"""Test configuration and cross-database helpers."""

import asyncio
import os

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kw):
    """Render PostgreSQL JSONB columns as generic JSON when using SQLite."""

    return "JSON"


os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_suite.db")

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_test_database():
    """Ensure the default SQLite database has the full schema for integration tests."""

    from telegram_poker_bot.shared.database import engine
    from telegram_poker_bot.shared.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
