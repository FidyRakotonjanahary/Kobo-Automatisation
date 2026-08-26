import logging
import re
from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger("database")


def _build_async_url(url: str) -> str:
    """
    Convertit l'URL de base de données en URL async compatible :
    - sqlite   → sqlite+aiosqlite
    - postgres / postgresql → postgresql+asyncpg
    
    Support optimisé pour Neon (neon.tech) / Supabase / PostgreSQL cloud :
    - Remplace le schéma par postgresql+asyncpg://
    - asyncpg gère le paramètre ?ssl=require plutôt que ?sslmode=require
    - Ajoute automatiquement ssl=require pour les bases distantes
    """
    url = url.strip()
    # 1. Remplacer le schéma postgres:// ou postgresql:// → postgresql+asyncpg://
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)
    # 2. SQLite : s'assurer qu'on utilise aiosqlite
    url = re.sub(r"^sqlite://(?!.*aiosqlite)", "sqlite+aiosqlite://", url)
    
    # 3. Paramétrage SSL pour PostgreSQL
    if "postgresql+asyncpg://" in url:
        # Convertir sslmode=... en ssl=... pour asyncpg
        url = re.sub(r"sslmode=[^&]+", "ssl=require", url)
        # Si aucun paramètre ssl et pas de localhost, forcer ssl=require (requis par Neon)
        if "ssl=" not in url and not any(h in url for h in ["localhost", "127.0.0.1", "host.docker.internal"]):
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}ssl=require"

    return url


_async_url = _build_async_url(settings.DATABASE_URL)
_is_sqlite = "sqlite" in _async_url

# Configuration du moteur de base de données
_engine_kwargs: Dict[str, Any] = {
    "echo": settings.DEBUG,
}

if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    if settings.is_render:
        logger.critical(
            "🚨 ATTENTION PRODUCTION/RENDER : Le backend utilise actuellement SQLite "
            "(./kobo_automation.db). Le disque Render étant éphémère, les comptes Kobo "
            "seront PERDUS à chaque redéploiement ! "
            "Renseignez la variable DATABASE_URL avec votre URL PostgreSQL Neon dans le tableau de bord Render."
        )
    else:
        logger.info("Connexion base de données : SQLite locale (développement).")
else:
    # Paramètres recommandés pour PostgreSQL Cloud / Neon Serverless :
    # - pool_pre_ping évite les crashs lors de la sortie de veille Neon
    # - pool_recycle évite l'accumulation de connexions obsolètes
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_recycle"] = 300
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20
    logger.info("Connexion base de données : PostgreSQL Cloud (persistante).")

engine = create_async_engine(
    _async_url,
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
