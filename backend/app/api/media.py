import json
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.database.session import get_db
from app.repositories.credential_repository import CredentialRepository
from app.schemas.media import MigrationRequest
from app.services.google_service import GoogleService
from app.services.media_engine import MediaEngine

logger = logging.getLogger("api_media")
router = APIRouter()

# Stockage temporaire de la progression (polling)
migration_status = {
    "logs": [],
    "is_running": False,
    "stop_requested": False,
    "progress": {
        "current": 0,
        "total": 0,
        "percent": 0,
        "current_action": "",
        "success": 0,
        "failed": 0,
    },
    "last_stats": None,
}


@router.get("/status")
async def get_migration_status():
    return migration_status


@router.get("/info")
async def get_media_info():
    return {"service_account_email": "Mode personnel (OAuth2) actif"}


@router.post("/stop")
async def stop_migration():
    global migration_status
    if migration_status["is_running"]:
        migration_status["stop_requested"] = True
        return {"status": "stopping"}
    return {"status": "not_running"}


@router.post("/migrate")
async def start_migration(req: MigrationRequest, db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    kobo_accs = await repo.get_accounts()

    if not kobo_accs:
        raise AppException("Aucun compte Kobo configuré.", 400)

    global migration_status
    migration_status["logs"] = []
    migration_status["is_running"] = True
    migration_status["stop_requested"] = False
    migration_status["progress"] = {
        "current": 0,
        "total": 0,
        "percent": 0,
        "current_action": "",
        "success": 0,
        "failed": 0,
    }

    try:
        google = GoogleService()
        engine = MediaEngine(google, kobo_accs)

        def on_prog(msg, current=None, total=None, current_action="", success=0, failed=0):
            migration_status["logs"].append(msg)
            if len(migration_status["logs"]) > 200:
                migration_status["logs"].pop(0)
            if current is not None and total is not None:
                pct = int((current / total) * 100) if total > 0 else 0
                migration_status["progress"] = {
                    "current": current,
                    "total": total,
                    "percent": min(pct, 100),
                    "current_action": current_action,
                    "success": success,
                    "failed": failed,
                }

        def check_stop():
            return migration_status["stop_requested"]

        stats = await engine.migrate_sheet(
            req.spreadsheet_id,
            req.sheet_name,
            req.drive_folder_id,
            sheet_folder_mapping=req.sheet_folder_mapping,
            on_progress=on_prog,
            check_stop=check_stop,
            update_links=req.update_links,
        )

        migration_status["last_stats"] = stats

        # ── Persister l'historique en base ──
        try:
            from app.repositories.media_repository import MediaRepository
            media_repo = MediaRepository(db)
            total_items = stats.get("success", 0) + stats.get("failed", 0)
            status_str = "partial" if stats.get("failed", 0) > 0 else "success"
            if migration_status["stop_requested"]:
                status_str = "stopped"
            dup = stats.get("skipped_duplicates", 0)
            await media_repo.save_migration_history(
                source_type="google_sheet",
                source_name=req.spreadsheet_id,
                sheet_name=req.sheet_name or None,
                drive_folder_id=req.drive_folder_id,
                total_items=total_items,
                success_count=stats.get("success", 0),
                failed_count=stats.get("failed", 0),
                update_links=req.update_links,
                status=status_str,
                failed_items=stats.get("failed_items", []),
                message=f"{dup} dédupliqué(s)" if dup else None,
            )
        except Exception as hist_err:
            logger.warning(f"Impossible de sauvegarder l'historique: {hist_err}")

        return {"status": "finished", "results": stats}

    except AppException as e:
        raise e
    except Exception as e:
        logger.error(f"Migration fatale : {e}")
        migration_status["logs"].append(f"❌ Erreur critique : {str(e)}")
        raise e
    finally:
        migration_status["is_running"] = False


@router.post("/migrate-excel")
async def start_migration_excel(
    file: UploadFile = File(...),
    drive_folder_id: str = Form(...),
    sheet_name: str = Form(""),
    sheet_folder_mapping: str = Form("{}"),
    update_links: bool = Form(True),
    db: AsyncSession = Depends(get_db),
):
    """
    Migration depuis un fichier Excel local.
    Retourne le fichier Excel modifié (liens Drive insérés) au téléchargement.
    """
    repo = CredentialRepository(db)
    kobo_accs = await repo.get_accounts()

    if not kobo_accs:
        raise AppException("Aucun compte Kobo configuré.", 400)

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise AppException("Le fichier doit être au format Excel (.xlsx ou .xls).", 400)

    try:
        mapping = json.loads(sheet_folder_mapping) if sheet_folder_mapping else {}
    except Exception:
        mapping = {}

    excel_bytes = await file.read()
    original_filename = file.filename

    global migration_status
    migration_status["logs"] = []
    migration_status["is_running"] = True
    migration_status["stop_requested"] = False
    migration_status["progress"] = {
        "current": 0,
        "total": 0,
        "percent": 0,
        "current_action": "",
        "success": 0,
        "failed": 0,
    }

    try:
        google = GoogleService()
        engine = MediaEngine(google, kobo_accs)

        def on_prog(msg, current=None, total=None, current_action="", success=0, failed=0):
            migration_status["logs"].append(msg)
            if len(migration_status["logs"]) > 200:
                migration_status["logs"].pop(0)
            if current is not None and total is not None:
                pct = int((current / total) * 100) if total > 0 else 0
                migration_status["progress"] = {
                    "current": current,
                    "total": total,
                    "percent": min(pct, 100),
                    "current_action": current_action,
                    "success": success,
                    "failed": failed,
                }

        def check_stop():
            return migration_status["stop_requested"]

        result_bytes, stats = await engine.migrate_excel_file(
            excel_bytes=excel_bytes,
            drive_folder_id=drive_folder_id,
            sheet_name=sheet_name or None,
            sheet_folder_mapping=mapping or None,
            on_progress=on_prog,
            check_stop=check_stop,
            update_links=update_links,
        )

        migration_status["last_stats"] = stats

        # ── Persister l'historique en base ──
        try:
            from app.repositories.media_repository import MediaRepository
            media_repo = MediaRepository(db)
            total_items = stats.get("success", 0) + stats.get("failed", 0)
            status_str = "partial" if stats.get("failed", 0) > 0 else "success"
            if migration_status["stop_requested"]:
                status_str = "stopped"
            dup = stats.get("skipped_duplicates", 0)
            await media_repo.save_migration_history(
                source_type="excel_local",
                source_name=original_filename,
                sheet_name=sheet_name or None,
                drive_folder_id=drive_folder_id,
                total_items=total_items,
                success_count=stats.get("success", 0),
                failed_count=stats.get("failed", 0),
                update_links=update_links,
                status=status_str,
                failed_items=stats.get("failed_items", []),
                message=f"{dup} dédupliqué(s)" if dup else None,
            )
        except Exception as hist_err:
            logger.warning(f"Impossible de sauvegarder l'historique: {hist_err}")

        # Si update_links=False : on retourne juste les stats (pas de téléchargement)
        if not update_links or result_bytes is None:
            return {"status": "finished", "results": stats}

        original_name = original_filename.rsplit(".", 1)[0]
        output_filename = f"{original_name}_migrated.xlsx"

        return StreamingResponse(
            io.BytesIO(result_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=\"{output_filename}\""},
        )
    except AppException as e:
        raise e
    except Exception as e:
        logger.error(f"Migration Excel fatale : {e}")
        migration_status["logs"].append(f"❌ Erreur critique : {str(e)}")
        raise e
    finally:
        migration_status["is_running"] = False


@router.get("/history")
async def get_migration_history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Récupère l'historique persistant des migrations depuis la base de données."""
    from app.repositories.media_repository import MediaRepository

    media_repo = MediaRepository(db)
    items = await media_repo.get_all_history(limit=limit)

    result = []
    for item in items:
        try:
            failed_items = json.loads(item.failed_items_json) if item.failed_items_json else []
        except Exception:
            failed_items = []

        created_at_str = item.created_at.isoformat() if item.created_at else ""
        result.append({
            "id": item.id,
            "source_type": item.source_type,
            "source_name": item.source_name,
            "sheet_name": item.sheet_name,
            "drive_folder_id": item.drive_folder_id,
            "total_items": item.total_items,
            "success_count": item.success_count,
            "failed_count": item.failed_count,
            "update_links": item.update_links,
            "status": item.status,
            "failed_items": failed_items,
            "message": item.message,
            "created_at": created_at_str,
            "timestamp": created_at_str,
        })
    return result


@router.delete("/history")
async def clear_migration_history(db: AsyncSession = Depends(get_db)):
    """Efface tout l'historique des migrations."""
    from app.repositories.media_repository import MediaRepository
    media_repo = MediaRepository(db)
    count = await media_repo.clear_all_history()
    return {"deleted": count}
