"""Tests for waitlist functionality."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.models import (
    Base,
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    User,
    Seat,
    WaitlistEntry,
    WaitlistStatus,
    GameMode,
)
from telegram_poker_bot.shared.services import waitlist_service


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
async def template_with_waitlist(db_session: AsyncSession):
    """Create a table template with waitlist enabled."""
    template = TableTemplate(
        name="Test Waitlist Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=True,
        config_json={
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 1000,
            "max_players": 4,
            "currency_type": "PLAY",
        },
    )
    db_session.add(template)
    await db_session.flush()
    return template


@pytest_asyncio.fixture
async def table_with_waitlist(db_session: AsyncSession, template_with_waitlist):
    """Create a table with waitlist enabled."""
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        template_id=template_with_waitlist.id,
        is_public=True,
    )
    db_session.add(table)
    await db_session.flush()
    return table


@pytest_asyncio.fixture
async def test_users(db_session: AsyncSession):
    """Create test users."""
    users = []
    for i in range(5):
        user = User(
            tg_user_id=10000 + i,
            username=f"testuser{i}",
            balance_play=10000,
        )
        db_session.add(user)
        users.append(user)
    await db_session.flush()
    return users


@pytest.mark.asyncio
async def test_join_waitlist_success(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test successfully joining a waitlist."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    entry = await waitlist_service.join_waitlist(db_session, table_id, user_id)

    assert entry.table_id == table_id
    assert entry.user_id == user_id
    assert entry.status == WaitlistStatus.WAITING
    assert entry.created_at is not None


@pytest.mark.asyncio
async def test_join_waitlist_already_seated(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test joining waitlist when already seated fails."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    # Create a seat for the user
    seat = Seat(
        table_id=table_id,
        user_id=user_id,
        position=0,
        chips=1000,
    )
    db_session.add(seat)
    await db_session.flush()

    # Try to join waitlist
    with pytest.raises(ValueError, match="already seated"):
        await waitlist_service.join_waitlist(db_session, table_id, user_id)


@pytest.mark.asyncio
async def test_join_waitlist_already_waiting(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test joining waitlist when already waiting fails."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    # Join waitlist once
    await waitlist_service.join_waitlist(db_session, table_id, user_id)

    # Try to join again
    with pytest.raises(ValueError, match="already on the waitlist"):
        await waitlist_service.join_waitlist(db_session, table_id, user_id)


@pytest.mark.asyncio
async def test_leave_waitlist_success(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test successfully leaving a waitlist."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    # Join waitlist
    entry = await waitlist_service.join_waitlist(db_session, table_id, user_id)
    entry_id = entry.id

    # Leave waitlist
    cancelled_entry = await waitlist_service.leave_waitlist(db_session, table_id, user_id)

    assert cancelled_entry.id == entry_id
    assert cancelled_entry.status == WaitlistStatus.CANCELLED


@pytest.mark.asyncio
async def test_leave_waitlist_not_waiting(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test leaving waitlist when not on waitlist fails."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    with pytest.raises(ValueError, match="not on the waitlist"):
        await waitlist_service.leave_waitlist(db_session, table_id, user_id)


@pytest.mark.asyncio
async def test_get_next_waiting_player(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test getting the next waiting player maintains FIFO order."""
    table_id = table_with_waitlist.id

    # Add multiple users to waitlist
    await waitlist_service.join_waitlist(db_session, table_id, test_users[0].id)
    await db_session.flush()

    # Small delay to ensure different timestamps
    import asyncio
    await asyncio.sleep(0.01)

    await waitlist_service.join_waitlist(db_session, table_id, test_users[1].id)
    await db_session.flush()

    # Get next player
    next_entry = await waitlist_service.get_next_waiting_player(db_session, table_id)

    assert next_entry is not None
    assert next_entry.user_id == test_users[0].id


@pytest.mark.asyncio
async def test_get_next_waiting_player_empty(
    db_session: AsyncSession, table_with_waitlist
):
    """Test getting next player when waitlist is empty."""
    table_id = table_with_waitlist.id

    next_entry = await waitlist_service.get_next_waiting_player(db_session, table_id)

    assert next_entry is None


@pytest.mark.asyncio
async def test_mark_entry_entered(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test marking a waitlist entry as entered."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    # Join waitlist
    entry = await waitlist_service.join_waitlist(db_session, table_id, user_id)
    entry_id = entry.id

    # Mark as entered
    await waitlist_service.mark_entry_entered(db_session, entry_id)

    # Verify status changed
    result = await db_session.execute(
        select(WaitlistEntry).where(WaitlistEntry.id == entry_id)
    )
    updated_entry = result.scalar_one()
    assert updated_entry.status == WaitlistStatus.ENTERED


@pytest.mark.asyncio
async def test_get_waitlist(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test getting all waitlist entries."""
    table_id = table_with_waitlist.id

    # Add multiple users
    await waitlist_service.join_waitlist(db_session, table_id, test_users[0].id)
    await waitlist_service.join_waitlist(db_session, table_id, test_users[1].id)
    await waitlist_service.join_waitlist(db_session, table_id, test_users[2].id)

    # Get waitlist
    entries = await waitlist_service.get_waitlist(db_session, table_id)

    assert len(entries) == 3
    assert entries[0].user_id == test_users[0].id
    assert entries[1].user_id == test_users[1].id
    assert entries[2].user_id == test_users[2].id


@pytest.mark.asyncio
async def test_get_user_waitlist_position(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test getting user position in waitlist."""
    table_id = table_with_waitlist.id

    # Add users to waitlist
    await waitlist_service.join_waitlist(db_session, table_id, test_users[0].id)
    await waitlist_service.join_waitlist(db_session, table_id, test_users[1].id)
    await waitlist_service.join_waitlist(db_session, table_id, test_users[2].id)

    # Check positions
    pos0 = await waitlist_service.get_user_waitlist_position(
        db_session, table_id, test_users[0].id
    )
    pos1 = await waitlist_service.get_user_waitlist_position(
        db_session, table_id, test_users[1].id
    )
    pos2 = await waitlist_service.get_user_waitlist_position(
        db_session, table_id, test_users[2].id
    )

    assert pos0 == 1
    assert pos1 == 2
    assert pos2 == 3


@pytest.mark.asyncio
async def test_get_user_waitlist_position_not_waiting(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test getting position for user not on waitlist."""
    table_id = table_with_waitlist.id
    user_id = test_users[0].id

    position = await waitlist_service.get_user_waitlist_position(
        db_session, table_id, user_id
    )

    assert position is None


@pytest.mark.asyncio
async def test_get_waitlist_count(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test getting waitlist count."""
    table_id = table_with_waitlist.id

    # Initially empty
    count = await waitlist_service.get_waitlist_count(db_session, table_id)
    assert count == 0

    # Add users
    await waitlist_service.join_waitlist(db_session, table_id, test_users[0].id)
    await waitlist_service.join_waitlist(db_session, table_id, test_users[1].id)

    count = await waitlist_service.get_waitlist_count(db_session, table_id)
    assert count == 2


@pytest.mark.asyncio
async def test_cancel_old_entries(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test cancelling old waitlist entries."""
    table_id = table_with_waitlist.id

    # Create an old entry
    old_entry = WaitlistEntry(
        table_id=table_id,
        user_id=test_users[0].id,
        status=WaitlistStatus.WAITING,
        created_at=datetime.now(timezone.utc) - timedelta(hours=25),
    )
    db_session.add(old_entry)
    await db_session.flush()

    # Create a recent entry
    await waitlist_service.join_waitlist(db_session, table_id, test_users[1].id)

    # Cancel old entries (older than 24 hours)
    cancelled_count = await waitlist_service.cancel_old_entries(
        db_session, table_id, max_age_hours=24
    )

    assert cancelled_count == 1

    # Verify only recent entry remains waiting
    entries = await waitlist_service.get_waitlist(
        db_session, table_id, status=WaitlistStatus.WAITING
    )
    assert len(entries) == 1
    assert entries[0].user_id == test_users[1].id


@pytest.mark.asyncio
async def test_waitlist_ordering_fifo(
    db_session: AsyncSession, table_with_waitlist, test_users
):
    """Test that waitlist maintains FIFO ordering."""
    table_id = table_with_waitlist.id

    # Add users with explicit timing
    for i in range(3):
        await waitlist_service.join_waitlist(db_session, table_id, test_users[i].id)
        await db_session.flush()
        import asyncio
        await asyncio.sleep(0.01)  # Ensure different timestamps

    # Get entries and verify order
    entries = await waitlist_service.get_waitlist(db_session, table_id)

    assert len(entries) == 3
    for i in range(3):
        assert entries[i].user_id == test_users[i].id
        assert entries[i].status == WaitlistStatus.WAITING
