import json
import logging
import os
import sys
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

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

        try:
            self.drive = build("drive", "v3", credentials=creds)
            self.sheets = build("sheets", "v4", credentials=creds)
        except Exception as e:
            raise GoogleAuthError(detail=str(e))

    def _handle_google_error(self, e: HttpError):
        import sys
        status = e.resp.status
        reason = str(e)
        details = e.content.decode('utf-8')
        print(f"!!! GOOGLE API ERROR {status} !!!", file=sys.stderr)
        print(f"Reason: {reason}", file=sys.stderr)
        print(f"Details: {details}", file=sys.stderr)
        sys.stderr.flush()
        
        # On log aussi pour la postérité
        logger.error(f"!!! GOOGLE API ERROR {status} !!!")
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
            raise Exception(f"Dossier ou fichier Drive introuvable (404). Vérifiez l'ID : {spreadsheet_id if 'spreadsheet_id' in locals() else 'inconnu'}")
        raise Exception(f"Erreur Google API ({status}): {reason}")

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
