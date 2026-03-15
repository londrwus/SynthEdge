from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve .env relative to this file: backend/app/config.py -> project root
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Synth API
    SYNTH_API_KEY: str = ""
    SYNTH_API_BASE: str = "https://api.synthdata.co"
    SYNTH_POLL_INTERVAL_SECONDS: int = 300  # 5 minutes default (configurable)
    SYNTH_CACHE_TTL_SECONDS: int = 600  # 10 minutes (survives between polls)
    SYNTH_1H_ENABLED: bool = True  # Set False to skip 1h polling entirely

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # PostgreSQL
    POSTGRES_URL: str = "postgresql://synthedge:synthedge_dev_password@localhost:5432/synthedge"

    # Backend
    CORS_ORIGINS: str = "*"
    LOG_LEVEL: str = "info"

    # Mock data fallback
    SAVE_MOCK_DATA: bool = True

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
