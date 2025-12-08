"""Centralized table lifecycle management service.

This module provides a single canonical path for table lifecycle decisions:
- Pre-start TTL (10 minutes to gather players and start)
- Post-start inactivity detection
- Per-turn timeout enforcement
- Self-destruct conditions
- History visibility rules
- Persistent table immunity

CRITICAL: This is the ONLY place where lifecycle logic should be implemented.
Do NOT create parallel lifecycle mechanisms elsewhere.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Awaitable, Callable, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    Table,
    TableStatus,
    Seat,
    TableTemplateType,
)

if TYPE_CHECKING:  # pragma: no cover
    pass

logger = get_logger(__name__)


_table_status_listeners: List[
    Callable[[int, TableStatus, str], Awaitable[None]]
] = []


def register_table_status_listener(
    listener: Callable[[int, TableStatus, str], Awaitable[None]]
) -> None:
    """Register a callback that is invoked when a table status changes."""

    _table_status_listeners.append(listener)


async def _emit_table_status_event(
    table: Table, status: TableStatus, reason: str
) -> None:
    """Notify all registered listeners of a table lifecycle change."""

    for listener in list(_table_status_listeners):
        try:
            await listener(table.id, status, reason)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning(
                "Table status listener failed",
                table_id=table.id,
                status=getattr(status, "value", str(status)),
                error=str(exc),
            )


async def is_persistent_table(table: Table) -> bool:
    """Check if a table is persistent and should be immune from auto-cleanup.
    
    A table is considered persistent if:
    1. It has lobby_persistent flag set to True, OR
    2. It is auto-generated (is_auto_generated flag), OR
    3. Its template type is PERSISTENT or CASH_GAME
    
    Persistent tables should never be deleted, only paused (returned to WAITING state).
    
    Args:
        table: Table instance
        
    Returns:
        True if table is persistent, False otherwise
    """
    return (
        table.lobby_persistent
        or table.is_auto_generated
        or (
            table.template
            and table.template.table_type
            in [TableTemplateType.PERSISTENT, TableTemplateType.CASH_GAME]
        )
    )


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
    
    PERSISTENT tables are immune from expiry.

    Rule 1 & 7: Pre-start join TTL
    - PUBLIC tables (no invite_code): 10 minutes to start
    - PRIVATE tables (with invite_code): 60 minutes to start
    - If game hasn't started by the limit, mark EXPIRED
    - Once the game starts (ACTIVE), this timer is disabled

    Args:
        db: Database session
        table: Table to check

    Returns:
        (should_expire, reason) tuple
    """
    # PERSISTENT tables never expire
    if await is_persistent_table(table):
        return False, None
    
    # Only applies to WAITING tables
    if table.status != TableStatus.WAITING:
        return False, None

    # If no active seats remain, expire immediately to avoid ghost lobby entries
    result = await db.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    active_seats = list(result.scalars())
    if not active_seats:
        return True, "no players remaining at table"

    # Check if expires_at is set and in the past
    if table.expires_at:
        now = datetime.now(timezone.utc)
        if table.expires_at <= now:
            expiration_minutes = None
            template = getattr(table, "template", None)
            if template and template.config_json:
                config_json = template.config_json
                config = config_json.get("backend", config_json)
                expiration_minutes = config.get("expiration_minutes")
            return (
                True,
                "pre-game timeout"
                if expiration_minutes is None
                else f"pre-game timeout ({expiration_minutes} minute join window expired)",
            )

    return False, None


async def compute_poststart_inactivity(
    db: AsyncSession, table: Table
) -> Tuple[bool, Optional[str]]:
    """
    Check if an active table should be expired due to inactivity.

    Rule 2: Zombie Cleanup
    - Players who timeout consecutively are marked as sitting out
    - If all players fold/timeout/sit-out, table is deleted

    Rule 5 & 6: Min Player Deletion
    - This check must occur after the inter-hand phase
    - Count only active players (those NOT sitting out for next hand)
    - If active_players < 2, mark table as expired immediately

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
    active_seats = list(result.scalars())

    if not active_seats:
        return True, "no active players remaining"

    # Rule 5 & 6: Count players who are NOT sitting out for next hand
    # This excludes zombies and players who chose to sit out
    playing_seats = [s for s in active_seats if not s.is_sitting_out_next_hand]

    # Rule 5 & 6: Check minimum player count (must have at least 2 active players)
    if len(playing_seats) < 2:
        return True, f"lack of minimum player ({len(playing_seats)}/2 required)"

    return False, None


async def mark_table_expired(db: AsyncSession, table: Table, reason: str) -> None:
    """
    Mark a table as EXPIRED and log the reason.

    Args:
        db: Database session
        table: Table to expire
        reason: Human-readable reason for expiration
    """
    previous_status = table.status
    table.status = TableStatus.EXPIRED
    table.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Table marked as EXPIRED",
        table_id=table.id,
        reason=reason,
        previous_status=(
            previous_status.value
            if hasattr(previous_status, "value")
            else str(previous_status)
        ),
    )

    await _emit_table_status_event(table, table.status, reason)


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
    active_seats = list(result.scalars())

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

    await _emit_table_status_event(table, table.status, reason)


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
    # Persistent tables never expire via lifecycle rules
    template_type = getattr(getattr(table, "template", None), "table_type", None)
    if template_type == TableTemplateType.PERSISTENT:
        return False, None

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
