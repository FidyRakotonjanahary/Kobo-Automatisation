import os
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from typing import List

from app.database.session import get_db
from app.schemas.export import (
    ExportHistoryItem,
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


@router.get("/history", response_model=List[ExportHistoryItem])
async def get_export_history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """
    Récupère l'historique persistant des exports enregistrés dans la base de données.
    """
    service = ExportService(db)
    return await service.get_export_history(limit=limit)


@router.delete("/history")
async def clear_export_history(db: AsyncSession = Depends(get_db)):
    """
    Efface l'historique des exports de la base de données.
    """
    service = ExportService(db)
    return await service.clear_export_history()


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
        raise HTTPException(
            status_code=404,
            detail="Le fichier n'est plus disponible sur le serveur local (le stockage temporaire a été réinitialisé). Utilisez le lien Google Drive si activé.",
        )

    filename = os.path.basename(abs_path)
    return FileResponse(
        path=abs_path,
        filename=filename,
        media_type="application/octet-stream",
    )

