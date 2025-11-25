"""Test for inter-hand phase hand_no increment bug fix.

This test verifies that when both players signal "Ready" during the inter-hand
phase, the system properly:
1. Marks the old hand as ENDED
2. Clears runtime state (current_hand and engine)
3. Creates a NEW hand with incremented hand_no (not reusing the old one)

Bug: Previously, load_or_create_hand would find the old hand in the session
cache even after it was marked ENDED, causing the same hand to be reused.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.models import (
    Base,
    Hand,
    HandStatus,
    Seat,
    Table,
    TableStatus,
    User,
    GameMode,
)
from telegram_poker_bot.game_core.pokerkit_runtime import (
    PokerKitTableRuntimeManager,
)


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
async def test_table_with_seats(db_session: AsyncSession):
    """Create a test table with 2 players."""
    # Create users
    user1 = User(tg_user_id=1001, username="player1")
    user2 = User(tg_user_id=1002, username="player2")
    db_session.add_all([user1, user2])
    await db_session.flush()

    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        config_json={"small_blind": 25, "big_blind": 50},
    )
    db_session.add(table)
    await db_session.flush()

    # Create seats
    seat1 = Seat(
        table_id=table.id, user_id=user1.id, position=0, chips=1000, left_at=None
    )
    seat2 = Seat(
        table_id=table.id, user_id=user2.id, position=1, chips=1000, left_at=None
    )
    db_session.add_all([seat1, seat2])
    await db_session.flush()
    await db_session.commit()

    return table, [seat1, seat2], [user1, user2]


@pytest.mark.asyncio
async def test_complete_inter_hand_creates_new_hand_with_incremented_hand_no(
    db_session: AsyncSession, test_table_with_seats
):
    """Test that complete_inter_hand_phase creates a new hand with incremented hand_no.

    This test reproduces the bug where:
    1. Hand #1 completes and enters INTER_HAND_WAIT
    2. Both players click "Ready"
    3. complete_inter_hand_phase marks hand #1 as ENDED
    4. start_new_hand is called
    5. BUG: load_or_create_hand finds hand #1 in session cache (even though it's ENDED)
    6. BUG: Hand #1 is reused instead of creating hand #2

    The fix ensures:
    - runtime.current_hand is set to None after marking as ENDED
    - runtime.engine is set to None after marking as ENDED
    - load_or_create_hand double-checks hand.status != ENDED
    """
    table, seats, users = test_table_with_seats
    manager = PokerKitTableRuntimeManager()

    # Start first hand
    await manager.start_game(db_session, table.id)
    await db_session.commit()

    # Verify hand #1 was created
    runtime = await manager.ensure_table(db_session, table.id)
    assert runtime.current_hand is not None
    assert runtime.current_hand.hand_no == 1
    assert runtime.current_hand.status == HandStatus.PREFLOP
    assert runtime.engine is not None
    hand1_id = runtime.current_hand.id

    # Simulate hand completion - mark as INTER_HAND_WAIT
    runtime.current_hand.status = HandStatus.INTER_HAND_WAIT
    runtime.inter_hand_wait_start = datetime.now(timezone.utc)
    await db_session.flush()
    await db_session.commit()

    # Simulate both players clicking "Ready"
    runtime.ready_players = {users[0].id, users[1].id}

    # Call complete_inter_hand_phase - this should:
    # 1. Mark hand #1 as ENDED
    # 2. Clear runtime.current_hand and runtime.engine
    # 3. Create hand #2 (NOT reuse hand #1)
    result = await manager.complete_inter_hand_phase(db_session, table.id)
    await db_session.commit()

    # Verify the result indicates a new hand was started
    assert "state" in result
    assert "table_ended" not in result

    # Verify runtime state was properly reset and new hand created
    runtime = await manager.ensure_table(db_session, table.id)
    assert runtime.current_hand is not None
    assert runtime.current_hand.hand_no == 2, "New hand should have hand_no=2"
    assert runtime.current_hand.id != hand1_id, "New hand should have different ID"
    assert runtime.current_hand.status == HandStatus.PREFLOP
    assert runtime.engine is not None

    # Verify old hand is ENDED in database
    result = await db_session.execute(select(Hand).where(Hand.id == hand1_id))
    old_hand = result.scalar_one()
    assert old_hand.status == HandStatus.ENDED
    assert old_hand.hand_no == 1

    # Verify new hand exists in database
    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id, Hand.hand_no == 2)
    )
    new_hand = result.scalar_one()
    assert new_hand.status == HandStatus.PREFLOP
    assert new_hand.id == runtime.current_hand.id
