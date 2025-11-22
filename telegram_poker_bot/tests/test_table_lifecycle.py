"""Tests for table lifecycle management changes."""

import pytest
from datetime import datetime, timezone, timedelta
from telegram_poker_bot.shared.models import Table, TableStatus, Seat
from telegram_poker_bot.shared.services import table_lifecycle
from telegram_poker_bot.shared.config import get_settings


@pytest.mark.asyncio
async def test_compute_prestart_expiry_public_table():
    """Test that public tables expire after configured time."""
    settings = get_settings()

    # Create a public table that should be expired
    table = Table(
        id=1,
        status=TableStatus.WAITING,
        is_public=True,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Already expired
        config_json={},
    )

    # Mock db session (not used in this function for public tables)
    db = None

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db, table)

    assert should_expire is True
    assert "public table" in reason.lower()
    assert f"{settings.public_table_prestart_ttl_minutes}" in reason


@pytest.mark.asyncio
async def test_compute_prestart_expiry_private_table():
    """Test that private tables expire after configured time."""
    settings = get_settings()

    # Create a private table that should be expired
    table = Table(
        id=2,
        status=TableStatus.WAITING,
        is_public=False,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Already expired
        config_json={},
    )

    # Mock db session
    db = None

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db, table)

    assert should_expire is True
    assert "private table" in reason.lower()
    assert f"{settings.private_table_prestart_ttl_minutes}" in reason


@pytest.mark.asyncio
async def test_compute_prestart_expiry_not_expired():
    """Test that tables not yet expired are not marked for expiry."""
    # Create a table that should NOT be expired
    table = Table(
        id=3,
        status=TableStatus.WAITING,
        is_public=True,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),  # Still valid
        config_json={},
    )

    # Mock db session
    db = None

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db, table)

    assert should_expire is False
    assert reason is None


@pytest.mark.asyncio
async def test_check_player_balance_requirements_sufficient():
    """Test player balance check with sufficient funds."""
    # Create a seat with enough chips
    seat = Seat(
        id=1,
        table_id=1,
        user_id=100,
        position=0,
        chips=1000,  # More than enough
    )

    small_blind = 25
    big_blind = 50
    ante = 0

    has_sufficient, required = await table_lifecycle.check_player_balance_requirements(
        seat, small_blind, big_blind, ante
    )

    assert has_sufficient is True
    assert required == small_blind + big_blind + ante


@pytest.mark.asyncio
async def test_check_player_balance_requirements_insufficient():
    """Test player balance check with insufficient funds."""
    # Create a seat with not enough chips
    seat = Seat(
        id=2,
        table_id=1,
        user_id=101,
        position=1,
        chips=50,  # Not enough for SB + BB
    )

    small_blind = 25
    big_blind = 50
    ante = 10

    has_sufficient, required = await table_lifecycle.check_player_balance_requirements(
        seat, small_blind, big_blind, ante
    )

    assert has_sufficient is False
    assert required == small_blind + big_blind + ante
    assert seat.chips < required


@pytest.mark.asyncio
async def test_check_player_balance_requirements_exact():
    """Test player balance check with exact required amount."""
    # Create a seat with exactly enough chips
    seat = Seat(
        id=3,
        table_id=1,
        user_id=102,
        position=2,
        chips=75,  # Exactly SB + BB
    )

    small_blind = 25
    big_blind = 50
    ante = 0

    has_sufficient, required = await table_lifecycle.check_player_balance_requirements(
        seat, small_blind, big_blind, ante
    )

    assert has_sufficient is True
    assert required == 75
    assert seat.chips == required
