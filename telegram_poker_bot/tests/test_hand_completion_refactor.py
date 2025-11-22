"""Tests for unified hand completion refactoring."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from telegram_poker_bot.shared.models import (
    Table,
    TableStatus,
    Seat,
    Hand,
    HandStatus,
    User,
)
from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime


@pytest.mark.asyncio
async def test_apply_hand_result_and_cleanup_sets_inter_hand_wait():
    """Test that _apply_hand_result_and_cleanup sets INTER_HAND_WAIT status."""
    # Create test table and seats
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        config_json={"small_blind": 25, "big_blind": 50},
    )

    user1 = User(id=100, tg_user_id=1000, username="player1")
    user2 = User(id=101, tg_user_id=1001, username="player2")

    seats = [
        Seat(
            id=1,
            table_id=1,
            user_id=100,
            user=user1,
            position=0,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=False,
        ),
        Seat(
            id=2,
            table_id=1,
            user_id=101,
            user=user2,
            position=1,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=False,
        ),
    ]

    runtime = PokerKitTableRuntime(table, seats)

    # Create mock hand and engine
    runtime.current_hand = Hand(
        id=1,
        table_id=1,
        hand_no=1,
        status=HandStatus.PREFLOP,
        engine_state_json={},
    )

    # Mock engine state
    mock_engine = MagicMock()
    mock_engine.state.board_cards = []
    mock_engine.state.street_index = 3  # River street for showdown
    mock_pot = MagicMock()
    mock_pot.amount = 100
    mock_engine.state.pots = [mock_pot]
    mock_engine.state.bets = []
    runtime.engine = mock_engine
    runtime.hand_no = 1  # Set hand_no properly

    # Mock database session
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    db.flush = AsyncMock()
    db.begin_nested = MagicMock(return_value=AsyncMock().__aenter__())

    # Create hand result
    hand_result = {
        "winners": [
            {
                "user_id": 100,
                "amount": 100,
                "hand_rank": "Pair",
                "best_hand_cards": ["Ah", "As"],
            }
        ]
    }

    # Mock the services
    with patch(
        "telegram_poker_bot.game_core.pokerkit_runtime.table_lifecycle"
    ) as mock_lifecycle:
        mock_lifecycle.compute_poststart_inactivity = AsyncMock(
            return_value=(False, None)
        )

        with patch(
            "telegram_poker_bot.shared.services.user_service.apply_hand_result_to_wallets_and_stats"
        ) as mock_apply:
            mock_apply.return_value = AsyncMock()

            # Call the method
            hand_ended_event = await runtime._apply_hand_result_and_cleanup(
                db, hand_result
            )

            # Verify the result
            assert hand_ended_event["type"] == "hand_ended"
            assert hand_ended_event["table_id"] == 1
            assert hand_ended_event["hand_no"] == 1
            assert hand_ended_event["status"] == "INTER_HAND_WAIT"
            assert hand_ended_event["next_hand_in"] == 20  # Default from settings
            assert len(hand_ended_event["winners"]) == 1
            assert hand_ended_event["winners"][0]["user_id"] == 100

            # Verify hand status was set to INTER_HAND_WAIT
            assert runtime.current_hand.status == HandStatus.INTER_HAND_WAIT

            # Verify all players are sitting out
            for seat in runtime.seats:
                assert seat.is_sitting_out_next_hand is True

            # Verify ready_players was reset
            assert len(runtime.ready_players) == 0

            # Verify lifecycle check was called
            mock_lifecycle.compute_poststart_inactivity.assert_called_once_with(
                db, table
            )


@pytest.mark.asyncio
async def test_apply_hand_result_includes_table_will_end_when_lifecycle_fails():
    """Test that hand_ended event includes table_will_end when lifecycle check fails."""
    # Create test table and seats
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        config_json={"small_blind": 25, "big_blind": 50},
    )

    user1 = User(id=100, tg_user_id=1000, username="player1")

    seats = [
        Seat(
            id=1,
            table_id=1,
            user_id=100,
            user=user1,
            position=0,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=False,
        ),
    ]

    runtime = PokerKitTableRuntime(table, seats)

    # Create mock hand and engine
    runtime.current_hand = Hand(
        id=1,
        table_id=1,
        hand_no=1,
        status=HandStatus.PREFLOP,
        engine_state_json={},
    )

    mock_engine = MagicMock()
    mock_engine.state.board_cards = []
    mock_engine.state.street_index = 3  # River street for showdown
    mock_pot = MagicMock()
    mock_pot.amount = 100
    mock_engine.state.pots = [mock_pot]
    mock_engine.state.bets = []
    runtime.engine = mock_engine
    runtime.hand_no = 1  # Set hand_no properly

    # Mock database session
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    db.flush = AsyncMock()
    db.begin_nested = MagicMock(return_value=AsyncMock().__aenter__())

    # Create hand result
    hand_result = {
        "winners": [
            {
                "user_id": 100,
                "amount": 100,
                "hand_rank": "High Card",
                "best_hand_cards": ["Ah"],
            }
        ]
    }

    # Mock the services to return lifecycle failure
    with patch(
        "telegram_poker_bot.game_core.pokerkit_runtime.table_lifecycle"
    ) as mock_lifecycle:
        mock_lifecycle.compute_poststart_inactivity = AsyncMock(
            return_value=(True, "lack of minimum player (1/2 required)")
        )

        with patch(
            "telegram_poker_bot.shared.services.user_service.apply_hand_result_to_wallets_and_stats"
        ) as mock_apply:
            mock_apply.return_value = AsyncMock()

            # Call the method
            hand_ended_event = await runtime._apply_hand_result_and_cleanup(
                db, hand_result
            )

            # Verify the result includes table_will_end
            assert hand_ended_event["type"] == "hand_ended"
            assert hand_ended_event["table_will_end"] is True
            assert hand_ended_event["end_reason"] == "lack of minimum player (1/2 required)"

            # Verify lifecycle check was called
            mock_lifecycle.compute_poststart_inactivity.assert_called_once_with(
                db, table
            )
