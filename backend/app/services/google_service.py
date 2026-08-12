import json
import logging
import os
import sys
import threading
import time
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.transport.requests import AuthorizedSession

from app.core.exceptions import GoogleAuthError, GooglePermissionError, GoogleQuotaError

logger = logging.getLogger("google_service")


class GoogleService:
    def __init__(self):
        print("--- INITIALISATION GOOGLE SERVICE ---", file=sys.stderr)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(current_dir))
        TOKEN_FILE = os.path.join(backend_dir, "token.json")

        creds = None
        if os.path.exists(TOKEN_FILE):
            from google.auth.transport.requests import Request as GoogleRequest
            from google.oauth2.credentials import Credentials

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
        self.session = AuthorizedSession(self.creds)
        
        try:
            self._drive_service = build("drive", "v3", credentials=self.creds, cache_discovery=False)
            self._sheets_service = build("sheets", "v4", credentials=self.creds, cache_discovery=False)
        except Exception as e:
            raise GoogleAuthError(detail=str(e))

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
            raise GooglePermissionError(detail=f"Erreur 403 (Forbidden): {reason} - Vérifiez que le compte a bien accès au fichier.")
        if status == 400:
            if "office file" in details.lower() or "office file" in reason.lower():
                raise Exception("Accès refusé : Le fichier est au format Excel (.xlsx). Veuillez l'ouvrir dans Google Drive et faire 'Fichier > Enregistrer au format Google Sheets' pour pouvoir l'utiliser.")
            raise Exception(f"Erreur 400 (Bad Request): {reason} - Vérifiez les paramètres (ID du fichier, nom de l'onglet).")
        if status == 404:
            raise Exception(f"Dossier ou fichier Drive introuvable (404).")
        raise Exception(f"Erreur Google API ({status}): {reason}")

    def upload_file(
        self, local_path: str, folder_id: str, display_name: str, convert: bool = False
    ) -> str:
        import mimetypes
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                metadata = {
                    "name": display_name,
                    "parents": [folder_id]
                }
                if convert:
                    metadata["mimeType"] = "application/vnd.google-apps.spreadsheet"
                
                content_type, _ = mimetypes.guess_type(local_path)
                if not content_type:
                    content_type = "application/octet-stream"

                with open(local_path, "rb") as f:
                    file_data = f.read()

                boundary = "foo_bar_baz"
                metadata_part = (
                    f"--{boundary}\r\n"
                    "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                    f"{json.dumps(metadata)}\r\n"
                )
                file_part_header = (
                    f"--{boundary}\r\n"
                    f"Content-Type: {content_type}\r\n\r\n"
                )
                
                body = metadata_part.encode('utf-8') + file_part_header.encode('utf-8') + file_data + f"\r\n--{boundary}--".encode('utf-8')
                
                headers = {
                    "Content-Type": f"multipart/related; boundary={boundary}",
                    "Content-Length": str(len(body))
                }
                
                url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink"
                res = self.session.post(url, data=body, headers=headers)
                if res.status_code != 200:
                    self._handle_request_error(res)
                
                res_data = res.json()
                file_id = res_data.get("id")
                
                # permissions
                perm_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions"
                perm_body = {"type": "anyone", "role": "writer"}
                try:
                    p_res = self.session.post(perm_url, json=perm_body)
                    p_res.raise_for_status()
                except Exception:
                    pass
                
                return res_data.get("webViewLink") or (
                    f"https://docs.google.com/spreadsheets/d/{file_id}/edit" if convert
                    else f"https://drive.google.com/file/d/{file_id}/view"
                )
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Réessai upload Drive ({attempt + 1}/{max_retries}) suite à : {e}")
                    time.sleep(1)
                else:
                    raise e

    def create_folder(self, name: str, parent_id: Optional[str] = None) -> str:
        url = "https://www.googleapis.com/drive/v3/files"
        body = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder"
        }
        if parent_id:
            body["parents"] = [parent_id]
        res = self.session.post(url, json=body)
        if res.status_code != 200:
            self._handle_request_error(res)
        return res.json().get("id")

    def get_sheet_data(self, spreadsheet_id: str, range_name: str):
        import urllib.parse
        encoded_range = urllib.parse.quote(range_name)
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{encoded_range}"
        res = self.session.get(url)
        if res.status_code != 200:
            self._handle_request_error(res)
        return res.json().get("values", [])

    def update_cell(self, spreadsheet_id: str, range_name: str, value: str):
        import urllib.parse
        encoded_range = urllib.parse.quote(range_name)
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{encoded_range}?valueInputOption=RAW"
        body = {"values": [[value]]}
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                res = self.session.put(url, json=body)
                if res.status_code != 200:
                    self._handle_request_error(res)
                return
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Réessai update_cell ({attempt + 1}/{max_retries}) suite à : {e}")
                    time.sleep(1)
                else:
                    raise e
