"""Table management service for creating and managing poker tables."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    User,
    Table,
    Seat,
    Group,
    GameMode,
    TableStatus,
    GroupGameInvite,
)
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


async def create_private_table(
    db: AsyncSession,
    creator_user_id: int,
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 10000,
    max_players: int = 8,
    table_name: Optional[str] = None,
) -> Table:
    """
    Create a new private table for "play with friends".
    
    Args:
        db: Database session
        creator_user_id: User ID of table creator
        small_blind: Small blind amount
        big_blind: Big blind amount
        starting_stack: Starting chip stack
        max_players: Maximum players allowed
        table_name: Optional friendly table name
    
    Returns:
        Created Table instance
    """
    table = Table(
        mode=GameMode.ANONYMOUS,  # Private tables use anonymous mode
        status=TableStatus.WAITING,
        config_json={
            "small_blind": small_blind,
            "big_blind": big_blind,
            "starting_stack": starting_stack,
            "max_players": max_players,
            "table_name": table_name or f"Table #{datetime.now().strftime('%H%M%S')}",
            "creator_user_id": creator_user_id,
            "is_private": True,
        },
    )
    db.add(table)
    await db.flush()
    
    logger.info(
        "Private table created",
        table_id=table.id,
        creator_user_id=creator_user_id,
        max_players=max_players,
    )
    
    return table


async def create_group_table(
    db: AsyncSession,
    creator_user_id: int,
    group_id: int,
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 10000,
    max_players: int = 8,
) -> Table:
    """
    Create a table linked to a Telegram group.
    
    Args:
        db: Database session
        creator_user_id: User ID of table creator
        group_id: Database ID of the Group
        small_blind: Small blind amount
        big_blind: Big blind amount
        starting_stack: Starting chip stack
        max_players: Maximum players allowed
    
    Returns:
        Created Table instance
    """
    table = Table(
        mode=GameMode.GROUP,
        group_id=group_id,
        status=TableStatus.WAITING,
        config_json={
            "small_blind": small_blind,
            "big_blind": big_blind,
            "starting_stack": starting_stack,
            "max_players": max_players,
            "creator_user_id": creator_user_id,
        },
    )
    db.add(table)
    await db.flush()
    
    logger.info(
        "Group table created",
        table_id=table.id,
        group_id=group_id,
        creator_user_id=creator_user_id,
    )
    
    return table


async def seat_user_at_table(
    db: AsyncSession,
    table_id: int,
    user_id: int,
) -> Seat:
    """
    Seat a user at a table.
    
    Args:
        db: Database session
        table_id: Table to join
        user_id: User to seat
    
    Returns:
        Created Seat instance
        
    Raises:
        ValueError: If table is full or user already seated
    """
    # Check if table exists and get config
    result = await db.execute(
        select(Table).where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    if not table:
        raise ValueError(f"Table {table_id} not found")
    
    config = table.config_json or {}
    max_players = config.get("max_players", 8)
    
    # Check if user already seated
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table_id,
            Seat.user_id == user_id,
            Seat.left_at.is_(None)
        )
    )
    existing_seat = result.scalar_one_or_none()
    if existing_seat:
        raise ValueError(f"User {user_id} already seated at table {table_id}")
    
    # Count current players
    result = await db.execute(
        select(func.count(Seat.id)).where(
            Seat.table_id == table_id,
            Seat.left_at.is_(None)
        )
    )
    current_players = result.scalar() or 0
    
    if current_players >= max_players:
        raise ValueError(f"Table {table_id} is full ({current_players}/{max_players})")
    
    # Find next available position
    result = await db.execute(
        select(Seat.position).where(
            Seat.table_id == table_id,
            Seat.left_at.is_(None)
        )
    )
    occupied_positions = set(pos for pos, in result.all())
    
    position = 0
    while position < max_players:
        if position not in occupied_positions:
            break
        position += 1
    
    # Get starting stack from table config
    starting_stack = config.get("starting_stack", 10000)
    
    # Create seat
    seat = Seat(
        table_id=table_id,
        user_id=user_id,
        position=position,
        chips=starting_stack,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(seat)
    await db.flush()
    
    logger.info(
        "User seated at table",
        table_id=table_id,
        user_id=user_id,
        position=position,
        chips=starting_stack,
    )
    
    return seat


async def get_table_info(db: AsyncSession, table_id: int) -> Dict[str, Any]:
    """
    Get comprehensive table information.
    
    Returns dict with table details, player count, and configuration.
    """
    result = await db.execute(
        select(Table).where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise ValueError(f"Table {table_id} not found")
    
    # Count seated players
    result = await db.execute(
        select(func.count(Seat.id)).where(
            Seat.table_id == table_id,
            Seat.left_at.is_(None)
        )
    )
    player_count = result.scalar() or 0
    
    config = table.config_json or {}
    
    # Get group info if it's a group table
    group_title = None
    if table.group_id:
        result = await db.execute(
            select(Group).where(Group.id == table.group_id)
        )
        group = result.scalar_one_or_none()
        if group:
            group_title = group.title
    
    return {
        "table_id": table.id,
        "mode": table.mode.value,
        "status": table.status.value,
        "player_count": player_count,
        "max_players": config.get("max_players", 8),
        "small_blind": config.get("small_blind", 25),
        "big_blind": config.get("big_blind", 50),
        "starting_stack": config.get("starting_stack", 10000),
        "table_name": config.get("table_name"),
        "is_private": config.get("is_private", False),
        "group_id": table.group_id,
        "group_title": group_title,
        "created_at": table.created_at.isoformat() if table.created_at else None,
    }


async def list_available_tables(
    db: AsyncSession,
    limit: int = 20,
    mode: Optional[GameMode] = None,
) -> List[Dict[str, Any]]:
    """
    List available tables that players can join.
    
    Returns public/group tables that are waiting for players or active.
    """
    query = select(Table).where(
        Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE])
    )
    
    if mode:
        query = query.where(Table.mode == mode)
    
    query = query.order_by(Table.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    tables = result.scalars().all()
    
    tables_data = []
    for table in tables:
        # Skip private tables unless explicitly requested
        config = table.config_json or {}
        if config.get("is_private"):
            continue
        
        # Count players
        result = await db.execute(
            select(func.count(Seat.id)).where(
                Seat.table_id == table.id,
                Seat.left_at.is_(None)
            )
        )
        player_count = result.scalar() or 0
        
        tables_data.append({
            "table_id": table.id,
            "mode": table.mode.value,
            "status": table.status.value,
            "player_count": player_count,
            "max_players": config.get("max_players", 8),
            "small_blind": config.get("small_blind", 25),
            "big_blind": config.get("big_blind", 50),
            "table_name": config.get("table_name", f"Table #{table.id}"),
        })
    
    return tables_data
