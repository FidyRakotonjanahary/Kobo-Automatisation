import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AccountFormPair(BaseModel):
    account_id: int = Field(..., gt=0, description="ID du compte Kobo a utiliser")
    form_uid: str = Field(..., min_length=1, description="UID du formulaire Kobo")


class ExportRequest(BaseModel):
    account_forms: List[AccountFormPair] = Field(..., min_length=1)
    form_name: str
    pivot_column: Optional[str] = None
    selected_columns: Optional[List[str]] = None
    selected_sheets: Optional[List[str]] = None
    filter_sites: Optional[List[str]] = None
    drive_folder_id: Optional[str] = None
    export_format: str = "xlsx"
    csv_separator: str = ";"
    csv_encoding: str = "utf-8-sig"
    csv_quotechar: str = '"'
    task_id: Optional[str] = None

    @field_validator("drive_folder_id")
    @classmethod
    def extract_drive_id(cls, v: Optional[str]) -> Optional[str]:
        if v and "/folders/" in v:
            match = re.search(r"/folders/([a-zA-Z0-9-_]+)", v)
            return match.group(1) if match else v
        return v


class ExportFileResult(BaseModel):
    site: str
    path: str
    folder_path: str
    rows: int


class ExportResult(BaseModel):
    status: Literal["success"]
    message: str
    files: List[ExportFileResult]
    drive_success: int


class PreviewResult(BaseModel):
    preview: str


class PreviewSitesResult(BaseModel):
    sites: List[str]
    sheets: List[str]
    columns: List[str]


class OpenFileRequest(BaseModel):
    path: Optional[str] = None


class OpenFileResult(BaseModel):
    status: Literal["success", "error"]
