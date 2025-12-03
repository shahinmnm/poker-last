"""Waitlist management service for global table queuing system.

This service provides the core operations for managing player waitlists:
- Join waitlist when table is full
- Leave waitlist voluntarily
- Get next waiting player for auto-seat assignment
- Cancel expired or invalid entries
- Query waitlist position and status
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from telegram_poker_bot.shared.models import (
    WaitlistEntry,
    WaitlistStatus,
    Table,
    User,
    Seat,
)
from telegram_poker_bot.shared.logging import get_logger

if TYPE_CHECKING:  # pragma: no cover
    pass

logger = get_logger(__name__)


async def join_waitlist(
    db: AsyncSession, table_id: int, user_id: int
) -> WaitlistEntry:
    """
    Add a user to the waitlist for a table.

    Args:
        db: Database session
        table_id: ID of the table
        user_id: ID of the user joining the waitlist

    Returns:
        The created WaitlistEntry

    Raises:
        ValueError: If user is already seated or already on the waitlist
    """
    # Check if user is already seated at this table
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table_id,
            Seat.user_id == user_id,
            Seat.left_at.is_(None),
        )
    )
    existing_seat = result.scalar_one_or_none()
    if existing_seat:
        raise ValueError("User is already seated at this table")

    # Check if user is already on the waitlist
    result = await db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.table_id == table_id,
            WaitlistEntry.user_id == user_id,
            WaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    existing_entry = result.scalar_one_or_none()
    if existing_entry:
        raise ValueError("User is already on the waitlist for this table")

    # Create new waitlist entry
    entry = WaitlistEntry(
        table_id=table_id,
        user_id=user_id,
        status=WaitlistStatus.WAITING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()

    logger.info(
        "User joined waitlist",
        table_id=table_id,
        user_id=user_id,
        entry_id=entry.id,
    )

    return entry


async def leave_waitlist(
    db: AsyncSession, table_id: int, user_id: int
) -> Optional[WaitlistEntry]:
    """
    Remove a user from the waitlist for a table.

    Args:
        db: Database session
        table_id: ID of the table
        user_id: ID of the user leaving the waitlist

    Returns:
        The cancelled WaitlistEntry, or None if not found

    Raises:
        ValueError: If user is not on the waitlist
    """
    # Find the waiting entry
    result = await db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.table_id == table_id,
            WaitlistEntry.user_id == user_id,
            WaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise ValueError("User is not on the waitlist for this table")

    # Mark as cancelled
    entry.status = WaitlistStatus.CANCELLED
    await db.flush()

    logger.info(
        "User left waitlist",
        table_id=table_id,
        user_id=user_id,
        entry_id=entry.id,
    )

    return entry


async def get_next_waiting_player(
    db: AsyncSession, table_id: int
) -> Optional[WaitlistEntry]:
    """
    Get the next player in line from the waitlist.

    Returns the oldest WAITING entry for the specified table.

    Args:
        db: Database session
        table_id: ID of the table

    Returns:
        The next WaitlistEntry, or None if waitlist is empty
    """
    result = await db.execute(
        select(WaitlistEntry)
        .where(
            WaitlistEntry.table_id == table_id,
            WaitlistEntry.status == WaitlistStatus.WAITING,
        )
        .order_by(WaitlistEntry.created_at.asc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()

    if entry:
        logger.debug(
            "Next waiting player retrieved",
            table_id=table_id,
            user_id=entry.user_id,
            entry_id=entry.id,
        )

    return entry


async def mark_entry_entered(db: AsyncSession, entry_id: int) -> None:
    """
    Mark a waitlist entry as entered (user has been seated).

    Args:
        db: Database session
        entry_id: ID of the waitlist entry
    """
    result = await db.execute(
        select(WaitlistEntry).where(WaitlistEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()

    if entry:
        entry.status = WaitlistStatus.ENTERED
        await db.flush()

        logger.info(
            "Waitlist entry marked as entered",
            entry_id=entry_id,
            table_id=entry.table_id,
            user_id=entry.user_id,
        )


async def get_waitlist(
    db: AsyncSession, table_id: int, status: Optional[WaitlistStatus] = None
) -> List[WaitlistEntry]:
    """
    Get all waitlist entries for a table.

    Args:
        db: Database session
        table_id: ID of the table
        status: Optional status filter (defaults to WAITING only)

    Returns:
        List of WaitlistEntry objects, ordered by created_at
    """
    query = select(WaitlistEntry).where(WaitlistEntry.table_id == table_id)

    if status is not None:
        query = query.where(WaitlistEntry.status == status)
    else:
        # Default to only waiting entries
        query = query.where(WaitlistEntry.status == WaitlistStatus.WAITING)

    query = query.order_by(WaitlistEntry.created_at.asc())

    result = await db.execute(query)
    entries = result.scalars().all()

    return list(entries)


async def get_user_waitlist_position(
    db: AsyncSession, table_id: int, user_id: int
) -> Optional[int]:
    """
    Get a user's position in the waitlist (1-indexed).

    Args:
        db: Database session
        table_id: ID of the table
        user_id: ID of the user

    Returns:
        Position (1-indexed), or None if not on waitlist
    """
    # Get all waiting entries ordered by created_at
    entries = await get_waitlist(db, table_id, status=WaitlistStatus.WAITING)

    for position, entry in enumerate(entries, start=1):
        if entry.user_id == user_id:
            return position

    return None


async def cancel_old_entries(
    db: AsyncSession, table_id: int, max_age_hours: int = 24
) -> int:
    """
    Cancel waitlist entries older than a specified age.

    Args:
        db: Database session
        table_id: ID of the table
        max_age_hours: Maximum age in hours before cancellation

    Returns:
        Number of entries cancelled
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)

    result = await db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.table_id == table_id,
            WaitlistEntry.status == WaitlistStatus.WAITING,
            WaitlistEntry.created_at < cutoff_time,
        )
    )
    old_entries = result.scalars().all()

    count = 0
    for entry in old_entries:
        entry.status = WaitlistStatus.CANCELLED
        count += 1

    if count > 0:
        await db.flush()
        logger.info(
            "Cancelled old waitlist entries",
            table_id=table_id,
            count=count,
            max_age_hours=max_age_hours,
        )

    return count


async def get_waitlist_count(db: AsyncSession, table_id: int) -> int:
    """
    Get the count of waiting players for a table.

    Args:
        db: Database session
        table_id: ID of the table

    Returns:
        Number of players waiting
    """
    result = await db.execute(
        select(func.count(WaitlistEntry.id)).where(
            WaitlistEntry.table_id == table_id,
            WaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    count = result.scalar() or 0
    return count
