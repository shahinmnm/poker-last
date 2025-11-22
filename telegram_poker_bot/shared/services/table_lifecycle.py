"""Centralized table lifecycle management service.

This module provides a single canonical path for table lifecycle decisions:
- Pre-start TTL (10 minutes to gather players and start)
- Post-start inactivity detection
- Per-turn timeout enforcement
- Self-destruct conditions
- History visibility rules

CRITICAL: This is the ONLY place where lifecycle logic should be implemented.
Do NOT create parallel lifecycle mechanisms elsewhere.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import Table, TableStatus, Seat

if TYPE_CHECKING:  # pragma: no cover
    pass

logger = get_logger(__name__)


async def should_table_be_listed_publicly(table: Table) -> bool:
    """
    Determine if a table should appear in public listings.

    Excludes:
    - Expired tables
    - Ended tables
    - Deleted tables
    - Pre-start tables past their expires_at time

    Args:
        table: Table instance to check

    Returns:
        True if table should be publicly visible, False otherwise
    """
    # Exclude based on status
    if table.status in {TableStatus.EXPIRED, TableStatus.ENDED}:
        return False

    # Check pre-start expiry
    if table.status == TableStatus.WAITING and table.expires_at:
        now = datetime.now(timezone.utc)
        if table.expires_at <= now:
            return False

    return True


async def compute_prestart_expiry(
    db: AsyncSession, table: Table
) -> Tuple[bool, Optional[str]]:
    """
    Check if a pre-start table should be expired.

    Rule A: Pre-start join TTL
    - PUBLIC tables: 10 minutes to start
    - PRIVATE tables: 60 minutes to start
    - If game hasn't started by the limit, mark EXPIRED

    Args:
        db: Database session
        table: Table to check

    Returns:
        (should_expire, reason) tuple
    """
    from telegram_poker_bot.shared.config import get_settings
    
    # Only applies to WAITING tables
    if table.status != TableStatus.WAITING:
        return False, None

    # Check if expires_at is set and in the past
    if table.expires_at:
        now = datetime.now(timezone.utc)
        if table.expires_at <= now:
            settings = get_settings()
            # Determine table type for reason message
            ttl_minutes = (
                settings.public_table_prestart_ttl_minutes
                if table.is_public
                else settings.private_table_prestart_ttl_minutes
            )
            table_type = "public" if table.is_public else "private"
            return True, f"pre-game timeout ({ttl_minutes} minute join window expired for {table_type} table)"

    return False, None


async def compute_poststart_inactivity(
    db: AsyncSession, table: Table
) -> Tuple[bool, Optional[str]]:
    """
    Check if an active table should be expired due to inactivity.

    Rule D: Self-destruct on dead tables
    - Not enough active players to continue (< 2 active players)
    - All remaining players are folded/sit-out/inactive

    Args:
        db: Database session
        table: Table to check

    Returns:
        (should_expire, reason) tuple
    """
    # Only applies to ACTIVE tables
    if table.status != TableStatus.ACTIVE:
        return False, None

    # Get active seats (not left)
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    active_seats = result.scalars().all()

    if not active_seats:
        return True, "no active players remaining"

    # Count players who are NOT sitting out
    playing_seats = [s for s in active_seats if not s.is_sitting_out_next_hand]

    if len(playing_seats) < 2:
        return True, f"insufficient active players (need 2, have {len(playing_seats)})"

    # Additional check: If ALL players are sitting out (should be caught above but being explicit)
    if len(playing_seats) == 0:
        return True, "all players sitting out"

    return False, None


async def mark_table_expired(db: AsyncSession, table: Table, reason: str) -> None:
    """
    Mark a table as EXPIRED and log the reason.

    Args:
        db: Database session
        table: Table to expire
        reason: Human-readable reason for expiration
    """
    table.status = TableStatus.EXPIRED
    table.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Table marked as EXPIRED",
        table_id=table.id,
        reason=reason,
        previous_status=(
            table.status.value if hasattr(table.status, "value") else str(table.status)
        ),
    )


async def mark_table_completed_and_cleanup(
    db: AsyncSession, table: Table, reason: str
) -> None:
    """
    Mark a table as ENDED (completed) and perform cleanup.

    This implements self-destruct:
    - Mark all active seats as left
    - Set table status to ENDED
    - Table will no longer appear in public lists
    - Will only be visible in history

    Args:
        db: Database session
        table: Table to complete
        reason: Human-readable reason for completion
    """
    now = datetime.now(timezone.utc)

    # Mark all active seats as left
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    active_seats = result.scalars().all()

    for seat in active_seats:
        seat.left_at = now
        logger.debug(
            "Auto-leaving seat on table completion",
            table_id=table.id,
            user_id=seat.user_id,
            seat_id=seat.id,
        )

    # Mark table as ENDED
    table.status = TableStatus.ENDED
    table.updated_at = now
    await db.flush()

    logger.info(
        "Table marked as ENDED (self-destruct)",
        table_id=table.id,
        reason=reason,
    )


async def check_player_balance_requirements(
    seat: Seat, small_blind: int, big_blind: int, ante: int = 0
) -> Tuple[bool, int]:
    """
    Check if a player has sufficient balance to play the next hand.

    A player needs at least (small_blind + big_blind + ante) to participate.

    Args:
        seat: Player's seat
        small_blind: Small blind amount
        big_blind: Big blind amount
        ante: Ante amount (default 0)

    Returns:
        (has_sufficient_balance, required_amount) tuple
    """
    required_amount = small_blind + big_blind + ante
    has_sufficient = seat.chips >= required_amount
    return has_sufficient, required_amount


async def check_and_enforce_lifecycle(
    db: AsyncSession, table: Table
) -> Tuple[bool, Optional[str]]:
    """
    Check table lifecycle and enforce rules.

    This is the canonical lifecycle check method.
    Call this before any table operation to ensure table is still valid.

    Returns:
        (was_expired, reason) tuple
    """
    # Check pre-start expiry
    should_expire, reason = await compute_prestart_expiry(db, table)
    if should_expire:
        await mark_table_expired(db, table, reason)
        return True, reason

    # Check post-start inactivity (only for self-destruct, not time-based)
    should_complete, reason = await compute_poststart_inactivity(db, table)
    if should_complete:
        await mark_table_completed_and_cleanup(db, table, reason)
        return True, reason

    return False, None
