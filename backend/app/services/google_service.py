"""
GoogleService - Client Google Drive/Sheets 100% async (httpx).
Supporte la persistance du token OAuth2 en base de données (PostgreSQL / SQLite)
avec fallback transparent sur le fichier token.json pour le développement local.
"""
import json
import logging
import os
import sys
import time
from typing import Optional

import httpx

from app.core.exceptions import GoogleAuthError, GooglePermissionError, GoogleQuotaError

logger = logging.getLogger("google_service")

TOKEN_URL = "https://oauth2.googleapis.com/token"


class GoogleService:
    """
    Client Google Drive/Sheets entièrement asynchrone basé sur httpx.
    Chaque méthode est une coroutine (async def) — aucun thread ni boucle bloquante n'est utilisé.
    """

    def __init__(self):
        self._data: Optional[dict] = None
        self._token_file: Optional[str] = None
        self._access_token: Optional[str] = None
        self._refresh_token: str = ""
        self._client_id: str = ""
        self._client_secret: str = ""
        self._token_expiry: float = 0.0  # Toujours refresher au premier appel

        # Tentative immédiate non-bloquante de lecture fichier local si disponible
        self._try_load_local_token_file()

    def _try_load_local_token_file(self) -> None:
        """Lecture non bloquante du token.json si présent en local."""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            backend_dir = os.path.dirname(os.path.dirname(current_dir))
            token_file = os.path.join(backend_dir, "token.json")
            if os.path.exists(token_file):
                with open(token_file, "r") as f:
                    data = json.load(f)
                    if data and data.get("refresh_token"):
                        self._data = data
                        self._token_file = token_file
                        self._access_token = data.get("token")
                        self._refresh_token = data.get("refresh_token", "")
                        self._client_id = data.get("client_id", "")
                        self._client_secret = data.get("client_secret", "")
        except Exception as e:
            logger.debug(f"Fichier token local non chargé : {e}")

    async def _load_creds_async(self) -> None:
        """
        Charge les identifiants OAuth Google :
        1. Depuis la base de données (table google_tokens) via session asynchrone
        2. Fallback depuis token.json si existant (développement local)
        """
        # 1. Tentative depuis la base de données
        try:
            from app.database.session import AsyncSessionLocal
            from app.repositories.google_token_repository import GoogleTokenRepository

            async with AsyncSessionLocal() as session:
                repo = GoogleTokenRepository(session)
                token_data = await repo.get_token_data()
                if token_data and token_data.get("refresh_token"):
                    self._data = token_data
                    self._token_file = None
                    self._access_token = token_data.get("token")
                    self._refresh_token = token_data.get("refresh_token", "")
                    self._client_id = token_data.get("client_id", "")
                    self._client_secret = token_data.get("client_secret", "")
                    return
        except Exception as e:
            logger.debug(f"Impossible de charger le token depuis la DB ({e}), essai fallback fichier...")

        # 2. Fallback token.json (local dev)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(current_dir))
        token_file = os.path.join(backend_dir, "token.json")
        if os.path.exists(token_file):
            try:
                with open(token_file, "r") as f:
                    data = json.load(f)
                    if data and data.get("refresh_token"):
                        self._data = data
                        self._token_file = token_file
                        self._access_token = data.get("token")
                        self._refresh_token = data.get("refresh_token", "")
                        self._client_id = data.get("client_id", "")
                        self._client_secret = data.get("client_secret", "")
                        return
            except Exception as err:
                logger.debug(f"Erreur lecture fallback token.json : {err}")

        raise GoogleAuthError(detail="Token Google introuvable en base de données et token.json absent. Veuillez vous connecter avec Google.")

    # ───────────────────────── Auth helpers ────────────────────────────────

    async def _ensure_token(self, client: httpx.AsyncClient) -> str:
        """Retourne (et rafraîchit si nécessaire) l'access token de façon 100% asynchrone."""
        if not self._refresh_token:
            await self._load_creds_async()

        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token

        # Refresh
        logger.info("Rafraîchissement du token Google...")
        res = await client.post(
            TOKEN_URL,
            data={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "refresh_token": self._refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
        if res.status_code != 200:
            raise GoogleAuthError(detail=f"Impossible de rafraîchir le token: {res.text}")

        payload = res.json()
        self._access_token = payload["access_token"]
        expires_in = payload.get("expires_in", 3600)
        self._token_expiry = time.time() + expires_in

        # Persister le nouveau token en base de données
        try:
            from app.database.session import AsyncSessionLocal
            from app.repositories.google_token_repository import GoogleTokenRepository
            from datetime import datetime, timedelta

            expiry_dt = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
            async with AsyncSessionLocal() as session:
                repo = GoogleTokenRepository(session)
                await repo.update_access_token(self._access_token, expiry_dt)
        except Exception as err:
            logger.warning(f"Impossible de persister le token rafraîchi en base : {err}")

        # Fallback écriture fichier si token_file était utilisé
        if self._token_file and os.path.exists(self._token_file):
            try:
                if self._data:
                    self._data["token"] = self._access_token
                    with open(self._token_file, "w") as f:
                        json.dump(self._data, f)
            except Exception:
                pass

        return self._access_token

    def _client(self) -> httpx.AsyncClient:
        """Crée un client httpx avec les bons paramètres."""
        return httpx.AsyncClient(
            timeout=httpx.Timeout(90.0, connect=15.0),
            follow_redirects=True,
        )

    def _auth_headers(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def _handle_error(self, res: httpx.Response) -> None:
        status = res.status_code
        try:
            data = res.json()
            reason = data.get("error", {}).get("message", str(res.text[:200]))
        except Exception:
            reason = str(res.text[:200])

        logger.error(f"GOOGLE HTTP {status}: {reason}")

        if status == 401:
            self._token_expiry = 0.0  # Forcer le refresh
            raise GoogleAuthError(detail=reason)
        if status == 403:
            if "quota" in reason.lower() or "limit" in reason.lower():
                raise GoogleQuotaError(detail=reason)
            raise GooglePermissionError(detail=f"403 Forbidden: {reason}")
        if status == 400:
            raise Exception(f"400 Bad Request: {reason}")
        if status == 404:
            raise Exception("404 Not Found: Dossier ou fichier Drive introuvable.")
        raise Exception(f"Erreur Google API ({status}): {reason}")

    # ───────────────────────── Drive ───────────────────────────────────────

    async def upload_file(
        self, local_path: str, folder_id: str, display_name: str, convert: bool = False
    ) -> str:
        """Upload un fichier local vers Google Drive. Retourne le lien webView."""
        import mimetypes

        content_type, _ = mimetypes.guess_type(local_path)
        if not content_type:
            content_type = "application/octet-stream"

        with open(local_path, "rb") as f:
            file_data = f.read()

        metadata = {"name": display_name, "parents": [folder_id]}
        if convert:
            metadata["mimeType"] = "application/vnd.google-apps.spreadsheet"

        boundary = "kobo_gc_boundary"
        body = (
            f"--{boundary}\r\n"
            "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(metadata)}\r\n"
            f"--{boundary}\r\n"
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode() + file_data + f"\r\n--{boundary}--".encode()

        url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink"

        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with self._client() as client:
                    token = await self._ensure_token(client)
                    headers = {
                        **self._auth_headers(token),
                        "Content-Type": f"multipart/related; boundary={boundary}",
                    }
                    res = await client.post(url, content=body, headers=headers)

                if res.status_code not in (200, 201):
                    self._handle_error(res)

                data = res.json()
                file_id = data.get("id")

                # Permissions (best-effort)
                try:
                    async with self._client() as client:
                        token = await self._ensure_token(client)
                        await client.post(
                            f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions",
                            headers=self._auth_headers(token),
                            json={"type": "anyone", "role": "writer"},
                        )
                except Exception:
                    pass

                return data.get("webViewLink") or (
                    f"https://docs.google.com/spreadsheets/d/{file_id}/edit"
                    if convert
                    else f"https://drive.google.com/file/d/{file_id}/view"
                )

            except (GoogleAuthError, GooglePermissionError, GoogleQuotaError):
                raise
            except Exception as e:
                wait = 2 ** (attempt + 1)
                if attempt < max_retries - 1:
                    logger.warning(f"Retry upload ({attempt+1}/{max_retries}) in {wait}s: {e}")
                    import asyncio
                    await asyncio.sleep(wait)
                else:
                    raise

    async def create_folder(self, name: str, parent_id: Optional[str] = None) -> str:
        body = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
        if parent_id:
            body["parents"] = [parent_id]

        async with self._client() as client:
            token = await self._ensure_token(client)
            res = await client.post(
                "https://www.googleapis.com/drive/v3/files",
                headers=self._auth_headers(token),
                json=body,
            )

        if res.status_code not in (200, 201):
            self._handle_error(res)
        return res.json().get("id")

    # ───────────────────────── Sheets ──────────────────────────────────────

    async def get_sheet_data(self, spreadsheet_id: str, range_name: str):
        import urllib.parse
        encoded = urllib.parse.quote(range_name)
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{encoded}"

        async with self._client() as client:
            token = await self._ensure_token(client)
            res = await client.get(url, headers=self._auth_headers(token))

        if res.status_code != 200:
            self._handle_error(res)
        return res.json().get("values", [])

    async def update_cell(self, spreadsheet_id: str, range_name: str, value: str):
        import urllib.parse
        encoded = urllib.parse.quote(range_name)
        url = (
            f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
            f"/values/{encoded}?valueInputOption=RAW"
        )

        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with self._client() as client:
                    token = await self._ensure_token(client)
                    res = await client.put(
                        url,
                        headers=self._auth_headers(token),
                        json={"values": [[value]]},
                    )
                if res.status_code != 200:
                    self._handle_error(res)
                return
            except (GoogleAuthError, GooglePermissionError, GoogleQuotaError):
                raise
            except Exception as e:
                wait = 2 ** (attempt + 1)
                if attempt < max_retries - 1:
                    logger.warning(f"Retry update_cell ({attempt+1}/{max_retries}) in {wait}s: {e}")
                    import asyncio
                    await asyncio.sleep(wait)
                else:
                    raise
