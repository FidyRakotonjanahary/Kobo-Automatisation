import logging
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
import asyncio

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.exports import router as exports_router
from app.api.google_auth import router as google_auth_router
from app.api.health import router as health_router
from app.api.kobo import router as kobo_router
from app.api.media import router as media_router
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import setup_logging
from app.core.security import security_manager

# Setup Logging
setup_logging()
logger = logging.getLogger("app")


def run_database_migrations():
    backend_dir = Path(__file__).resolve().parents[1]
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    logger.info("Démarrage du Backend... [RELOAD_HMR]")
    security_manager.initialize()
    # Exécuter les migrations dans un thread dédié pour ne pas bloquer ni entrer en conflit avec l'event loop FastAPI
    await asyncio.to_thread(run_database_migrations)
    logger.info("Migrations, base de données et sécurité prêtes.")
    yield
    # --- SHUTDOWN ---
    logger.info("Arrêt du Backend.")


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)


# Exception Handlers
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    logger.error(f"AppError: {exc.message} | Detail: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.message, "detail": exc.detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.critical(f"Unhandled Exception: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "message": (
                "Une erreur inattendue est survenue. "
                "Veuillez contacter l'administrateur."
            )
        },
    )


# Middleware CORS
# Normalisation robuste : supprime les espaces et les trailing slashes éventuels (ex: 'https://site.com/' -> 'https://site.com')
parsed_origins = [o.strip().rstrip("/") for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
# Si '*' est présent, désactiver allow_credentials pour respecter la spécification CORS
is_wildcard = "*" in parsed_origins
allowed_origins = ["*"] if is_wildcard else parsed_origins

logger.info(f"CORS Allowed Origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes principales (avec préfixe /api standard)
app.include_router(health_router, prefix="/api", tags=["System"])
app.include_router(kobo_router, prefix="/api/kobo", tags=["Kobo"])
app.include_router(exports_router, prefix="/api/exports", tags=["Exports"])
app.include_router(media_router, prefix="/api/media", tags=["Media"])
app.include_router(google_auth_router, prefix="/api/google", tags=["Google Auth"])

# Routes de fallback sans préfixe /api (au cas où les requêtes arrivent directement sur /kobo, /exports, etc.)
app.include_router(health_router, tags=["System Fallback"], include_in_schema=False)
app.include_router(kobo_router, prefix="/kobo", tags=["Kobo Fallback"], include_in_schema=False)
app.include_router(exports_router, prefix="/exports", tags=["Exports Fallback"], include_in_schema=False)
app.include_router(media_router, prefix="/media", tags=["Media Fallback"], include_in_schema=False)
app.include_router(google_auth_router, prefix="/google", tags=["Google Auth Fallback"], include_in_schema=False)


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}

