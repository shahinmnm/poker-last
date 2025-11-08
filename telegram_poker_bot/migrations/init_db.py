"""Setup script for initial database migration."""

import asyncio
from alembic.config import Config
from alembic import command
from telegram_poker_bot.shared.config import get_settings

settings = get_settings()


def run_migrations():
    """Run database migrations."""
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")
    print("Migrations completed successfully!")


if __name__ == "__main__":
    run_migrations()
