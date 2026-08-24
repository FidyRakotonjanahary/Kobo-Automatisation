import logging
import os
from typing import Optional

from cryptography.fernet import Fernet

from app.core.config import settings

logger = logging.getLogger("security")


class SecurityManager:
    def __init__(self):
        self._fernet: Optional[Fernet] = None

    def initialize(self):
        """
        Initialise le système de chiffrement.
        
        Stratégie (par ordre de priorité) :
        1. Variable d'environnement SECRET_KEY  → idéale pour le déploiement cloud
        2. Keyring système (Windows local)       → compatibilité locale conservée
        3. Génération automatique + avertissement → fallback de dernier recours
        """
        key: Optional[str] = None

        # 1. Clé via variable d'environnement (Render, Railway, etc.)
        if settings.SECRET_KEY:
            key = settings.SECRET_KEY
            logger.info("Clé de sécurité chargée depuis SECRET_KEY (env).")
        else:
            # 2. Tentative keyring (Windows local uniquement)
            try:
                import keyring
                key = keyring.get_password(settings.KEYRING_SERVICE, settings.KEYRING_USER)
                if not key:
                    logger.info("Génération d'une nouvelle clé maître via keyring...")
                    key = Fernet.generate_key().decode()
                    keyring.set_password(settings.KEYRING_SERVICE, settings.KEYRING_USER, key)
                else:
                    logger.info("Clé de sécurité chargée depuis le keyring.")
            except Exception as e:
                logger.warning(f"Keyring indisponible ({e}). Génération d'une clé temporaire.")
                # 3. Fallback : clé temporaire (données non persistées entre redémarrages)
                key = Fernet.generate_key().decode()
                logger.warning(
                    "⚠️  Clé temporaire générée. Définissez SECRET_KEY en variable "
                    "d'environnement pour la persistance des données chiffrées."
                )

        try:
            self._fernet = Fernet(key.encode())
            logger.info("Système de sécurité initialisé.")
        except Exception as e:
            logger.error(f"Clé invalide : {e}")
            raise

    def encrypt(self, text: str) -> str:
        if not self._fernet or not text:
            return ""
        return self._fernet.encrypt(text.encode()).decode()

    def decrypt(self, token: str) -> str:
        if not self._fernet or not token:
            return ""
        return self._fernet.decrypt(token.encode()).decode()


security_manager = SecurityManager()
