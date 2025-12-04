"""Test configuration and cross-database helpers."""

import asyncio
import os
from typing import Dict, Any, Optional

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kw):
    """Render PostgreSQL JSONB columns as generic JSON when using SQLite."""

    return "JSON"


os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_suite.db")
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")

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


def create_test_template_config(
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 1000,
    max_players: int = 6,
    **kwargs: Any
) -> Dict[str, Any]:
    """Create a test template configuration with sensible defaults.
    
    Args:
        small_blind: Small blind amount (default: 25)
        big_blind: Big blind amount (default: 50)
        starting_stack: Starting stack amount (default: 1000)
        max_players: Maximum number of players (default: 6)
        **kwargs: Additional config parameters to override defaults
        
    Returns:
        Template configuration dictionary
    """
    config = {
        "small_blind": small_blind,
        "big_blind": big_blind,
        "starting_stack": starting_stack,
        "max_players": max_players,
        "ante": kwargs.get("ante", 0),
        "raw_antes": kwargs.get("raw_antes", 0),
        "raw_blinds_or_straddles": kwargs.get("raw_blinds_or_straddles", [small_blind, big_blind]),
        "min_bet": kwargs.get("min_bet", big_blind),
        "rake_percentage": kwargs.get("rake_percentage", 0.05),
        "rake_cap": kwargs.get("rake_cap", 100),
        "turn_timeout_seconds": kwargs.get("turn_timeout_seconds", 30),
        "game_variant": kwargs.get("game_variant", "no_limit_texas_holdem"),
        "currency_type": kwargs.get("currency_type", "PLAY"),
    }
    # Allow arbitrary additional fields
    for key, value in kwargs.items():
        if key not in config:
            config[key] = value
    return config


@pytest.fixture
def test_template_config():
    """Provide a factory function for creating test template configurations."""
    return create_test_template_config


async def create_test_template(db, **kwargs):
    """Create a table template for testing.
    
    This is a helper function that creates a properly validated template
    with test-friendly defaults. Use this instead of calling table_service
    functions directly.
    
    Args:
        db: Database session
        **kwargs: Override any config parameters
        
    Returns:
        Created TableTemplate instance
    """
    from telegram_poker_bot.shared.models import TableTemplateType
    from telegram_poker_bot.shared.services import table_service
    
    name = kwargs.pop("name", "Test Template")
    table_type = kwargs.pop("table_type", TableTemplateType.EXPIRING)
    has_waitlist = kwargs.pop("has_waitlist", False)
    
    config = create_test_template_config(**kwargs)
    
    return await table_service.create_table_template(
        db,
        name=name,
        table_type=table_type,
        has_waitlist=has_waitlist,
        config=config,
    )
