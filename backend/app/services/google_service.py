import json
import logging
import os
import sys
import threading
import time
from typing import Optional

from googleapiclient.discovery import build
from google.auth.transport.requests import AuthorizedSession
from google.oauth2.credentials import Credentials
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from app.core.exceptions import GoogleAuthError, GooglePermissionError, GoogleQuotaError

logger = logging.getLogger("google_service")

# Stockage thread-local : chaque thread du pool d'asyncio aura sa propre session HTTP
_thread_local = threading.local()


def _build_session(creds: Credentials) -> AuthorizedSession:
    """Crée une AuthorizedSession avec retry et timeout pour un thread donné."""
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(
        pool_connections=1,   # 1 pool par thread-session
        pool_maxsize=4,
        max_retries=retry_strategy,
    )
    session = AuthorizedSession(creds)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


class GoogleService:
    def __init__(self):
        print("--- INITIALISATION GOOGLE SERVICE ---", file=sys.stderr)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(current_dir))
        TOKEN_FILE = os.path.join(backend_dir, "token.json")

        creds = None
        if os.path.exists(TOKEN_FILE):
            from google.auth.transport.requests import Request as GoogleRequest

            try:
                with open(TOKEN_FILE, "r") as f:
                    data = json.load(f)
                    creds = Credentials(
                        token=data.get("token"),
                        refresh_token=data.get("refresh_token"),
                        token_uri=data.get("token_uri"),
                        client_id=data.get("client_id"),
                        client_secret=data.get("client_secret"),
                        scopes=data.get("scopes"),
                    )

                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(GoogleRequest())
                    data["token"] = creds.token
                    with open(TOKEN_FILE, "w") as f:
                        json.dump(data, f)
            except Exception as e:
                logger.error(f"Erreur refresh token: {e}")
                creds = None

        if not creds:
            raise GoogleAuthError(detail="Token manquant ou invalide.")

        self.creds = creds

        try:
            self._drive_service = build("drive", "v3", credentials=self.creds, cache_discovery=False)
            self._sheets_service = build("sheets", "v4", credentials=self.creds, cache_discovery=False)
        except Exception as e:
            raise GoogleAuthError(detail=str(e))

    def _get_session(self) -> AuthorizedSession:
        """Retourne la session HTTP propre au thread courant (créée si absente)."""
        if not hasattr(_thread_local, "session") or _thread_local.session is None:
            _thread_local.session = _build_session(self.creds)
        return _thread_local.session

    @property
    def drive(self):
        return self._drive_service

    @property
    def sheets(self):
        return self._sheets_service

    def _handle_request_error(self, res):
        status = res.status_code
        try:
            details = res.text
            data = res.json()
            reason = data.get("error", {}).get("message", res.reason)
        except Exception:
            reason = res.reason
            details = res.text

        logger.error(f"!!! GOOGLE HTTP ERROR {status} !!!")
        logger.error(f"Reason: {reason}")
        logger.error(f"Details: {details}")

        if status == 401:
            raise GoogleAuthError(detail=reason)
        if status == 403:
            if "quota" in reason.lower() or "limit" in reason.lower():
                raise GoogleQuotaError(detail=reason)
            raise GooglePermissionError(
                detail=f"Erreur 403 (Forbidden): {reason} - Vérifiez que le compte a bien accès au fichier."
            )
        if status == 400:
            if "office file" in details.lower() or "office file" in reason.lower():
                raise Exception(
                    "Accès refusé : Le fichier est au format Excel (.xlsx). "
                    "Veuillez l'ouvrir dans Google Drive et faire 'Fichier > Enregistrer au format Google Sheets'."
                )
            raise Exception(
                f"Erreur 400 (Bad Request): {reason} - Vérifiez les paramètres (ID du fichier, nom de l'onglet)."
            )
        if status == 404:
            raise Exception("Dossier ou fichier Drive introuvable (404).")
        raise Exception(f"Erreur Google API ({status}): {reason}")

    def upload_file(
        self, local_path: str, folder_id: str, display_name: str, convert: bool = False
    ) -> str:
        import mimetypes

        max_retries = 3
        for attempt in range(max_retries):
            try:
                session = self._get_session()

                metadata = {"name": display_name, "parents": [folder_id]}
                if convert:
                    metadata["mimeType"] = "application/vnd.google-apps.spreadsheet"

                content_type, _ = mimetypes.guess_type(local_path)
                if not content_type:
                    content_type = "application/octet-stream"

                with open(local_path, "rb") as f:
                    file_data = f.read()

                boundary = "kobo_boundary_xyz"
                body = (
                    f"--{boundary}\r\n"
                    "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                    f"{json.dumps(metadata)}\r\n"
                    f"--{boundary}\r\n"
                    f"Content-Type: {content_type}\r\n\r\n"
                ).encode("utf-8") + file_data + f"\r\n--{boundary}--".encode("utf-8")

                headers = {
                    "Content-Type": f"multipart/related; boundary={boundary}",
                    "Content-Length": str(len(body)),
                }

                url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink"
                res = session.post(url, data=body, headers=headers, timeout=90)
                if res.status_code not in (200, 201):
                    self._handle_request_error(res)

                res_data = res.json()
                file_id = res_data.get("id")

                # Rendre le fichier accessible
                try:
                    perm_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions"
                    session.post(perm_url, json={"type": "anyone", "role": "writer"}, timeout=30)
                except Exception:
                    pass

                return res_data.get("webViewLink") or (
                    f"https://docs.google.com/spreadsheets/d/{file_id}/edit"
                    if convert
                    else f"https://drive.google.com/file/d/{file_id}/view"
                )

            except Exception as e:
                wait_time = 2 ** (attempt + 1)  # backoff exponentiel : 2s, 4s, 8s
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Réessai upload Drive ({attempt + 1}/{max_retries}) dans {wait_time}s — {type(e).__name__}: {e}"
                    )
                    # Invalider la session du thread pour forcer la recréation d'un socket propre
                    _thread_local.session = None
                    time.sleep(wait_time)
                else:
                    raise e

    def create_folder(self, name: str, parent_id: Optional[str] = None) -> str:
        session = self._get_session()
        body = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
        if parent_id:
            body["parents"] = [parent_id]
        res = session.post(
            "https://www.googleapis.com/drive/v3/files", json=body, timeout=60
        )
        if res.status_code not in (200, 201):
            self._handle_request_error(res)
        return res.json().get("id")

    def get_sheet_data(self, spreadsheet_id: str, range_name: str):
        import urllib.parse

        encoded_range = urllib.parse.quote(range_name)
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{encoded_range}"
        session = self._get_session()
        res = session.get(url, timeout=60)
        if res.status_code != 200:
            self._handle_request_error(res)
        return res.json().get("values", [])

    def update_cell(self, spreadsheet_id: str, range_name: str, value: str):
        import urllib.parse

        encoded_range = urllib.parse.quote(range_name)
        url = (
            f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
            f"/values/{encoded_range}?valueInputOption=RAW"
        )
        body = {"values": [[value]]}

        max_retries = 3
        for attempt in range(max_retries):
            try:
                session = self._get_session()
                res = session.put(url, json=body, timeout=60)
                if res.status_code != 200:
                    self._handle_request_error(res)
                return
            except Exception as e:
                wait_time = 2 ** (attempt + 1)
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Réessai update_cell ({attempt + 1}/{max_retries}) dans {wait_time}s — {type(e).__name__}: {e}"
                    )
                    _thread_local.session = None
                    time.sleep(wait_time)
                else:
                    raise e

