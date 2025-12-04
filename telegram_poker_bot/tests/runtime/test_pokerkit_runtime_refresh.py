"""Test that PokerKit runtime refreshes seat data correctly."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.game_core.pokerkit_runtime import (
    get_pokerkit_runtime_manager,
    reset_pokerkit_runtime_cache,
)
from telegram_poker_bot.shared.models import Base, User
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
async def test_runtime_refreshes_seats_when_players_join(
    db_session: AsyncSession,
) -> None:
    """
    Test that the runtime manager refreshes seat data when players join after table creation.

    This tests the fix for the issue where the runtime was cached with 0 players,
    and then when players joined and the game started, it would fail with
    "Player count must be between 2 and 8, got 0".
    """
    # Create users
    creator = User(tg_user_id=1001, language="en")
    player2 = User(tg_user_id=1002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create a table (no players seated yet)
    # Create template for test
    from telegram_poker_bot.tests.conftest import create_test_template
    template = await create_test_template(
        db_session,
        name="Test Template",
    )

    # Create table from template
    table = await table_service.create_table(
        db_session,
        creator_user_id=creator.id,
        template_id=template.id,
        auto_seat_creator=False,

    )

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # First ensure_table call - should have 0 seats
    runtime1 = await manager.ensure_table(db_session, table.id)
    assert len(runtime1.seats) == 0, "Should have 0 seats initially"

    # Now seat the creator
    await table_service.seat_user_at_table(db_session, table.id, creator.id)

    # Second ensure_table call - should have 1 seat (refreshed from DB)
    runtime2 = await manager.ensure_table(db_session, table.id)
    assert len(runtime2.seats) == 1, "Should have 1 seat after creator joins"

    # Seat the second player
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Third ensure_table call - should have 2 seats (refreshed from DB)
    runtime3 = await manager.ensure_table(db_session, table.id)
    assert len(runtime3.seats) == 2, "Should have 2 seats after second player joins"

    # Now try to start the game - this should not raise an error
    # Previously it would fail with "Player count must be between 2 and 8, got 0"
    state = await manager.start_game(db_session, table.id)

    # Verify the game started successfully
    assert state is not None
    assert "players" in state
    assert len(state["players"]) == 2, "Game should start with 2 players"


@pytest.mark.asyncio
async def test_runtime_refreshes_when_player_leaves(db_session: AsyncSession) -> None:
    """Test that the runtime updates when a player leaves the table."""
    # Create users
    creator = User(tg_user_id=2001, language="en")
    player2 = User(tg_user_id=2002, language="en")
    player3 = User(tg_user_id=2003, language="en")
    db_session.add_all([creator, player2, player3])
    await db_session.flush()

    # Create a table and seat all players
    # Create template for test
    from telegram_poker_bot.tests.conftest import create_test_template
    template = await create_test_template(
        db_session,
        name="Test Template",
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
    await table_service.seat_user_at_table(db_session, table.id, player3.id)

    # Get the runtime manager
    manager = get_pokerkit_runtime_manager()

    # Ensure table - should have 3 seats
    runtime1 = await manager.ensure_table(db_session, table.id)
    assert len(runtime1.seats) == 3, "Should have 3 seats"

    # Player 3 leaves
    await table_service.leave_table(db_session, table.id, player3.id)

    # Ensure table again - should have 2 seats (refreshed from DB)
    runtime2 = await manager.ensure_table(db_session, table.id)
    assert len(runtime2.seats) == 2, "Should have 2 seats after player leaves"

    # Verify we can start the game with 2 players
    state = await manager.start_game(db_session, table.id)
    assert state is not None
    assert len(state["players"]) == 2
