"""Test for inter-hand wait deadline broadcast bug fix."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from telegram_poker_bot.shared.models import (
    Table,
    TableStatus,
    TableTemplate,
    TableTemplateType,
    Seat,
    Hand,
    HandStatus,
    User,
)


@pytest.mark.asyncio
async def test_hand_ended_event_contains_deadline():
    """
    Test that _apply_hand_result_and_cleanup creates event with deadline.

    This test verifies the fix for the bug where the deadline was missing from
    the broadcasted state, causing the frontend's "Ready Voting Panel" to never appear.

    The fix ensures that:
    1. _apply_hand_result_and_cleanup creates hand_ended_event with inter_hand_wait_deadline
    2. This deadline is extracted and propagated to the result dictionary
    3. The deadline is then copied to the state dictionary that gets broadcasted
    """
    from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime
    from telegram_poker_bot.shared.config import get_settings

    settings = get_settings()

    # Create test template
    template = MagicMock(spec=TableTemplate)
    template.id = 1
    template.name = "Test Template"
    template.table_type = TableTemplateType.EXPIRING
    template.config_json = {
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 1000,
        "max_players": 6,
    }

    # Create test table and seats
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        template_id=1,
    )
    table.template = template

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

            # Verify other expected fields are also present
            assert hand_ended_event["type"] == "hand_ended"
            assert hand_ended_event["table_id"] == 1
            assert hand_ended_event["status"] == "INTER_HAND_WAIT"
            assert hand_ended_event["next_hand_in"] == settings.post_hand_delay_seconds


@pytest.mark.asyncio
async def test_hand_ended_event_contains_allowed_actions_with_ready():
    """
    Test that hand_ended event includes allowed_actions with ready action.

    This test verifies the fix for the bug where the ready button wasn't shown
    to all players because the hand_ended broadcast was missing allowed_actions.

    The fix ensures that:
    1. hand_ended_event includes "allowed_actions" field
    2. allowed_actions contains [{"action_type": "ready"}]
    3. All players receiving the broadcast can see and click the ready button
    """
    from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime

    # Create test template
    template = MagicMock(spec=TableTemplate)
    template.id = 1
    template.name = "Test Template"
    template.table_type = TableTemplateType.EXPIRING
    template.config_json = {
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 1000,
        "max_players": 6,
    }

    # Create test table and seats (2 players)
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        template_id=1,
    )
    table.template = template

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
    mock_pot.amount = 200
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

    # Create hand result with winner
    hand_result = {
        "winners": [
            {
                "user_id": 100,
                "amount": 200,
                "hand_rank": "Two Pair",
                "best_hand_cards": ["Ah", "As", "Kh", "Ks", "Qh"],
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

            # CRITICAL: Verify allowed_actions is present
            assert (
                "allowed_actions" in hand_ended_event
            ), "hand_ended_event MUST contain allowed_actions for ready button"

            # Verify allowed_actions is a non-empty list
            allowed_actions = hand_ended_event["allowed_actions"]
            assert isinstance(allowed_actions, list), "allowed_actions should be a list"
            assert len(allowed_actions) > 0, "allowed_actions should not be empty"

            # Verify the ready action is present
            action_types = [a.get("action_type") for a in allowed_actions]
            assert (
                "ready" in action_types
            ), "allowed_actions must include 'ready' action type"

            # Verify the exact structure
            ready_action = next(
                (a for a in allowed_actions if a.get("action_type") == "ready"), None
            )
            assert ready_action is not None, "ready action must be present"
            assert ready_action == {
                "action_type": "ready"
            }, "ready action should have correct structure"

            # Verify all other expected fields are present
            assert hand_ended_event["type"] == "hand_ended"
            assert hand_ended_event["status"] == "INTER_HAND_WAIT"
            assert "winners" in hand_ended_event
            assert "inter_hand_wait_deadline" in hand_ended_event
