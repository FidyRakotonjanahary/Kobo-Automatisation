import re

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _build_async_url(url: str) -> str:
    """
    Convertit l'URL de base de données en URL async compatible :
    - sqlite   → sqlite+aiosqlite
    - postgres / postgresql → postgresql+asyncpg

    Render fournit une URL au format : postgres://user:pass@host/db
    SQLAlchemy nécessite : postgresql+asyncpg://user:pass@host/db
    """
    # Remplacer le schéma postgres:// ou postgresql:// → postgresql+asyncpg://
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)
    # SQLite : s'assurer qu'on utilise aiosqlite
    url = re.sub(r"^sqlite://(?!.*aiosqlite)", "sqlite+aiosqlite://", url)
    # Si déjà préfixé correctement, ne rien changer
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
