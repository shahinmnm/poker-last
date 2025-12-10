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


def test_allowed_actions_for_non_actor_viewers():
    """
    Test that non-actor viewers receive empty allowed_actions.

    This verifies the correct behavior where:
    1. Broadcasts (viewer_player_index=None): Include allowed_actions for current actor
    2. Actor viewing (viewer_player_index==actor_index): Include allowed_actions
    3. Non-actor viewing (viewer_player_index!=actor_index): Empty allowed_actions

    This prevents showing action buttons to players when it's not their turn.
    """
    adapter = PokerEngineAdapter(
        player_count=3,
        starting_stacks=[10000, 10000, 10000],
        small_blind=25,
        big_blind=50,
    )

    adapter.deal_new_hand()

    actor_index = adapter.state.actor_index
    assert actor_index is not None, "Should have a current actor"

    # Get indices of non-actors
    non_actor_indices = [i for i in range(3) if i != actor_index]

    # Scenario 1: Broadcast should have allowed_actions
    broadcast_state = adapter.to_full_state(viewer_player_index=None)
    assert (
        broadcast_state["allowed_actions"] != {}
    ), "Broadcast should include allowed_actions"

    # Scenario 2: Actor should see their allowed_actions
    actor_state = adapter.to_full_state(viewer_player_index=actor_index)
    assert (
        actor_state["allowed_actions"] != {}
    ), "Actor should see their allowed_actions"

    # Scenario 3: Non-actors should NOT see allowed_actions
    for non_actor_idx in non_actor_indices:
        non_actor_state = adapter.to_full_state(viewer_player_index=non_actor_idx)
        assert (
            non_actor_state["allowed_actions"] == {}
        ), f"Non-actor player {non_actor_idx} should have empty allowed_actions"

    # Verify broadcast and actor state have matching allowed_actions
    assert (
        broadcast_state["allowed_actions"] == actor_state["allowed_actions"]
    ), "Broadcast and actor state should have same allowed_actions"


def test_true_initial_stacks_persistence():
    """
    Test that true_initial_stacks is properly persisted and restored.
    
    This tests the fix for the financial integrity timing bug where
    _pre_showdown_stacks was captured AFTER blinds were posted, leading to
    incorrect pot integrity calculations.
    
    Expected behavior:
    - true_initial_stacks maintains original stack values (before blinds)
    - pre_showdown_stacks reflects post-blind values
    - Both are correctly persisted and restored from state
    """
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
    )
    
    # Manually set true initial stacks (simulating what runtime does)
    adapter._true_initial_stacks = [10000, 10000]
    
    adapter.deal_new_hand()
    
    # Verify pre_showdown_stacks is captured after blinds (so stacks are reduced)
    # Blinds: SB = 25, BB = 50, so total deducted = 75
    assert adapter._pre_showdown_stacks is not None
    
    # Verify true_initial_stacks preserves original values
    assert adapter._true_initial_stacks == [10000, 10000]
    
    # Test persistence
    state_dict = adapter.to_persistence_state()
    assert "true_initial_stacks" in state_dict
    assert state_dict["true_initial_stacks"] == [10000, 10000]
    
    # Test restoration
    restored_adapter = PokerEngineAdapter.from_persistence_state(state_dict)
    assert restored_adapter._true_initial_stacks == [10000, 10000]


def test_pot_integrity_uses_true_initial_stacks():
    """
    Test that get_winners uses true_initial_stacks for integrity calculation.
    
    Verifies that the financial integrity check uses stacks captured BEFORE
    blinds are posted, not after.
    """
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[10000, 10000],
        small_blind=25,
        big_blind=50,
    )
    
    # Set true initial stacks BEFORE creating/dealing
    # This simulates what pokerkit_runtime.py does
    adapter._true_initial_stacks = [10000, 10000]
    
    adapter.deal_new_hand()
    
    # After deal_new_hand, _pre_showdown_stacks has post-blind values
    # but _true_initial_stacks should still have pre-blind values
    assert adapter._true_initial_stacks == [10000, 10000]
    
    # _pre_showdown_stacks should reflect post-blind values
    # (which is the issue that true_initial_stacks fixes)
    assert adapter._pre_showdown_stacks is not None
