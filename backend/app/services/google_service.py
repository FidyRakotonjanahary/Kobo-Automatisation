import json
import logging
import os
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from app.core.exceptions import GoogleAuthError, GooglePermissionError, GoogleQuotaError

logger = logging.getLogger("google_service")


class GoogleService:
    def __init__(self):
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

        try:
            self.drive = build("drive", "v3", credentials=creds)
            self.sheets = build("sheets", "v4", credentials=creds)
        except Exception as e:
            raise GoogleAuthError(detail=str(e))

    def _handle_google_error(self, e: HttpError):
        status = e.resp.status
        reason = str(e)
        logger.error(f"Google API Error {status}: {reason}")

        if status == 401:
            raise GoogleAuthError(detail=reason)
        if status == 403:
            if "quota" in reason.lower() or "limit" in reason.lower():
                raise GoogleQuotaError(detail=reason)
            raise GooglePermissionError(detail=reason)
        if status == 404:
            raise Exception("Dossier ou fichier Drive introuvable.")
        raise Exception(f"Erreur Google Drive ({status}): {reason}")

    def upload_file(
        self, local_path: str, folder_id: str, display_name: str, convert: bool = False
    ) -> str:
        try:
            file_metadata = {"name": display_name, "parents": [folder_id]}
            if convert:
                file_metadata["mimeType"] = "application/vnd.google-apps.spreadsheet"
            media = MediaFileUpload(local_path, resumable=True)
            file = (
                self.drive.files()
                .create(
                    body=file_metadata,
                    media_body=media,
                    fields="id,webViewLink",
                    supportsAllDrives=True,
                )
                .execute()
            )
            try:
                self.drive.permissions().create(
                    fileId=file["id"], body={"type": "anyone", "role": "writer"}
                ).execute()
            except Exception:
                pass
            return file["webViewLink"]
        except HttpError as e:
            self._handle_google_error(e)

    def create_folder(self, name: str, parent_id: Optional[str] = None) -> str:
        try:
            file_metadata = {
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
            }
            if parent_id:
                file_metadata["parents"] = [parent_id]
            file = (
                self.drive.files()
                .create(body=file_metadata, fields="id", supportsAllDrives=True)
                .execute()
            )
            return file.get("id")
        except HttpError as e:
            self._handle_google_error(e)

    def get_sheet_data(self, spreadsheet_id: str, range_name: str):
        try:
            result = (
                self.sheets.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=range_name)
                .execute()
            )
            return result.get("values", [])
        except HttpError as e:
            self._handle_google_error(e)

    def update_cell(self, spreadsheet_id: str, range_name: str, value: str):
        try:
            body = {"values": [[value]]}
            self.sheets.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption="RAW",
                body=body,
            ).execute()
        except HttpError as e:
            self._handle_google_error(e)
