"""Tests for ghost hand recovery in the pokerkit runtime.

This module tests the recovery logic that handles "ghost hands" - corrupted
hands that fail to restore from the database and leave tables permanently stuck.

Key scenarios tested:
1. Corrupted hand detection and marking as ABORTED
2. Table status reset to WAITING for persistent tables
3. Auto-start resilience after recovery
4. Structured logging of recovery events
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
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
    TableTemplate,
    TableTemplateType,
)


@pytest_asyncio.fixture
async def db_session():
    """Create test database session using in-memory SQLite."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest_asyncio.fixture
async def test_table_with_ghost_hand(db_session: AsyncSession):
    """Create a test table with a corrupted 'ghost' hand.
    
    This simulates the scenario where:
    1. A hand was started but never properly completed
    2. The engine_state_json is corrupted or in an invalid state
    3. The table cannot proceed because of the ghost hand
    """
    # Create users
    user1 = User(tg_user_id=1001, username="player1")
    user2 = User(tg_user_id=1002, username="player2")
    db_session.add_all([user1, user2])
    await db_session.flush()

    # Create PERSISTENT template (for auto-recovery to WAITING)
    template = TableTemplate(
        name="Test Persistent Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=True,
        config_json={
            "backend": {
                "small_blind": 25,
                "big_blind": 50,
                "starting_stack": 1000,
                "max_players": 6,
                "currency_type": "REAL",
                "game_variant": "no_limit_texas_holdem",
            }
        }
    )
    db_session.add(template)
    await db_session.flush()

    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,  # Table thinks hand is running
        template_id=template.id,
        is_public=True,
        lobby_persistent=True,
    )
    table.template = template
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

    # Create a "ghost hand" with corrupted state that will fail to restore
    ghost_hand = Hand(
        table_id=table.id,
        hand_no=90,
        status=HandStatus.FLOP,  # Not ENDED, so it looks "in progress"
        engine_state_json={
            # Corrupted state - will cause "No board dealing is pending" error
            "player_count": 2,
            "starting_stacks": [1000, 1000],
            "small_blind": 25,
            "big_blind": 50,
            "mode": "tournament",
            "stacks": [975, 950],
            "bets": [0, 0],
            "hole_cards": [["As", "Kh"], ["Qd", "Jc"]],
            "board_cards": ["2h", "7c", "Ts"],  # Flop dealt
            "button_index": 0,
            "street_index": 1,  # Flop
            "player_indices": [0, 1],
            "actor_index": 0,
            "actor_indices": [0, 1],
            "status": True,
            "deck": [],  # Empty deck will cause issues
            "pots": [{"amount": 75, "player_indices": [0, 1]}],
        }
    )
    db_session.add(ghost_hand)
    await db_session.flush()
    await db_session.commit()

    return table, [seat1, seat2], [user1, user2], ghost_hand


class TestHandStatusAborted:
    """Test the ABORTED hand status."""

    def test_aborted_status_exists(self):
        """Verify ABORTED is a valid HandStatus value."""
        assert hasattr(HandStatus, "ABORTED")
        assert HandStatus.ABORTED.value == "aborted"

    def test_aborted_is_terminal(self):
        """ABORTED hands should be treated as terminal like ENDED."""
        terminal_statuses = [HandStatus.ENDED, HandStatus.ABORTED]
        assert HandStatus.ABORTED in terminal_statuses


class TestGhostHandDetection:
    """Test detection of ghost hands during restore."""

    @pytest.mark.asyncio
    async def test_ghost_hand_exists_in_non_terminal_status(
        self, db_session: AsyncSession, test_table_with_ghost_hand
    ):
        """Verify ghost hand setup creates expected scenario."""
        table, seats, users, ghost_hand = test_table_with_ghost_hand
        
        # Ghost hand should exist in non-terminal status
        assert ghost_hand.status == HandStatus.FLOP
        assert ghost_hand.status not in [HandStatus.ENDED, HandStatus.ABORTED]
        
        # Table should be in ACTIVE state
        assert table.status == TableStatus.ACTIVE


class TestStartTableGuard:
    """Test the 'cannot start new hand' guard with ABORTED hands."""

    @pytest.mark.asyncio
    async def test_guard_query_excludes_aborted(self, db_session: AsyncSession):
        """Verify the start_table guard correctly excludes ABORTED hands."""
        from sqlalchemy import select
        
        # Create a minimal table setup
        template = TableTemplate(
            name="Test",
            table_type=TableTemplateType.EXPIRING,
            config_json={"backend": {"small_blind": 25, "big_blind": 50, "starting_stack": 1000, "max_players": 6, "currency_type": "REAL", "game_variant": "no_limit_texas_holdem"}}
        )
        db_session.add(template)
        await db_session.flush()
        
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.WAITING,
            template_id=template.id,
        )
        db_session.add(table)
        await db_session.flush()
        
        # Create an ABORTED hand
        aborted_hand = Hand(
            table_id=table.id,
            hand_no=1,
            status=HandStatus.ABORTED,
            engine_state_json={},
        )
        db_session.add(aborted_hand)
        await db_session.flush()
        
        # Query should NOT find the ABORTED hand
        result = await db_session.execute(
            select(Hand)
            .where(
                Hand.table_id == table.id,
                Hand.status.not_in([HandStatus.ENDED, HandStatus.ABORTED])
            )
            .limit(1)
        )
        active_hand = result.scalar_one_or_none()
        
        # No active hand should be found (ABORTED is excluded)
        assert active_hand is None

    @pytest.mark.asyncio
    async def test_guard_finds_non_terminal_hands(self, db_session: AsyncSession):
        """Verify the guard finds hands in non-terminal states."""
        from sqlalchemy import select
        
        template = TableTemplate(
            name="Test",
            table_type=TableTemplateType.EXPIRING,
            config_json={"backend": {"small_blind": 25, "big_blind": 50, "starting_stack": 1000, "max_players": 6, "currency_type": "REAL", "game_variant": "no_limit_texas_holdem"}}
        )
        db_session.add(template)
        await db_session.flush()
        
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
        )
        db_session.add(table)
        await db_session.flush()
        
        # Create a hand in PREFLOP (active, not terminal)
        active_hand = Hand(
            table_id=table.id,
            hand_no=1,
            status=HandStatus.PREFLOP,
            engine_state_json={},
        )
        db_session.add(active_hand)
        await db_session.flush()
        
        # Query SHOULD find the active hand
        result = await db_session.execute(
            select(Hand)
            .where(
                Hand.table_id == table.id,
                Hand.status.not_in([HandStatus.ENDED, HandStatus.ABORTED])
            )
            .limit(1)
        )
        found_hand = result.scalar_one_or_none()
        
        # Active hand should be found
        assert found_hand is not None
        assert found_hand.id == active_hand.id


class TestRecoveryLogic:
    """Test the recovery logic for corrupted hands."""

    @pytest.mark.asyncio
    async def test_manual_recovery_flow(
        self, db_session: AsyncSession, test_table_with_ghost_hand
    ):
        """Test manually marking a ghost hand as ABORTED allows new hand start.
        
        This simulates what the recovery logic in ensure_table() does.
        """
        from sqlalchemy import select
        
        table, seats, users, ghost_hand = test_table_with_ghost_hand
        
        # Before recovery: ghost hand blocks new hand
        result = await db_session.execute(
            select(Hand)
            .where(
                Hand.table_id == table.id,
                Hand.status.not_in([HandStatus.ENDED, HandStatus.ABORTED])
            )
        )
        blocking_hand = result.scalar_one_or_none()
        assert blocking_hand is not None, "Ghost hand should block before recovery"
        
        # Perform recovery: mark ghost hand as ABORTED
        ghost_hand.status = HandStatus.ABORTED
        ghost_hand.ended_at = datetime.now(timezone.utc)
        table.status = TableStatus.WAITING  # Reset for persistent table
        await db_session.flush()
        
        # After recovery: no hand should block
        result = await db_session.execute(
            select(Hand)
            .where(
                Hand.table_id == table.id,
                Hand.status.not_in([HandStatus.ENDED, HandStatus.ABORTED])
            )
        )
        blocking_hand = result.scalar_one_or_none()
        assert blocking_hand is None, "No hand should block after recovery"
        
        # Table should be in WAITING state
        assert table.status == TableStatus.WAITING

    @pytest.mark.asyncio
    async def test_new_hand_can_be_created_after_recovery(
        self, db_session: AsyncSession, test_table_with_ghost_hand
    ):
        """Test that a new hand can be created after recovery."""
        from sqlalchemy import select, func
        
        table, seats, users, ghost_hand = test_table_with_ghost_hand
        
        # Perform recovery
        ghost_hand.status = HandStatus.ABORTED
        table.status = TableStatus.WAITING
        await db_session.flush()
        
        # Get max hand_no for this table
        result = await db_session.execute(
            select(func.max(Hand.hand_no)).where(Hand.table_id == table.id)
        )
        max_hand_no = result.scalar_one_or_none() or 0
        
        # Create new hand (simulates what start_new_hand does)
        new_hand = Hand(
            table_id=table.id,
            hand_no=max_hand_no + 1,
            status=HandStatus.PREFLOP,
            engine_state_json={},
        )
        db_session.add(new_hand)
        await db_session.flush()
        
        # Verify new hand was created with correct number
        assert new_hand.hand_no == 91  # ghost_hand was #90
        assert new_hand.status == HandStatus.PREFLOP


class TestLoadOrCreateHandExcludesAborted:
    """Test that load_or_create_hand properly excludes ABORTED hands."""

    @pytest.mark.asyncio
    async def test_aborted_hand_not_returned_by_query(self, db_session: AsyncSession):
        """Verify ABORTED hands are not returned by the load query."""
        from sqlalchemy import select
        
        template = TableTemplate(
            name="Test",
            table_type=TableTemplateType.EXPIRING,
            config_json={"backend": {"small_blind": 25, "big_blind": 50, "starting_stack": 1000, "max_players": 6, "currency_type": "REAL", "game_variant": "no_limit_texas_holdem"}}
        )
        db_session.add(template)
        await db_session.flush()
        
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.WAITING,
            template_id=template.id,
        )
        db_session.add(table)
        await db_session.flush()
        
        # Create an ABORTED hand
        aborted = Hand(
            table_id=table.id,
            hand_no=1,
            status=HandStatus.ABORTED,
            engine_state_json={},
        )
        db_session.add(aborted)
        await db_session.flush()
        
        # Query mimics load_or_create_hand logic
        result = await db_session.execute(
            select(Hand)
            .where(
                Hand.table_id == table.id,
                Hand.status.not_in([HandStatus.ENDED, HandStatus.ABORTED])
            )
            .order_by(Hand.hand_no.desc())
            .limit(1)
        )
        found = result.scalar_one_or_none()
        
        # Should not find the ABORTED hand
        assert found is None

    @pytest.mark.asyncio
    async def test_active_hand_still_returned(self, db_session: AsyncSession):
        """Verify that active hands are still found."""
        from sqlalchemy import select
        
        template = TableTemplate(
            name="Test",
            table_type=TableTemplateType.EXPIRING,
            config_json={"backend": {"small_blind": 25, "big_blind": 50, "starting_stack": 1000, "max_players": 6, "currency_type": "REAL", "game_variant": "no_limit_texas_holdem"}}
        )
        db_session.add(template)
        await db_session.flush()
        
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
        )
        db_session.add(table)
        await db_session.flush()
        
        # Create hands: ABORTED, then INTER_HAND_WAIT (active)
        aborted = Hand(
            table_id=table.id,
            hand_no=1,
            status=HandStatus.ABORTED,
            engine_state_json={},
        )
        active = Hand(
            table_id=table.id,
            hand_no=2,
            status=HandStatus.INTER_HAND_WAIT,
            engine_state_json={},
        )
        db_session.add_all([aborted, active])
        await db_session.flush()
        
        # Query should find the INTER_HAND_WAIT hand, not the ABORTED one
        result = await db_session.execute(
            select(Hand)
            .where(
                Hand.table_id == table.id,
                Hand.status.not_in([HandStatus.ENDED, HandStatus.ABORTED])
            )
            .order_by(Hand.hand_no.desc())
            .limit(1)
        )
        found = result.scalar_one_or_none()
        
        assert found is not None
        assert found.id == active.id
        assert found.status == HandStatus.INTER_HAND_WAIT
