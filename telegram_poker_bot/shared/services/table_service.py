"""Table management service for creating and managing poker tables using templates."""

from __future__ import annotations

import json
import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, TYPE_CHECKING, Tuple

from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from telegram_poker_bot.game_core import pokerkit_runtime as game_runtime
from telegram_poker_bot.shared.models import (
    User,
    Table,
    Seat,
    Group,
    GameMode,
    GameVariant,
    TableStatus,
    GroupGameInvite,
    GroupGameInviteStatus,
    CurrencyType,
    TableTemplate,
    TableTemplateType,
)
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.services import table_lifecycle
from telegram_poker_bot.shared.services.table_buyin_service import TableBuyInService

logger = get_logger(__name__)

if TYPE_CHECKING:  # pragma: no cover - import for typing only
    from redis.asyncio import Redis


PUBLIC_TABLE_CACHE_PREFIX = "lobby:public_tables"
PUBLIC_TABLE_CACHE_KEYS = f"{PUBLIC_TABLE_CACHE_PREFIX}:keys"
INVITE_CODE_LENGTH = 6
INVITE_CODE_FALLBACK_LENGTH = 8


@dataclass
class TableRuleConfig:
    """Normalized rule configuration pulled from a template."""

    small_blind: int
    big_blind: int
    starting_stack: int
    max_players: int
    ante: int
    raw_antes: int
    raw_blinds_or_straddles: Tuple[int, int]
    min_bet: int
    bring_in: Optional[int]
    rake_percentage: float
    rake_cap: int
    turn_timeout_seconds: Optional[int]
    poker_mode: Optional[str]


def _require_int(config: Dict[str, Any], key: str) -> int:
    """Fetch and coerce an integer rule from template config."""

    if key not in config:
        raise ValueError(f"{key} is required in table template config")
    try:
        return int(config[key])
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{key} must be an integer in template config") from exc


def parse_template_rules(config: Dict[str, Any]) -> TableRuleConfig:
    """Normalize required rule values from a template config."""

    small_blind = _require_int(config, "small_blind")
    big_blind = _require_int(config, "big_blind")
    starting_stack = _require_int(config, "starting_stack")
    max_players = _require_int(config, "max_players")

    ante_value_raw = config.get("ante", config.get("raw_antes", 0))
    try:
        ante_value = int(ante_value_raw or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("ante must be an integer in template config") from exc

    raw_antes = ante_value

    raw_blinds = config.get("raw_blinds_or_straddles") or (small_blind, big_blind)
    if not isinstance(raw_blinds, (list, tuple)) or len(raw_blinds) != 2:
        raise ValueError("raw_blinds_or_straddles must be a two-element sequence")
    try:
        raw_blinds_tuple = (int(raw_blinds[0]), int(raw_blinds[1]))
    except (TypeError, ValueError) as exc:
        raise ValueError("raw_blinds_or_straddles values must be integers") from exc

    min_bet_raw = config.get("min_bet", big_blind)
    try:
        min_bet = int(min_bet_raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("min_bet must be an integer in template config") from exc

    bring_in_raw = config.get("bring_in")
    bring_in = None
    if bring_in_raw is not None:
        try:
            bring_in = int(bring_in_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("bring_in must be an integer in template config") from exc

    rake_percentage_raw = config.get("rake_percentage", 0)
    try:
        rake_percentage = float(rake_percentage_raw or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("rake_percentage must be numeric in template config") from exc

    rake_cap_raw = config.get("rake_cap", 0)
    try:
        rake_cap = int(rake_cap_raw or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("rake_cap must be an integer in template config") from exc

    timeout_raw = config.get("turn_timeout_seconds")
    turn_timeout_seconds = None
    if timeout_raw is not None:
        try:
            turn_timeout_seconds = int(timeout_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("turn_timeout_seconds must be an integer in template config") from exc

    poker_mode = None
    if "poker_mode" in config:
        poker_mode = str(config.get("poker_mode") or "").strip() or None
    elif "mode" in config:
        poker_mode = str(config.get("mode") or "").strip() or None

    return TableRuleConfig(
        small_blind=small_blind,
        big_blind=big_blind,
        starting_stack=starting_stack,
        max_players=max_players,
        ante=ante_value,
        raw_antes=raw_antes,
        raw_blinds_or_straddles=raw_blinds_tuple,
        min_bet=min_bet,
        bring_in=bring_in,
        rake_percentage=rake_percentage,
        rake_cap=rake_cap,
        turn_timeout_seconds=turn_timeout_seconds,
        poker_mode=poker_mode,
    )


def get_template_config(table: Table) -> Dict[str, Any]:
    """Return the configuration dict from a table's template."""

    template = getattr(table, "template", None)
    if template and template.config_json:
        return template.config_json
    return {}


def _coerce_currency_type(raw: Any) -> CurrencyType:
    """Normalize currency type values coming from template config."""

    if isinstance(raw, CurrencyType):
        return raw
    if isinstance(raw, str):
        try:
            return CurrencyType(raw)
        except ValueError:
            return CurrencyType.REAL
    return CurrencyType.REAL


def _coerce_game_variant(raw: Any) -> str:
    """Normalize game variant to a string value."""

    if isinstance(raw, GameVariant):
        return raw.value
    if isinstance(raw, str):
        return raw
    return GameVariant.NO_LIMIT_TEXAS_HOLDEM.value


def get_table_currency_type(table: Table) -> CurrencyType:
    """Return the table currency type from its template configuration."""

    config = get_template_config(table)
    rules = parse_template_rules(config)
    return _coerce_currency_type(config.get("currency_type"))


def get_table_game_variant(table: Table) -> str:
    """Return the game variant string from template configuration."""

    config = get_template_config(table)
    return _coerce_game_variant(config.get("game_variant"))


async def _load_table_with_template(db: AsyncSession, table_id: int) -> Table:
    """Helper to load a table with its template eager-loaded."""

    result = await db.execute(
        select(Table).options(joinedload(Table.template)).where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    if not table:
        raise ValueError(f"Table {table_id} not found")
    if not table.template:
        raise ValueError(f"Table {table_id} is missing a template")
    return table


async def check_and_mark_expired_table(db: AsyncSession, table: Table) -> bool:
    """
    Check if a table should be marked as expired and update its status.

    Returns True if table was expired, False otherwise.

    DEPRECATED: Use table_lifecycle.check_and_enforce_lifecycle instead.
    This wrapper maintained for backward compatibility.
    """
    was_expired, _ = await table_lifecycle.check_and_enforce_lifecycle(db, table)
    return was_expired


def _generate_invite_code(length: int = INVITE_CODE_LENGTH) -> str:
    """Generate a random invite code for private tables."""
    alphabet = string.ascii_uppercase + string.digits
    alphabet = (
        alphabet.replace("O", "").replace("I", "").replace("0", "").replace("1", "")
    )
    return "".join(secrets.choice(alphabet) for _ in range(length))


def normalize_invite_code(raw: str) -> str:
    """Normalize an invite code for comparisons."""

    return raw.strip().upper()


def _resolve_visibility_flags(table: Table) -> Tuple[bool, bool, str]:
    """Return (is_public, is_private, visibility_label) for a table."""

    is_public = (
        table.is_public
        if table.is_public is not None
        else getattr(table.template, "table_type", None) != TableTemplateType.PRIVATE
    )
    visibility = "public" if is_public else "private"
    return is_public, not is_public, visibility


def _public_cache_key(mode: Optional[GameMode], limit: int) -> str:
    """Compose a Redis cache key for public tables."""

    mode_value = mode.value if mode else "any"
    return f"{PUBLIC_TABLE_CACHE_PREFIX}:{mode_value}:{limit}"


async def create_table_template(
    db: AsyncSession,
    *,
    name: str,
    table_type: TableTemplateType,
    has_waitlist: bool = False,
    config: Optional[Dict[str, Any]] = None,
) -> TableTemplate:
    """Create and persist a TableTemplate."""

    template = TableTemplate(
        name=name,
        table_type=table_type,
        has_waitlist=has_waitlist,
        config_json=config or {},
    )
    db.add(template)
    await db.flush()
    return template


async def create_default_template(
    db: AsyncSession,
    *,
    name: str = "Default Table",
    table_type: TableTemplateType = TableTemplateType.EXPIRING,
    has_waitlist: bool = False,
    config_overrides: Optional[Dict[str, Any]] = None,
) -> TableTemplate:
    """Create a template with sensible defaults for tests and callers."""

    base_config: Dict[str, Any] = {
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 10000,
        "max_players": 8,
        "table_name": name,
        "expiration_minutes": 10,
        "currency_type": CurrencyType.REAL.value,
        "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
        "turn_timeout_seconds": 25,
    }
    if config_overrides:
        base_config.update(config_overrides)

    return await create_table_template(
        db,
        name=name,
        table_type=table_type,
        has_waitlist=has_waitlist,
        config=base_config,
    )


async def create_table(
    db: AsyncSession,
    *,
    creator_user_id: int,
    template_id: int,
    mode: GameMode = GameMode.ANONYMOUS,
    group_id: Optional[int] = None,
    auto_seat_creator: bool = False,
) -> Table:
    """Create a table from a TableTemplate."""

    template = await db.scalar(
        select(TableTemplate).where(TableTemplate.id == template_id)
    )
    if not template:
        raise ValueError(f"TableTemplate {template_id} not found")

    config = template.config_json or {}
    rules = parse_template_rules(config)

    if template.table_type == TableTemplateType.PERSISTENT and not template.has_waitlist:
        raise ValueError("Persistent tables must enable waitlists in their template")

    expiration_minutes = config.get("expiration_minutes")
    if template.table_type == TableTemplateType.EXPIRING:
        if expiration_minutes is None:
            raise ValueError("Expiring table templates must define expiration_minutes")
        try:
            expiration_minutes = int(expiration_minutes)
        except (TypeError, ValueError):
            raise ValueError("expiration_minutes must be an integer for expiring tables")
        if expiration_minutes <= 0:
            raise ValueError("expiration_minutes must be positive for expiring tables")

    allow_invite_code = config.get("allow_invite_code", True)
    if template.table_type == TableTemplateType.PRIVATE and allow_invite_code is False:
        raise ValueError("Private table templates must allow invite codes")

    max_players = rules.max_players
    starting_stack = rules.starting_stack
    table_name = config.get("table_name") or f"Table #{datetime.now().strftime('%H%M%S')}"
    currency_type = _coerce_currency_type(config.get("currency_type"))
    game_variant = _coerce_game_variant(config.get("game_variant"))

    is_public = template.table_type != TableTemplateType.PRIVATE

    invite_code = None
    if not is_public:
        for _ in range(10):
            candidate_code = _generate_invite_code()
            result = await db.execute(
                select(Table).where(Table.invite_code == candidate_code)
            )
            if result.scalar_one_or_none() is None:
                invite_code = candidate_code
                break
        if invite_code is None:
            invite_code = _generate_invite_code(length=INVITE_CODE_FALLBACK_LENGTH)

    expires_at = None
    if template.table_type == TableTemplateType.EXPIRING:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiration_minutes)

    table = Table(
        mode=mode,
        group_id=group_id,
        status=TableStatus.WAITING,
        creator_user_id=creator_user_id,
        is_public=is_public,
        invite_code=invite_code,
        expires_at=expires_at,
        template_id=template.id,
    )
    table.template = template
    db.add(table)
    await db.flush()

    logger.info(
        "Table created from template",
        table_id=table.id,
        template_id=template.id,
        creator_user_id=creator_user_id,
        max_players=max_players,
        is_private=not is_public,
        is_public=is_public,
        mode=mode.value,
        invite_code=invite_code,
        expires_at=expires_at.isoformat() if expires_at else None,
        currency_type=currency_type.value,
        game_variant=game_variant,
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


async def create_table_with_config(
    db: AsyncSession,
    *,
    creator_user_id: int,
    template_id: Optional[int] = None,
    mode: GameMode = GameMode.ANONYMOUS,
    group_id: Optional[int] = None,
    auto_seat_creator: bool = False,
    **legacy_config: Any,
) -> Table:
    """
    Deprecated legacy entrypoint.

    Builds a one-off template from provided config (if template_id is None) and creates the table.
    """

    if template_id is None:
        name = legacy_config.get("table_name") or "Legacy Template"
        has_waitlist = bool(legacy_config.get("has_waitlist", False))
        table_type = TableTemplateType.EXPIRING
        if legacy_config.get("is_private"):
            table_type = TableTemplateType.PRIVATE
        elif legacy_config.get("is_persistent"):
            table_type = TableTemplateType.PERSISTENT
        template = await create_default_template(
            db,
            name=name,
            table_type=table_type,
            has_waitlist=has_waitlist,
            config_overrides=legacy_config,
        )
        template_id = template.id
    return await create_table(
        db,
        creator_user_id=creator_user_id,
        template_id=template_id,
        mode=mode,
        group_id=group_id,
        auto_seat_creator=auto_seat_creator,
    )


async def create_private_table(
    db: AsyncSession,
    creator_user_id: int,
    template_id: int,
) -> Table:
    """Create a private table (template must be PRIVATE)."""

    return await create_table(
        db,
        creator_user_id=creator_user_id,
        template_id=template_id,
        auto_seat_creator=False,
    )


async def create_group_table(
    db: AsyncSession,
    creator_user_id: int,
    group_id: int,
    template_id: int,
) -> Table:
    """Create a group-linked table from a template."""

    return await create_table(
        db,
        creator_user_id=creator_user_id,
        template_id=template_id,
        mode=GameMode.GROUP,
        group_id=group_id,
        auto_seat_creator=False,
    )


async def invalidate_public_table_cache(redis_client: Optional["Redis"]) -> None:
    """Clear cached public table listings when lobby state changes."""

    if not redis_client:
        return

    try:
        cached_keys = await redis_client.smembers(PUBLIC_TABLE_CACHE_KEYS)
        if cached_keys:
            keys = [
                key.decode() if isinstance(key, bytes) else str(key)
                for key in cached_keys
            ]
            if keys:
                await redis_client.delete(*keys)
        await redis_client.delete(PUBLIC_TABLE_CACHE_KEYS)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to invalidate public table cache", error=str(exc))


async def seat_user_at_table(
    db: AsyncSession,
    table_id: int,
    user_id: int,
) -> Seat:
    """
    Seat a user at a table using template rules.
    """

    table = await _load_table_with_template(db, table_id)
    config = get_template_config(table)
    rules = parse_template_rules(config)
    max_players = rules.max_players

    result = await db.execute(
        select(Seat)
        .where(Seat.table_id == table_id, Seat.user_id == user_id, Seat.left_at.is_(None))
        .order_by(Seat.joined_at.desc())
    )
    existing_seats = result.scalars().all()
    if existing_seats:
        if len(existing_seats) > 1:
            now = datetime.now(timezone.utc)
            for duplicate in existing_seats[1:]:
                duplicate.left_at = now
            await db.flush()
        raise ValueError(f"User {user_id} already seated at table {table_id}")

    result = await db.execute(
        select(func.count(Seat.id)).where(
            Seat.table_id == table_id, Seat.left_at.is_(None)
        )
    )
    current_players = result.scalar() or 0

    if current_players >= max_players:
        raise ValueError(f"Table {table_id} is full ({current_players}/{max_players})")

    result = await db.execute(
        select(Seat.position).where(Seat.table_id == table_id, Seat.left_at.is_(None))
    )
    occupied_positions = set(pos for pos, in result.all())

    position = 0
    while position < max_players:
        if position not in occupied_positions:
            break
        position += 1

    starting_stack = rules.starting_stack
    buy_in_min = config.get("buy_in_min")
    buy_in_max = config.get("buy_in_max")
    buy_in_amount = starting_stack

    if buy_in_min is not None and buy_in_amount < int(buy_in_min):
        raise ValueError("Buy-in below minimum for this table")
    if buy_in_max is not None and buy_in_amount > int(buy_in_max):
        raise ValueError("Buy-in above maximum for this table")

    currency_type = _coerce_currency_type(config.get("currency_type"))

    await TableBuyInService.reserve_buy_in(
        db,
        table=table,
        user_id=user_id,
        buy_in_amount=buy_in_amount,
        currency_type=currency_type,
    )

    seat = Seat(
        table_id=table_id,
        user_id=user_id,
        position=position,
        chips=buy_in_amount,
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
        chips=buy_in_amount,
    )

    await game_runtime.refresh_table_runtime(db, table_id)

    return seat


async def get_table_by_invite_code(db: AsyncSession, invite_code: str) -> Table:
    """Fetch a non-expired private table by invite code."""

    normalized = normalize_invite_code(invite_code)
    if not normalized:
        raise ValueError("Invalid invite code")

    result = await db.execute(
        select(Table)
        .options(joinedload(Table.template))
        .where(Table.invite_code == normalized)
    )
    table = result.scalar_one_or_none()

    if not table:
        raise ValueError("Invite code not found")

    now = datetime.now(timezone.utc)
    if table.expires_at and table.expires_at <= now:
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
    """
    Mark a user's seat as vacated for the given table and reconcile wallet.
    """

    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table_id, Seat.user_id == user_id, Seat.left_at.is_(None)
        )
    )
    seat = result.scalar_one_or_none()
    if not seat:
        raise ValueError(f"User {user_id} is not seated at table {table_id}")

    table = await _load_table_with_template(db, table_id)
    config = get_template_config(table)
    rules = parse_template_rules(config)
    starting_stack = rules.starting_stack
    session_profit = seat.chips - starting_stack

    logger.info(
        "User leaving table",
        table_id=table_id,
        user_id=user_id,
        starting_stack=starting_stack,
        final_chips=seat.chips,
        session_profit=session_profit,
    )

    currency_type = _coerce_currency_type(config.get("currency_type"))

    from telegram_poker_bot.shared.services.wallet_service import process_cash_out

    await process_cash_out(
        db=db,
        user_id=user_id,
        amount=seat.chips,
        currency_type=currency_type,
        table_id=table_id,
        reference_id=f"table_{table_id}_cashout",
    )

    seat.left_at = datetime.now(timezone.utc)
    seat.chips = 0
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
    """
    table = await _load_table_with_template(db, table_id)

    is_expired = await check_and_mark_expired_table(db, table)

    config = get_template_config(table)
    creator_user_id = table.creator_user_id
    is_public = (
        table.is_public
        if table.is_public is not None
        else getattr(table.template, "table_type", None) != TableTemplateType.PRIVATE
    )
    is_private = not is_public

    host_user = None
    if creator_user_id:
        host_result = await db.execute(select(User).where(User.id == creator_user_id))
        host_user = host_result.scalar_one_or_none()

    seats_result = await db.execute(
        select(Seat, User)
        .join(User, Seat.user_id == User.id)
        .where(Seat.table_id == table_id, Seat.left_at.is_(None))
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

    group_title = None
    if table.group_id:
        result = await db.execute(select(Group).where(Group.id == table.group_id))
        group = result.scalar_one_or_none()
        if group:
            group_title = group.title

    invite_info = None
    if creator_user_id:
        invite_result = await db.execute(
            select(GroupGameInvite)
            .where(GroupGameInvite.creator_user_id == creator_user_id)
            .order_by(desc(GroupGameInvite.expires_at))
        )
        for invite in invite_result.scalars():
            if invite.status not in {
                GroupGameInviteStatus.PENDING,
                GroupGameInviteStatus.READY,
            }:
                continue
            expires_at = invite.expires_at
            if expires_at:
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < datetime.now(timezone.utc):
                    continue
            table_hint = (
                invite.metadata_json.get("table_id") if invite.metadata_json else None
            )
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

    max_players = rules.max_players
    viewer_is_creator = viewer_user_id is not None and viewer_user_id == creator_user_id

    from telegram_poker_bot.shared.models import Hand, HandStatus

    has_active_hand = False
    if table.status == TableStatus.ACTIVE:
        hand_result = await db.execute(
            select(Hand)
            .where(Hand.table_id == table.id, Hand.status != HandStatus.ENDED)
            .limit(1)
        )
        has_active_hand = hand_result.scalar_one_or_none() is not None

    permissions = {
        "can_start": (
            viewer_is_creator
            and player_count >= 2
            and (
                table.status == TableStatus.WAITING
                or (table.status == TableStatus.ACTIVE and not has_active_hand)
            )
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
            table.invite_code
            if is_private and (viewer_is_creator or viewer_is_seated)
            else None
        ),
        "players": players,
        "host": host_info,
        "viewer": viewer_info,
        "permissions": permissions,
        "invite": invite_info,
        "template": {
            "id": table.template.id,
            "table_type": table.template.table_type.value,
            "config": config,
            "has_waitlist": table.template.has_waitlist,
        },
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
                    cached_text = (
                        cached_raw.decode()
                        if isinstance(cached_raw, (bytes, bytearray))
                        else cached_raw
                    )
                    cached_payload = json.loads(cached_text)
                except (json.JSONDecodeError, AttributeError):
                    logger.warning(
                        "Corrupted public table cache entry", cache_key=cache_key
                    )
                    cached_payload = None

    if cached_payload is None:
        now = datetime.now(timezone.utc)
        query = (
            select(Table)
            .options(joinedload(Table.template))
            .where(Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE]))
        )

        query = query.where(or_(Table.expires_at.is_(None), Table.expires_at > now))

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

        query = query.order_by(
            Table.expires_at.asc().nullslast(), Table.created_at.desc(), Table.id.desc()
        ).limit(limit)

        result = await db.execute(query)
        tables = result.scalars().unique().all()

        if not tables:
            if use_cache and cache_key:
                try:
                    await redis_client.setex(cache_key, cache_ttl, "[]")
                    await redis_client.sadd(PUBLIC_TABLE_CACHE_KEYS, cache_key)
                except Exception as exc:  # pragma: no cover
                    logger.warning(
                        "Failed to write empty public table cache", error=str(exc)
                    )
            return []

        table_ids = [table.id for table in tables]

        seat_counts_result = await db.execute(
            select(Seat.table_id, func.count(Seat.id))
            .where(Seat.table_id.in_(table_ids), Seat.left_at.is_(None))
            .group_by(Seat.table_id)
        )
        seat_counts = {table_id: count for table_id, count in seat_counts_result.all()}

        creator_ids = {
            table.creator_user_id for table in tables if table.creator_user_id
        }
        creator_map: Dict[int, User] = {}
        if creator_ids:
            creator_result = await db.execute(
                select(User).where(User.id.in_(creator_ids))
            )
            creator_map = {user.id: user for user in creator_result.scalars()}

        payload: List[Dict[str, Any]] = []
        for table in tables:
            config = get_template_config(table)
            rules = parse_template_rules(config)
            creator_user_id = table.creator_user_id
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
            max_players = rules.max_players

            payload.append(
                {
                    "table_id": table.id,
                    "mode": table.mode.value,
                    "status": table.status.value,
                    "player_count": player_count,
                    "max_players": max_players,
                    "table_name": config.get("table_name", f"Table #{table.id}"),
                    "host": host_info,
                    "created_at": (
                        table.created_at.isoformat() if table.created_at else None
                    ),
                    "updated_at": (
                        table.updated_at.isoformat() if table.updated_at else None
                    ),
                    "expires_at": (
                        table.expires_at.isoformat() if table.expires_at else None
                    ),
                    "is_full": player_count >= max_players,
                    "is_private": is_private,
                    "is_public": is_public,
                    "visibility": visibility,
                    "creator_user_id": creator_user_id,
                    "viewer": None,
                    "template": {
                        "id": table.template.id,
                        "table_type": table.template.table_type.value,
                        "config": config,
                        "has_waitlist": table.template.has_waitlist,
                    },
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

    legacy_keys = {
        "small_blind",
        "big_blind",
        "starting_stack",
        "game_variant",
        "currency_type",
        "is_persistent",
    }
    for entry in tables_data:
        for key in legacy_keys:
            entry.pop(key, None)

    if viewer_user_id is not None and tables_data:
        table_ids = [entry["table_id"] for entry in tables_data]
        viewer_seats_result = await db.execute(
            select(
                Seat.table_id,
                Seat.position,
                Seat.chips,
                Seat.joined_at,
            ).where(
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
    """
    Transition a table into the active state or start a new hand if already active.
    """

    table = await _load_table_with_template(db, table_id)
    creator_user_id = table.creator_user_id
    if creator_user_id is None or creator_user_id != user_id:
        raise PermissionError("Only the table creator can start the game")

    if table.status not in (TableStatus.WAITING, TableStatus.ACTIVE):
        raise ValueError(f"Table cannot be started from {table.status.value} state")

    result = await db.execute(
        select(func.count(Seat.id)).where(
            Seat.table_id == table_id, Seat.left_at.is_(None)
        )
    )
    player_count = result.scalar() or 0
    required_players = 2
    if player_count < required_players:
        raise ValueError("At least two seated players are required to start the game")

    from telegram_poker_bot.shared.models import Hand, HandStatus

    hand_result = await db.execute(
        select(Hand)
        .where(Hand.table_id == table_id, Hand.status != HandStatus.ENDED)
        .order_by(Hand.hand_no.desc())
        .limit(1)
    )
    active_hand = hand_result.scalar_one_or_none()
    if active_hand:
        raise ValueError("Cannot start a new hand while another hand is in progress")

    if table.status == TableStatus.WAITING:
        table.status = TableStatus.ACTIVE
        table.expires_at = None

    table.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Table ready for new hand",
        table_id=table.id,
        started_by=user_id,
        player_count=player_count,
        table_status=table.status.value,
    )

    return table


async def end_table(
    db: AsyncSession,
    table_id: int,
    *,
    user_id: int,
) -> Table:
    """
    End a table session (host only).
    """
    table = await _load_table_with_template(db, table_id)
    creator_user_id = table.creator_user_id
    if creator_user_id is None or creator_user_id != user_id:
        raise PermissionError("Only the table creator can end the table")

    result = await db.execute(
        select(Seat).where(Seat.table_id == table_id, Seat.left_at.is_(None))
    )
    active_seats = result.scalars().all()

    now = datetime.now(timezone.utc)
    for seat in active_seats:
        seat.left_at = now
        logger.info(
            "Auto-leaving seat on table end",
            table_id=table_id,
            user_id=seat.user_id,
            seat_id=seat.id,
        )

    table.status = TableStatus.ENDED
    table.updated_at = now
    await db.flush()

    logger.info(
        "Table ended",
        table_id=table.id,
        ended_by=user_id,
    )

    return table


async def try_seat_from_waitlist(
    db: AsyncSession,
    table_id: int,
) -> Optional[Seat]:
    """
    Try to seat the next player from the waitlist.

    This should be called when a seat becomes available (e.g., after a player leaves).
    Only works for tables with has_waitlist=True.

    Args:
        db: Database session
        table_id: ID of the table

    Returns:
        The newly created Seat if successful, None otherwise
    """
    from telegram_poker_bot.shared.services import waitlist_service

    # Load table with template
    table = await _load_table_with_template(db, table_id)

    # Only process if table has waitlist enabled
    if not table.template or not table.template.has_waitlist:
        return None

    # Get next waiting player
    next_entry = await waitlist_service.get_next_waiting_player(db, table_id)
    if not next_entry:
        # No one waiting
        return None

    # Try to seat the player
    try:
        seat = await seat_user_at_table(db, table_id, next_entry.user_id)

        # Mark waitlist entry as entered
        await waitlist_service.mark_entry_entered(db, next_entry.id)

        logger.info(
            "Player seated from waitlist",
            table_id=table_id,
            user_id=next_entry.user_id,
            seat_id=seat.id,
            waitlist_entry_id=next_entry.id,
        )

        return seat

    except ValueError as exc:
        # Failed to seat (e.g., table full, user already seated)
        logger.warning(
            "Failed to seat player from waitlist",
            table_id=table_id,
            user_id=next_entry.user_id,
            error=str(exc),
        )
        # Cancel this entry and try the next one
        await waitlist_service.leave_waitlist(db, table_id, next_entry.user_id)
        return None
