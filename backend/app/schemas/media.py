import re
from pydantic import BaseModel, field_validator
from typing import Dict, Any, Optional

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
    google_service_account: Optional[Dict[str, Any]] = None # Optionnel, utilise le défaut serveur si absent

    @field_validator("spreadsheet_id", "drive_folder_id")
    @classmethod
    def validate_ids(cls, v):
        return extract_google_id(v)
