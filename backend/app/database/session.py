import re

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _build_async_url(url: str) -> str:
    """
    Convertit l'URL de base de données en URL async compatible :
    - sqlite   → sqlite+aiosqlite
    - postgres / postgresql → postgresql+asyncpg
    
    Support de Neon (neon.tech) / Supabase / PostgreSQL cloud :
    - Remplace le schéma par postgresql+asyncpg://
    - asyncpg gère le paramètre ?ssl=require plutôt que ?sslmode=require
    """
    # Remplacer le schéma postgres:// ou postgresql:// → postgresql+asyncpg://
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)
    # SQLite : s'assurer qu'on utilise aiosqlite
    url = re.sub(r"^sqlite://(?!.*aiosqlite)", "sqlite+aiosqlite://", url)
    # Compatibilité SSL pour asyncpg (Neon fournit souvent sslmode=require)
    if "sslmode=require" in url:
        url = url.replace("sslmode=require", "ssl=require")
    return url


_async_url = _build_async_url(settings.DATABASE_URL)

# Paramètres spécifiques selon le driver
_connect_args = {}
if "sqlite" in _async_url:
    _connect_args = {"check_same_thread": False}

engine = create_async_engine(
    _async_url,
    echo=settings.DEBUG,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
