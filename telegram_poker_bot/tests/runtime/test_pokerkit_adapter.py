import pytest
from pokerkit import Mode

from telegram_poker_bot.engine_adapter import PokerEngineAdapter


@pytest.fixture
def adapter():
    return PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )


def test_deal_new_hand_gives_two_cards_each_and_reduces_deck(adapter):
    adapter.deal_new_hand()

    assert len(adapter.state.hole_cards) == adapter.player_count
    assert all(len(cards) == 2 for cards in adapter.state.hole_cards)
    assert len(adapter._deck) == 52 - adapter.player_count * 2


def test_allowed_actions_flags_match_expected_preflop(adapter):
    adapter.deal_new_hand()

    actor_index = adapter.state.actor_index
    assert actor_index is not None

    state = adapter.to_full_state(viewer_player_index=actor_index)
    actions = state["allowed_actions"]

    assert actions["can_fold"] is True
    assert actions["can_check"] or actions["can_call"]
    assert "min_raise_to" in actions
    assert "max_raise_to" in actions


def test_fold_in_heads_up_ends_hand(adapter):
    adapter.deal_new_hand()
    adapter.fold()

    assert adapter.is_hand_complete()


def test_all_in_preflop_auto_deals_full_board_and_produces_winners():
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[500, 500],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )

    adapter.deal_new_hand()

    first_actor = adapter.state.actor_index
    assert first_actor is not None
    all_in_amount = adapter.state.stacks[first_actor] + adapter.state.bets[first_actor]
    adapter.bet_or_raise(all_in_amount)

    second_actor = adapter.state.actor_index
    assert second_actor is not None
    adapter.check_or_call()

    board_count = sum(len(cards) for cards in adapter.state.board_cards)
    assert board_count == 5
    assert adapter.is_hand_complete()

    winners = adapter.get_winners()
    assert isinstance(winners, list)
    assert len(winners) >= 1


# -----------------------------------------------------------------------------------
# Tests for fold legality (Task D - Regression tests for "no reason to fold" fix)
# -----------------------------------------------------------------------------------


def test_allowed_actions_no_fold_when_check_available():
    """Test that can_fold is False when check is available (call_amount == 0).

    This is a critical test for the "no reason to fold" fix.
    When a player can check (no bet to call), folding is not allowed.
    """
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )
    adapter.deal_new_hand()

    # Small blind calls the big blind (matches the bet)
    adapter.check_or_call()

    # Now it's the big blind's turn - they can check (call_amount == 0)
    actor_index = adapter.state.actor_index
    assert actor_index is not None

    state = adapter.to_full_state(viewer_player_index=actor_index)
    actions = state["allowed_actions"]

    # Big blind should be able to check, but NOT fold
    assert actions["can_check"] is True
    assert actions["call_amount"] == 0
    assert actions["can_fold"] is False, "Fold should not be allowed when check is available"


def test_fold_raises_error_when_check_available():
    """Test that attempting to fold when check is available raises ValueError.

    PokerKit is the source of truth for legality. When call_amount == 0,
    folding is not allowed and should raise an error.
    """
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )
    adapter.deal_new_hand()

    # Small blind calls the big blind
    adapter.check_or_call()

    # Now big blind can check - attempting to fold should raise ValueError
    with pytest.raises(ValueError, match="no reason for this player to fold"):
        adapter.fold()


def test_fold_allowed_when_facing_bet():
    """Test that fold is allowed when facing a bet (call_amount > 0)."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )
    adapter.deal_new_hand()

    # Small blind (first actor) faces big blind, so call_amount > 0
    actor_index = adapter.state.actor_index
    assert actor_index is not None

    state = adapter.to_full_state(viewer_player_index=actor_index)
    actions = state["allowed_actions"]

    # Small blind should be able to fold (they face the big blind)
    assert actions["can_fold"] is True
    assert actions["call_amount"] > 0


def test_heads_up_check_check_river_no_fold():
    """Test heads-up check-check to river, then verify fold is not allowed.

    This is the scenario from the problem evidence:
    - River after check-check, player attempts fold
    - Should NOT be allowed because check is available
    """
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )
    adapter.deal_new_hand()

    # Preflop: SB calls, BB checks
    adapter.check_or_call()  # SB calls
    adapter.check_or_call()  # BB checks

    # Flop: both check
    adapter.check_or_call()  # First to act checks
    adapter.check_or_call()  # Second checks

    # Turn: both check
    adapter.check_or_call()
    adapter.check_or_call()

    # River: first player to act
    actor_index = adapter.state.actor_index
    assert actor_index is not None

    state = adapter.to_full_state(viewer_player_index=actor_index)
    actions = state["allowed_actions"]

    # Should be able to check, NOT fold
    assert actions["can_check"] is True
    assert actions["can_fold"] is False, "Fold should not be allowed on river when check is available"

    # Attempting fold should raise an error
    with pytest.raises(ValueError, match="no reason for this player to fold"):
        adapter.fold()
