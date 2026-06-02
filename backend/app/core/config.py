from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Kobo Automation Suite"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite+aiosqlite:///./kobo_automation.db"
    
    # Security Keyring Config
    KEYRING_SERVICE: str = "KoboAutomation_MasterKey"
    KEYRING_USER: str = "LocalSystem"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
