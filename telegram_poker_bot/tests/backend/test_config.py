import pytest

from telegram_poker_bot.shared import config


@pytest.fixture(autouse=True)
def clear_settings_cache():
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


def test_database_url_expands_environment_variables(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv("POSTGRES_PASSWORD", "supersecret")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://pokerbot:${POSTGRES_PASSWORD}@postgres:5432/pokerbot",
    )

    settings = config.get_settings()

    assert (
        settings.database_url
        == "postgresql+asyncpg://pokerbot:supersecret@postgres:5432/pokerbot"
    )


def test_database_url_constructed_from_postgres_env(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_USER", "bot")
    monkeypatch.setenv("POSTGRES_PASSWORD", "p@ss word")
    monkeypatch.setenv("POSTGRES_DB", "cards")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    monkeypatch.setenv("POSTGRES_PORT", "6543")

    settings = config.get_settings()

    assert (
        settings.database_url
        == "postgresql+asyncpg://bot:p%40ss+word@db:6543/cards"
    )


def test_database_url_rebuilt_when_postgres_password_changes(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://pokerbot:old-password@postgres:5432/pokerbot",
    )
    monkeypatch.setenv("POSTGRES_PASSWORD", "new-secret")

    settings = config.get_settings()

    assert (
        settings.database_url
        == "postgresql+asyncpg://pokerbot:new-secret@postgres:5432/pokerbot"
    )


def test_postgres_password_loaded_from_file(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    monkeypatch.setenv("POSTGRES_USER", "bot")
    monkeypatch.setenv("POSTGRES_DB", "cards")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    password_file = tmp_path / "pgpass"
    password_file.write_text("s3cret\n", encoding="utf-8")
    monkeypatch.setenv("POSTGRES_PASSWORD_FILE", str(password_file))

    settings = config.get_settings()

    assert settings.postgres_password == "s3cret"
    assert (
        settings.database_url == "postgresql+asyncpg://bot:s3cret@db:5432/cards"
    )


def test_missing_postgres_password_file_raises(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    missing_file = tmp_path / "missing"
    monkeypatch.setenv("POSTGRES_PASSWORD_FILE", str(missing_file))

    with pytest.raises(ValueError, match="POSTGRES_PASSWORD_FILE"):
        config.get_settings()


def test_webhook_url_and_frontend_defaults(monkeypatch):
    """Default domain-dependent URLs derive from PUBLIC_BASE_URL."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.example.com/")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("VITE_API_URL", raising=False)
    monkeypatch.delenv("WEBHOOK_PATH", raising=False)

    settings = config.get_settings()

    assert settings.public_base_url == "https://poker.example.com"
    assert settings.webhook_path == "/telegram/webhook"
    assert settings.webhook_url == "https://poker.example.com/telegram/webhook"
    assert settings.cors_origins == "https://poker.example.com"
    assert settings.vite_api_url == "https://poker.example.com/api"


def test_custom_webhook_path_normalized(monkeypatch):
    """WEBHOOK_PATH without leading slash is normalized correctly."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv("WEBHOOK_PATH", "telegram/custom")

    settings = config.get_settings()

    assert settings.webhook_path == "/telegram/custom"
    assert settings.webhook_url == "https://example.com/telegram/custom"


def test_mini_app_url_with_relative_vite_api_url(monkeypatch):
    """mini_app_url should derive correctly when VITE_API_URL is a relative path."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.shahin8n.sbs")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv("VITE_API_URL", "/api")

    settings = config.get_settings()

    assert settings.vite_api_url == "/api"
    assert settings.mini_app_url == "https://poker.shahin8n.sbs"


def test_mini_app_url_with_absolute_vite_api_url(monkeypatch):
    """mini_app_url should derive correctly when VITE_API_URL is an absolute URL."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.shahin8n.sbs")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv("VITE_API_URL", "https://poker.shahin8n.sbs/api")

    settings = config.get_settings()

    assert settings.vite_api_url == "https://poker.shahin8n.sbs/api"
    assert settings.mini_app_url == "https://poker.shahin8n.sbs"


def test_mini_app_url_when_vite_api_url_not_set(monkeypatch):
    """mini_app_url should use PUBLIC_BASE_URL when VITE_API_URL is not set."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("VITE_API_URL", raising=False)

    settings = config.get_settings()

    # vite_api_url should be derived from PUBLIC_BASE_URL
    assert settings.vite_api_url == "https://poker.example.com/api"
    assert settings.mini_app_url == "https://poker.example.com"


def test_admin_public_url_defaults_to_public_base_url(monkeypatch):
    """admin_public_url should fall back to PUBLIC_BASE_URL when ADMIN_PUBLIC_BASE_URL is not set."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("ADMIN_PUBLIC_BASE_URL", raising=False)

    settings = config.get_settings()

    assert settings.admin_public_url == "https://poker.example.com"


def test_admin_public_url_uses_custom_value(monkeypatch):
    """admin_public_url should use ADMIN_PUBLIC_BASE_URL when explicitly set."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv("ADMIN_PUBLIC_BASE_URL", "https://admin.example.com")

    settings = config.get_settings()

    assert settings.admin_public_url == "https://admin.example.com"


def test_admin_dashboard_path_defaults(monkeypatch):
    """admin_dashboard_path should have correct default value."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.delenv("ADMIN_DASHBOARD_PATH", raising=False)

    settings = config.get_settings()

    assert settings.admin_dashboard_path == "/admin/panel"


def test_admin_dashboard_path_custom(monkeypatch):
    """admin_dashboard_path should use custom value when set."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.example.com")
    monkeypatch.setenv("WEBAPP_SECRET", "secret")
    monkeypatch.setenv("ADMIN_DASHBOARD_PATH", "/admin/dashboard")

    settings = config.get_settings()

    assert settings.admin_dashboard_path == "/admin/dashboard"
