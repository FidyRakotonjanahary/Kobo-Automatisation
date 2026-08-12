"""
GoogleService - Client Google Drive/Sheets 100% async (httpx).

Pourquoi httpx au lieu de requests/AuthorizedSession ?
- requests est synchrone : il doit être appelé via asyncio.to_thread()
- asyncio.to_thread() crée des threads qui partagent le contexte OpenSSL de Python
- Sur Windows, ce partage provoque des corruptions SSL (WRONG_VERSION_NUMBER, etc.)
- httpx est natif async : toutes les connexions SSL s'exécutent dans l'event loop,
  sans jamais toucher à un thread différent.
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


def _load_creds_data() -> dict:
    """Lit le fichier token.json et retourne son contenu."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(os.path.dirname(current_dir))
    token_file = os.path.join(backend_dir, "token.json")
    if not os.path.exists(token_file):
        raise GoogleAuthError(detail="token.json introuvable.")
    with open(token_file, "r") as f:
        return json.load(f), token_file


class GoogleService:
    """
    Client Google Drive/Sheets entièrement asynchrone basé sur httpx.
    Chaque méthode est un coroutine (async def) — aucun thread n'est utilisé.
    """

    def __init__(self):
        print("--- INITIALISATION GOOGLE SERVICE (httpx async) ---", file=sys.stderr)
        self._data, self._token_file = _load_creds_data()
        self._access_token: Optional[str] = self._data.get("token")
        self._refresh_token: str = self._data.get("refresh_token", "")
        self._client_id: str = self._data.get("client_id", "")
        self._client_secret: str = self._data.get("client_secret", "")
        self._token_expiry: float = 0.0  # Toujours refresher au premier appel

    # ───────────────────────── Auth helpers ────────────────────────────────

    async def _ensure_token(self, client: httpx.AsyncClient) -> str:
        """Retourne (et rafraichit si nécessaire) l'access token."""
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
        self._token_expiry = time.time() + payload.get("expires_in", 3600)

        # Persister le nouveau token
        self._data["token"] = self._access_token
        with open(self._token_file, "w") as f:
            json.dump(self._data, f)

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
