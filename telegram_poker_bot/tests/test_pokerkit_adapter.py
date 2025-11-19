"""Test the PokerKit adapter basic functionality."""

from pokerkit import Mode

from telegram_poker_bot.engine_adapter import PokerEngineAdapter


def test_adapter_initialization():
    """Test basic adapter initialization."""
    adapter = PokerEngineAdapter(
        player_count=3,
        starting_stacks=[1000, 1000, 1000],
        small_blind=10,
        big_blind=20,
        mode=Mode.TOURNAMENT,
    )
    
    assert adapter.player_count == 3
    assert adapter.small_blind == 10
    assert adapter.big_blind == 20
    assert len(adapter.state.stacks) == 3


def test_deal_new_hand():
    """Test dealing a new hand."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
    )
    
    # Deal new hand
    adapter.deal_new_hand()
    
    # Check that hole cards were dealt
    assert len(adapter.state.hole_cards) == 2
    for player_cards in adapter.state.hole_cards:
        assert len(player_cards) == 2  # Each player has 2 cards
    
    # Check that deck has remaining cards
    assert len(adapter._deck) == 52 - 4  # 52 - (2 players * 2 cards)


def test_to_full_state():
    """Test state serialization."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
    )
    
    adapter.deal_new_hand()
    state = adapter.to_full_state(viewer_player_index=0)
    
    # Check basic structure
    assert "status" in state
    assert "street" in state
    assert "players" in state
    assert "board_cards" in state
    assert "pots" in state
    assert "allowed_actions" in state
    
    # Check player count
    assert len(state["players"]) == 2
    
    # Check that viewer can see their own cards
    player_0 = state["players"][0]
    assert len(player_0["hole_cards"]) == 2
    
    # Check that viewer cannot see opponent's cards
    player_1 = state["players"][1]
    assert len(player_1["hole_cards"]) == 0  # Hidden from viewer


def test_allowed_actions():
    """Test that allowed actions are extracted correctly."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
    )
    
    adapter.deal_new_hand()
    
    # Get state for current actor
    actor_index = adapter.state.actor_index
    assert actor_index is not None
    
    state = adapter.to_full_state(viewer_player_index=actor_index)
    actions = state["allowed_actions"]
    
    # Should have some allowed actions
    assert len(actions) > 0
    assert "can_fold" in actions
    
    # Should have either check or call
    assert "can_check" in actions or "can_call" in actions


def test_fold_action():
    """Test fold action."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
    )
    
    adapter.deal_new_hand()
    
    # Fold
    initial_actor = adapter.state.actor_index
    adapter.fold()
    
    # Hand should be complete after one player folds in heads-up
    assert adapter.is_hand_complete()


def test_check_and_call():
    """Test check and call actions."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
    )
    
    adapter.deal_new_hand()
    
    # First player can call or fold
    adapter.check_or_call()  # Call the big blind
    
    # Big blind player can check
    adapter.check_or_call()  # Check
    
    # Should still be active (not complete)
    assert not adapter.is_hand_complete()


def test_bet_or_raise():
    """Test bet/raise action."""
    adapter = PokerEngineAdapter(
        player_count=2,
        starting_stacks=[1000, 1000],
        small_blind=10,
        big_blind=20,
    )
    
    adapter.deal_new_hand()
    
    # Get minimum bet amount
    actor_idx = adapter.state.actor_index
    min_bet = adapter.state.min_completion_betting_or_raising_to_amount
    
    # Raise to minimum
    adapter.bet_or_raise(min_bet)
    
    # Should still be active
    assert not adapter.is_hand_complete()


if __name__ == "__main__":
    # Run tests manually
    test_adapter_initialization()
    print("✓ Initialization test passed")
    
    test_deal_new_hand()
    print("✓ Deal new hand test passed")
    
    test_to_full_state()
    print("✓ State serialization test passed")
    
    test_allowed_actions()
    print("✓ Allowed actions test passed")
    
    test_fold_action()
    print("✓ Fold action test passed")
    
    test_check_and_call()
    print("✓ Check/call test passed")
    
    test_bet_or_raise()
    print("✓ Bet/raise test passed")
    
    print("\nAll tests passed!")
