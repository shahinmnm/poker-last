"""Tests for StatsProcessor and UserPokerStats functionality."""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from telegram_poker_bot.shared.models import (
    Base,
    User,
    UserPokerStats,
    Hand,
    HandStatus,
    Seat,
    Table,
    TableStatus,
    TableTemplate,
    TableTemplateType,
    GameMode,
    Action,
    ActionType,
)
from telegram_poker_bot.game_core.stats_processor import StatsProcessor


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
async def test_template(db_session):
    """Create a test template for table tests."""
    template = TableTemplate(
        id=1,
        name="Test Template",
        table_type=TableTemplateType.EXPIRING,
        config_json={
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 1000,
            "max_players": 6,
        }
    )
    db_session.add(template)
    await db_session.flush()
    return template


@pytest.mark.asyncio
async def test_ensure_user_stats_creates_record(db_session):
    """Test that ensure_user_stats creates a new record if it doesn't exist."""
    # Create a test user
    user = User(tg_user_id=12345, language="en")
    db_session.add(user)
    await db_session.flush()

    # Ensure stats record is created
    stats = await StatsProcessor.ensure_user_stats(db_session, user.id)

    assert stats is not None
    assert stats.user_id == user.id
    assert stats.total_hands == 0
    assert stats.wins == 0
    assert stats.vpip_count == 0
    assert stats.pfr_count == 0
    assert stats.total_winnings == 0
    assert stats.best_hand_rank is None


@pytest.mark.asyncio
async def test_ensure_user_stats_returns_existing(db_session):
    """Test that ensure_user_stats returns existing record if it exists."""
    # Create a test user
    user = User(tg_user_id=12345, language="en")
    db_session.add(user)
    await db_session.flush()

    # Create existing stats
    existing_stats = UserPokerStats(
        user_id=user.id,
        total_hands=10,
        wins=5,
        vpip_count=7,
        pfr_count=3,
        total_winnings=1000,
        best_hand_rank="Full House",
    )
    db_session.add(existing_stats)
    await db_session.flush()

    # Ensure stats returns existing record
    stats = await StatsProcessor.ensure_user_stats(db_session, user.id)

    assert stats.user_id == user.id
    assert stats.total_hands == 10
    assert stats.wins == 5
    assert stats.vpip_count == 7


@pytest.mark.asyncio
async def test_calculate_vpip_true(db_session, test_template):
    """Test VPIP calculation returns True when user made voluntary action."""
    # Create test data
    user = User(tg_user_id=12345, language="en")
    db_session.add(user)
    await db_session.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=test_template.id
    )
    db_session.add(table)
    await db_session.flush()

    hand = Hand(
        table_id=table.id,
        hand_no=1,
        status=HandStatus.ENDED,
        engine_state_json={},
    )
    db_session.add(hand)
    await db_session.flush()

    # Add a voluntary action (BET)
    action = Action(
        hand_id=hand.id,
        user_id=user.id,
        type=ActionType.BET,
        amount=100,
    )
    db_session.add(action)
    await db_session.flush()

    # Calculate VPIP
    has_vpip = await StatsProcessor.calculate_vpip(db_session, hand, user.id)

    assert has_vpip is True


@pytest.mark.asyncio
async def test_calculate_vpip_false(db_session, test_template):
    """Test VPIP calculation returns False when user only folded."""
    # Create test data
    user = User(tg_user_id=12345, language="en")
    db_session.add(user)
    await db_session.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=test_template.id
    )
    db_session.add(table)
    await db_session.flush()

    hand = Hand(
        table_id=table.id,
        hand_no=1,
        status=HandStatus.ENDED,
        engine_state_json={},
    )
    db_session.add(hand)
    await db_session.flush()

    # Add a non-voluntary action (FOLD)
    action = Action(
        hand_id=hand.id,
        user_id=user.id,
        type=ActionType.FOLD,
        amount=0,
    )
    db_session.add(action)
    await db_session.flush()

    # Calculate VPIP
    has_vpip = await StatsProcessor.calculate_vpip(db_session, hand, user.id)

    assert has_vpip is False


@pytest.mark.asyncio
async def test_calculate_pfr_true(db_session, test_template):
    """Test PFR calculation returns True when user raised."""
    # Create test data
    user = User(tg_user_id=12345, language="en")
    db_session.add(user)
    await db_session.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=test_template.id
    )
    db_session.add(table)
    await db_session.flush()

    hand = Hand(
        table_id=table.id,
        hand_no=1,
        status=HandStatus.ENDED,
        engine_state_json={},
    )
    db_session.add(hand)
    await db_session.flush()

    # Add a raise action
    action = Action(
        hand_id=hand.id,
        user_id=user.id,
        type=ActionType.RAISE,
        amount=200,
    )
    db_session.add(action)
    await db_session.flush()

    # Calculate PFR
    has_pfr = await StatsProcessor.calculate_pfr(db_session, hand, user.id)

    assert has_pfr is True


@pytest.mark.asyncio
async def test_update_stats_increments_hands(db_session, test_template):
    """Test that update_stats increments total_hands for all participants."""
    # Create test data
    user1 = User(tg_user_id=12345, language="en")
    user2 = User(tg_user_id=67890, language="en")
    db_session.add_all([user1, user2])
    await db_session.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=test_template.id
    )
    db_session.add(table)
    await db_session.flush()

    seat1 = Seat(table_id=table.id, user_id=user1.id, position=0, chips=1000)
    seat2 = Seat(table_id=table.id, user_id=user2.id, position=1, chips=1000)
    db_session.add_all([seat1, seat2])
    await db_session.flush()

    hand = Hand(
        table_id=table.id,
        hand_no=1,
        status=HandStatus.INTER_HAND_WAIT,
        engine_state_json={},
    )
    db_session.add(hand)
    await db_session.flush()

    hand_result = {
        "winners": [
            {
                "user_id": user1.id,
                "amount": 500,
                "hand_rank": "Pair",
            }
        ]
    }

    # Update stats
    await StatsProcessor.update_stats(db_session, hand, hand_result, [seat1, seat2])

    # Check that stats were updated
    result1 = await db_session.execute(
        select(UserPokerStats).where(UserPokerStats.user_id == user1.id)
    )
    stats1 = result1.scalar_one()

    result2 = await db_session.execute(
        select(UserPokerStats).where(UserPokerStats.user_id == user2.id)
    )
    stats2 = result2.scalar_one()

    # User1 won
    assert stats1.total_hands == 1
    assert stats1.wins == 1
    assert stats1.total_winnings == 500
    assert stats1.best_hand_rank == "Pair"

    # User2 lost
    assert stats2.total_hands == 1
    assert stats2.wins == 0
    assert stats2.total_winnings == 0


@pytest.mark.asyncio
async def test_is_better_hand_comparison(db_session):
    """Test hand rank comparison logic."""
    # Test better hand
    assert StatsProcessor._is_better_hand("Full House", "Pair") is True
    assert StatsProcessor._is_better_hand("Straight Flush", "Full House") is True
    assert StatsProcessor._is_better_hand("Royal Flush", "Straight Flush") is True

    # Test worse hand
    assert StatsProcessor._is_better_hand("Pair", "Full House") is False
    assert StatsProcessor._is_better_hand("High Card", "Pair") is False

    # Test equal hand
    assert StatsProcessor._is_better_hand("Pair", "Pair") is False


@pytest.mark.asyncio
async def test_update_stats_updates_best_hand(db_session, test_template):
    """Test that update_stats updates best_hand_rank when a better hand is achieved."""
    # Create test data
    user = User(tg_user_id=12345, language="en")
    db_session.add(user)
    await db_session.flush()

    # Create existing stats with a Pair
    stats = UserPokerStats(
        user_id=user.id,
        total_hands=1,
        wins=1,
        best_hand_rank="Pair",
    )
    db_session.add(stats)
    await db_session.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=test_template.id
    )
    db_session.add(table)
    await db_session.flush()

    seat = Seat(table_id=table.id, user_id=user.id, position=0, chips=1000)
    db_session.add(seat)
    await db_session.flush()

    hand = Hand(
        table_id=table.id,
        hand_no=2,
        status=HandStatus.INTER_HAND_WAIT,
        engine_state_json={},
    )
    db_session.add(hand)
    await db_session.flush()

    # User wins with a Full House (better than Pair)
    hand_result = {
        "winners": [
            {
                "user_id": user.id,
                "amount": 1000,
                "hand_rank": "Full House",
            }
        ]
    }

    # Update stats
    await StatsProcessor.update_stats(db_session, hand, hand_result, [seat])

    # Check that best_hand_rank was updated
    result = await db_session.execute(
        select(UserPokerStats).where(UserPokerStats.user_id == user.id)
    )
    updated_stats = result.scalar_one()

    assert updated_stats.total_hands == 2
    assert updated_stats.wins == 2
    assert updated_stats.best_hand_rank == "Full House"  # Updated to better hand
    assert updated_stats.total_winnings == 1000

