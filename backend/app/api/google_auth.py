import json
import logging
import os

from fastapi import APIRouter, HTTPException
from google_auth_oauthlib.flow import Flow

logger = logging.getLogger("google_auth")
router = APIRouter()

# Autoriser HTTP (au lieu de HTTPS) pour le développement local
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# Chemins des fichiers
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
CLIENT_SECRETS_FILE = os.path.join(backend_dir, "client_secrets.json")
TOKEN_FILE = os.path.join(backend_dir, "token.json")

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


@router.get("/status")
async def get_status():
    """Vérifie si on est connecté et quel est l'email."""
    if not os.path.exists(TOKEN_FILE):
        return {"connected": False}

    try:
        with open(TOKEN_FILE, "r") as f:
            token_data = json.load(f)
            return {
                "connected": True,
                "email": token_data.get("email", "Compte Google"),
                "expiry": token_data.get("expiry"),
            }
    except Exception:
        return {"connected": False}


@router.get("/login-url")
async def get_login_url():
    """Génère l'URL de connexion Google."""
    if not os.path.exists(CLIENT_SECRETS_FILE):
        raise HTTPException(
            400, "Fichier client_secrets.json introuvable sur le serveur."
        )

    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri="http://localhost:3000/google-callback",
    )

    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    return {"url": auth_url}


@router.post("/callback")
async def callback(data: dict):
    """Reçoit le code de Google et génère le token."""
    code = data.get("code")
    if not code:
        raise HTTPException(400, "Code manquant")

    try:
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri="http://localhost:3000/google-callback",
        )
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Récupérer l'email de l'utilisateur
        from googleapiclient.discovery import build

        service = build("oauth2", "v2", credentials=creds)
        user_info = service.userinfo().get().execute()
        email = user_info.get("email")

        # Sauvegarder le token
        token_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": creds.scopes,
            "email": email,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        }

        with open(TOKEN_FILE, "w") as f:
            json.dump(token_data, f)

        return {"status": "success", "email": email}
    except Exception as e:
        logger.error(f"Erreur callback Google: {e}")
        raise HTTPException(500, str(e))


@router.post("/logout")
async def logout():
    """Déconnexion (supprime le token)."""
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)
    return {"status": "success"}
