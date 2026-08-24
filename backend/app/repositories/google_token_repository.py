"""
GoogleTokenRepository — Persistance du token OAuth2 Google en base de données.

Remplace la lecture/écriture de token.json sur le système de fichiers local.
La table google_tokens contient une seule ligne (id=1) qui est créée ou
mise à jour à chaque connexion/rafraîchissement du token.
"""
import json
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.google_token import GoogleToken

logger = logging.getLogger("google_token_repository")


class GoogleTokenRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_token(self) -> Optional[GoogleToken]:
        """Retourne le token Google (id=1) ou None s'il n'existe pas."""
        result = await self.db.execute(
            select(GoogleToken).where(GoogleToken.id == 1)
        )
        return result.scalar_one_or_none()

    async def get_token_data(self) -> Optional[dict]:
        """Retourne le token sous forme de dict (compatible avec l'ancien token.json)."""
        token = await self.get_token()
        if not token:
            return None
        return {
            "token": token.access_token,
            "refresh_token": token.refresh_token,
            "token_uri": token.token_uri,
            "client_id": token.client_id,
            "client_secret": token.client_secret,
            "scopes": json.loads(token.scopes) if token.scopes else [],
            "email": token.email,
            "expiry": token.expiry,
        }

    async def is_connected(self) -> bool:
        """Vérifie si un token valide existe en base."""
        token = await self.get_token()
        return token is not None and bool(token.refresh_token)

    async def save_token(
        self,
        access_token: str,
        refresh_token: Optional[str],
        client_id: str,
        client_secret: str,
        scopes: list,
        email: Optional[str],
        expiry: Optional[str],
        token_uri: str = "https://oauth2.googleapis.com/token",
    ) -> GoogleToken:
        """
        Crée ou met à jour le token Google (upsert sur id=1).
        Un seul token est conservé (l'application n'est pas multi-utilisateur).
        """
        existing = await self.get_token()

        if existing:
            # Mise à jour
            existing.access_token = access_token
            if refresh_token:  # Ne jamais écraser un refresh_token valide par None
                existing.refresh_token = refresh_token
            existing.client_id = client_id
            existing.client_secret = client_secret
            existing.scopes = json.dumps(scopes)
            existing.email = email
            existing.expiry = expiry
            existing.token_uri = token_uri
            await self.db.commit()
            await self.db.refresh(existing)
            logger.info(f"Token Google mis à jour pour {email}")
            return existing
        else:
            # Création avec id=1 fixe
            new_token = GoogleToken(
                id=1,
                access_token=access_token,
                refresh_token=refresh_token,
                client_id=client_id,
                client_secret=client_secret,
                scopes=json.dumps(scopes),
                email=email,
                expiry=expiry,
                token_uri=token_uri,
            )
            self.db.add(new_token)
            await self.db.commit()
            await self.db.refresh(new_token)
            logger.info(f"Token Google créé pour {email}")
            return new_token

    async def update_access_token(self, access_token: str, expiry: str) -> None:
        """Met à jour uniquement l'access_token (après rafraîchissement)."""
        token = await self.get_token()
        if token:
            token.access_token = access_token
            token.expiry = expiry
            await self.db.commit()
            logger.debug("Access token Google rafraîchi en base.")

    async def delete_token(self) -> bool:
        """Supprime le token (déconnexion)."""
        token = await self.get_token()
        if token:
            await self.db.delete(token)
            await self.db.commit()
            logger.info("Token Google supprimé (déconnexion).")
            return True
        return False
