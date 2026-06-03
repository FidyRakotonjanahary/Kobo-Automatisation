import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.database.session import get_db
from app.repositories.credential_repository import CredentialRepository
from app.schemas.media import MigrationRequest
from app.services.google_service import GoogleService
from app.services.media_engine import MediaEngine

logger = logging.getLogger("api_media")
router = APIRouter()

# Stockage temporaire de la progression
migration_status = {"logs": [], "is_running": False}


@router.get("/status")
async def get_migration_status():
    return migration_status


@router.get("/info")
async def get_media_info():
    return {"service_account_email": "Mode personnel (OAuth2) actif"}


@router.post("/migrate")
async def start_migration(req: MigrationRequest, db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    kobo_accs = await repo.get_accounts()

    if not kobo_accs:
        raise AppException("Aucun compte Kobo configuré.", 400)

    global migration_status
    migration_status["logs"] = []
    migration_status["is_running"] = True

    try:
        google = GoogleService()
        engine = MediaEngine(google, kobo_accs)

        def on_prog(msg):
            migration_status["logs"].append(msg)
            if len(migration_status["logs"]) > 50:
                migration_status["logs"].pop(0)

        stats = await engine.migrate_sheet(
            req.spreadsheet_id, req.sheet_name, req.drive_folder_id, on_progress=on_prog
        )
        return {"status": "finished", "results": stats}

    except AppException as e:
        # Relayer l'AppException pour qu'elle soit gérée par le mapper central
        raise e
    except Exception as e:
        logger.error(f"Migration fatale : {e}")
        migration_status["logs"].append(f"❌ Erreur critique : {str(e)}")
        raise e
    finally:
        migration_status["is_running"] = False
