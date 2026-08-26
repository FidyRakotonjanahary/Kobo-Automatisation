import re
from typing import Any, Dict, Optional

from pydantic import BaseModel, field_validator


def extract_google_id(value: str) -> str:
    """Extrait l'ID d'une URL Google Sheet ou Drive Folder si nécessaire."""
    if not value or not isinstance(value, str):
        return value

    # Cas Google Sheet
    if "spreadsheets/d/" in value:
        match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", value)
        if match:
            return match.group(1)

    # Cas Drive Folder
    if "/folders/" in value:
        match = re.search(r"/folders/([a-zA-Z0-9-_]+)", value)
        if match:
            return match.group(1)

    # Sinon on retire les espaces superflus
    return value.strip()


class MigrationRequest(BaseModel):
    spreadsheet_id: str
    sheet_name: Optional[str] = None
    drive_folder_id: str
    sheet_folder_mapping: Optional[Dict[str, str]] = None
    update_links: bool = True
    google_service_account: Optional[Dict[str, Any]] = (
        None  # Optionnel, utilise le défaut serveur si absent
    )

    @field_validator("spreadsheet_id", "drive_folder_id")
    @classmethod
    def validate_ids(cls, v):
        return extract_google_id(v)

    @field_validator("sheet_folder_mapping", mode="after")
    @classmethod
    def validate_mapping_ids(cls, v):
        if v:
            return {sheet: extract_google_id(fid) for sheet, fid in v.items()}
        return v


class FailedItem(BaseModel):
    sheet: str
    row: int
    col: str
    url: str
    reason: str


class MediaMigrationResult(BaseModel):
    success: int = 0
    failed: int = 0
    skipped_duplicates: int = 0
    failed_items: list[FailedItem] = []


class MediaMigrationProgress(BaseModel):
    current: int = 0
    total: int = 0
    percent: int = 0
    current_action: str = ""
    success: int = 0
    failed: int = 0


class MediaHistoryItem(BaseModel):
    id: int
    source_type: str = "google_sheet"
    source_name: str
    sheet_name: Optional[str] = None
    drive_folder_id: str
    total_items: int = 0
    success_count: int = 0
    failed_count: int = 0
    update_links: bool = True
    status: str = "success"
    failed_items: list[FailedItem] = []
    message: Optional[str] = ""
    created_at: str
    timestamp: str

