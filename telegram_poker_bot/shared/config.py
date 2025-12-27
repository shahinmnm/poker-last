"""Configuration management using environment variables."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus, urljoin

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
    telegram_bot_token: str = "000000:TEST-TOKEN"
    telegram_webhook_secret_token: Optional[str] = None
    admin_chat_id: Optional[int] = None

    # Webhook
    public_base_url: str = "https://poker.shahin8n.sbs"
    webhook_path: str = "/telegram/webhook"
    webhook_secret_token: Optional[str] = None
    webhook_bind_host: str = "0.0.0.0"
    webhook_bind_port: int = 8443

    # Database
    database_url: Optional[str] = None
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_user: str = "pokerbot"
    postgres_password: str = "changeme"
    postgres_password_file: Optional[Path] = None
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

    # Auth / Security
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION"

    # Feature Flags
    feature_wallet: bool = False

    # Game Configuration
    matchmaking_pool_ttl: int = 120
    private_game_ttl: int = 3600
    table_inactivity_timeout_minutes: int = 10
    table_all_sitout_timeout_minutes: int = 5

    # Currency Configuration (Cent-based System)
    currency_smallest_unit_factor: int = 100  # 100 = cents (USD), 1 = whole units
    initial_balance_usd: float = 100.00  # Initial balance for new users in USD

    # Table Lifecycle Configuration
    public_table_prestart_ttl_minutes: int = 10  # 10 minutes for public tables to start
    private_table_prestart_ttl_minutes: int = (
        60  # 60 minutes for private tables to start
    )
    post_hand_delay_seconds: int = 20  # Env: POST_HAND_DELAY_SECONDS. Delay after hand ends before starting next hand (recommended: 15-30s)

    # Mini App
    webapp_secret: str = "test-webapp-secret"
    cors_origins: Optional[str] = None
    vite_api_url: Optional[str] = None
    vite_bot_username: str = "@pokerbazabot"
    mini_app_base_url: Optional[str] = None
    group_invite_ttl_seconds: int = 900

    @field_validator("public_base_url", mode="before")
    @classmethod
    def normalize_public_base_url(cls, value: str) -> str:
        """Ensure PUBLIC_BASE_URL has no trailing slash and includes a scheme."""
        if not isinstance(value, str):
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("PUBLIC_BASE_URL cannot be empty")
        if not trimmed.startswith(("http://", "https://")):
            raise ValueError("PUBLIC_BASE_URL must include http:// or https://")
        return trimmed.rstrip("/")

    @field_validator("webhook_path", mode="before")
    @classmethod
    def ensure_webhook_path(cls, value: str) -> str:
        """Ensure webhook path always starts with a leading slash."""
        if not isinstance(value, str):
            return value
        trimmed = value.strip()
        if not trimmed.startswith("/"):
            trimmed = f"/{trimmed.lstrip('/')}"
        return trimmed

    @field_validator("cors_origins", "vite_api_url", "mini_app_base_url", mode="before")
    @classmethod
    def normalize_optional_urls(cls, value: Optional[str]) -> Optional[str]:
        """Normalize optional URL fields, treating empty strings as missing."""
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

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
        """Ensure DATABASE_URL is always populated and synced with POSTGRES_* overrides."""
        if self.postgres_password_file:
            try:
                file_contents = self.postgres_password_file.read_text(encoding="utf-8")
            except OSError as exc:
                raise ValueError(
                    f"Unable to read POSTGRES_PASSWORD_FILE '{self.postgres_password_file}': {exc.strerror or exc}"
                ) from exc
            self.postgres_password = file_contents.rstrip("\r\n")

        component_env_vars = (
            "POSTGRES_HOST",
            "POSTGRES_PORT",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
            "POSTGRES_DB",
            "POSTGRES_PASSWORD_FILE",
        )
        component_env_provided = any(
            os.getenv(var) is not None for var in component_env_vars
        )

        env_database_url = os.getenv("DATABASE_URL")

        # Always rebuild the URL when any granular POSTGRES_* env var is provided.
        # This prevents stale credentials when the password or host changes but the composed DATABASE_URL
        # (for example copied from .env.example) is not kept in sync.
        if component_env_provided or not env_database_url:
            user = quote_plus(self.postgres_user)
            password = (
                quote_plus(self.postgres_password) if self.postgres_password else ""
            )
            auth = f"{user}:{password}" if password else user
            self.database_url = (
                f"postgresql+asyncpg://{auth}@"
                f"{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        return self

    @model_validator(mode="after")
    def derive_service_urls(self) -> "Settings":
        """Derive domain-dependent URLs from PUBLIC_BASE_URL when not explicitly set."""
        base = self.public_base_url.rstrip("/")
        if not self.cors_origins:
            self.cors_origins = base
        if not self.vite_api_url:
            self.vite_api_url = f"{base}/api"
        if not self.mini_app_base_url:
            api_base = (self.vite_api_url or "").rstrip("/")
            if api_base.endswith("/api"):
                self.mini_app_base_url = api_base[: -len("/api")]
            else:
                self.mini_app_base_url = api_base or base
        return self

    @property
    def redis_url_computed(self) -> str:
        """Compute Redis URL from components if not provided."""
        if self.redis_url:
            return self.redis_url
        auth = f":{self.redis_pass}@" if self.redis_pass else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def webhook_url(self) -> str:
        """Full public webhook URL derived from PUBLIC_BASE_URL and WEBHOOK_PATH."""
        base = f"{self.public_base_url.rstrip('/')}/"
        path = self.webhook_path.lstrip("/")
        return urljoin(base, path)

    @property
    def bot_username_clean(self) -> str:
        """Normalized bot username without leading @."""
        return self.vite_bot_username.lstrip("@")

    @property
    def mini_app_url(self) -> str:
        """Public base URL for the mini app."""
        return (self.mini_app_base_url or self.public_base_url).rstrip("/")

    @property
    def initial_balance_cents(self) -> int:
        """Initial balance in cents (smallest currency unit)."""
        return int(self.initial_balance_usd * self.currency_smallest_unit_factor)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
