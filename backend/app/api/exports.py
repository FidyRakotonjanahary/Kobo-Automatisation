import os
import logging
import io
import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.repositories.credential_repository import CredentialRepository
from app.services.kobo_service import KoboService
from app.services.export_engine import ExportEngine
from app.utils.text_encoding import repair_dataframe_columns
from pydantic import BaseModel, field_validator
from typing import List, Optional
from app.core.exceptions import AppException

router = APIRouter()
logger = logging.getLogger("exports_api")

class AccountFormPair(BaseModel):
    account_id: int
    form_uid: str

class ExportRequest(BaseModel):
    account_forms: List[AccountFormPair]
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

    @field_validator("drive_folder_id")
    @classmethod
    def extract_drive_id(cls, v):
        if v and "/folders/" in v:
            import re
            match = re.search(r"/folders/([a-zA-Z0-9-_]+)", v)
            return match.group(1) if match else v
        return v

def resolve_csv_encoding(separator: str, encoding: str) -> str:
    normalized = (encoding or "utf-8-sig").lower().replace("_", "-")
    if separator == ";" and normalized == "utf-8":
        return "utf-8-sig"
    return encoding or "utf-8-sig"

@router.post("/run")
async def run_export(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    cred_uid_pairs = []
    for af in req.account_forms:
        acc = await repo.get_account(af.account_id)
        if acc: cred_uid_pairs.append((acc, af.form_uid))

    if not cred_uid_pairs:
        raise AppException("Aucun compte Kobo valide trouvé.", 404)

    try:
        engine = ExportEngine()
        csv_params = {
            "sep": req.csv_separator,
            "encoding": resolve_csv_encoding(req.csv_separator, req.csv_encoding),
            "quotechar": req.csv_quotechar
        }

        if len(cred_uid_pairs) == 1:
            cred, uid = cred_uid_pairs[0]
            excel_data = await KoboService.fetch_export_file(cred, uid)
            files = engine.run_pipeline_from_bytes(
                excel_content=excel_data,
                form_name=req.form_name,
                pivot_column=req.pivot_column or "",
                selected_columns=req.selected_columns,
                filter_sites=req.filter_sites,
                selected_sheets=req.selected_sheets,
                export_format=req.export_format,
                csv_params=csv_params
            )
        else:
            merged_dfs = await KoboService.fetch_and_merge_exports_multi(cred_uid_pairs)
            files = engine.run_pipeline_from_dfs(
                merged_dfs=merged_dfs,
                form_name=req.form_name,
                pivot_column=req.pivot_column or "",
                selected_columns=req.selected_columns,
                filter_sites=req.filter_sites,
                selected_sheets=req.selected_sheets,
                export_format=req.export_format,
                csv_params=csv_params
            )

        drive_count = 0
        if req.drive_folder_id:
            from app.services.google_service import GoogleService
            google = GoogleService()
            for f in files:
                try:
                    file_name = os.path.basename(f["path"])
                    google.upload_file(
                        local_path=f["path"],
                        folder_id=req.drive_folder_id,
                        display_name=file_name.replace(".xlsx", "").replace(".csv", ""),
                        convert=(req.export_format == "xlsx")
                    )
                    drive_count += 1
                except Exception as e:
                    logger.error(f"Erreur upload Drive pour {f['site']}: {e}")

        total_rows = sum(f.get("rows", 0) for f in files)
        return {
            "status": "success",
            "message": f"Export terminé : {len(files)} fichiers ({total_rows} lignes).",
            "files": files,
            "drive_success": drive_count
        }
    except Exception as e:
        logger.error(f"Frayeur export: {e}")
        raise AppException(str(e), 500)

@router.post("/preview")
async def preview_csv(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    cred_uid_pairs = []
    for af in req.account_forms:
        acc = await repo.get_account(af.account_id)
        if acc: cred_uid_pairs.append((acc, af.form_uid))
    
    if not cred_uid_pairs:
        raise AppException("Comptes invalides.", 404)

    try:
        if len(cred_uid_pairs) == 1:
            cred, uid = cred_uid_pairs[0]
            excel_bytes = await KoboService.fetch_export_file(cred, uid)
            dfs = pd.read_excel(io.BytesIO(excel_bytes), sheet_name=None)
        else:
            dfs = await KoboService.fetch_and_merge_exports_multi(cred_uid_pairs)

        sheet_names = list(dfs.keys())
        if not sheet_names:
            raise ValueError("Le fichier source est vide.")
        sheet_name = sheet_names[0]
        if req.selected_sheets:
            sheet_name = next((name for name in req.selected_sheets if name in dfs), sheet_name)

        df = dfs[sheet_name]
        df = repair_dataframe_columns(df)
        preview_df = df.head(5)
        buffer = io.StringIO()
        preview_df.to_csv(
            buffer, 
            index=False, 
            sep=req.csv_separator, 
            encoding=resolve_csv_encoding(req.csv_separator, req.csv_encoding),
            quotechar=req.csv_quotechar,
            lineterminator="\r\n"
        )
        return {"preview": buffer.getvalue()}
    except Exception as e:
        raise AppException(f"Erreur aperçu: {str(e)}", 500)

@router.post("/preview-sites")
async def preview_sites(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    cred_uid_pairs = []
    for af in req.account_forms:
        acc = await repo.get_account(af.account_id)
        if acc: cred_uid_pairs.append((acc, af.form_uid))
    
    if not cred_uid_pairs:
        raise AppException("Comptes invalides.", 404)

    try:
        merged_dfs = await KoboService.fetch_and_merge_exports_multi(cred_uid_pairs)
        sheets = list(merged_dfs.keys())
        main_df = list(merged_dfs.values())[0]
        columns = [str(column) for column in main_df.columns]
        sites = []
        if req.pivot_column:
            from app.utils.normalizer import TextNormalizer
            if req.pivot_column in main_df.columns:
                unique_vals = main_df[req.pivot_column].dropna().unique()
                sites = sorted([TextNormalizer.normalize(str(v)) for v in unique_vals])
        return {"sites": sites, "sheets": sheets, "columns": columns}
    except Exception as e:
        logger.error(f"Erreur preview-sites: {e}")
        raise AppException(f"Erreur détection sites: {str(e)}", 500)

@router.post("/open")
async def open_file(req: dict):
    path = req.get("path")
    if path and os.path.exists(path):
        os.startfile(os.path.dirname(path))
        return {"status": "success"}
    return {"status": "error"}
