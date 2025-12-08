"""SNG (Sit-n-Go) tournament management service.

This module handles:
- SNG state machine transitions
- Join window management
- Auto-start logic based on template config
- SNG lifecycle events
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    SNGState,
    Seat,
)
from telegram_poker_bot.shared.logging import get_logger

if TYPE_CHECKING:  # pragma: no cover
    pass

logger = get_logger(__name__)


def is_sng_enabled(config: Dict[str, Any]) -> bool:
    """Check if SNG mode is enabled in template config."""
    return config.get("sng_enabled", False) is True


def get_sng_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract SNG configuration from template config with defaults."""
    return {
        "enabled": config.get("sng_enabled", False),
        "min_players": int(config.get("sng_min_players", 2)),
        "max_players": int(config.get("max_players", 8)),
        "auto_start": config.get("sng_auto_start", True),
        "join_window_seconds": int(config.get("sng_join_window_seconds", 120)),
        "force_start_on_full": config.get("sng_force_start_on_full", True),
        "unregister_allowed": config.get("sng_unregister_allowed", True),
    }


async def start_join_window(db: AsyncSession, table: Table) -> None:
    """Start SNG join window if applicable."""
    if not table.template:
        return
    config = table.template.config_json.get("backend", table.template.config_json or {})
    
    if is_sng_enabled(config) and table.sng_state == SNGState.WAITING:
        table.sng_state = SNGState.JOIN_WINDOW
        table.sng_join_window_started_at = datetime.now(timezone.utc)
        await db.flush()
        logger.info("SNG join window started", table_id=table.id)


async def check_auto_start_conditions(
    db: AsyncSession,
    table: Table,
) -> tuple[bool, Optional[str]]:
    """Check if table meets conditions for auto-start.
    
    Args:
        db: Database session
        table: Table instance to check
        
    Returns:
        Tuple of (should_start: bool, reason: Optional[str])
        - should_start: True if table should auto-start now
        - reason: String describing why table should start (e.g., "cash_game_min_players_met")
    """
    if not table.template:
        return False, None

    # Count active seats (joined and not sitting out)
    result = await db.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    seats = result.scalars().all()
    active_count = len(seats)

    # === LOGIC 1: PERSISTENT / CASH GAMES (Instant Start) ===
    # If the table is persistent (Lobby) or explicitly marked as PERSISTENT/CASH_GAME
    is_persistent = (
        table.lobby_persistent 
        or table.template.table_type == TableTemplateType.PERSISTENT
        or table.template.table_type == TableTemplateType.CASH_GAME
    )

    if is_persistent:
        # Standard Cash Game Logic: 2 players = Game On
        if active_count >= 2:
            return True, "persistent_min_players_met"
        return False, None
    # ========================================================

    # === LOGIC 2: SNG TOURNAMENTS (Join Windows) ===
    config_json = table.template.config_json or {}
    config = config_json.get("backend", config_json)
    sng_config = get_sng_config(config)

    if not sng_config["enabled"] or not sng_config["auto_start"]:
        return False, None

    # Force start if full
    if active_count >= sng_config["max_players"]:
        if sng_config["force_start_on_full"]:
            return True, "table_full"

    # Start if min players met + logic satisfied
    if active_count >= sng_config["min_players"]:
        if table.sng_state == SNGState.JOIN_WINDOW:
            if table.sng_join_window_started_at:
                now = datetime.now(timezone.utc)
                elapsed = (now - table.sng_join_window_started_at).total_seconds()
                if elapsed >= sng_config["join_window_seconds"]:
                    return True, "join_window_expired"
        
        # Move to READY if not already
        if table.sng_state != SNGState.READY:
            table.sng_state = SNGState.READY
            await db.flush()

    return False, None


async def force_start_sng(
    db: AsyncSession,
    table_id: int,
) -> Table:
    """Force-start an SNG table (admin/creator action).
    
    Args:
        db: Database session
        table_id: Table ID
        
    Returns:
        Updated table
        
    Raises:
        ValueError: If table cannot be force-started
    """
    table = await db.get(Table, table_id)
    if not table:
        raise ValueError(f"Table {table_id} not found")
    
    if table.status != TableStatus.WAITING:
        raise ValueError("Can only force-start tables in WAITING status")
    
    if not table.template:
        raise ValueError("Table is not an SNG table")
    base_config = table.template.config_json or {}
    backend_config = base_config.get("backend", base_config)
    if not is_sng_enabled(backend_config):
        raise ValueError("Table is not an SNG table")
    
    # Check minimum players
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    seats = result.scalars().all()
    
    config = backend_config
    sng_config = get_sng_config(config)
    
    if len(seats) < sng_config["min_players"]:
        raise ValueError(
            f"Need at least {sng_config['min_players']} players to start "
            f"(currently {len(seats)})"
        )
    
    table.sng_state = SNGState.ACTIVE
    table.status = TableStatus.ACTIVE
    await db.flush()
    
    logger.info(
        "SNG force-started",
        table_id=table.id,
        player_count=len(seats),
    )
    
    return table


async def on_player_seated(db: AsyncSession, table: Table) -> None:
    """Handle SNG logic when a player is seated."""
    result = await db.execute(select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None)))
    seats = result.scalars().all()
    if len(seats) == 1:
        await start_join_window(db, table)
