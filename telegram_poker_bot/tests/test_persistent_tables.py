"""Tests for persistent table lifecycle behavior."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.models import (
    Base,
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    User,
    Seat,
    GameMode,
)
from telegram_poker_bot.shared.services import table_lifecycle


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


@pytest_asyncio.fixture
async def persistent_template(db_session: AsyncSession):
    """Create a persistent table template."""
    template = TableTemplate(
        name="Persistent Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=True,
        config_json={
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 1000,
            "max_players": 6,
            "currency_type": "PLAY",
        },
    )
    db_session.add(template)
    await db_session.flush()
    return template


@pytest_asyncio.fixture
async def expiring_template(db_session: AsyncSession):
    """Create an expiring table template."""
    template = TableTemplate(
        name="Expiring Test Template",
        table_type=TableTemplateType.EXPIRING,
        has_waitlist=False,
        config_json={
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 1000,
            "max_players": 6,
            "currency_type": "PLAY",
            "expiration_minutes": 10,
        },
    )
    db_session.add(template)
    await db_session.flush()
    return template


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        tg_user_id=12345,
        username="testuser",
        balance_play=10000,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_persistent_table_never_expires_prestart(
    db_session: AsyncSession, persistent_template, test_user
):
    """Test that persistent tables never expire during pre-start even past expires_at."""
    # Create a persistent table with expired timestamp
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        template_id=persistent_template.id,
        is_public=True,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=2),  # Expired 2 hours ago
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add a seat so table isn't empty
    seat = Seat(
        table_id=table.id,
        user_id=test_user.id,
        position=0,
        chips=1000,
    )
    db_session.add(seat)
    await db_session.flush()

    # Check lifecycle
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )

    # Persistent tables should never expire via lifecycle
    assert should_expire is False
    assert reason is None
    assert table.status == TableStatus.WAITING


@pytest.mark.asyncio
async def test_persistent_table_never_expires_active(
    db_session: AsyncSession, persistent_template, test_user
):
    """Test that persistent tables never expire when active."""
    # Create a persistent table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,  # Active game
        template_id=persistent_template.id,
        is_public=True,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add a single seat (below minimum)
    seat = Seat(
        table_id=table.id,
        user_id=test_user.id,
        position=0,
        chips=1000,
        is_sitting_out_next_hand=True,  # Sitting out
    )
    db_session.add(seat)
    await db_session.flush()

    # Check lifecycle
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )

    # Persistent tables should never expire via lifecycle
    assert should_expire is False
    assert reason is None
    assert table.status == TableStatus.ACTIVE


@pytest.mark.asyncio
async def test_expiring_table_does_expire(
    db_session: AsyncSession, expiring_template, test_user
):
    """Test that expiring tables do expire normally."""
    # Create an expiring table with expired timestamp
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        template_id=expiring_template.id,
        is_public=True,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Expired
    )
    table.template = expiring_template
    db_session.add(table)
    await db_session.flush()

    # Add a seat so table isn't empty
    seat = Seat(
        table_id=table.id,
        user_id=test_user.id,
        position=0,
        chips=1000,
    )
    db_session.add(seat)
    await db_session.flush()

    # Check lifecycle
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )

    # Expiring tables should expire
    assert should_expire is True
    assert reason is not None
    assert "timeout" in reason.lower()
    assert table.status == TableStatus.EXPIRED


@pytest.mark.asyncio
async def test_persistent_table_with_empty_seats(
    db_session: AsyncSession, persistent_template
):
    """Test that persistent tables don't auto-expire even if empty (manual removal only)."""
    # Create a persistent table with no seats
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        template_id=persistent_template.id,
        is_public=True,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Check lifecycle
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )

    # Persistent tables should not auto-expire even if empty
    # They can only be removed via manual admin action
    assert should_expire is False
    assert reason is None
    assert table.status == TableStatus.WAITING


@pytest.mark.asyncio
async def test_persistent_table_status_transitions(
    db_session: AsyncSession, persistent_template, test_user
):
    """Test that persistent tables can transition between WAITING and ACTIVE."""
    # Create a persistent table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        template_id=persistent_template.id,
        is_public=True,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add seats
    seat1 = Seat(
        table_id=table.id,
        user_id=test_user.id,
        position=0,
        chips=1000,
    )
    db_session.add(seat1)
    await db_session.flush()

    # Verify table starts in WAITING
    assert table.status == TableStatus.WAITING

    # Transition to ACTIVE
    table.status = TableStatus.ACTIVE
    await db_session.flush()

    # Check lifecycle doesn't auto-expire
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )
    assert should_expire is False

    # Can transition back to WAITING
    table.status = TableStatus.WAITING
    await db_session.flush()

    # Check lifecycle still doesn't expire
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )
    assert should_expire is False


@pytest.mark.asyncio
async def test_persistent_table_no_expiration_field_required(
    db_session: AsyncSession, persistent_template, test_user
):
    """Test that persistent tables work fine without expires_at set."""
    # Create a persistent table without expires_at
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        template_id=persistent_template.id,
        is_public=True,
        expires_at=None,  # No expiration time
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add a seat
    seat = Seat(
        table_id=table.id,
        user_id=test_user.id,
        position=0,
        chips=1000,
    )
    db_session.add(seat)
    await db_session.flush()

    # Check lifecycle
    should_expire, reason = await table_lifecycle.check_and_enforce_lifecycle(
        db_session, table
    )

    # Should not expire
    assert should_expire is False
    assert reason is None
    assert table.status == TableStatus.WAITING
