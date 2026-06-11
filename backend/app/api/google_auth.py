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

    from urllib.parse import urlencode
    
    with open(CLIENT_SECRETS_FILE, "r") as f:
        client_config = json.load(f)["web"]

    params = {
        "client_id": client_config["client_id"],
        "redirect_uri": "http://localhost:3001/google-callback",
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true"
    }
    
    auth_url = f"{client_config['auth_uri']}?{urlencode(params)}"
    return {"url": auth_url}


@router.post("/callback")
async def callback(data: dict):
    """Reçoit le code de Google et génère le token."""
    code = data.get("code")
    if not code:
        raise HTTPException(400, "Code manquant")

    try:
        # Échanger le code contre un token via une requête directe pour éviter les erreurs PKCE/Flow
        import requests
        with open(CLIENT_SECRETS_FILE, "r") as f:
            client_config = json.load(f)["web"]

        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_config["client_id"],
                "client_secret": client_config["client_secret"],
                "redirect_uri": "http://localhost:3001/google-callback",
                "grant_type": "authorization_code",
            },
        )

        if not token_response.ok:
            raise HTTPException(400, f"Erreur Google Token: {token_response.text}")

        creds_data = token_response.json()
        access_token = creds_data.get("access_token")
        refresh_token = creds_data.get("refresh_token")

        # Récupérer l'email de l'utilisateur avec l'access_token
        user_info_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_info = user_info_response.json()
        email = user_info.get("email")

        # Sauvegarder le token
        from datetime import datetime, timedelta
        expiry = datetime.utcnow() + timedelta(seconds=creds_data.get("expires_in", 3600))

        token_data = {
            "token": access_token,
            "refresh_token": refresh_token,
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": client_config["client_id"],
            "client_secret": client_config["client_secret"],
            "scopes": SCOPES,
            "email": email,
            "expiry": expiry.isoformat(),
        }

        with open(TOKEN_FILE, "w") as f:
            json.dump(token_data, f)

        return {"status": "success", "email": email}
    except Exception as e:
        import traceback
        logger.error(f"Erreur callback Google: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(500, f"{type(e).__name__}: {str(e)}")


@router.post("/logout")
async def logout():
    """Déconnexion (supprime le token)."""
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)
    return {"status": "success"}
