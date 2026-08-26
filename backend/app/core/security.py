import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger("security")


class SecurityManager:
    def __init__(self):
        self._fernet: Optional[Fernet] = None
        self.is_persistent: bool = False

    def initialize(self):
        """
        Initialise le système de chiffrement AES-256 (Fernet).
        
        Stratégie (par ordre de priorité) :
        1. Variable d'environnement SECRET_KEY  → obligatoire en production pour persistance
        2. Keyring système (Windows local)       → persistance locale automatique
        3. Génération temporaire                 → fallback avec alerte
        """
        key: Optional[str] = None

        # 1. Clé via variable d'environnement (Render, Railway, Neon, etc.)
        if settings.SECRET_KEY and settings.SECRET_KEY.strip():
            key = settings.SECRET_KEY.strip()
            self.is_persistent = True
            logger.info("Clé de sécurité Fernet chargée depuis SECRET_KEY (persistance cloud active).")
        else:
            # 2. Tentative via keyring local (Windows de dev)
            try:
                import keyring
                key = keyring.get_password(settings.KEYRING_SERVICE, settings.KEYRING_USER)
                if not key:
                    logger.info("Génération d'une nouvelle clé maître via keyring local...")
                    key = Fernet.generate_key().decode()
                    keyring.set_password(settings.KEYRING_SERVICE, settings.KEYRING_USER, key)
                else:
                    logger.info("Clé de sécurité chargée depuis le keyring local.")
                self.is_persistent = True
            except Exception as e:
                # 3. Fallback : clé temporaire en mémoire
                key = Fernet.generate_key().decode()
                self.is_persistent = False
                logger.warning(
                    f"⚠️ Keyring indisponible ({e}). Clé Fernet temporaire en mémoire générée.\n"
                    "🚨 IMPORTANT POUR RENDER : Les mots de passe chiffrés ne pourront pas être déchiffrés "
                    "après un redéploiement si SECRET_KEY n'est pas configuré.\n"
                    f"👉 Définissez SECRET_KEY='{key}' dans les variables d'environnement de Render."
                )

        try:
            self._fernet = Fernet(key.encode())
            logger.info("Système de chiffrement initialisé avec succès.")
        except Exception as e:
            logger.error(f"Clé Fernet invalide : {e}")
            raise

    def encrypt(self, text: str) -> str:
        if not self._fernet or not text:
            return ""
        try:
            return self._fernet.encrypt(text.encode()).decode()
        except Exception as e:
            logger.error(f"Erreur de chiffrement : {e}")
            return ""

    def decrypt(self, token: str) -> str:
        if not self._fernet or not token:
            return ""
        try:
            return self._fernet.decrypt(token.encode()).decode()
        except InvalidToken:
            logger.error(
                "❌ Échec de déchiffrement (InvalidToken) : la clé SECRET_KEY actuelle ne correspond pas "
                "à la clé utilisée lors de l'enregistrement de ce compte Kobo. "
                "Vérifiez la variable SECRET_KEY sur Render."
            )
            return ""
        except Exception as e:
            logger.error(f"Erreur inattendue de déchiffrement : {e}")
            return ""


security_manager = SecurityManager()
