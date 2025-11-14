"""Table management service for creating and managing poker tables."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    User,
    Table,
    Seat,
    Group,
    GameMode,
    TableStatus,
    GroupGameInvite,
    GroupGameInviteStatus,
)
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


def _is_table_private(config: Dict[str, Any]) -> bool:
    """Resolve whether a table configuration represents a private table."""

    raw_private = config.get("is_private")
    if isinstance(raw_private, bool):
        return raw_private

    if isinstance(raw_private, (int, float)):
        return bool(raw_private)

    if isinstance(raw_private, str):
        normalized = raw_private.strip().lower()
        if normalized in {"true", "1", "yes", "y", "private"}:
            return True
        if normalized in {"false", "0", "no", "n", "public"}:
            return False

    visibility = config.get("visibility")
    if isinstance(visibility, str):
        normalized_visibility = visibility.strip().lower()
        if normalized_visibility == "private":
            return True
        if normalized_visibility == "public":
            return False

    return bool(raw_private)


async def create_table_with_config(
    db: AsyncSession,
    *,
    creator_user_id: int,
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 10000,
    max_players: int = 8,
    table_name: Optional[str] = None,
    mode: GameMode = GameMode.ANONYMOUS,
    group_id: Optional[int] = None,
    is_private: bool = False,
    auto_seat_creator: bool = False,
) -> Table:
    """Create a table with explicit configuration options."""

    is_public = not is_private

    table = Table(
        mode=mode,
        group_id=group_id,
        status=TableStatus.WAITING,
        creator_user_id=creator_user_id,
        is_public=is_public,
        config_json={
            "small_blind": small_blind,
            "big_blind": big_blind,
            "starting_stack": starting_stack,
            "max_players": max_players,
            "table_name": table_name or f"Table #{datetime.now().strftime('%H%M%S')}",
            "creator_user_id": creator_user_id,
            "is_private": not is_public,
            "visibility": "public" if is_public else "private",
        },
    )
    db.add(table)
    await db.flush()

    logger.info(
        "Table created",
        table_id=table.id,
        creator_user_id=creator_user_id,
        max_players=max_players,
        is_private=not is_public,
        is_public=is_public,
        mode=mode.value,
    )

    if auto_seat_creator:
        try:
            await seat_user_at_table(db, table.id, creator_user_id)
        except ValueError as exc:  # pragma: no cover - defensive
            logger.warning(
                "Failed to auto-seat creator",
                table_id=table.id,
                creator_user_id=creator_user_id,
                error=str(exc),
            )

    return table


async def create_private_table(
    db: AsyncSession,
    creator_user_id: int,
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 10000,
    max_players: int = 8,
    table_name: Optional[str] = None,
) -> Table:
    """Create a private table (used for invite-based games)."""

    return await create_table_with_config(
        db,
        creator_user_id=creator_user_id,
        small_blind=small_blind,
        big_blind=big_blind,
        starting_stack=starting_stack,
        max_players=max_players,
        table_name=table_name,
        is_private=True,
        auto_seat_creator=False,
    )


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
    return await create_table_with_config(
        db,
        creator_user_id=creator_user_id,
        small_blind=small_blind,
        big_blind=big_blind,
        starting_stack=starting_stack,
        max_players=max_players,
        mode=GameMode.GROUP,
        group_id=group_id,
        is_private=False,
        auto_seat_creator=False,
    )


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


async def leave_table(
    db: AsyncSession,
    table_id: int,
    user_id: int,
) -> Seat:
    """Mark a user's seat as vacated for the given table."""

    result = await db.execute(
        select(Seat)
        .where(
            Seat.table_id == table_id,
            Seat.user_id == user_id,
            Seat.left_at.is_(None)
        )
    )
    seat = result.scalar_one_or_none()
    if not seat:
        raise ValueError(f"User {user_id} is not seated at table {table_id}")

    seat.left_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "User left table",
        table_id=table_id,
        user_id=user_id,
        seat_id=seat.id,
    )

    return seat


async def get_table_info(
    db: AsyncSession,
    table_id: int,
    *,
    viewer_user_id: Optional[int] = None,
) -> Dict[str, Any]:
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
    
    config = table.config_json or {}
    creator_user_id = table.creator_user_id or config.get("creator_user_id")
    is_public = table.is_public if table.is_public is not None else not _is_table_private(config)
    is_private = not is_public

    # Fetch host user if available
    host_user = None
    if creator_user_id:
        host_result = await db.execute(
            select(User).where(User.id == creator_user_id)
        )
        host_user = host_result.scalar_one_or_none()

    # Load seated players with user information
    seats_result = await db.execute(
        select(Seat, User)
        .join(User, Seat.user_id == User.id)
        .where(
            Seat.table_id == table_id,
            Seat.left_at.is_(None)
        )
        .order_by(Seat.position.asc())
    )

    players: List[Dict[str, Any]] = []
    viewer_is_seated = False
    viewer_position: Optional[int] = None
    for seat, user in seats_result.all():
        display_name = user.username or f"Player #{user.id}"
        players.append(
            {
                "user_id": user.id,
                "username": user.username,
                "display_name": display_name,
                "position": seat.position,
                "chips": seat.chips,
                "joined_at": seat.joined_at.isoformat() if seat.joined_at else None,
                "is_host": user.id == creator_user_id,
            }
        )

        if viewer_user_id is not None and user.id == viewer_user_id:
            viewer_is_seated = True
            viewer_position = seat.position

    player_count = len(players)
    
    # Get group info if it's a group table
    group_title = None
    if table.group_id:
        result = await db.execute(
            select(Group).where(Group.id == table.group_id)
        )
        group = result.scalar_one_or_none()
        if group:
            group_title = group.title
    
    # Determine invite metadata for the table
    invite_info = None
    if creator_user_id:
        invite_result = await db.execute(
            select(GroupGameInvite)
            .where(GroupGameInvite.creator_user_id == creator_user_id)
            .order_by(desc(GroupGameInvite.expires_at))
        )
        for invite in invite_result.scalars():
            if invite.status not in {GroupGameInviteStatus.PENDING, GroupGameInviteStatus.READY}:
                continue
            if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
                continue
            table_hint = invite.metadata_json.get("table_id") if invite.metadata_json else None
            if table_hint == table.id:
                invite_info = {
                    "game_id": invite.game_id,
                    "status": invite.status.value,
                    "expires_at": invite.expires_at.isoformat() if invite.expires_at else None,
                }
                break

    host_info = None
    if host_user:
        host_info = {
            "user_id": host_user.id,
            "username": host_user.username,
            "display_name": host_user.username or f"Player #{host_user.id}",
        }

    max_players = config.get("max_players", 8)
    viewer_is_creator = viewer_user_id is not None and viewer_user_id == creator_user_id

    permissions = {
        "can_start": (
            viewer_is_creator
            and table.status == TableStatus.WAITING
            and player_count >= 2
        ),
        "can_join": (
            (not viewer_is_seated)
            and player_count < max_players
            and (not is_private or viewer_is_creator)
        ),
        "can_leave": viewer_is_seated,
    }

    viewer_info = None
    if viewer_user_id is not None:
        viewer_info = {
            "user_id": viewer_user_id,
            "is_creator": viewer_is_creator,
            "is_seated": viewer_is_seated,
            "seat_position": viewer_position,
        }

    return {
        "table_id": table.id,
        "mode": table.mode.value,
        "status": table.status.value,
        "player_count": player_count,
        "max_players": max_players,
        "small_blind": config.get("small_blind", 25),
        "big_blind": config.get("big_blind", 50),
        "starting_stack": config.get("starting_stack", 10000),
        "table_name": config.get("table_name"),
        "is_private": is_private,
        "is_public": is_public,
        "visibility": "public" if is_public else "private",
        "creator_user_id": creator_user_id,
        "group_id": table.group_id,
        "group_title": group_title,
        "created_at": table.created_at.isoformat() if table.created_at else None,
        "updated_at": table.updated_at.isoformat() if table.updated_at else None,
        "players": players,
        "host": host_info,
        "viewer": viewer_info,
        "permissions": permissions,
        "invite": invite_info,
    }


async def list_available_tables(
    db: AsyncSession,
    limit: int = 20,
    mode: Optional[GameMode] = None,
    viewer_user_id: Optional[int] = None,
    scope: str = "public",
) -> List[Dict[str, Any]]:
    """
    List available tables that players can join.

    Args:
        db: Database session
        limit: Maximum number of tables to return
        mode: Optional game mode filter
        viewer_user_id: Viewer requesting the list (used for personalized scopes)
        scope: Visibility scope. Supported values:
            - "public": only globally visible tables (default)
            - "all": public tables plus ones created by the viewer
            - "mine": only tables created by the viewer

    Returns:
        List of table metadata dictionaries.
    """
    normalized_scope = (scope or "public").strip().lower()
    if normalized_scope not in {"public", "all", "mine"}:
        raise ValueError(f"Unsupported scope: {scope}")

    query = select(Table).where(
        Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE])
    )

    if mode:
        query = query.where(Table.mode == mode)

    if normalized_scope == "public":
        query = query.where(Table.is_public.is_(True))
    elif normalized_scope == "mine":
        if viewer_user_id is None:
            return []
        query = query.where(Table.creator_user_id == viewer_user_id)
    elif normalized_scope == "all":
        if viewer_user_id is not None:
            query = query.where(
                or_(
                    Table.is_public.is_(True),
                    Table.creator_user_id == viewer_user_id,
                )
            )
        else:
            query = query.where(Table.is_public.is_(True))

    query = query.order_by(Table.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    tables = result.scalars().all()

    if not tables:
        return []

    table_ids = [table.id for table in tables]

    # Preload seat counts for all candidate tables
    seat_counts_result = await db.execute(
        select(Seat.table_id, func.count(Seat.id))
        .where(
            Seat.table_id.in_(table_ids),
            Seat.left_at.is_(None)
        )
        .group_by(Seat.table_id)
    )
    seat_counts = {table_id: count for table_id, count in seat_counts_result.all()}

    viewer_positions: Dict[int, int] = {}
    if viewer_user_id is not None:
        viewer_seat_result = await db.execute(
            select(Seat.table_id, Seat.position)
            .where(
                Seat.table_id.in_(table_ids),
                Seat.left_at.is_(None),
                Seat.user_id == viewer_user_id,
            )
        )
        viewer_positions = {
            table_id: position for table_id, position in viewer_seat_result.all()
        }

    # Preload host user information
    creator_ids = {
        table.creator_user_id for table in tables if table.creator_user_id
    }
    creator_map: Dict[int, User] = {}
    if creator_ids:
        creator_result = await db.execute(
            select(User).where(User.id.in_(creator_ids))
        )
        creator_map = {user.id: user for user in creator_result.scalars()}

    tables_data: List[Dict[str, Any]] = []
    for table in tables:
        config = table.config_json or {}
        creator_user_id = table.creator_user_id or config.get("creator_user_id")
        is_public = table.is_public if table.is_public is not None else not _is_table_private(config)
        is_private = not is_public

        player_count = seat_counts.get(table.id, 0)
        max_players = config.get("max_players", 8)
        creator = (
            creator_map.get(creator_user_id)
            if creator_user_id in creator_map
            else None
        )

        host_info = None
        if creator:
            host_info = {
                "user_id": creator.id,
                "username": creator.username,
                "display_name": creator.username or f"Player #{creator.id}",
            }

        viewer_info = None
        if viewer_user_id is not None:
            viewer_info = {
                "is_seated": table.id in viewer_positions,
                "seat_position": viewer_positions.get(table.id),
            }

        tables_data.append(
            {
                "table_id": table.id,
                "mode": table.mode.value,
                "status": table.status.value,
                "player_count": player_count,
                "max_players": max_players,
                "small_blind": config.get("small_blind", 25),
                "big_blind": config.get("big_blind", 50),
                "table_name": config.get("table_name", f"Table #{table.id}"),
                "host": host_info,
                "created_at": table.created_at.isoformat() if table.created_at else None,
                "is_full": player_count >= max_players,
                "is_private": is_private,
                "is_public": is_public,
                "visibility": "public" if is_public else "private",
                "creator_user_id": creator_user_id,
                "viewer": viewer_info,
            }
        )

    return tables_data


async def start_table(
    db: AsyncSession,
    table_id: int,
    *,
    user_id: int,
) -> Table:
    """Transition a table into the active state if the caller is the host."""

    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise ValueError(f"Table {table_id} not found")

    config = table.config_json or {}
    creator_user_id = table.creator_user_id or config.get("creator_user_id")
    if creator_user_id is None or creator_user_id != user_id:
        raise PermissionError("Only the table creator can start the game")

    if table.status != TableStatus.WAITING:
        raise ValueError("Table is not in a state that can be started")

    result = await db.execute(
        select(func.count(Seat.id)).where(
            Seat.table_id == table_id,
            Seat.left_at.is_(None)
        )
    )
    player_count = result.scalar() or 0
    required_players = 2
    if player_count < required_players:
        raise ValueError("At least two seated players are required to start the game")

    table.status = TableStatus.ACTIVE
    table.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Table started",
        table_id=table.id,
        started_by=user_id,
        player_count=player_count,
    )

    return table
