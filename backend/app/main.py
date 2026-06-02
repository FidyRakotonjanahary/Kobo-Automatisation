import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import traceback

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.security import security_manager
from app.core.exceptions import AppException
from app.api.health import router as health_router
from app.api.kobo import router as kobo_router
from app.api.exports import router as exports_router
from app.api.media import router as media_router
from app.api.google_auth import router as google_auth_router
from app.database.session import engine
from app.database.base import Base

# Registration des modèles
from app.models.credential import Credential 
from app.models.export_history import ExportHistory

# Setup Logging
setup_logging()
logger = logging.getLogger("app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    logger.info("Démarrage du Backend...")
    security_manager.initialize()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Base de données et Sécurité prêtes.")
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
        content={"message": exc.message, "detail": exc.detail}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.critical(f"Unhandled Exception: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"message": "Une erreur inattendue est survenue. Veuillez contacter l'administrateur."}
    )

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health_router, prefix="/api", tags=["System"])
app.include_router(kobo_router, prefix="/api/kobo", tags=["Kobo"])
app.include_router(exports_router, prefix="/api/exports", tags=["Exports"])
app.include_router(media_router, prefix="/api/media", tags=["Media"])
app.include_router(google_auth_router, prefix="/api/google", tags=["Google Auth"])

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}
