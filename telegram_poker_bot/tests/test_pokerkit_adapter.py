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
