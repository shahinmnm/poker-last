"""Test configuration and shared fixtures for Phase 6 test suite.

This module provides test fixtures aligned with the template-driven,
persistent SNG, and analytics-enabled architecture (Phases 1-5).
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Configure SQLite to handle PostgreSQL JSONB types
@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kw):
    """Render PostgreSQL JSONB columns as generic JSON when using SQLite."""
    return "JSON"


# Set test database URL
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_phase6.db")


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test.
    
    This fixture provides isolation between tests by creating
    a fresh in-memory database for each test function.
    """
    from telegram_poker_bot.shared.models import Base
    
    # Use in-memory SQLite for speed
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session factory
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        yield session
        await session.rollback()
    
    # Cleanup
    await engine.dispose()


def create_template_config(
    game_variant: str = "no_limit_texas_holdem",
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 1000,
    max_players: int = 6,
    **overrides: Any
) -> Dict[str, Any]:
    """Create a template configuration with sensible defaults.
    
    This factory function creates template configs aligned with the
    template-driven architecture from Phase 1.
    
    Args:
        game_variant: Game variant (default: no_limit_texas_holdem)
        small_blind: Small blind amount (default: 25)
        big_blind: Big blind amount (default: 50)
        starting_stack: Starting stack amount (default: 1000)
        max_players: Maximum number of players (default: 6)
        **overrides: Additional config parameters to override
        
    Returns:
        Template configuration dictionary
    """
    config = {
        "game_variant": game_variant,
        "small_blind": small_blind,
        "big_blind": big_blind,
        "starting_stack": starting_stack,
        "max_players": max_players,
        "ante": 0,
        "raw_antes": 0,
        "raw_blinds_or_straddles": [small_blind, big_blind],
        "min_bet": big_blind,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
    }
    
    # Apply overrides
    config.update(overrides)
    return config


@pytest.fixture
def template_config_factory():
    """Provide factory function for creating template configurations."""
    return create_template_config


@pytest_asyncio.fixture
async def sample_template(db_session: AsyncSession):
    """Create a sample table template for testing.
    
    Returns a PERSISTENT template with standard cash game settings.
    """
    from telegram_poker_bot.shared.models import TableTemplate, TableTemplateType
    
    template = TableTemplate(
        name="Standard Cash Game",
        table_type=TableTemplateType.PERSISTENT,
        config_json=create_template_config()
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)
    return template


@pytest_asyncio.fixture
async def sample_users(db_session: AsyncSession):
    """Create sample users for testing.
    
    Returns a list of 4 users with unique Telegram IDs.
    """
    from telegram_poker_bot.shared.models import User
    import random
    
    # Use random IDs to avoid conflicts across tests
    base_id = random.randint(100000, 999999)
    users = [
        User(tg_user_id=base_id + i, username=f"player{base_id + i}")
        for i in range(4)
    ]
    db_session.add_all(users)
    await db_session.commit()
    for user in users:
        await db_session.refresh(user)
    return users


@pytest_asyncio.fixture
async def sample_table(db_session: AsyncSession, sample_template, sample_users):
    """Create a sample table with template and users.
    
    Returns a WAITING table with a template configured.
    """
    from telegram_poker_bot.shared.models import Table, TableStatus, GameMode
    
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=sample_template.id,
        creator_id=sample_users[0].id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(table)
    await db_session.commit()
    await db_session.refresh(table)
    return table
