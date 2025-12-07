"""Test that PokerKit runtime uses Redis distributed locks correctly."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.game_core.pokerkit_runtime import (
    get_pokerkit_runtime_manager,
    reset_pokerkit_runtime_cache,
)
from telegram_poker_bot.game_core import get_redis_client
from telegram_poker_bot.shared.models import Base, User
from telegram_poker_bot.shared.services import table_service

pytest.importorskip("aiosqlite")

# Test lock keys for cleanup
TEST_LOCK_KEYS = ["lock:table:1", "lock:table:2", "lock:table:999"]


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Create an in-memory database session for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()
    reset_pokerkit_runtime_cache()


@pytest_asyncio.fixture
async def redis_client():
    """Get Redis client for testing."""
    client = await get_redis_client()
    # Clean up any existing test locks
    await client.delete(*TEST_LOCK_KEYS)
    yield client
    # Clean up after test
    await client.delete(*TEST_LOCK_KEYS)


@pytest.mark.asyncio
async def test_distributed_lock_is_created_correctly(
    db_session: AsyncSession,
    redis_client,
) -> None:
    """
    Test that the distributed lock method creates a Redis lock with correct parameters.

    Verifies:
    - Lock key format is correct
    - Lock can be acquired and released
    """
    manager = get_pokerkit_runtime_manager()

    # Get a distributed lock
    lock = await manager._get_distributed_lock(table_id=999)

    # Verify lock has expected attributes
    assert lock is not None
    assert hasattr(lock, "name")
    assert lock.name == "lock:table:999"  # Lock name is a string in redis-py 5.x

    # Test acquiring and releasing the lock
    acquired = await lock.acquire()
    assert acquired is True

    # Release the lock
    await lock.release()


@pytest.mark.asyncio
async def test_distributed_locks_are_table_specific(
    db_session: AsyncSession,
    redis_client,
) -> None:
    """
    Test that different tables get different locks.

    Verifies:
    - Table 1 and Table 2 have separate locks
    - Locks can be acquired independently
    """
    manager = get_pokerkit_runtime_manager()

    # Get locks for two different tables
    lock1 = await manager._get_distributed_lock(table_id=1)
    lock2 = await manager._get_distributed_lock(table_id=2)

    # Verify different lock names
    assert lock1.name != lock2.name
    assert lock1.name == "lock:table:1"
    assert lock2.name == "lock:table:2"

    # Both locks can be acquired independently
    acquired1 = await lock1.acquire()
    acquired2 = await lock2.acquire()

    assert acquired1 is True
    assert acquired2 is True

    # Release both locks
    await lock1.release()
    await lock2.release()


@pytest.mark.asyncio
async def test_distributed_lock_prevents_concurrent_access(
    db_session: AsyncSession,
    redis_client,
) -> None:
    """
    Test that distributed lock prevents concurrent access to the same table.

    Verifies:
    - First lock acquisition succeeds
    - Second attempt blocks (or fails quickly due to blocking_timeout)
    """
    manager = get_pokerkit_runtime_manager()

    # Get a lock and hold it
    lock1 = await manager._get_distributed_lock(table_id=1)
    acquired1 = await lock1.acquire()
    assert acquired1 is True

    try:
        # Try to get the same lock from another "worker" (simulated)
        lock2 = await manager._get_distributed_lock(table_id=1)

        # This should block or timeout quickly (blocking_timeout=5)
        # We expect acquire() to return False when timeout is reached
        acquired2 = await lock2.acquire(blocking=False)
        assert acquired2 is False

    finally:
        # Release the first lock
        await lock1.release()


@pytest.mark.asyncio
async def test_operations_use_distributed_locks(
    db_session: AsyncSession,
    redis_client,
) -> None:
    """
    Test that actual table operations use distributed locks.

    This is an integration test that verifies get_state uses the lock.
    """
    # Create users
    creator = User(tg_user_id=7001, language="en")
    player2 = User(tg_user_id=7002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create template for test
    from telegram_poker_bot.tests.conftest import create_test_template

    template = await create_test_template(
        db_session,
        name="Distributed Lock Test Template",
    )

    # Create table from template
    table = await table_service.create_table(
        db_session,
        creator_user_id=creator.id,
        template_id=template.id,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # Start the game
    await manager.start_game(db_session, table.id)

    # Get state should work and use the distributed lock internally
    state = await manager.get_state(db_session, table.id, creator.id)

    assert state is not None
    assert state["table_id"] == table.id
    assert len(state["players"]) == 2


@pytest.mark.asyncio
async def test_lock_is_released_on_exception(
    db_session: AsyncSession,
    redis_client,
) -> None:
    """
    Test that locks are properly released even when exceptions occur.

    Verifies:
    - Lock is released after an exception in the locked section
    - Subsequent operations can acquire the lock
    """
    manager = get_pokerkit_runtime_manager()

    # Try to acquire lock and raise an exception
    try:
        lock = await manager._get_distributed_lock(table_id=999)
        async with lock:
            # Simulate some error happening
            raise ValueError("Test exception")
    except ValueError:
        pass  # Expected

    # Now try to acquire the same lock - it should be available
    lock2 = await manager._get_distributed_lock(table_id=999)
    acquired = await lock2.acquire()
    assert acquired is True
    await lock2.release()
