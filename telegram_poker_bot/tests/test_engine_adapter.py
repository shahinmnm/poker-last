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

