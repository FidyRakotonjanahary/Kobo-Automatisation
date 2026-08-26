import os
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_database_url() -> str:
    """
    Résout la chaîne de connexion en vérifiant DATABASE_URL et ses alias courants
    (POSTGRES_URL, NEON_DATABASE_URL, POSTGRESQL_URL, DATABASE_URI).
    """
    for key in [
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRESQL_URL",
        "NEON_DATABASE_URL",
        "DATABASE_URI",
    ]:
        val = os.environ.get(key)
        if val and val.strip():
            return val.strip()
    return "sqlite+aiosqlite:///./kobo_automation.db"


class Settings(BaseSettings):
    APP_NAME: str = "Kobo Automation Suite"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")

    DATABASE_URL: str = _resolve_database_url()

    # Security - clé Fernet encodée en base64 (à définir en variable d'env en production)
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

    @property
    def is_render(self) -> bool:
        return bool(
            os.environ.get("RENDER")
            or os.environ.get("RENDER_SERVICE_ID")
            or self.ENVIRONMENT.lower() == "production"
        )


settings = Settings()
