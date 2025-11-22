"""Test for inter-hand wait deadline broadcast bug fix."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from telegram_poker_bot.shared.models import (
    Table,
    TableStatus,
    Seat,
    Hand,
    HandStatus,
    User,
    ActionType,
)
from telegram_poker_bot.game_core.pokerkit_runtime import (
    PokerKitTableRuntimeManager,
)


@pytest.mark.asyncio
async def test_inter_hand_wait_deadline_in_broadcasted_state():
    """
    Test that inter_hand_wait_deadline is included in the state when hand ends.

    This test verifies the fix for the bug where the deadline was missing from
    the broadcasted state, causing the frontend's "Ready Voting Panel" to never appear.
    """
    # Create test table and seats
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        config_json={"small_blind": 25, "big_blind": 50},
        last_action_at=datetime.now(timezone.utc),
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

    manager = PokerKitTableRuntimeManager()

    # Mock database session
    db = AsyncMock()

    # Mock table query
    mock_table_result = MagicMock()
    mock_table_result.scalar_one_or_none.return_value = table

    # Mock seats query
    mock_seats_result = MagicMock()
    mock_seats_result.scalars.return_value.all.return_value = seats

    # Mock hand query to return an existing hand
    mock_hand = Hand(
        id=1,
        table_id=1,
        hand_no=1,
        status=HandStatus.PREFLOP,
        engine_state_json={},
        timeout_tracking={},
    )
    mock_hand_result = MagicMock()
    mock_hand_result.scalar_one_or_none.return_value = mock_hand

    # Setup db.execute to return appropriate mocks
    async def mock_execute(query):
        # Simple heuristic to determine which query is being executed
        query_str = str(query)
        if "Table" in query_str and "Seat" not in query_str:
            return mock_table_result
        elif "Seat" in query_str:
            return mock_seats_result
        else:
            return mock_hand_result

    db.execute = AsyncMock(side_effect=mock_execute)
    db.flush = AsyncMock()
    db.begin_nested = MagicMock(return_value=AsyncMock().__aenter__())

    # Mock the runtime and engine to simulate a hand ending
    with patch(
        "telegram_poker_bot.game_core.pokerkit_runtime.PokerKitTableRuntime.handle_action"
    ) as mock_handle_action:
        # Create a mock result that simulates a hand ending
        mock_hand_result_data = {
            "winners": [
                {
                    "user_id": 100,
                    "amount": 100,
                    "pot_index": 0,
                    "hand_score": 1000,
                    "hand_rank": "Pair",
                    "best_hand_cards": ["Ah", "As"],
                }
            ]
        }

        # Mock _apply_hand_result_and_cleanup to return proper event
        with patch(
            "telegram_poker_bot.game_core.pokerkit_runtime.PokerKitTableRuntime._apply_hand_result_and_cleanup"
        ) as mock_apply:
            # Calculate expected deadline (20 seconds from now)
            from telegram_poker_bot.shared.config import get_settings

            settings = get_settings()
            from datetime import timedelta

            expected_deadline = (
                datetime.now(timezone.utc)
                + timedelta(seconds=settings.post_hand_delay_seconds)
            ).isoformat()

            # Mock the hand_ended_event that _apply_hand_result_and_cleanup returns
            mock_hand_ended_event = {
                "type": "hand_ended",
                "table_id": 1,
                "hand_no": 1,
                "winners": mock_hand_result_data["winners"],
                "next_hand_in": settings.post_hand_delay_seconds,
                "status": "INTER_HAND_WAIT",
                "inter_hand_wait_deadline": expected_deadline,  # The critical field
            }

            mock_apply.return_value = mock_hand_ended_event

            # Mock handle_action to return a state with hand_result
            mock_handle_action.return_value = {
                "state": {
                    "type": "table_state",
                    "table_id": 1,
                    "hand_id": 1,
                    "status": "river",
                    "players": [],
                },
                "hand_result": mock_hand_result_data,
            }

            # Now test the actual manager.handle_action flow
            with patch(
                "telegram_poker_bot.shared.services.user_service.apply_hand_result_to_wallets_and_stats"
            ) as mock_wallet_update:
                mock_wallet_update.return_value = AsyncMock()

                # Simulate a fold action that ends the hand
                result_state = await manager.handle_action(
                    db=db,
                    table_id=1,
                    user_id=100,
                    action=ActionType.FOLD,
                    amount=None,
                )

                # THE FIX VERIFICATION:
                # After the fix, the result_state should contain inter_hand_wait_deadline
                assert (
                    "inter_hand_wait" in result_state
                ), "inter_hand_wait flag should be present when hand ends"
                assert (
                    "inter_hand_wait_seconds" in result_state
                ), "inter_hand_wait_seconds should be present when hand ends"
                # This is the critical assertion - the deadline MUST be present
                assert "inter_hand_wait_deadline" in result_state, (
                    "inter_hand_wait_deadline MUST be present in broadcasted state "
                    "for frontend countdown timer to work"
                )

                # Verify the deadline is properly formatted as ISO string
                deadline = result_state["inter_hand_wait_deadline"]
                assert isinstance(
                    deadline, str
                ), "inter_hand_wait_deadline should be ISO formatted string"
                # Basic ISO format check (should contain 'T' and timezone info)
                assert (
                    "T" in deadline
                ), "Deadline should be in ISO format with date and time"


@pytest.mark.asyncio
async def test_hand_ended_event_contains_deadline():
    """Test that _apply_hand_result_and_cleanup creates event with deadline."""
    from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime
    from telegram_poker_bot.shared.config import get_settings

    settings = get_settings()

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
    runtime.hand_no = 1

    # Mock database session
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )
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

            # Verify the deadline is in the event
            assert (
                "inter_hand_wait_deadline" in hand_ended_event
            ), "hand_ended_event must contain inter_hand_wait_deadline"

            # Verify it's a properly formatted ISO timestamp
            deadline = hand_ended_event["inter_hand_wait_deadline"]
            assert isinstance(deadline, str), "Deadline should be ISO formatted string"
            assert "T" in deadline, "Deadline should be in ISO format"

            # Verify the deadline is approximately 20 seconds from now
            # (we can't check exact time due to test execution time)
            deadline_dt = datetime.fromisoformat(deadline)
            now = datetime.now(timezone.utc)
            time_diff = (deadline_dt - now).total_seconds()

            # Should be close to post_hand_delay_seconds (20 seconds by default)
            # Allow some tolerance for test execution time
            assert abs(time_diff - settings.post_hand_delay_seconds) < 5, (
                f"Deadline should be approximately {settings.post_hand_delay_seconds} "
                f"seconds from now, got {time_diff} seconds"
            )
