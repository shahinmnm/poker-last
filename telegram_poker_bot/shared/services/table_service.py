"""Table management service for creating and managing poker tables."""

from __future__ import annotations

import json
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, TYPE_CHECKING, Tuple
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.game_core import runtime as game_runtime
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

if TYPE_CHECKING:  # pragma: no cover - import for typing only
    from redis.asyncio import Redis


PUBLIC_TABLE_CACHE_PREFIX = "lobby:public_tables"
PUBLIC_TABLE_CACHE_KEYS = f"{PUBLIC_TABLE_CACHE_PREFIX}:keys"
TABLE_EXPIRATION_MINUTES = 10
INVITE_CODE_LENGTH = 6
INVITE_CODE_FALLBACK_LENGTH = 8


async def check_and_mark_expired_table(db: AsyncSession, table: Table) -> bool:
    """
    Check if a table should be marked as expired and update its status.
    
    Returns True if table was expired, False otherwise.
    """
    now = datetime.now(timezone.utc)
    
    # Skip tables that are already ended or expired
    if table.status in {TableStatus.ENDED, TableStatus.EXPIRED}:
        return table.status == TableStatus.EXPIRED
    
    # Check time-based expiration
    if table.expires_at and table.expires_at <= now:
        table.status = TableStatus.EXPIRED
        table.updated_at = now
        await db.flush()
        logger.info(
            "Table marked as expired (time limit)",
            table_id=table.id,
            expires_at=table.expires_at.isoformat(),
        )
        return True
    
    return False


def _generate_invite_code(length: int = INVITE_CODE_LENGTH) -> str:
    """Generate a random invite code for private tables."""
    # Use uppercase letters and digits for readability
    alphabet = string.ascii_uppercase + string.digits
    # Exclude similar-looking characters: O, 0, I, 1
    alphabet = alphabet.replace('O', '').replace('I', '').replace('0', '').replace('1', '')
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def normalize_invite_code(raw: str) -> str:
    """Normalize an invite code for comparisons."""

    return raw.strip().upper()


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


def _resolve_visibility_flags(table: Table) -> Tuple[bool, bool, str]:
    """Return (is_public, is_private, visibility_label) for a table."""

    config = table.config_json or {}
    is_public = table.is_public if table.is_public is not None else not _is_table_private(config)
    visibility = "public" if is_public else "private"
    return is_public, not is_public, visibility


def _public_cache_key(mode: Optional[GameMode], limit: int) -> str:
    """Compose a Redis cache key for public tables."""

    mode_value = mode.value if mode else "any"
    return f"{PUBLIC_TABLE_CACHE_PREFIX}:{mode_value}:{limit}"


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
    
    # Generate invite code for private tables
    invite_code = None
    if is_private:
        # Keep trying until we get a unique code (very unlikely to collide)
        for _ in range(10):
            candidate_code = _generate_invite_code()
            result = await db.execute(
                select(Table).where(Table.invite_code == candidate_code)
            )
            if result.scalar_one_or_none() is None:
                invite_code = candidate_code
                break
        if invite_code is None:
            # Fallback to longer code
            invite_code = _generate_invite_code(length=INVITE_CODE_FALLBACK_LENGTH)
    
    # Set expiration time (10 minutes from now)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TABLE_EXPIRATION_MINUTES)

    table = Table(
        mode=mode,
        group_id=group_id,
        status=TableStatus.WAITING,
        creator_user_id=creator_user_id,
        is_public=is_public,
        invite_code=invite_code,
        expires_at=expires_at,
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
        invite_code=invite_code,
        expires_at=expires_at.isoformat(),
    )

    await game_runtime.refresh_table_runtime(db, table.id)

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


async def invalidate_public_table_cache(redis_client: Optional["Redis"]) -> None:
    """Clear cached public table listings when lobby state changes."""

    if not redis_client:
        return

    try:
        cached_keys = await redis_client.smembers(PUBLIC_TABLE_CACHE_KEYS)
        if cached_keys:
            keys = [key.decode() if isinstance(key, bytes) else str(key) for key in cached_keys]
            if keys:
                await redis_client.delete(*keys)
        await redis_client.delete(PUBLIC_TABLE_CACHE_KEYS)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to invalidate public table cache", error=str(exc))


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
    table.updated_at = datetime.now(timezone.utc)
    await db.flush()
    
    logger.info(
        "User seated at table",
        table_id=table_id,
        user_id=user_id,
        position=position,
        chips=starting_stack,
    )

    await game_runtime.refresh_table_runtime(db, table_id)

    return seat


async def get_table_by_invite_code(db: AsyncSession, invite_code: str) -> Table:
    """Fetch a non-expired private table by invite code."""

    normalized = normalize_invite_code(invite_code)
    if not normalized:
        raise ValueError("Invalid invite code")

    result = await db.execute(select(Table).where(Table.invite_code == normalized))
    table = result.scalar_one_or_none()

    if not table:
        raise ValueError("Invite code not found")

    now = datetime.now(timezone.utc)
    if table.expires_at and table.expires_at <= now:
        # Mark as expired if not already
        if table.status not in {TableStatus.ENDED, TableStatus.EXPIRED}:
            table.status = TableStatus.EXPIRED
            table.updated_at = now
            await db.flush()
        raise ValueError("Table has expired")

    if table.is_public:
        raise ValueError("Invite code is not linked to a private table")

    return table


async def seat_user_by_invite_code(
    db: AsyncSession,
    invite_code: str,
    user_id: int,
) -> Tuple[Table, Optional[Seat], Optional[str]]:
    """Seat a user using an invite code, returning the table, seat, and any error."""

    table = await get_table_by_invite_code(db, invite_code)

    try:
        seat = await seat_user_at_table(db, table.id, user_id)
    except ValueError as exc:
        # Allow caller to handle cases where the user is already seated or table is full
        logger.info(
            "Join by invite failed to seat user",
            table_id=table.id,
            user_id=user_id,
            error=str(exc),
        )
        return table, None, str(exc)

    return table, seat, None


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
    seat.table.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "User left table",
        table_id=table_id,
        user_id=user_id,
        seat_id=seat.id,
    )

    await game_runtime.refresh_table_runtime(db, table_id)

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

    # Check if table should be marked as expired
    is_expired = await check_and_mark_expired_table(db, table)

    now = datetime.now(timezone.utc)
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
            expires_at = invite.expires_at
            if expires_at:
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < datetime.now(timezone.utc):
                    continue
            table_hint = invite.metadata_json.get("table_id") if invite.metadata_json else None
            if table_hint == table.id:
                invite_info = {
                    "game_id": invite.game_id,
                    "status": invite.status.value,
                    "expires_at": expires_at.isoformat() if expires_at else None,
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
            and (not is_private or viewer_is_creator or viewer_user_id is not None)
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
        "expires_at": table.expires_at.isoformat() if table.expires_at else None,
        "is_expired": is_expired,
        "invite_code": (
            table.invite_code if is_private and (viewer_is_creator or viewer_is_seated) else None
        ),
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
    *,
    redis_client: Optional["Redis"] = None,
    cache_ttl: int = 20,
) -> List[Dict[str, Any]]:
    """List tables visible to the viewer, optionally using a Redis cache."""

    normalized_scope = (scope or "public").strip().lower()
    if normalized_scope not in {"public", "all", "mine"}:
        raise ValueError(f"Unsupported scope: {scope}")

    use_cache = normalized_scope == "public" and redis_client is not None
    cache_key = _public_cache_key(mode, limit) if use_cache else None
    cached_payload: Optional[List[Dict[str, Any]]] = None

    if use_cache and cache_key:
        try:
            cached_raw = await redis_client.get(cache_key)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to read public table cache", error=str(exc))
        else:
            if cached_raw:
                try:
                    cached_text = cached_raw.decode() if isinstance(cached_raw, (bytes, bytearray)) else cached_raw
                    cached_payload = json.loads(cached_text)
                except (json.JSONDecodeError, AttributeError):
                    logger.warning("Corrupted public table cache entry", cache_key=cache_key)
                    cached_payload = None

    if cached_payload is None:
        now = datetime.now(timezone.utc)
        query = select(Table).where(
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE])
        )
        
        # Filter out expired tables
        query = query.where(
            or_(
                Table.expires_at.is_(None),
                Table.expires_at > now
            )
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

        # Order by expiration (soonest first), then by created_at
        query = query.order_by(Table.expires_at.asc().nullslast(), Table.created_at.desc(), Table.id.desc()).limit(limit)

        result = await db.execute(query)
        tables = result.scalars().all()

        if not tables:
            if use_cache and cache_key:
                try:
                    await redis_client.setex(cache_key, cache_ttl, "[]")
                    await redis_client.sadd(PUBLIC_TABLE_CACHE_KEYS, cache_key)
                except Exception as exc:  # pragma: no cover
                    logger.warning("Failed to write empty public table cache", error=str(exc))
            return []

        table_ids = [table.id for table in tables]

        seat_counts_result = await db.execute(
            select(Seat.table_id, func.count(Seat.id))
            .where(
                Seat.table_id.in_(table_ids),
                Seat.left_at.is_(None)
            )
            .group_by(Seat.table_id)
        )
        seat_counts = {
            table_id: count for table_id, count in seat_counts_result.all()
        }

        creator_ids = {
            table.creator_user_id or (table.config_json or {}).get("creator_user_id")
            for table in tables
            if table.creator_user_id or (table.config_json or {}).get("creator_user_id")
        }
        creator_map: Dict[int, User] = {}
        if creator_ids:
            creator_result = await db.execute(
                select(User).where(User.id.in_(creator_ids))
            )
            creator_map = {user.id: user for user in creator_result.scalars()}

        payload: List[Dict[str, Any]] = []
        for table in tables:
            config = table.config_json or {}
            creator_user_id = table.creator_user_id or config.get("creator_user_id")
            host_user = creator_map.get(creator_user_id) if creator_user_id else None
            host_info = None
            if host_user:
                host_info = {
                    "user_id": host_user.id,
                    "username": host_user.username,
                    "display_name": host_user.username or f"Player #{host_user.id}",
                }

            is_public, is_private, visibility = _resolve_visibility_flags(table)
            player_count = seat_counts.get(table.id, 0)
            max_players = config.get("max_players", 8)

            payload.append(
                {
                    "table_id": table.id,
                    "mode": table.mode.value,
                    "status": table.status.value,
                    "player_count": player_count,
                    "max_players": max_players,
                    "small_blind": config.get("small_blind", 25),
                    "big_blind": config.get("big_blind", 50),
                    "starting_stack": config.get("starting_stack", 10000),
                    "table_name": config.get("table_name", f"Table #{table.id}"),
                    "host": host_info,
                    "created_at": table.created_at.isoformat() if table.created_at else None,
                    "updated_at": table.updated_at.isoformat() if table.updated_at else None,
                    "expires_at": table.expires_at.isoformat() if table.expires_at else None,
                    "is_full": player_count >= max_players,
                    "is_private": is_private,
                    "is_public": is_public,
                    "visibility": visibility,
                    "creator_user_id": creator_user_id,
                    "viewer": None,
                }
            )

        cached_payload = payload

        if use_cache and cache_key:
            try:
                await redis_client.setex(cache_key, cache_ttl, json.dumps(payload))
                await redis_client.sadd(PUBLIC_TABLE_CACHE_KEYS, cache_key)
            except Exception as exc:  # pragma: no cover
                logger.warning("Failed to cache public tables", error=str(exc))

    if not cached_payload:
        return []

    tables_data = [dict(entry) for entry in cached_payload]

    if viewer_user_id is not None and tables_data:
        table_ids = [entry["table_id"] for entry in tables_data]
        viewer_seats_result = await db.execute(
            select(
                Seat.table_id,
                Seat.position,
                Seat.chips,
                Seat.joined_at,
            )
            .where(
                Seat.table_id.in_(table_ids),
                Seat.left_at.is_(None),
                Seat.user_id == viewer_user_id,
            )
        )
        viewer_map = {
            table_id: {
                "seat_position": position,
                "chips": chips,
                "joined_at": joined_at.isoformat() if joined_at else None,
            }
            for table_id, position, chips, joined_at in viewer_seats_result.all()
        }
    else:
        viewer_map = {}

    for entry in tables_data:
        viewer_details = None
        if viewer_user_id is not None:
            seat_info = viewer_map.get(entry["table_id"])
            viewer_details = {
                "is_seated": seat_info is not None,
                "seat_position": seat_info.get("seat_position") if seat_info else None,
                "chips": seat_info.get("chips") if seat_info else None,
                "joined_at": seat_info.get("joined_at") if seat_info else None,
                "is_creator": entry.get("creator_user_id") == viewer_user_id,
            }
        entry["viewer"] = viewer_details

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
