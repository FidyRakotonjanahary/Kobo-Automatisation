import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Kobo Automation Suite"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite+aiosqlite:///./kobo_automation.db"

    # Security - clé Fernet encodée en base64 (à définir en variable d'env)
    SECRET_KEY: str = ""

    # Google OAuth2
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3001/google-callback"

    # CORS - origines autorisées (séparées par des virgules)
    ALLOWED_ORIGINS: str = "http://localhost:3001"

    # Keyring fallback (ignoré en prod)
    KEYRING_SERVICE: str = "KoboAutomation_MasterKey"
    KEYRING_USER: str = "LocalSystem"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
