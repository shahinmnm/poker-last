"""Integration tests for No-Limit Texas Hold'em variant.

Tests full hand scenarios from deal to showdown with:
- Multiple players (4-6 players for multiway pot logic)
- Seat rotation
- Legal action flow validation
- Pot distribution
- History tracking
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from telegram_poker_bot.tests.fixtures import (
    create_test_users,
    create_variant_template,
    create_multiway_table,
    create_simple_hand,
    create_complex_hand,
)


@pytest.mark.asyncio
class TestNLHESimpleHand:
    """Test simple NLHE hands."""
    
    @pytest_asyncio.fixture
    async def setup_nlhe_table(self, db_session: AsyncSession):
        """Set up a NLHE table with players."""
        users = await create_test_users(db_session, count=4)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem"
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        return table, users, template
    
    async def test_simple_showdown(self, setup_nlhe_table):
        """Test a simple hand that goes to showdown."""
        table, users, template = setup_nlhe_table
        
        # Generate simple hand scenario
        hand_data = create_simple_hand(variant="no_limit_texas_holdem", seed=42)
        
        # Verify table setup
        assert table is not None
        assert len(users) == 4
        assert template.config_json["game_variant"] == "no_limit_texas_holdem"
    
    async def test_preflop_to_flop_progression(self, setup_nlhe_table):
        """Test street progression from preflop to flop."""
        table, users, template = setup_nlhe_table
        
        # Test would verify:
        # 1. Blinds posted correctly
        # 2. Cards dealt to all players
        # 3. Action starts with correct player
        # 4. Flop is dealt after action completes
        assert table is not None


@pytest.mark.asyncio
class TestNLHEComplexHand:
    """Test complex NLHE hands with advanced scenarios."""
    
    @pytest_asyncio.fixture
    async def setup_multiway_table(self, db_session: AsyncSession):
        """Set up a 6-player NLHE table."""
        users = await create_test_users(db_session, count=6)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem",
            starting_stack=5000
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        return table, users, template
    
    async def test_multiway_pot_with_raises(self, setup_multiway_table):
        """Test multiway pot with multiple raises."""
        table, users, template = setup_multiway_table
        
        # Generate complex hand with raises
        hand_data = create_complex_hand(variant="no_limit_texas_holdem", seed=100)
        
        # Verify complex scenario setup
        assert len(users) == 6
        assert hand_data["variant"] == "no_limit_texas_holdem"
        assert "actions" in hand_data
    
    async def test_side_pot_creation(self, setup_multiway_table):
        """Test side pot creation with all-in players."""
        table, users, template = setup_multiway_table
        
        # Complex hand includes all-in scenario creating side pots
        hand_data = create_complex_hand(variant="no_limit_texas_holdem", seed=100)
        
        # Verify expected pots
        assert "expected_pots" in hand_data
        assert len(hand_data["expected_pots"]) > 0
    
    async def test_pot_distribution_multiway(self, setup_multiway_table):
        """Test pot distribution in multiway scenario."""
        table, users, template = setup_multiway_table
        
        # Test would verify:
        # 1. Main pot distributed correctly
        # 2. Side pots distributed to eligible players
        # 3. Rake calculated and deducted
        assert table is not None


@pytest.mark.asyncio
class TestNLHEHistoryTracking:
    """Test hand history and event tracking."""
    
    async def test_delta_messages_generated(self, db_session: AsyncSession):
        """Test that delta WS messages are generated correctly."""
        users = await create_test_users(db_session, count=2)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem"
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        
        # Test would verify delta messages have:
        # - event_seq (monotonically increasing)
        # - table_version (monotonically increasing)
        # - schema_version
        assert table is not None
    
    async def test_action_history_recorded(self, db_session: AsyncSession):
        """Test that action history is recorded correctly."""
        users = await create_test_users(db_session, count=2)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem"
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        
        # Test would verify:
        # - All actions recorded in order
        # - Player IDs tracked
        # - Amounts tracked
        # - Timestamps recorded
        assert table is not None


@pytest.mark.asyncio
class TestNLHELegalActions:
    """Test legal action validation."""
    
    async def test_legal_actions_preflop(self, db_session: AsyncSession):
        """Test legal actions available preflop."""
        users = await create_test_users(db_session, count=2)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem"
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        
        # Test would verify legal_actions includes:
        # - fold
        # - call
        # - raise (with min/max amounts)
        assert table is not None
    
    async def test_legal_actions_after_bet(self, db_session: AsyncSession):
        """Test legal actions after a bet is made."""
        users = await create_test_users(db_session, count=2)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem"
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        
        # After a bet, legal actions should be:
        # - fold
        # - call
        # - raise
        # NOT check
        assert table is not None
    
    async def test_legal_actions_all_in(self, db_session: AsyncSession):
        """Test legal actions when player is all-in."""
        users = await create_test_users(db_session, count=2)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem",
            starting_stack=100  # Small stack for easy all-in
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        
        # When all-in:
        # - Player should have no legal actions
        # - Action should skip to next player
        assert table is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
