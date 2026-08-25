import os
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.export import (
    ExportRequest,
    ExportResult,
    PreviewSitesResult,
)
from app.core.task_monitor import task_monitor
from app.services.export_service import ExportService

router = APIRouter()


@router.post("/run", response_model=ExportResult)
async def run_export(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    service = ExportService(db)
    return await service.run_export(req)


@router.post("/cancel")
async def cancel_export(task_id: str):
    task_monitor.cancel_task(task_id)
    return {"status": "request_sent"}


@router.post("/preview-sites", response_model=PreviewSitesResult)
async def preview_sites(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    service = ExportService(db)
    return await service.preview_sites(req)


@router.get("/download")
async def download_export_file(path: str):
    """
    Télécharge directement un fichier exporté depuis le serveur.
    Le paramètre `path` est encodé en URL (urllib.parse.quote).
    Seuls les fichiers dans le répertoire Exports_Kobo sont autorisés.
    """
    try:
        decoded_path = urllib.parse.unquote(path)
    except Exception:
        raise HTTPException(status_code=400, detail="Chemin invalide.")

    # Sécurité : on s'assure que le fichier se trouve bien dans le répertoire d'exports autorisé
    root_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "Exports_Kobo")
    )
    abs_path = os.path.abspath(decoded_path)

    if not abs_path.startswith(root_dir):
        raise HTTPException(status_code=403, detail="Accès interdit.")

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur.")

    filename = os.path.basename(abs_path)
    return FileResponse(
        path=abs_path,
        filename=filename,
        media_type="application/octet-stream",
    )
