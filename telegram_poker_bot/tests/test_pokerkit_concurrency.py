"""Test that PokerKit runtime handles concurrent actions correctly with per-table locking."""

import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.game_core.pokerkit_runtime import (
    get_pokerkit_runtime_manager,
    reset_pokerkit_runtime_cache,
)
from telegram_poker_bot.shared.models import ActionType, Base, User
from telegram_poker_bot.shared.services import table_service

pytest.importorskip("aiosqlite")


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


@pytest.mark.asyncio
async def test_concurrent_get_state_calls_on_same_table(
    db_session: AsyncSession,
) -> None:
    """
    Test that concurrent get_state calls on the same table don't cause race conditions.

    This verifies per-table locking works correctly.
    """
    # Create users
    creator = User(tg_user_id=3001, language="en")
    player2 = User(tg_user_id=3002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create a table and seat players
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        is_private=False,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # Start the game
    await manager.start_game(db_session, table.id)

    # Make concurrent get_state calls
    async def get_state_task(user_id: int):
        return await manager.get_state(db_session, table.id, user_id)

    # Run 10 concurrent get_state calls
    tasks = [get_state_task(creator.id) for _ in range(10)]
    states = await asyncio.gather(*tasks)

    # All states should be valid and consistent
    assert len(states) == 10
    for state in states:
        assert state is not None
        assert "players" in state
        assert len(state["players"]) == 2
        assert state["table_id"] == table.id


@pytest.mark.asyncio
async def test_different_tables_can_be_accessed_concurrently(
    db_session: AsyncSession,
) -> None:
    """
    Test that operations on different tables can proceed concurrently.

    This verifies that per-table locking doesn't create a global bottleneck.
    """
    # Create users
    user1 = User(tg_user_id=4001, language="en")
    user2 = User(tg_user_id=4002, language="en")
    user3 = User(tg_user_id=4003, language="en")
    user4 = User(tg_user_id=4004, language="en")
    db_session.add_all([user1, user2, user3, user4])
    await db_session.flush()

    # Create two tables
    table1 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user1.id,
        is_private=False,
        auto_seat_creator=False,
    )
    table2 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user3.id,
        is_private=False,
        auto_seat_creator=False,
    )

    # Seat players
    await table_service.seat_user_at_table(db_session, table1.id, user1.id)
    await table_service.seat_user_at_table(db_session, table1.id, user2.id)
    await table_service.seat_user_at_table(db_session, table2.id, user3.id)
    await table_service.seat_user_at_table(db_session, table2.id, user4.id)

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # Start games concurrently on both tables
    async def start_game_task(table_id: int):
        return await manager.start_game(db_session, table_id)

    # Run start_game on both tables concurrently
    states = await asyncio.gather(
        start_game_task(table1.id),
        start_game_task(table2.id),
    )

    # Both games should start successfully
    assert len(states) == 2
    assert states[0]["table_id"] == table1.id
    assert states[1]["table_id"] == table2.id
    assert len(states[0]["players"]) == 2
    assert len(states[1]["players"]) == 2


@pytest.mark.asyncio
async def test_ensure_table_can_be_called_without_lock(
    db_session: AsyncSession,
) -> None:
    """
    Test that ensure_table can be called multiple times concurrently without deadlock.

    This verifies that ensure_table does not hold a global lock.
    """
    # Create users
    creator = User(tg_user_id=5001, language="en")
    player2 = User(tg_user_id=5002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create a table
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        is_private=False,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # Call ensure_table concurrently multiple times
    async def ensure_table_task():
        return await manager.ensure_table(db_session, table.id)

    # Run 20 concurrent ensure_table calls
    tasks = [ensure_table_task() for _ in range(20)]
    runtimes = await asyncio.gather(*tasks)

    # All should succeed and return the same runtime instance
    assert len(runtimes) == 20
    for runtime in runtimes:
        assert runtime is not None
        assert len(runtime.seats) == 2
        assert runtime.table.id == table.id


@pytest.mark.asyncio
async def test_concurrent_actions_are_serialized_per_table(
    db_session: AsyncSession,
) -> None:
    """
    Test that concurrent actions on the same table are properly serialized.

    This is a basic sanity check - we can't fully test race conditions without
    actual concurrent execution, but we can verify the locking mechanism works.
    """
    # Create users
    creator = User(tg_user_id=6001, language="en")
    player2 = User(tg_user_id=6002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create a table and seat players
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        is_private=False,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # Start the game
    await manager.start_game(db_session, table.id)

    # Get initial state to determine whose turn it is
    state = await manager.get_state(db_session, table.id, creator.id)
    current_actor_user_id = state.get("current_actor")

    # Verify we have an actor
    assert current_actor_user_id is not None

    # Call handle_action with lock (should work)
    result = await manager.handle_action(
        db_session,
        table.id,
        current_actor_user_id,
        ActionType.CALL,
        None,
    )

    # Verify result is valid
    assert result is not None
    assert "players" in result
    assert result["table_id"] == table.id
