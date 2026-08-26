import asyncio
import re
from logging.config import fileConfig

from alembic import context
from app.core.config import settings
from app.database.base import Base

# Import all models so Alembic autogenerate can discover every mapped table.
from app.models.credential import Credential  # noqa: F401
from app.models.export_history import ExportHistory  # noqa: F401
from app.models.google_token import GoogleToken  # noqa: F401
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _build_sync_url(url: str) -> str:
    """Produit l'URL synchrone (pour mode offline et psycopg2)."""
    url = url.strip()
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    url = re.sub(r"^sqlite\+aiosqlite://", "sqlite://", url)
    url = re.sub(r"^postgres://", "postgresql://", url)
    return url


def _build_async_url(url: str) -> str:
    """Produit l'URL async (pour mode online)."""
    url = url.strip()
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)
    url = re.sub(r"^sqlite://(?!.*aiosqlite)", "sqlite+aiosqlite://", url)
    if "postgresql+asyncpg://" in url:
        url = re.sub(r"sslmode=[^&]+", "ssl=require", url)
        if "ssl=" not in url and not any(h in url for h in ["localhost", "127.0.0.1", "host.docker.internal"]):
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}ssl=require"
    return url


_db_url = settings.DATABASE_URL
_sync_url = _build_sync_url(_db_url)
_async_url = _build_async_url(_db_url)

config.set_main_option("sqlalchemy.url", _async_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    is_sqlite = "sqlite" in _async_url
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=is_sqlite,  # batch mode requis uniquement pour SQLite
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _async_url
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Si une event loop tourne déjà dans ce thread (ex: appel direct synchrone),
        # exécuter la coroutine dans une tâche ou un sous-thread
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            executor.submit(lambda: asyncio.run(run_async_migrations())).result()
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
