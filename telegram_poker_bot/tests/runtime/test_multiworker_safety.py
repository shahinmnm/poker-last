"""Test that PokerKit runtime has documented multi-worker behavior."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.game_core.pokerkit_runtime import (
    PokerKitTableRuntimeManager,
    reset_pokerkit_runtime_cache,
)
from telegram_poker_bot.shared.models import ActionType, Base, Hand, HandStatus, User
from telegram_poker_bot.shared.services import table_service
from sqlalchemy import select

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
async def test_worker_loads_hand_state_on_first_access(
    db_session: AsyncSession,
) -> None:
    """
    Test that a worker loads hand state from DB on first access.

    This verifies that when a hand is already in progress (created by another worker),
    a new worker can pick up where it left off by loading from DB.
    """
    # Create users
    creator = User(tg_user_id=8001, language="en")
    player2 = User(tg_user_id=8002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create template for test
    from telegram_poker_bot.tests.conftest import create_test_template
    template = await create_test_template(
        db_session,
        name="Test Template",
        table_name="Test Table",
    )

    # Create a table and seat players
    table = await table_service.create_table(
        db_session,
        creator_user_id=creator.id,
        template_id=template.id,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Worker 1 starts a game
    manager1 = PokerKitTableRuntimeManager()
    state1 = await manager1.start_game(db_session, table.id)

    # Verify hand was created in DB
    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id, Hand.status != HandStatus.ENDED)
    )
    hand = result.scalar_one()
    assert hand is not None
    assert hand.engine_state_json is not None

    await db_session.commit()

    # Worker 2 (new manager simulating different process)
    manager2 = PokerKitTableRuntimeManager()

    # Worker 2 gets state - should load from DB on first access
    state2 = await manager2.get_state(db_session, table.id, creator.id)

    # Worker 2 should see the game that Worker 1 started
    assert state2 is not None
    assert state2["hand_id"] == state1["hand_id"]
    assert state2["status"] == state1["status"]


@pytest.mark.asyncio
async def test_same_worker_handles_sequential_actions(
    db_session: AsyncSession,
) -> None:
    """
    Test that a single worker can handle sequential actions correctly.

    This verifies the normal case where one worker handles multiple actions in sequence.
    """
    # Create users
    creator = User(tg_user_id=9001, language="en")
    player2 = User(tg_user_id=9002, language="en")
    db_session.add_all([creator, player2])
    await db_session.flush()

    # Create template for test
    from telegram_poker_bot.tests.conftest import create_test_template
    template = await create_test_template(
        db_session,
        name="Test Template",
    )

    # Create a table and seat players
    table = await table_service.create_table(
        db_session,
        creator_user_id=creator.id,
        template_id=template.id,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Worker handles start and multiple actions
    manager = PokerKitTableRuntimeManager()
    state1 = await manager.start_game(db_session, table.id)

    actor1 = state1.get("current_actor")
    state2 = await manager.handle_action(
        db_session, table.id, actor1, ActionType.CALL, None
    )

    # Next action
    actor2 = state2.get("current_actor")
    assert actor2 is not None

    state3 = await manager.handle_action(
        db_session, table.id, actor2, ActionType.CHECK, None
    )

    # Verify the sequence was successful
    assert state3 is not None
    # After call and check, we should be at flop
    assert state3["status"] == "flop"

    # Verify state was persisted to DB
    result = await db_session.execute(select(Hand).where(Hand.table_id == table.id))
    hand = result.scalar_one()
    assert hand.engine_state_json is not None


@pytest.mark.asyncio
async def test_table_and_seat_data_always_fresh_from_db(
    db_session: AsyncSession,
) -> None:
    """
    Test that table and seat data are always refreshed from DB.

    This ensures that even with caching, table/seat metadata is current.
    """
    # Create users
    creator = User(tg_user_id=10001, language="en")
    player2 = User(tg_user_id=10002, language="en")
    player3 = User(tg_user_id=10003, language="en")
    db_session.add_all([creator, player2, player3])
    await db_session.flush()

    # Create template for test
    from telegram_poker_bot.tests.conftest import create_test_template
    template = await create_test_template(
        db_session,
        name="Test Template",
    )

    # Create a table with initial players
    table = await table_service.create_table(
        db_session,
        creator_user_id=creator.id,
        template_id=template.id,
        auto_seat_creator=False,
    )
    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    await table_service.seat_user_at_table(db_session, table.id, player2.id)

    # Manager loads initial state
    manager = PokerKitTableRuntimeManager()
    runtime1 = await manager.ensure_table(db_session, table.id)
    assert len(runtime1.seats) == 2

    # Add a third player
    await table_service.seat_user_at_table(db_session, table.id, player3.id)
    await db_session.commit()

    # Manager should see updated seats on next ensure_table call
    runtime2 = await manager.ensure_table(db_session, table.id)
    assert len(runtime2.seats) == 3
    assert runtime2.seats[-1].user_id == player3.id
