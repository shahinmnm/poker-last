"""Alembic migration configuration."""

from logging.config import fileConfig
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool, text
from sqlalchemy.ext.asyncio import AsyncEngine

MIGRATIONS_DIR = Path(__file__).resolve().parent
PACKAGE_ROOT = MIGRATIONS_DIR.parent
REPO_ROOT = PACKAGE_ROOT.parent

for path in (REPO_ROOT, PACKAGE_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.models import Base

# Import all models to ensure they're registered
from telegram_poker_bot.shared import models  # noqa: F401

settings = get_settings()
DATABASE_URL = settings.database_url
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not configured.")

# this is the Alembic Config object
config = context.config

# Set SQLAlchemy URL from settings, escaping percent signs for ConfigParser interpolation.
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def _cleanup_stale_alembic_version_type(connection) -> None:
    """Remove an orphaned alembic_version type to prevent duplicate type errors."""

    type_exists = connection.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'alembic_version'
                AND n.nspname = current_schema()
            )
            """
        )
    ).scalar()

    table_exists = connection.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = 'alembic_version'
                AND table_schema = current_schema()
            )
            """
        )
    ).scalar()

    if type_exists and not table_exists:
        connection.execute(text("DROP TYPE IF EXISTS alembic_version"))


def do_run_migrations(connection):
    """Run migrations with connection."""
    _cleanup_stale_alembic_version_type(connection)

    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section) or {}
    configuration = dict(configuration)  # ensure we don't mutate Alembic config state
    configuration["sqlalchemy.url"] = DATABASE_URL
    connectable = AsyncEngine(
        engine_from_config(
            configuration,
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio

    asyncio.run(run_migrations_online())
