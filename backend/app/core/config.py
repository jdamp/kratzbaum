"""Application configuration from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = (
        "postgresql+asyncpg://kratzbaum:kratzbaum@localhost:5432/kratzbaum"
    )

    # Security
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # PlantNet API
    plantnet_api_key: str = ""
    plantnet_api_url: str = "https://my-api.plantnet.org/v2/identify/all"

    # Push Notifications (VAPID)
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_email: str = "mailto:admin@kratzbaum.local"

    # File Storage
    upload_dir: Path = Path("./uploads")

    @property
    def upload_plants_dir(self) -> Path:
        """Directory for plant photos."""
        return self.upload_dir / "plants"

    @property
    def upload_pots_dir(self) -> Path:
        """Directory for pot photos."""
        return self.upload_dir / "pots"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
