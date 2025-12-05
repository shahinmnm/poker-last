"""Global waitlist service for intelligent cross-table player routing.

This service manages a global player queue and routes players to optimal tables
based on multiple scoring factors.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, TYPE_CHECKING

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from telegram_poker_bot.shared.models import (
    GlobalWaitlistEntry,
    WaitlistStatus,
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    Seat,
    User,
    GameVariant,
    SNGState,
)
from telegram_poker_bot.shared.logging import get_logger

if TYPE_CHECKING:  # pragma: no cover
    pass

logger = get_logger(__name__)


async def join_global_waitlist(
    db: AsyncSession,
    user_id: int,
    game_variant: Optional[str] = None,
) -> GlobalWaitlistEntry:
    """Add user to global waitlist.
    
    Args:
        db: Database session
        user_id: User ID
        game_variant: Optional game variant filter (NULL = any variant)
        
    Returns:
        Created entry
        
    Raises:
        ValueError: If user is already in global waitlist
    """
    # Check if user already in global waitlist
    result = await db.execute(
        select(GlobalWaitlistEntry).where(
            GlobalWaitlistEntry.user_id == user_id,
            GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("User is already in the global waitlist")
    
    entry = GlobalWaitlistEntry(
        user_id=user_id,
        game_variant=game_variant,
        status=WaitlistStatus.WAITING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()
    
    logger.info(
        "User joined global waitlist",
        user_id=user_id,
        game_variant=game_variant,
        entry_id=entry.id,
    )
    
    return entry


async def leave_global_waitlist(
    db: AsyncSession,
    user_id: int,
) -> Optional[GlobalWaitlistEntry]:
    """Remove user from global waitlist.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        Cancelled entry or None if not found
    """
    result = await db.execute(
        select(GlobalWaitlistEntry).where(
            GlobalWaitlistEntry.user_id == user_id,
            GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None
    
    entry.status = WaitlistStatus.CANCELLED
    await db.flush()
    
    logger.info("User left global waitlist", user_id=user_id, entry_id=entry.id)
    
    return entry


async def get_next_waiting_player(
    db: AsyncSession,
    table: Table,
) -> Optional[int]:
    """Get next player from global waitlist for a table.
    
    Uses scoring algorithm to find best match:
    1. Variant match (if specified)
    2. Earliest join time
    
    Args:
        db: Database session
        table: Table instance
        
    Returns:
        User ID or None if no suitable player
    """
    if not table.template:
        return None
    
    config_json = table.template.config_json or {}
    config = config_json.get("backend", config_json)
    table_variant = config.get("game_variant")
    
    # Build query for waiting players
    query = select(GlobalWaitlistEntry).where(
        GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
    )
    
    # Filter by variant if specified
    if table_variant:
        query = query.where(
            or_(
                GlobalWaitlistEntry.game_variant == table_variant,
                GlobalWaitlistEntry.game_variant.is_(None),  # Accepts any variant
            )
        )
    
    # Order by creation time (FIFO within variant match)
    query = query.order_by(GlobalWaitlistEntry.created_at)
    
    result = await db.execute(query)
    entry = result.scalar_one_or_none()
    
    if entry:
        logger.info(
            "Found player in global waitlist",
            user_id=entry.user_id,
            table_id=table.id,
            entry_id=entry.id,
        )
        return entry.user_id
    
    return None


async def route_player_to_table(
    db: AsyncSession,
    entry_id: int,
    table_id: int,
) -> None:
    """Mark global waitlist entry as routed to a specific table.
    
    Args:
        db: Database session
        entry_id: GlobalWaitlistEntry ID
        table_id: Target table ID
    """
    entry = await db.get(GlobalWaitlistEntry, entry_id)
    if not entry:
        raise ValueError(f"GlobalWaitlistEntry {entry_id} not found")
    
    entry.status = WaitlistStatus.ENTERED
    entry.routed_table_id = table_id
    await db.flush()
    
    logger.info(
        "Player routed from global waitlist",
        user_id=entry.user_id,
        entry_id=entry_id,
        table_id=table_id,
    )


async def find_best_table_for_player(
    db: AsyncSession,
    user_id: int,
    game_variant: Optional[str] = None,
) -> Optional[Table]:
    """Find the best table for a player using scoring algorithm.
    
    Scoring priority:
    1. Persistent SNG tables in JOIN_WINDOW state (highest priority)
    2. Partially filled tables (50-75% capacity)
    3. Tables with active players
    4. Variant match
    
    Args:
        db: Database session
        user_id: User ID
        game_variant: Optional variant preference
        
    Returns:
        Best table or None if no suitable table
    """
    # Find tables that have open seats
    query = (
        select(Table)
        .options(joinedload(Table.template))
        .where(
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE]),
        )
    )
    
    result = await db.execute(query)
    tables = result.scalars().all()
    
    scored_tables = []
    
    for table in tables:
        if not table.template:
            continue
        
        config_json = table.template.config_json or {}
        config = config_json.get("backend", config_json)
        max_players = config.get("max_players", 8)
        table_variant = config.get("game_variant")
        
        # Count current seats
        seat_result = await db.execute(
            select(func.count(Seat.id)).where(
                Seat.table_id == table.id,
                Seat.left_at.is_(None),
            )
        )
        seat_count = seat_result.scalar() or 0
        
        # Skip full tables
        if seat_count >= max_players:
            continue
        
        score = 0
        
        # Priority 1: Persistent SNG in JOIN_WINDOW
        if (
            table.template.table_type == TableTemplateType.PERSISTENT
            and table.sng_state == SNGState.JOIN_WINDOW
        ):
            score += 1000
        
        # Priority 2: Partially filled (50-75% capacity)
        fill_ratio = seat_count / max_players
        if 0.5 <= fill_ratio <= 0.75:
            score += 500
        
        # Priority 3: Has active players
        if seat_count > 0:
            score += 100
        
        # Priority 4: Variant match
        if game_variant and table_variant == game_variant:
            score += 50
        
        # Penalty: Nearly dead tables (1 player)
        # Rationale: Single-player tables are at risk of becoming abandoned.
        # The -200 penalty is chosen to override the +100 "has active players"
        # bonus but still allow routing if it's the only option available.
        # This encourages routing to more stable tables first.
        # TODO: Make this penalty configurable via system settings if needed.
        if seat_count == 1:
            score -= 200
        
        scored_tables.append((score, table))
    
    if not scored_tables:
        return None
    
    # Sort by score descending and return best
    scored_tables.sort(key=lambda x: x[0], reverse=True)
    best_table = scored_tables[0][1]
    
    logger.info(
        "Best table found for player",
        user_id=user_id,
        table_id=best_table.id,
        score=scored_tables[0][0],
    )
    
    return best_table


async def get_global_waitlist_stats(
    db: AsyncSession,
) -> Dict[str, Any]:
    """Get statistics about global waitlist.
    
    Returns:
        Dict with total_waiting and by_variant counts
    """
    result = await db.execute(
        select(GlobalWaitlistEntry).where(
            GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    entries = result.scalars().all()
    
    total = len(entries)
    by_variant: Dict[str, int] = {}
    
    for entry in entries:
        variant = entry.game_variant or "any"
        by_variant[variant] = by_variant.get(variant, 0) + 1
    
    return {
        "total_waiting": total,
        "by_variant": by_variant,
    }
