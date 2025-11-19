"""Integration tests for game flow."""

import pytest
from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.models import Base
from telegram_poker_bot.game_core import TableManager, MatchmakingPool
from telegram_poker_bot.shared.models import GameMode, TableStatus


class InMemoryRedis:
    """Minimal async Redis clone for sorted-set operations used in tests."""

    def __init__(self) -> None:
        self._sorted_sets: Dict[str, Dict[str, float]] = defaultdict(dict)

    async def zadd(self, key: str, mapping: Dict[str, float]) -> None:
        self._sorted_sets[key].update(mapping)

    async def expire(self, key: str, _ttl: int) -> bool:
        self._sorted_sets.setdefault(key, {})
        return True

    async def zrange(self, key: str, start: int, end: int) -> List[bytes]:
        items: List[Tuple[str, float]] = sorted(
            self._sorted_sets.get(key, {}).items(), key=lambda item: (item[1], item[0])
        )
        if end == -1:
            slice_items = items[start:]
        else:
            slice_items = items[start : end + 1]
        return [member.encode() for member, _ in slice_items]

    async def zrem(self, key: str, member: bytes) -> None:
        decoded = member.decode() if isinstance(member, (bytes, bytearray)) else str(member)
        self._sorted_sets.get(key, {}).pop(decoded, None)

    async def zremrangebyscore(self, key: str, min_score: float, max_score: float) -> None:
        bucket = self._sorted_sets.get(key, {})
        to_remove: Iterable[str] = [
            member for member, score in bucket.items() if min_score <= score <= max_score
        ]
        for member in to_remove:
            bucket.pop(member, None)

    async def flushdb(self) -> None:
        self._sorted_sets.clear()

    async def close(self) -> None:
        self._sorted_sets.clear()


@pytest_asyncio.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()
    
    await engine.dispose()


@pytest_asyncio.fixture
async def redis_client():
    """Create test Redis client."""
    client = InMemoryRedis()
    yield client
    await client.flushdb()


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
