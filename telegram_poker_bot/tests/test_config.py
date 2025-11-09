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
