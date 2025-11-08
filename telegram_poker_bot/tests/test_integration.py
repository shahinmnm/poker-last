"""Integration tests for game flow."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from telegram_poker_bot.shared.models import Base
from telegram_poker_bot.game_core import TableManager, MatchmakingPool
from telegram_poker_bot.shared.models import GameMode, TableStatus
import redis.asyncio as redis


@pytest.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_schema_creation(Base.metadata)
    
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()
    
    await engine.dispose()


@pytest.fixture
async def redis_client():
    """Create test Redis client."""
    client = await redis.from_url("redis://localhost:6379/15")  # Use DB 15 for tests
    yield client
    await client.flushdb()
    await client.close()


@pytest.mark.asyncio
async def test_matchmaking_pool_add_remove(db_session, redis_client):
    """Test matchmaking pool add/remove."""
    pool = MatchmakingPool(redis_client)
    
    await pool.add_player(123, {"pref": "test"})
    players = await pool.get_waiting_players(min_players=1)
    assert 123 in players
    
    await pool.remove_player(123)
    players = await pool.get_waiting_players(min_players=1)
    assert 123 not in players


@pytest.mark.asyncio
async def test_table_creation(db_session, redis_client):
    """Test table creation."""
    table_manager = TableManager(db_session, redis_client)
    
    table = await table_manager.create_table(
        mode=GameMode.ANONYMOUS,
        user_ids=[1, 2],
    )
    
    assert table.id is not None
    assert table.mode == GameMode.ANONYMOUS
    assert table.status == TableStatus.WAITING
