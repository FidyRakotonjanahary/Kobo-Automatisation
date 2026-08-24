import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.repositories.google_token_repository import GoogleTokenRepository

logger = logging.getLogger("google_auth")
router = APIRouter()

# NOTE : En production (HTTPS), supprimer cette ligne ou la conditionner
if os.environ.get("ENVIRONMENT") != "production":
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

# Chemin du fichier client_secrets.json (uniquement pour le développement local)
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(os.path.dirname(_current_dir))
_CLIENT_SECRETS_FILE = os.path.join(_backend_dir, "client_secrets.json")


def _get_client_config() -> dict:
    """
    Charge la config OAuth2 depuis :
    1. Variables d'environnement GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (production Render)
    2. Fichier client_secrets.json (développement local)
    """
    from app.core.config import settings

    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        return {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }

    if os.path.exists(_CLIENT_SECRETS_FILE):
        with open(_CLIENT_SECRETS_FILE, "r") as f:
            return json.load(f)["web"]

    raise HTTPException(
        400,
        "Configuration Google OAuth2 introuvable. "
        "Définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET en variables d'environnement.",
    )


def _get_redirect_uri() -> str:
    """Retourne l'URI de redirection selon l'environnement."""
    from app.core.config import settings

    return settings.GOOGLE_REDIRECT_URI


@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_db)):
    """Vérifie si on est connecté et quel est l'email (lit depuis la DB)."""
    repo = GoogleTokenRepository(db)
    token_data = await repo.get_token_data()
    if not token_data:
        return {"connected": False}
    return {
        "connected": True,
        "email": token_data.get("email", "Compte Google"),
        "expiry": token_data.get("expiry"),
    }


@router.get("/login-url")
async def get_login_url():
    """Génère l'URL de connexion Google."""
    from urllib.parse import urlencode

    client_config = _get_client_config()
    redirect_uri = _get_redirect_uri()

    params = {
        "client_id": client_config["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }

    auth_url = f"{client_config['auth_uri']}?{urlencode(params)}"
    return {"url": auth_url}


@router.post("/callback")
async def callback(data: dict, db: AsyncSession = Depends(get_db)):
    """
    Reçoit le code de Google, échange contre un token,
    et sauvegarde le token en base de données (plus de token.json).
    """
    code = data.get("code")
    if not code:
        raise HTTPException(400, "Code manquant")

    try:
        import requests
        from datetime import datetime, timedelta

        client_config = _get_client_config()
        redirect_uri = _get_redirect_uri()

        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_config["client_id"],
                "client_secret": client_config["client_secret"],
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if not token_response.ok:
            raise HTTPException(400, f"Erreur Google Token: {token_response.text}")

        creds_data = token_response.json()
        access_token = creds_data.get("access_token")
        refresh_token = creds_data.get("refresh_token")

        # Récupérer l'email de l'utilisateur
        user_info_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_info = user_info_response.json()
        email = user_info.get("email")

        # Calculer l'expiry
        expiry = datetime.utcnow() + timedelta(seconds=creds_data.get("expires_in", 3600))

        # ✅ Sauvegarder en base de données (remplace token.json)
        repo = GoogleTokenRepository(db)
        await repo.save_token(
            access_token=access_token,
            refresh_token=refresh_token,
            client_id=client_config["client_id"],
            client_secret=client_config["client_secret"],
            scopes=SCOPES,
            email=email,
            expiry=expiry.isoformat(),
            token_uri=client_config.get("token_uri", "https://oauth2.googleapis.com/token"),
        )

        logger.info(f"Token Google sauvegardé en DB pour {email}")
        return {"status": "success", "email": email}

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        logger.error(f"Erreur callback Google: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(500, f"{type(e).__name__}: {str(e)}")


@router.post("/logout")
async def logout(db: AsyncSession = Depends(get_db)):
    """Déconnexion — supprime le token de la base de données."""
    repo = GoogleTokenRepository(db)
    await repo.delete_token()
    return {"status": "success"}
