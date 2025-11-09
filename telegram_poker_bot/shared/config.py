"""Configuration management using environment variables."""

import os
from functools import lru_cache
from typing import Optional
from urllib.parse import quote_plus

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Telegram Bot
    telegram_bot_token: str
    telegram_webhook_secret_token: Optional[str] = None
    admin_chat_id: Optional[int] = None

    # Webhook
    public_base_url: str
    webhook_path: str = "/telegram/webhook"
    webhook_secret_token: Optional[str] = None

    # Database
    database_url: Optional[str] = None
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_user: str = "pokerbot"
    postgres_password: str = "changeme"
    postgres_db: str = "pokerbot"
    database_pool_min_size: int = 10
    database_pool_max_size: int = 20

    # Redis
    redis_url: Optional[str] = None
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_pass: Optional[str] = None
    redis_db: int = 0

    # Logging
    log_level: str = "INFO"
    log_json: bool = False
    trace_updates: bool = False
    trace_sql: bool = False
    trace_engine: bool = False

    # Feature Flags
    feature_wallet: bool = False

    # Game Configuration
    matchmaking_pool_ttl: int = 120
    private_game_ttl: int = 3600
    default_starting_stack: int = 10000
    small_blind: int = 25
    big_blind: int = 50

    # Mini App
    webapp_secret: str
    cors_origins: str = "https://poker.shahin8n.sbs"
    vite_api_url: str = "https://poker.shahin8n.sbs/api"
    vite_bot_username: str = "@pokerbazabot"

    @field_validator("database_url", mode="before")
    @classmethod
    def expand_database_url(cls, value: Optional[str]) -> Optional[str]:
        """Expand environment variables and user home in DATABASE_URL."""
        if isinstance(value, str):
            expanded = os.path.expandvars(value)
            return os.path.expanduser(expanded)
        return value

    @model_validator(mode="after")
    def ensure_database_url(self) -> "Settings":
        """Ensure DATABASE_URL is always populated."""
        if not self.database_url:
            user = quote_plus(self.postgres_user)
            password = quote_plus(self.postgres_password) if self.postgres_password else ""
            auth = f"{user}:{password}" if password else user
            self.database_url = (
                f"postgresql+asyncpg://{auth}@"
                f"{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        return self

    @property
    def redis_url_computed(self) -> str:
        """Compute Redis URL from components if not provided."""
        if self.redis_url:
            return self.redis_url
        auth = f":{self.redis_pass}@" if self.redis_pass else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
