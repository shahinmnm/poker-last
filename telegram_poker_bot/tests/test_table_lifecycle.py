"""Tests for table lifecycle management changes."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from telegram_poker_bot.shared.models import Base, Table, TableStatus, Seat, TableTemplate, TableTemplateType, GameMode
from telegram_poker_bot.shared.services import table_lifecycle
from telegram_poker_bot.shared.config import get_settings


@pytest_asyncio.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_compute_prestart_expiry_public_table(db_session):
    """Test that public tables expire after configured time."""
    settings = get_settings()

    # Create template
    template = TableTemplate(
        id=1,
        name="Test Template",
        table_type=TableTemplateType.EXPIRING,
        config_json={"expiration_minutes": 10}
    )
    db_session.add(template)
    
    # Create a public table that should be expired
    table = Table(
        id=1,
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=1,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Already expired
    )
    table.template = template
    db_session.add(table)
    
    # Add a seat so table is not empty (we want to test timeout, not empty table)
    seat = Seat(
        table_id=1,
        user_id=100,
        position=0,
        chips=1000,
        left_at=None
    )
    db_session.add(seat)
    await db_session.flush()

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db_session, table)

    assert should_expire is True
    # Check for timeout message
    assert "timeout" in reason.lower()


@pytest.mark.asyncio
async def test_compute_prestart_expiry_private_table(db_session):
    """Test that private tables also expire after the same configured time."""
    settings = get_settings()

    # Create template
    template = TableTemplate(
        id=2,
        name="Private Template",
        table_type=TableTemplateType.PRIVATE,
        config_json={"expiration_minutes": 10}
    )
    db_session.add(template)

    # Create a private table that should be expired
    table = Table(
        id=2,
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=False,
        template_id=2,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Already expired
    )
    table.template = template
    db_session.add(table)
    
    # Add a seat so table is not empty (we want to test timeout, not empty table)
    seat = Seat(
        table_id=2,
        user_id=101,
        position=0,
        chips=1000,
        left_at=None
    )
    db_session.add(seat)
    await db_session.flush()

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db_session, table)

    assert should_expire is True
    # Check for timeout message
    assert "timeout" in reason.lower()


@pytest.mark.asyncio
async def test_compute_prestart_expiry_not_expired(db_session):
    """Test that tables not yet expired are not marked for expiry."""
    # Create template
    template = TableTemplate(
        id=3,
        name="Active Template",
        table_type=TableTemplateType.EXPIRING,
        config_json={}
    )
    db_session.add(template)
    
    # Create a table that should NOT be expired
    table = Table(
        id=3,
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=3,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),  # Still valid
    )
    table.template = template
    db_session.add(table)
    
    # Add a seat so table is not empty
    seat = Seat(
        table_id=3,
        user_id=100,
        position=0,
        chips=1000,
        left_at=None
    )
    db_session.add(seat)
    await db_session.flush()

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db_session, table)

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
    assert required == small_blind + big_blind


@pytest.mark.asyncio
async def test_compute_prestart_expiry_private_table_with_invite_code(db_session):
    """Test that private tables with invite_code get proper TTL."""
    # Create template
    template = TableTemplate(
        id=10,
        name="Private Template with Invite",
        table_type=TableTemplateType.PRIVATE,
        config_json={"expiration_minutes": 60}
    )
    db_session.add(template)
    
    # Create a private table with invite_code that should be expired
    table = Table(
        id=10,
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=False,
        invite_code="ABC123",  # Private table indicator
        template_id=10,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Already expired
    )
    table.template = template
    db_session.add(table)
    
    # Add a seat so table is not empty (we want to test timeout, not empty table)
    seat = Seat(
        table_id=10,
        user_id=105,
        position=0,
        chips=1000,
        left_at=None
    )
    db_session.add(seat)
    await db_session.flush()

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db_session, table)

    assert should_expire is True
    # Should mention timeout
    assert "timeout" in reason.lower()


@pytest.mark.asyncio
async def test_compute_prestart_expiry_public_table_without_invite_code(db_session):
    """Test that public tables without invite_code get proper TTL."""
    # Create template
    template = TableTemplate(
        id=11,
        name="Public Template",
        table_type=TableTemplateType.EXPIRING,
        config_json={"expiration_minutes": 10}
    )
    db_session.add(template)
    
    # Create a public table without invite_code that should be expired
    table = Table(
        id=11,
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        invite_code=None,  # No invite code = public table
        template_id=11,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Already expired
    )
    table.template = template
    db_session.add(table)
    
    # Add a seat so table is not empty (we want to test timeout, not empty table)
    seat = Seat(
        table_id=11,
        user_id=106,
        position=0,
        chips=1000,
        left_at=None
    )
    db_session.add(seat)
    await db_session.flush()

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db_session, table)

    assert should_expire is True
    # Should mention timeout
    assert "timeout" in reason.lower()


@pytest.mark.asyncio
async def test_compute_prestart_expiry_private_table_not_expired(db_session):
    """Test that private tables with 60-min TTL don't expire prematurely."""
    # Create template
    template = TableTemplate(
        id=12,
        name="Long-lived Private Template",
        table_type=TableTemplateType.PRIVATE,
        config_json={}
    )
    db_session.add(template)
    
    # Create a private table that's been waiting for 15 minutes (still valid with 60-min TTL)
    table = Table(
        id=12,
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=False,
        invite_code="XYZ789",
        template_id=12,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=45),  # Still 45 min left
    )
    table.template = template
    db_session.add(table)
    
    # Add a seat so table is not empty
    seat = Seat(
        table_id=12,
        user_id=200,
        position=0,
        chips=1000,
        left_at=None
    )
    db_session.add(seat)
    await db_session.flush()

    should_expire, reason = await table_lifecycle.compute_prestart_expiry(db_session, table)

    assert should_expire is False
    assert reason is None


@pytest.mark.asyncio
async def test_check_player_balance_requirements_insufficient():
    """Test player balance check with insufficient funds."""
    # Create a seat with not enough chips
    seat = Seat(
        id=2,
        table_id=1,
        user_id=101,
        position=1,
        chips=50,  # Not enough for SB + BB + ante
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

