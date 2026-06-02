import logging
from typing import Optional
from cryptography.fernet import Fernet
import keyring
from app.core.config import settings

logger = logging.getLogger("security")

class SecurityManager:
    def __init__(self):
        self._fernet: Optional[Fernet] = None

    def initialize(self):
        try:
            key = keyring.get_password(settings.KEYRING_SERVICE, settings.KEYRING_USER)
            if not key:
                logger.info("Génération d'une nouvelle clé maître...")
                key = Fernet.generate_key().decode()
                keyring.set_password(settings.KEYRING_SERVICE, settings.KEYRING_USER, key)
            
            self._fernet = Fernet(key.encode())
            logger.info("Système de sécurité initialisé.")
        except Exception as e:
            logger.error(f"Erreur sécurité : {e}")
            raise

    def encrypt(self, text: str) -> str:
        if not self._fernet or not text: return ""
        return self._fernet.encrypt(text.encode()).decode()

    def decrypt(self, token: str) -> str:
        if not self._fernet or not token: return ""
        return self._fernet.decrypt(token.encode()).decode()

security_manager = SecurityManager()
