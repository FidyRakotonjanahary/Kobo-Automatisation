from urllib.parse import urlparse

from fastapi import APIRouter

from app.core.config import settings
from app.core.security import security_manager

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Diagnostic complet de santé du backend :
    - Statut global
    - Moteur de base de données (PostgreSQL Neon vs SQLite)
    - Persistance du stockage
    - État de la clé de chiffrement SECRET_KEY
    """
    db_url = settings.DATABASE_URL
    is_sqlite = "sqlite" in db_url.lower()
    is_postgres = "postgres" in db_url.lower()

    db_type = "sqlite" if is_sqlite else ("postgresql" if is_postgres else "other")

    host_display = "local_file"
    if is_postgres:
        try:
            clean_url = db_url.replace("postgresql+asyncpg://", "http://").replace(
                "postgres://", "http://"
            )
            parsed = urlparse(clean_url)
            host_display = parsed.hostname or "remote_postgres"
        except Exception:
            host_display = "remote_postgres"

    is_render = settings.is_render
    # SQLite sur Render est éphémère (disque détruit au redéploiement)
    db_persistent = not (is_sqlite and is_render)

    return {
        "status": "online",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "is_render": is_render,
        "database": {
            "type": db_type,
            "host": host_display,
            "persistent": db_persistent,
        },
        "security": {
            "secret_key_configured": bool(settings.SECRET_KEY),
            "key_persistent": security_manager.is_persistent,
        },
    }
