"""Configuration management using environment variables."""

from functools import lru_cache
from typing import Optional

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
    database_url: str
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
