from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.export import (
    ExportRequest,
    ExportResult,
    OpenFileRequest,
    OpenFileResult,
    PreviewResult,
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


@router.post("/preview", response_model=PreviewResult)
async def preview_csv(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    service = ExportService(db)
    return await service.preview_export(req)


@router.post("/preview-sites", response_model=PreviewSitesResult)
async def preview_sites(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    service = ExportService(db)
    return await service.preview_sites(req)


@router.post("/open", response_model=OpenFileResult)
async def open_file(req: OpenFileRequest):
    return ExportService.open_export_path(req.path)
