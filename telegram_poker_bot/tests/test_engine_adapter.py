"""Unit tests for engine adapter."""

import pytest
from pokerkit import Mode

from telegram_poker_bot.engine_adapter import PokerEngineAdapter


def test_engine_adapter_initialization():
    """Test engine adapter initialization."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
        mode=Mode.TOURNAMENT,
    )

    assert adapter.player_count == 2
    assert adapter.starting_stacks == [10000, 10000]
    assert adapter.small_blind == 25
    assert adapter.big_blind == 50


def test_engine_adapter_invalid_player_count():
    """Test engine adapter with invalid player count."""
    with pytest.raises(ValueError):
        PokerEngineAdapter(
            player_count=1,
            starting_stacks=[10000],
            small_blind=25,
            big_blind=50,
        )

    with pytest.raises(ValueError):
        PokerEngineAdapter(
            player_count=9,
            starting_stacks=[10000] * 9,
            small_blind=25,
            big_blind=50,
        )


def test_engine_adapter_state_serialization():
    """Test state serialization using to_persistence_state."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
    )

    state_dict = adapter.to_persistence_state()

    assert "player_count" in state_dict
    assert "stacks" in state_dict
    assert "street_index" in state_dict
    assert len(state_dict["stacks"]) == 2


def test_engine_adapter_deal_new_hand():
    """Test dealing a new hand."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
    )

    adapter.deal_new_hand()
    # Verify hole cards were dealt
    assert len(adapter.state.hole_cards) == 2
    assert len(adapter.state.hole_cards[0]) == 2


def test_engine_adapter_get_winners():
    """Test getting winners after hand completion."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
    )

    adapter.deal_new_hand()

    # Initially no winners (hand not complete)
    winners = adapter.get_winners()
    assert isinstance(winners, list)


def test_allowed_actions_in_broadcast_state():
    """
    Test the fix for the critical bug where WebSocket broadcasts had empty allowed_actions.

    Verifies that allowed_actions are included when viewer_player_index is None (broadcast),
    preventing the issue where action buttons didn't appear and players got auto-folded.
    """
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
    )

    adapter.deal_new_hand()

    # Get state for broadcast (viewer_player_index=None)
    broadcast_state = adapter.to_full_state(viewer_player_index=None)

    # The current actor should have allowed actions available
    assert (
        broadcast_state["current_actor_index"] is not None
    ), "Should have a current actor"

    # CRITICAL: allowed_actions should NOT be empty in broadcast
    # This is what the bug fix addresses
    assert (
        broadcast_state["allowed_actions"] != {}
    ), "allowed_actions should be populated for current actor in broadcast state"

    # Verify that allowed_actions contains expected action keys
    allowed_actions = broadcast_state["allowed_actions"]
    assert "can_fold" in allowed_actions
    # At preflop with blinds posted, actor should be able to either call or check
    # (BB can check, SB/others must call or raise)
    has_call_or_check = allowed_actions.get("can_call", False) or allowed_actions.get(
        "can_check", False
    )
    assert has_call_or_check, "Actor should have either call or check action available"

    # Compare with actor-specific state to ensure they match
    actor_index = broadcast_state["current_actor_index"]
    actor_state = adapter.to_full_state(viewer_player_index=actor_index)

    # Both should have the same allowed_actions for the current actor
    assert (
        broadcast_state["allowed_actions"] == actor_state["allowed_actions"]
    ), "Broadcast state should have same allowed_actions as actor-specific state"
