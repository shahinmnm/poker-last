"""Tests for inter-hand ready phase functionality."""

import pytest
from datetime import datetime, timezone
from telegram_poker_bot.shared.models import Table, TableStatus, Seat, Hand, HandStatus
from telegram_poker_bot.shared.services import table_lifecycle


@pytest.mark.asyncio
async def test_all_players_sitting_out_triggers_expiration():
    """Test that table expires when all players are sitting out."""
    from unittest.mock import AsyncMock, MagicMock

    # Create an active table
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        config_json={},
    )

    # Mock database session
    db = MagicMock()

    # Create mock seats - all sitting out
    mock_seats = [
        Seat(
            id=1,
            table_id=1,
            user_id=100,
            position=0,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=True,  # Sitting out
        ),
        Seat(
            id=2,
            table_id=1,
            user_id=101,
            position=1,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=True,  # Sitting out
        ),
    ]

    # Mock database query result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_seats
    db.execute = AsyncMock(return_value=mock_result)

    should_expire, reason = await table_lifecycle.compute_poststart_inactivity(db, table)

    assert should_expire is True
    assert "lack of minimum players" in reason.lower()


@pytest.mark.asyncio
async def test_one_active_player_triggers_expiration():
    """Test that table expires when only one player is not sitting out."""
    from unittest.mock import AsyncMock, MagicMock

    # Create an active table
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        config_json={},
    )

    # Mock database session
    db = MagicMock()

    # Create mock seats - only one active
    mock_seats = [
        Seat(
            id=1,
            table_id=1,
            user_id=100,
            position=0,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=False,  # Active
        ),
        Seat(
            id=2,
            table_id=1,
            user_id=101,
            position=1,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=True,  # Sitting out
        ),
    ]

    # Mock database query result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_seats
    db.execute = AsyncMock(return_value=mock_result)

    should_expire, reason = await table_lifecycle.compute_poststart_inactivity(db, table)

    assert should_expire is True
    assert "lack of minimum players" in reason.lower()
    assert "1/2 required" in reason


@pytest.mark.asyncio
async def test_two_active_players_no_expiration():
    """Test that table does not expire when at least 2 players are active."""
    from unittest.mock import AsyncMock, MagicMock

    # Create an active table
    table = Table(
        id=1,
        status=TableStatus.ACTIVE,
        is_public=True,
        config_json={},
    )

    # Mock database session
    db = MagicMock()

    # Create mock seats - two active
    mock_seats = [
        Seat(
            id=1,
            table_id=1,
            user_id=100,
            position=0,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=False,  # Active
        ),
        Seat(
            id=2,
            table_id=1,
            user_id=101,
            position=1,
            chips=1000,
            left_at=None,
            is_sitting_out_next_hand=False,  # Active
        ),
    ]

    # Mock database query result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_seats
    db.execute = AsyncMock(return_value=mock_result)

    should_expire, reason = await table_lifecycle.compute_poststart_inactivity(db, table)

    assert should_expire is False
    assert reason is None


@pytest.mark.asyncio
async def test_balance_check_with_ante():
    """Test balance check includes ante in requirement calculation."""
    seat = Seat(
        id=1,
        table_id=1,
        user_id=100,
        position=0,
        chips=100,  # Exactly SB + BB + Ante
    )

    small_blind = 25
    big_blind = 50
    ante = 25

    has_sufficient, required = await table_lifecycle.check_player_balance_requirements(
        seat, small_blind, big_blind, ante
    )

    assert has_sufficient is True
    assert required == 100  # 25 + 50 + 25


@pytest.mark.asyncio
async def test_balance_check_insufficient_with_ante():
    """Test balance check correctly identifies insufficient balance with ante."""
    seat = Seat(
        id=1,
        table_id=1,
        user_id=100,
        position=0,
        chips=99,  # One chip short
    )

    small_blind = 25
    big_blind = 50
    ante = 25

    has_sufficient, required = await table_lifecycle.check_player_balance_requirements(
        seat, small_blind, big_blind, ante
    )

    assert has_sufficient is False
    assert required == 100  # 25 + 50 + 25
