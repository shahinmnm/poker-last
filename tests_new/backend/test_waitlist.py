"""High-level tests for waitlist logic and functionality.

This module validates waitlist behavior including queue management,
FIFO ordering, and integration with table seating.
"""

import pytest
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_user_can_join_waitlist(db_session, sample_table, sample_users):
    """Validate user can join a table's waitlist."""
    from telegram_poker_bot.shared.models import WaitlistEntry
    from telegram_poker_bot.shared.services.waitlist import add_to_waitlist
    
    user = sample_users[0]
    entry = await add_to_waitlist(db_session, sample_table.id, user.id)
    
    assert entry is not None
    assert entry.table_id == sample_table.id
    assert entry.user_id == user.id
    assert not entry.entered


@pytest.mark.asyncio
async def test_waitlist_maintains_fifo_order(db_session, sample_table, sample_users):
    """Validate waitlist maintains first-in-first-out ordering."""
    from telegram_poker_bot.shared.services.waitlist import add_to_waitlist, get_waitlist
    
    # Add users in specific order
    for user in sample_users[:3]:
        await add_to_waitlist(db_session, sample_table.id, user.id)
    
    # Get waitlist
    waitlist = await get_waitlist(db_session, sample_table.id)
    
    # Verify FIFO order
    assert len(waitlist) == 3
    assert waitlist[0].user_id == sample_users[0].id
    assert waitlist[1].user_id == sample_users[1].id
    assert waitlist[2].user_id == sample_users[2].id


@pytest.mark.asyncio
async def test_get_next_waiting_player(db_session, sample_table, sample_users):
    """Validate getting next player from waitlist."""
    from telegram_poker_bot.shared.services.waitlist import (
        add_to_waitlist, get_next_waiting_player
    )
    
    # Add users to waitlist
    for user in sample_users[:3]:
        await add_to_waitlist(db_session, sample_table.id, user.id)
    
    # Get next player
    next_player = await get_next_waiting_player(db_session, sample_table.id)
    
    assert next_player is not None
    assert next_player.user_id == sample_users[0].id


@pytest.mark.asyncio
async def test_mark_waitlist_entry_entered(db_session, sample_table, sample_users):
    """Validate marking a waitlist entry as entered."""
    from telegram_poker_bot.shared.services.waitlist import (
        add_to_waitlist, mark_entry_entered, get_next_waiting_player
    )
    
    # Add user to waitlist
    entry = await add_to_waitlist(db_session, sample_table.id, sample_users[0].id)
    
    # Mark as entered
    await mark_entry_entered(db_session, entry.id)
    
    # Verify no longer in queue
    next_player = await get_next_waiting_player(db_session, sample_table.id)
    assert next_player is None


@pytest.mark.asyncio
async def test_get_user_waitlist_position(db_session, sample_table, sample_users):
    """Validate getting user's position in waitlist."""
    from telegram_poker_bot.shared.services.waitlist import (
        add_to_waitlist, get_user_waitlist_position
    )
    
    # Add users to waitlist
    for user in sample_users[:3]:
        await add_to_waitlist(db_session, sample_table.id, user.id)
    
    # Check positions
    pos1 = await get_user_waitlist_position(db_session, sample_table.id, sample_users[0].id)
    pos2 = await get_user_waitlist_position(db_session, sample_table.id, sample_users[1].id)
    pos3 = await get_user_waitlist_position(db_session, sample_table.id, sample_users[2].id)
    
    assert pos1 == 1
    assert pos2 == 2
    assert pos3 == 3


@pytest.mark.asyncio
async def test_get_waitlist_count(db_session, sample_table, sample_users):
    """Validate getting total count of waitlist entries."""
    from telegram_poker_bot.shared.services.waitlist import add_to_waitlist, get_waitlist_count
    
    # Add users to waitlist
    for user in sample_users[:3]:
        await add_to_waitlist(db_session, sample_table.id, user.id)
    
    # Check count
    count = await get_waitlist_count(db_session, sample_table.id)
    assert count == 3


@pytest.mark.asyncio
async def test_waitlist_for_nonexistent_table(db_session, sample_users):
    """Validate waitlist operations handle nonexistent tables gracefully."""
    from telegram_poker_bot.shared.services.waitlist import get_waitlist
    
    # Try to get waitlist for table that doesn't exist
    waitlist = await get_waitlist(db_session, table_id=99999)
    assert waitlist == []


@pytest.mark.asyncio
async def test_cancel_old_waitlist_entries(db_session, sample_table, sample_users):
    """Validate old waitlist entries can be cancelled."""
    from telegram_poker_bot.shared.models import WaitlistEntry
    from telegram_poker_bot.shared.services.waitlist import cancel_old_entries
    
    # Create old entry
    old_entry = WaitlistEntry(
        table_id=sample_table.id,
        user_id=sample_users[0].id,
        entered=False,
        joined_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    db_session.add(old_entry)
    
    # Create recent entry
    recent_entry = WaitlistEntry(
        table_id=sample_table.id,
        user_id=sample_users[1].id,
        entered=False,
        joined_at=datetime.now(timezone.utc)
    )
    db_session.add(recent_entry)
    await db_session.commit()
    
    # Cancel old entries (older than 1 hour)
    cancelled = await cancel_old_entries(db_session, sample_table.id, hours=1)
    
    assert cancelled > 0
