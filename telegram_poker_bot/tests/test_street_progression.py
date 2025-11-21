"""Tests for automatic street progression."""

from unittest.mock import MagicMock

from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime
from telegram_poker_bot.shared.models import ActionType, Seat, Table, User


def test_preflop_to_flop_progression():
    """Test that game progresses from preflop to flop after betting round ends."""
    # Create mock objects
    table = MagicMock(spec=Table)
    table.id = 1

    user1 = MagicMock(spec=User)
    user1.id = 1
    user1.username = "Player1"

    user2 = MagicMock(spec=User)
    user2.id = 2
    user2.username = "Player2"

    seat1 = MagicMock(spec=Seat)
    seat1.user_id = 1
    seat1.position = 0
    seat1.chips = 1000
    seat1.left_at = None
    seat1.is_sitting_out_next_hand = False
    seat1.user = user1

    seat2 = MagicMock(spec=Seat)
    seat2.user_id = 2
    seat2.position = 1
    seat2.chips = 1000
    seat2.left_at = None
    seat2.is_sitting_out_next_hand = False
    seat2.user = user2

    # Create runtime and start hand
    runtime = PokerKitTableRuntime(table, [seat1, seat2])
    state = runtime.start_hand(small_blind=10, big_blind=20)

    assert state["street"] == "preflop"
    assert len(state["board"]) == 0

    # Complete preflop betting
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CALL)
    state = result["state"]

    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CHECK)
    state = result["state"]

    # Should now be on flop with 3 cards
    assert state["street"] == "flop"
    assert len(state["board"]) == 3


def test_flop_to_turn_progression():
    """Test that game progresses from flop to turn after betting round ends."""
    table = MagicMock(spec=Table)
    table.id = 1

    user1 = MagicMock(spec=User)
    user1.id = 1
    user1.username = "Player1"

    user2 = MagicMock(spec=User)
    user2.id = 2
    user2.username = "Player2"

    seat1 = MagicMock(spec=Seat)
    seat1.user_id = 1
    seat1.position = 0
    seat1.chips = 1000
    seat1.left_at = None
    seat1.is_sitting_out_next_hand = False
    seat1.user = user1

    seat2 = MagicMock(spec=Seat)
    seat2.user_id = 2
    seat2.position = 1
    seat2.chips = 1000
    seat2.left_at = None
    seat2.is_sitting_out_next_hand = False
    seat2.user = user2

    runtime = PokerKitTableRuntime(table, [seat1, seat2])
    state = runtime.start_hand(small_blind=10, big_blind=20)

    # Get to flop
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CALL)
    state = result["state"]

    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CHECK)
    state = result["state"]

    assert state["street"] == "flop"
    assert len(state["board"]) == 3

    # Complete flop betting
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CHECK)
    state = result["state"]

    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CHECK)
    state = result["state"]

    # Should now be on turn with 4 cards
    assert state["street"] == "turn"
    assert len(state["board"]) == 4


def test_turn_to_river_progression():
    """Test that game progresses from turn to river after betting round ends."""
    table = MagicMock(spec=Table)
    table.id = 1

    user1 = MagicMock(spec=User)
    user1.id = 1
    user1.username = "Player1"

    user2 = MagicMock(spec=User)
    user2.id = 2
    user2.username = "Player2"

    seat1 = MagicMock(spec=Seat)
    seat1.user_id = 1
    seat1.position = 0
    seat1.chips = 1000
    seat1.left_at = None
    seat1.is_sitting_out_next_hand = False
    seat1.user = user1

    seat2 = MagicMock(spec=Seat)
    seat2.user_id = 2
    seat2.position = 1
    seat2.chips = 1000
    seat2.left_at = None
    seat2.is_sitting_out_next_hand = False
    seat2.user = user2

    runtime = PokerKitTableRuntime(table, [seat1, seat2])
    state = runtime.start_hand(small_blind=10, big_blind=20)

    # Get to turn
    for _ in range(2):  # Preflop actions
        actor_user_id = state["current_actor"]
        result = runtime.handle_action(
            actor_user_id, ActionType.CHECK if _ == 1 else ActionType.CALL
        )
        state = result["state"]

    for _ in range(2):  # Flop actions
        actor_user_id = state["current_actor"]
        result = runtime.handle_action(actor_user_id, ActionType.CHECK)
        state = result["state"]

    assert state["street"] == "turn"
    assert len(state["board"]) == 4

    # Complete turn betting
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CHECK)
    state = result["state"]

    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CHECK)
    state = result["state"]

    # Should now be on river with 5 cards
    assert state["street"] == "river"
    assert len(state["board"]) == 5


def test_all_in_preflop_deals_all_streets():
    """Test that all-in preflop automatically deals flop, turn, and river."""
    table = MagicMock(spec=Table)
    table.id = 1

    user1 = MagicMock(spec=User)
    user1.id = 1
    user1.username = "Player1"

    user2 = MagicMock(spec=User)
    user2.id = 2
    user2.username = "Player2"

    seat1 = MagicMock(spec=Seat)
    seat1.user_id = 1
    seat1.position = 0
    seat1.chips = 1000
    seat1.left_at = None
    seat1.is_sitting_out_next_hand = False
    seat1.user = user1

    seat2 = MagicMock(spec=Seat)
    seat2.user_id = 2
    seat2.position = 1
    seat2.chips = 1000
    seat2.left_at = None
    seat2.is_sitting_out_next_hand = False
    seat2.user = user2

    runtime = PokerKitTableRuntime(table, [seat1, seat2])
    state = runtime.start_hand(small_blind=10, big_blind=20)

    # Player goes all-in
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.ALL_IN)
    state = result["state"]

    # Other player calls all-in
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.CALL)
    state = result["state"]

    # Should have dealt all 5 community cards and hand should be complete
    assert len(state["board"]) == 5
    assert "hand_result" in result


def test_fold_before_flop_does_not_deal_cards():
    """Test that folding before flop doesn't deal any community cards."""
    table = MagicMock(spec=Table)
    table.id = 1

    user1 = MagicMock(spec=User)
    user1.id = 1
    user1.username = "Player1"

    user2 = MagicMock(spec=User)
    user2.id = 2
    user2.username = "Player2"

    seat1 = MagicMock(spec=Seat)
    seat1.user_id = 1
    seat1.position = 0
    seat1.chips = 1000
    seat1.left_at = None
    seat1.is_sitting_out_next_hand = False
    seat1.user = user1

    seat2 = MagicMock(spec=Seat)
    seat2.user_id = 2
    seat2.position = 1
    seat2.chips = 1000
    seat2.left_at = None
    seat2.is_sitting_out_next_hand = False
    seat2.user = user2

    runtime = PokerKitTableRuntime(table, [seat1, seat2])
    state = runtime.start_hand(small_blind=10, big_blind=20)

    # Player folds preflop
    actor_user_id = state["current_actor"]
    result = runtime.handle_action(actor_user_id, ActionType.FOLD)
    state = result["state"]

    # No cards should be dealt and hand should be complete
    assert len(state["board"]) == 0
    assert "hand_result" in result
