"""Tests for PokerKit engine state persistence."""

import pytest
import pytest_asyncio
from pokerkit import Mode
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
    ActionType,
)
from telegram_poker_bot.engine_adapter import PokerEngineAdapter
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
        status=TableStatus.WAITING,
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
async def test_adapter_persistence_roundtrip():
    """Test that adapter can be serialized and deserialized correctly."""
    # Create adapter
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=25,
        big_blind=50,
        mode=Mode.TOURNAMENT,
    )

    # Deal new hand
    adapter.deal_new_hand()

    # Serialize to persistence state
    state = adapter.to_persistence_state()

    # Verify state structure
    assert "player_count" in state
    assert "starting_stacks" in state
    assert "small_blind" in state
    assert "big_blind" in state
    assert "mode" in state
    assert "stacks" in state
    assert "bets" in state
    assert "hole_cards" in state
    assert "board_cards" in state
    assert "deck" in state

    # Verify config values
    assert state["player_count"] == 2
    assert state["small_blind"] == 25
    assert state["big_blind"] == 50

    # Verify hole cards were dealt
    assert len(state["hole_cards"]) == 2
    assert len(state["hole_cards"][0]) == 2  # 2 cards for player 0
    assert len(state["hole_cards"][1]) == 2  # 2 cards for player 1

    # Deserialize back to adapter
    restored_adapter = PokerEngineAdapter.from_persistence_state(state)

    # Verify restored adapter matches original
    assert restored_adapter.player_count == adapter.player_count
    assert restored_adapter.small_blind == adapter.small_blind
    assert restored_adapter.big_blind == adapter.big_blind
    assert list(restored_adapter.state.stacks) == list(adapter.state.stacks)
    assert list(restored_adapter.state.bets) == list(adapter.state.bets)

    # Verify hole cards were restored
    assert len(restored_adapter.state.hole_cards) == 2
    for i in range(2):
        assert len(restored_adapter.state.hole_cards[i]) == 2


@pytest.mark.asyncio
async def test_hand_creation_and_persistence(
    db_session: AsyncSession, test_table_with_seats
):
    """Test that Hand records are created and engine state is persisted."""
    table, seats, users = test_table_with_seats

    # Create runtime manager
    manager = PokerKitTableRuntimeManager()

    # Start game
    state = await manager.start_game(db_session, table.id)

    # Verify state was returned
    assert "type" in state
    assert state["type"] == "table_state"
    assert state["table_id"] == table.id

    # Query for Hand record
    from sqlalchemy import select

    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id).order_by(Hand.hand_no.desc())
    )
    hand = result.scalar_one_or_none()

    # Verify Hand was created
    assert hand is not None
    assert hand.hand_no == 1
    assert hand.status == HandStatus.PREFLOP
    assert hand.engine_state_json is not None
    assert len(hand.engine_state_json) > 0

    # Verify engine state has required fields
    engine_state = hand.engine_state_json
    assert "player_count" in engine_state
    assert engine_state["player_count"] == 2
    assert "hole_cards" in engine_state
    assert len(engine_state["hole_cards"]) == 2


@pytest.mark.asyncio
async def test_action_persistence(db_session: AsyncSession, test_table_with_seats):
    """Test that engine state is persisted after each action."""
    table, seats, users = test_table_with_seats

    # Create runtime manager
    manager = PokerKitTableRuntimeManager()

    # Start game
    state = await manager.start_game(db_session, table.id)

    # Get initial hand state
    from sqlalchemy import select

    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id).order_by(Hand.hand_no.desc())
    )
    hand = result.scalar_one()
    initial_state = hand.engine_state_json.copy()

    # Get current actor from state
    current_actor_user_id = state.get("current_actor")
    assert current_actor_user_id is not None

    # Perform action (call)
    await manager.handle_action(
        db_session, table.id, current_actor_user_id, ActionType.CALL, None
    )

    # Refresh hand from DB
    await db_session.refresh(hand)

    # Verify state was updated
    assert hand.engine_state_json != initial_state
    # Bets should have changed after action
    assert hand.engine_state_json["bets"] != initial_state["bets"]


@pytest.mark.asyncio
async def test_engine_restoration_after_restart(
    db_session: AsyncSession, test_table_with_seats
):
    """Test that engine can be restored from DB after process restart."""
    table, seats, users = test_table_with_seats

    # Create first manager and start game
    manager1 = PokerKitTableRuntimeManager()
    state1 = await manager1.start_game(db_session, table.id)

    # Perform some actions using current actor
    current_actor = state1.get("current_actor")
    state2 = await manager1.handle_action(
        db_session, table.id, current_actor, ActionType.CALL, None
    )

    current_actor = state2.get("current_actor")
    state3 = await manager1.handle_action(
        db_session, table.id, current_actor, ActionType.CHECK, None
    )

    # Record hand_no and table_id before restart
    hand_no = state3.get("hand_id")

    # Simulate process restart by creating new manager
    manager2 = PokerKitTableRuntimeManager()

    # Get state with new manager (should restore from DB)
    post_restart_state = await manager2.get_state(db_session, table.id, users[0].id)

    # Verify key state elements match
    assert post_restart_state["table_id"] == table.id
    assert post_restart_state["hand_id"] == hand_no

    # Verify we have players
    assert len(post_restart_state["players"]) == 2

    # Most importantly: verify we can continue playing after restoration
    # The engine was successfully restored if we can make another action
    current_actor = post_restart_state.get("current_actor")
    if current_actor:
        result = await manager2.handle_action(
            db_session, table.id, current_actor, ActionType.CHECK, None
        )
        # If this succeeds, the engine was properly restored
        assert "state" in result or "type" in result


@pytest.mark.asyncio
async def test_hand_status_updates(db_session: AsyncSession, test_table_with_seats):
    """Test that hand status is updated correctly after actions."""
    table, seats, users = test_table_with_seats

    # Create runtime manager
    manager = PokerKitTableRuntimeManager()

    # Start game
    state = await manager.start_game(db_session, table.id)

    # Get hand
    from sqlalchemy import select

    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id).order_by(Hand.hand_no.desc())
    )
    hand = result.scalar_one()

    # Initial status should be PREFLOP
    assert hand.status == HandStatus.PREFLOP

    # Progress through actions to reach flop
    current_actor = state.get("current_actor")
    state = await manager.handle_action(
        db_session, table.id, current_actor, ActionType.CALL, None
    )
    await db_session.refresh(hand)

    current_actor = state.get("current_actor")
    state = await manager.handle_action(
        db_session, table.id, current_actor, ActionType.CHECK, None
    )
    await db_session.refresh(hand)

    # Status should now be FLOP (after preflop betting round completes)
    assert hand.status == HandStatus.FLOP


@pytest.mark.asyncio
async def test_hand_completion_persistence(
    db_session: AsyncSession, test_table_with_seats
):
    """Test that hand is marked as ENDED when complete."""
    table, seats, users = test_table_with_seats

    # Create runtime manager
    manager = PokerKitTableRuntimeManager()

    # Start game
    state = await manager.start_game(db_session, table.id)

    # Get hand
    from sqlalchemy import select

    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id).order_by(Hand.hand_no.desc())
    )
    hand = result.scalar_one()

    # Current player folds - this should end the hand
    current_actor = state.get("current_actor")
    result = await manager.handle_action(
        db_session, table.id, current_actor, ActionType.FOLD, None
    )

    # Refresh hand
    await db_session.refresh(hand)

    # Verify hand is marked as ended
    assert hand.status == HandStatus.ENDED
    assert hand.ended_at is not None

    # Verify hand_result is in response
    assert "hand_result" in result


@pytest.mark.asyncio
async def test_multiple_hands_persistence(
    db_session: AsyncSession, test_table_with_seats
):
    """Test that multiple hands can be created and persisted."""
    table, seats, users = test_table_with_seats

    # Create runtime manager
    manager = PokerKitTableRuntimeManager()

    # Start first hand
    state = await manager.start_game(db_session, table.id)

    # Get first hand
    from sqlalchemy import select

    result = await db_session.execute(
        select(Hand)
        .where(Hand.table_id == table.id)
        .order_by(Hand.hand_no.desc())
        .limit(1)
    )
    hand1 = result.scalar_one()
    assert hand1.hand_no == 1

    # End first hand by folding
    current_actor = state.get("current_actor")
    await manager.handle_action(
        db_session, table.id, current_actor, ActionType.FOLD, None
    )
    await db_session.refresh(hand1)
    assert hand1.status == HandStatus.ENDED

    # Start second hand
    await manager.start_game(db_session, table.id)

    # Get all hands for this table
    result = await db_session.execute(
        select(Hand).where(Hand.table_id == table.id).order_by(Hand.hand_no.asc())
    )
    all_hands = result.scalars().all()

    # Verify we have 2 hands
    assert len(all_hands) == 2

    hand2 = all_hands[1]  # Second hand

    # Verify it's a new hand
    assert hand2.id != hand1.id
    assert hand2.hand_no == 2
    assert hand2.status == HandStatus.PREFLOP


if __name__ == "__main__":
    # Run tests manually
    import asyncio

    asyncio.run(test_adapter_persistence_roundtrip())
    print("✓ Adapter persistence roundtrip test passed")
