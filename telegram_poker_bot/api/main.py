"""FastAPI service for Mini App - REST + WebSocket API."""

from datetime import datetime, timezone, timedelta
from functools import lru_cache
from typing import Optional, List, Dict, Any
import asyncio
import json
import hmac
import hashlib
from urllib.parse import parse_qsl, urlparse

from fastapi import (
    Body,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.shared.database import get_db, get_db_session
from telegram_poker_bot.shared.models import (
    Table,
    ActionType,
    User,
    Group,
    GroupGameInviteStatus,
    TableStatus,
    Seat,
    HandStatus,
)
from telegram_poker_bot.shared.types import (
    GameMode,
    TableCreateRequest,
    TableVisibility,
)
from telegram_poker_bot.shared.services.group_invites import (
    create_invite,
    fetch_invite_by_game_id,
    generate_unique_game_id,
    token_length_for_ttl,
)
from telegram_poker_bot.shared.services import user_service, table_service
from telegram_poker_bot.shared.services.avatar_service import generate_avatar
from telegram_poker_bot.bot.i18n import get_translation
from telegram_poker_bot.game_core import get_matchmaking_pool, get_redis_client
from telegram_poker_bot.game_core.pokerkit_runtime import (
    NoActorToActError,
    get_pokerkit_runtime_manager,
)

settings = get_settings()
configure_logging()
logger = get_logger(__name__)

DEFAULT_API_PREFIX = "/api"


def _derive_api_path_prefix(api_url: Optional[str]) -> str:
    """Extract a normalized path prefix from the configured API URL."""

    if not api_url:
        return ""

    parsed = urlparse(api_url)
    if parsed.scheme or parsed.netloc:
        candidate = parsed.path or ""
    else:
        candidate = api_url

    normalized = "/" + candidate.strip("/") if candidate.strip("/") else ""
    if normalized == "/":
        return ""
    return normalized


api_app = FastAPI(
    title="Telegram Poker Bot API",
    description="REST and WebSocket API for Telegram Poker Bot Mini App",
    version="1.0.0",
)

# CORS middleware
api_app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        settings.cors_origins.split(",")
        if "," in settings.cors_origins
        else [settings.cors_origins]
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models


class UserAuth(BaseModel):
    """User authentication model parsed from Telegram init data."""

    user_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None


class UserProfileResponse(BaseModel):
    """Response describing the current Telegram user registration state."""

    registered: bool
    user_id: Optional[int] = None
    username: Optional[str] = None
    language: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class GroupInviteResponse(BaseModel):
    """Response payload for newly created group invite."""

    game_id: str
    deep_link: str
    startapp_link: str
    expires_at: datetime
    status: str


class GroupInviteStatusResponse(BaseModel):
    """Invite status information accessible without secrets."""

    game_id: str
    deep_link: str
    status: str
    expires_at: datetime
    group_id: Optional[int] = None
    group_title: Optional[str] = None


class GroupInviteJoinResponse(BaseModel):
    """Response when a player signals intent to join via mini app."""

    game_id: str
    status: str
    message: str
    group_title: Optional[str] = None


class JoinByInviteRequest(BaseModel):
    """Validated payload for joining a private table by invite code."""

    invite_code: str = Field(
        ...,
        min_length=table_service.INVITE_CODE_LENGTH,
        max_length=table_service.INVITE_CODE_FALLBACK_LENGTH,
        pattern=r"^[A-Za-z0-9]+$",
        description="Invite code shared by the table host.",
    )


class ActionRequest(BaseModel):
    """Action request model."""

    action_type: str
    amount: Optional[int] = None


class SitOutRequest(BaseModel):
    """Sit-out request model."""

    sit_out: bool


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = (
            {}
        )  # table_id -> [websockets]

    async def connect(self, websocket: WebSocket, table_id: int):
        """Connect a WebSocket to a table."""
        await websocket.accept()
        if table_id not in self.active_connections:
            self.active_connections[table_id] = []
        self.active_connections[table_id].append(websocket)
        logger.info("WebSocket connected", table_id=table_id)

    def disconnect(self, websocket: WebSocket, table_id: int):
        """Disconnect a WebSocket from a table."""
        if table_id in self.active_connections:
            self.active_connections[table_id].remove(websocket)
            if not self.active_connections[table_id]:
                del self.active_connections[table_id]
        logger.info("WebSocket disconnected", table_id=table_id)

    async def broadcast(self, table_id: int, message: Dict[str, Any]):
        """Broadcast message to all connections for a table."""
        message_type = message.get("type", "unknown")

        if table_id not in self.active_connections:
            logger.warning(
                "Broadcast attempted but no connections exist",
                table_id=table_id,
                message_type=message_type,
            )
            return

        connection_count = len(self.active_connections[table_id])

        # Log broadcast details before sending
        logger.info(
            "Broadcasting WebSocket message",
            table_id=table_id,
            message_type=message_type,
            recipient_count=connection_count,
            current_actor=message.get("current_actor"),
            allowed_actions_present=bool(message.get("allowed_actions")),
            status=message.get("status"),
            street=message.get("street"),
        )

        # Special logging for hand_ended broadcasts
        if message_type == "hand_ended":
            logger.info(
                "Broadcasting hand_ended event to all clients",
                table_id=table_id,
                recipient_count=connection_count,
                winners=message.get("winners", []),
                pot_total=message.get("pot_total"),
                allowed_actions=message.get("allowed_actions"),
                has_ready_action=any(
                    a.get("action_type") == "ready"
                    for a in (message.get("allowed_actions") or [])
                ),
            )

        disconnected = []
        for connection in self.active_connections[table_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error("Error broadcasting", table_id=table_id, error=str(e))
                disconnected.append(connection)

        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn, table_id)

        # Log successful broadcast completion
        successful_count = connection_count - len(disconnected)
        logger.info(
            "Broadcast completed",
            table_id=table_id,
            message_type=message_type,
            successful_recipients=successful_count,
            failed_recipients=len(disconnected),
        )

    async def close_all_connections(self, table_id: int):
        """Close all WebSocket connections for a table (e.g., when table is deleted)."""
        if table_id not in self.active_connections:
            return

        connections = self.active_connections[table_id].copy()
        for connection in connections:
            try:
                await connection.close()
            except Exception as e:
                logger.warning(
                    "Error closing WebSocket connection",
                    table_id=table_id,
                    error=str(e),
                )

        # Clear all connections for this table
        if table_id in self.active_connections:
            del self.active_connections[table_id]

        logger.info(
            "Closed all WebSocket connections",
            table_id=table_id,
            count=len(connections),
        )


manager = ConnectionManager()


_auto_fold_task: Optional[asyncio.Task] = None
_inactivity_check_task: Optional[asyncio.Task] = None
_inter_hand_tasks: Dict[int, asyncio.Task] = {}


def _cancel_inter_hand_task(table_id: int) -> None:
    """Cancel any pending inter-hand task for the table."""

    task = _inter_hand_tasks.pop(table_id, None)
    if task:
        task.cancel()


async def _handle_inter_hand_result(table_id: int, result: Dict[str, Any]) -> None:
    """Broadcast the outcome of the inter-hand phase."""

    if not result:
        return

    if result.get("table_ended"):
        await manager.broadcast(
            table_id,
            {
                "type": "table_ended",
                "reason": result.get("reason", "Not enough players"),
            },
        )
        await manager.close_all_connections(table_id)
        return

    if result.get("state"):
        await manager.broadcast(table_id, result["state"])


async def _auto_complete_inter_hand(table_id: int) -> None:
    """Automatically resolve the inter-hand phase when the timer expires."""

    try:
        await asyncio.sleep(settings.post_hand_delay_seconds)
        async with get_db_session() as session:
            result = await get_pokerkit_runtime_manager().complete_inter_hand_phase(
                session, table_id
            )
            await session.commit()

        await _handle_inter_hand_result(table_id, result)
    except asyncio.CancelledError:
        return
    finally:
        _inter_hand_tasks.pop(table_id, None)


def _schedule_inter_hand_completion(table_id: int) -> None:
    """Schedule or reset the inter-hand countdown task for a table."""

    _cancel_inter_hand_task(table_id)
    _inter_hand_tasks[table_id] = asyncio.create_task(
        _auto_complete_inter_hand(table_id)
    )


async def check_table_inactivity():
    """
    Background task that checks for inactive tables and marks them as expired.

    Rules implemented via table_lifecycle service:
    - Pre-game: Tables expire if expires_at is in the past (Rule A)
    - Post-game: Tables self-destruct if insufficient active players (Rule D)
    - All-sit-out: Tables where ALL players are sitting out expire after 5 minutes

    Uses distributed lock to prevent duplicate execution in multi-worker environments.
    Runs every 30 seconds.
    """
    from telegram_poker_bot.shared.database import get_db_session
    from telegram_poker_bot.shared.services import table_lifecycle

    LOCK_KEY = "background:check_table_inactivity"
    LOCK_TTL = 25

    logger.info("Table inactivity check task started")

    while True:
        try:
            await asyncio.sleep(30)

            redis_client = await get_redis_client()
            lock_acquired = await redis_client.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL)

            if not lock_acquired:
                logger.debug("Inactivity check lock held by another worker, skipping")
                continue

            try:
                now = datetime.now(timezone.utc)

                async with get_db_session() as db:
                    result = await db.execute(
                        select(Table).where(
                            Table.status.in_([TableStatus.ACTIVE, TableStatus.WAITING])
                        )
                    )
                    tables = result.scalars().all()

                    for table in tables:
                        try:
                            # Use canonical lifecycle check
                            was_expired, reason = (
                                await table_lifecycle.check_and_enforce_lifecycle(
                                    db, table
                                )
                            )

                            if was_expired:
                                logger.info(
                                    "Table lifecycle action taken",
                                    table_id=table.id,
                                    reason=reason,
                                    new_status=table.status.value,
                                )

                                # Broadcast expired/ended state to all clients
                                runtime_mgr = get_pokerkit_runtime_manager()
                                try:
                                    final_state = await runtime_mgr.get_state(
                                        db, table.id, viewer_user_id=None
                                    )
                                    final_state["status"] = table.status.value.lower()
                                    final_state["table_status"] = (
                                        table.status.value.lower()
                                    )
                                    await manager.broadcast(table.id, final_state)
                                except Exception as broadcast_err:
                                    logger.error(
                                        "Failed to broadcast lifecycle state",
                                        table_id=table.id,
                                        error=str(broadcast_err),
                                    )

                                await manager.close_all_connections(table.id)

                            # Additional check for all-sit-out timeout (post-start only)
                            elif table.status == TableStatus.ACTIVE:
                                seats_result = await db.execute(
                                    select(Seat).where(
                                        Seat.table_id == table.id,
                                        Seat.left_at.is_(None),
                                    )
                                )
                                active_seats = seats_result.scalars().all()

                                if active_seats:
                                    all_sitting_out = all(
                                        seat.is_sitting_out_next_hand
                                        for seat in active_seats
                                    )

                                    if all_sitting_out and table.last_action_at:
                                        sit_out_duration = now - table.last_action_at
                                        if sit_out_duration > timedelta(
                                            minutes=settings.table_all_sitout_timeout_minutes
                                        ):
                                            reason = f"all players sitting out ({sit_out_duration.total_seconds():.0f}s)"
                                            await table_lifecycle.mark_table_completed_and_cleanup(
                                                db, table, reason
                                            )
                                            logger.info(
                                                "Table completed due to all-sitout",
                                                table_id=table.id,
                                                reason=reason,
                                            )

                                            # Broadcast and close
                                            try:
                                                runtime_mgr = (
                                                    get_pokerkit_runtime_manager()
                                                )
                                                final_state = (
                                                    await runtime_mgr.get_state(
                                                        db,
                                                        table.id,
                                                        viewer_user_id=None,
                                                    )
                                                )
                                                final_state["status"] = "ended"
                                                final_state["table_status"] = "ended"
                                                await manager.broadcast(
                                                    table.id, final_state
                                                )
                                            except Exception:
                                                pass

                                            await manager.close_all_connections(
                                                table.id
                                            )

                        except Exception as e:
                            logger.error(
                                "Error checking inactivity for table",
                                table_id=table.id,
                                error=str(e),
                            )

                    await db.commit()
            finally:
                await redis_client.delete(LOCK_KEY)

        except asyncio.CancelledError:
            logger.info("Table inactivity check task cancelled")
            break
        except Exception as e:
            logger.error("Error in table inactivity check task", error=str(e))


async def auto_fold_expired_actions():
    """
    Background task that checks for expired action deadlines and auto-folds.

    Implements Rule C: Per-turn timeout enforcement
    - Timeout #1: auto-check if legal, otherwise auto-fold
    - Timeout #2 (consecutive): always auto-fold

    Production-hardened implementation:
    - Uses distributed lock for multi-worker safety
    - Re-validates all conditions before folding (idempotent)
    - Excludes sit-out players from auto-fold
    - Tracks consecutive timeouts per player in hand
    - Race-safe with proper state checks

    Runs every 2 seconds to check all active tables with pending actions.
    """
    from telegram_poker_bot.shared.database import get_db_session

    LOCK_KEY = "background:auto_fold"
    LOCK_TTL = 5

    logger.info("Auto-fold background task started")

    while True:
        try:
            await asyncio.sleep(2)

            redis_client = await get_redis_client()
            lock_acquired = await redis_client.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL)

            if not lock_acquired:
                logger.debug("Auto-fold lock held by another worker, skipping")
                continue

            try:
                now = datetime.now(timezone.utc)

                async with get_db_session() as db:
                    result = await db.execute(
                        select(Table).where(Table.status == TableStatus.ACTIVE)
                    )
                    active_tables = result.scalars().all()

                    for table in active_tables:
                        try:
                            runtime_mgr = get_pokerkit_runtime_manager()
                            state = await runtime_mgr.get_state(
                                db, table.id, viewer_user_id=None
                            )

                            if not state.get("current_actor"):
                                continue

                            deadline_str = state.get("action_deadline")
                            if not deadline_str:
                                continue

                            try:
                                if deadline_str.endswith("Z"):
                                    deadline = datetime.fromisoformat(
                                        deadline_str.replace("Z", "+00:00")
                                    )
                                else:
                                    deadline = datetime.fromisoformat(deadline_str)

                                if deadline.tzinfo is None:
                                    deadline = deadline.replace(tzinfo=timezone.utc)
                            except (ValueError, AttributeError) as e:
                                logger.warning(
                                    "Failed to parse action_deadline",
                                    table_id=table.id,
                                    deadline_str=deadline_str,
                                    error=str(e),
                                )
                                continue

                            if now < deadline:
                                continue

                            current_actor_user_id = state["current_actor"]

                            result_seats = await db.execute(
                                select(Seat).where(
                                    Seat.table_id == table.id,
                                    Seat.user_id == current_actor_user_id,
                                    Seat.left_at.is_(None),
                                )
                            )
                            actor_seat = result_seats.scalar_one_or_none()

                            if not actor_seat:
                                logger.warning(
                                    "Current actor has no seat",
                                    table_id=table.id,
                                    user_id=current_actor_user_id,
                                )
                                continue

                            if actor_seat.is_sitting_out_next_hand:
                                logger.debug(
                                    "Skipping auto-fold for sitting out player",
                                    table_id=table.id,
                                    user_id=current_actor_user_id,
                                )
                                continue

                            # Get current hand for timeout tracking
                            from telegram_poker_bot.shared.models import Hand

                            hand_result = await db.execute(
                                select(Hand)
                                .where(
                                    Hand.table_id == table.id,
                                    Hand.status != HandStatus.ENDED,
                                )
                                .order_by(Hand.hand_no.desc())
                                .limit(1)
                            )
                            current_hand = hand_result.scalar_one_or_none()

                            if not current_hand:
                                logger.debug(
                                    "No active hand found for timeout",
                                    table_id=table.id,
                                )
                                continue

                            # Check consecutive timeout count
                            timeout_tracking = current_hand.timeout_tracking or {}
                            user_key = str(current_actor_user_id)
                            timeout_count = timeout_tracking.get(user_key, {}).get(
                                "count", 0
                            )

                            # Re-validate current state
                            fresh_state = await runtime_mgr.get_state(
                                db, table.id, viewer_user_id=None
                            )

                            if (
                                fresh_state.get("current_actor")
                                != current_actor_user_id
                            ):
                                logger.debug(
                                    "Actor changed before auto-fold, skipping",
                                    table_id=table.id,
                                    original_actor=current_actor_user_id,
                                    current_actor=fresh_state.get("current_actor"),
                                )
                                continue

                            if fresh_state.get(
                                "status"
                            ) == "waiting" or not fresh_state.get("current_actor"):
                                logger.debug(
                                    "Table no longer active or no actor, skipping",
                                    table_id=table.id,
                                )
                                continue

                            # Determine action based on timeout count and allowed actions
                            # Rule C & Rule 2 (Zombie Cleanup):
                            # - First timeout: check if legal, otherwise fold
                            # - Second+ consecutive timeout: always fold AND set to sit out
                            auto_action = ActionType.FOLD  # Default

                            allowed_actions_raw = fresh_state.get(
                                "allowed_actions", []
                            )
                            allowed_action_types = set()
                            if isinstance(allowed_actions_raw, list):
                                for entry in allowed_actions_raw:
                                    if not isinstance(entry, dict):
                                        continue
                                    action_value = entry.get("action_type")
                                    if action_value:
                                        allowed_action_types.add(action_value.lower())
                            elif isinstance(allowed_actions_raw, dict):
                                action_value = allowed_actions_raw.get("action_type")
                                if action_value:
                                    allowed_action_types.add(action_value.lower())
                            elif isinstance(allowed_actions_raw, str):
                                allowed_action_types.add(allowed_actions_raw.lower())

                            if timeout_count == 0:
                                # First timeout - check if CHECK is legal
                                if "check" in allowed_action_types:
                                    auto_action = ActionType.CHECK
                                    logger.info(
                                        "Auto-checking player (first timeout, check is legal)",
                                        table_id=table.id,
                                        user_id=current_actor_user_id,
                                        deadline=deadline_str,
                                    )
                                else:
                                    logger.info(
                                        "Auto-folding player (first timeout, check not legal)",
                                        table_id=table.id,
                                        user_id=current_actor_user_id,
                                        deadline=deadline_str,
                                    )
                            else:
                                # Consecutive timeout - always fold
                                logger.info(
                                    "Auto-folding player (consecutive timeout)",
                                    table_id=table.id,
                                    user_id=current_actor_user_id,
                                    timeout_count=timeout_count + 1,
                                    deadline=deadline_str,
                                )

                            # Execute auto-action
                            public_state = await runtime_mgr.handle_action(
                                db,
                                table_id=table.id,
                                user_id=current_actor_user_id,
                                action=auto_action,
                                amount=None,
                            )

                            # Update timeout tracking
                            if user_key not in timeout_tracking:
                                timeout_tracking[user_key] = {
                                    "count": 0,
                                    "last_timeout_at": None,
                                }

                            timeout_tracking[user_key]["count"] = timeout_count + 1
                            timeout_tracking[user_key][
                                "last_timeout_at"
                            ] = now.isoformat()
                            current_hand.timeout_tracking = timeout_tracking

                            # Rule 2: After 2nd consecutive timeout, set player to sit out
                            if timeout_count + 1 >= 2:
                                actor_seat.is_sitting_out_next_hand = True
                                logger.info(
                                    "Player set to sit out after consecutive timeouts",
                                    table_id=table.id,
                                    user_id=current_actor_user_id,
                                    timeout_count=timeout_count + 1,
                                )
                                # Broadcast seat update to all clients
                                await manager.broadcast(
                                    table.id,
                                    {
                                        "type": "player_sitout_changed",
                                        "user_id": current_actor_user_id,
                                        "is_sitting_out": True,
                                        "reason": "consecutive_timeouts",
                                    },
                                )

                            table.last_action_at = now
                            await db.flush()

                            await db.commit()
                            await manager.broadcast(table.id, public_state)

                            if public_state.get("inter_hand_wait"):
                                hand_ended_event = public_state.get("hand_ended_event")
                                if hand_ended_event:
                                    await manager.broadcast(table.id, hand_ended_event)
                                _schedule_inter_hand_completion(table.id)

                        except Exception as e:
                            logger.error(
                                "Error auto-folding for table",
                                table_id=table.id,
                                error=str(e),
                            )
                            await db.rollback()
            finally:
                await redis_client.delete(LOCK_KEY)

        except asyncio.CancelledError:
            logger.info("Auto-fold background task cancelled")
            break
        except Exception as e:
            logger.error("Error in auto-fold background task", error=str(e))


@api_app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup."""
    global _auto_fold_task, _inactivity_check_task
    _auto_fold_task = asyncio.create_task(auto_fold_expired_actions())
    _inactivity_check_task = asyncio.create_task(check_table_inactivity())
    logger.info("Started background tasks: auto-fold and inactivity check")


@api_app.on_event("shutdown")
async def shutdown_event():
    """Clean up background tasks on application shutdown."""
    global _auto_fold_task, _inactivity_check_task

    if _auto_fold_task:
        _auto_fold_task.cancel()
        try:
            await _auto_fold_task
        except asyncio.CancelledError:
            pass

    if _inactivity_check_task:
        _inactivity_check_task.cancel()
        try:
            await _inactivity_check_task
        except asyncio.CancelledError:
            pass

    logger.info("Stopped background tasks")


def verify_telegram_init_data(init_data: str) -> Optional[UserAuth]:
    """
    Verify Telegram Mini App init data.

    Design Note:
    - Validates Telegram WebApp initData signature
    - Extracts user information securely
    - Returns UserAuth if valid, None otherwise
    """
    try:
        if not init_data:
            return None

        params = dict(parse_qsl(init_data, keep_blank_values=True))

        # Verify hash
        hash_value = params.pop("hash", None)
        if not hash_value:
            return None

        # Create data check string
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))

        # Calculate secret key
        secret_key = hmac.new(
            "WebAppData".encode(), settings.telegram_bot_token.encode(), hashlib.sha256
        ).digest()

        # Verify signature
        calculated_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if calculated_hash != hash_value:
            logger.warning("Invalid Telegram init data hash")
            return None

        # Parse user data
        user_raw = params.get("user")
        user_data = json.loads(user_raw or "{}")
        user_id = user_data.get("id")
        if user_id is None:
            return None
        return UserAuth(
            user_id=user_id,
            username=user_data.get("username"),
            first_name=user_data.get("first_name"),
            last_name=user_data.get("last_name"),
            language_code=user_data.get("language_code"),
        )
    except Exception as e:
        logger.error("Error verifying Telegram init data", error=str(e))
        return None


@lru_cache()
def get_bot_client() -> Bot:
    """Return a cached Telegram Bot client for outbound notifications."""
    return Bot(token=settings.telegram_bot_token)


def build_group_deep_link(game_id: str) -> str:
    """Compose Telegram deep link for adding the bot to a group."""
    return f"https://t.me/{settings.bot_username_clean}?startgroup={game_id}"


def build_startapp_link(game_id: str) -> str:
    """Compose Telegram deep link for opening the mini app with a payload."""
    return f"https://t.me/{settings.bot_username_clean}?startapp={game_id}"


def sanitize_language(code: Optional[str]) -> str:
    """Normalize Telegram language codes."""
    if not code:
        return "en"
    return code.split("-")[0].lower()


async def find_user_by_tg_id(db: AsyncSession, tg_user_id: int) -> Optional[User]:
    """Fetch user by Telegram identifier."""
    result = await db.execute(select(User).where(User.tg_user_id == tg_user_id))
    return result.scalar_one_or_none()


async def ensure_user(db: AsyncSession, auth: UserAuth) -> User:
    """Fetch existing user or create a new record based on Telegram data."""
    normalized_language = sanitize_language(auth.language_code)

    user = await find_user_by_tg_id(db, auth.user_id)

    if not user:
        user = User(
            tg_user_id=auth.user_id,
            username=auth.username,
            language=normalized_language or "en",
        )
        db.add(user)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            # Another request created the user concurrently; fetch the existing row.
            user = await find_user_by_tg_id(db, auth.user_id)
            if not user:
                raise

    updated = False
    if auth.username and user.username != auth.username:
        user.username = auth.username
        updated = True
    if normalized_language and user.language != normalized_language:
        user.language = normalized_language
        updated = True
    if updated:
        await db.flush()

    return user


async def send_invite_share_message(
    *,
    user: User,
    deep_link: str,
    language: Optional[str] = None,
) -> None:
    """Send the shareable invite message to the creator via Telegram."""
    language_code = sanitize_language(language or user.language)
    translator = get_translation(language_code)
    text = f"{translator('group_invite_share_message')}\n\n{deep_link}"
    button_text = translator("group_invite_share_button")
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text=button_text, url=deep_link)]]
    )

    bot = get_bot_client()
    try:
        await bot.send_message(
            chat_id=user.tg_user_id,
            text=text,
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
        logger.info(
            "Sent group invite share message",
            user_id=user.tg_user_id,
            deep_link=deep_link,
        )
    except TelegramError as exc:
        logger.warning(
            "Failed to send group invite share message",
            user_id=user.tg_user_id,
            error=str(exc),
        )


@api_app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "api"}


@api_app.get("/users/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Return registration status for the current Telegram user."""
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Telegram init data",
        )

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data",
        )

    user = await find_user_by_tg_id(db, auth.user_id)
    language = sanitize_language(auth.language_code)

    if not user:
        return UserProfileResponse(
            registered=False,
            user_id=None,
            username=auth.username,
            language=language,
            first_name=auth.first_name,
            last_name=auth.last_name,
        )

    return UserProfileResponse(
        registered=True,
        user_id=user.id,
        username=user.username or auth.username,
        language=user.language,
        first_name=auth.first_name,
        last_name=auth.last_name,
    )


@api_app.post("/users/register", response_model=UserProfileResponse)
async def register_current_user(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Ensure the Telegram user has a persisted profile."""
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Telegram init data",
        )

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data",
        )

    user = await ensure_user(db, auth)
    language = user.language or sanitize_language(auth.language_code)

    return UserProfileResponse(
        registered=True,
        user_id=user.id,
        username=user.username or auth.username,
        language=language,
        first_name=auth.first_name,
        last_name=auth.last_name,
    )


@api_app.post(
    "/group-games/invites",
    response_model=GroupInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_group_game_invite(
    small_blind: int = 25,
    big_blind: int = 50,
    starting_stack: int = 10000,
    max_players: int = 8,
    table_name: Optional[str] = None,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new Telegram group invite link for poker tables.

    This creates an invite that users can share to groups, allowing friends
    to join a specific poker table with configured stakes.
    """
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Telegram init data",
        )

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data",
        )

    user = await ensure_user(db, auth)
    language = user.language or sanitize_language(auth.language_code)

    token_length = token_length_for_ttl(settings.group_invite_ttl_seconds)
    game_id = await generate_unique_game_id(db, token_length=token_length)
    deep_link = build_group_deep_link(game_id)
    startapp_link = build_startapp_link(game_id)

    # Create a table for this invite
    table = await table_service.create_private_table(
        db,
        creator_user_id=user.id,
        small_blind=small_blind,
        big_blind=big_blind,
        starting_stack=starting_stack,
        max_players=max_players,
        table_name=table_name or f"{auth.first_name or auth.username}'s Table",
    )

    metadata = {
        "creator_username": auth.username,
        "creator_first_name": auth.first_name,
        "creator_last_name": auth.last_name,
        "language": language,
        "table_id": table.id,
        "small_blind": small_blind,
        "big_blind": big_blind,
        "starting_stack": starting_stack,
        "max_players": max_players,
        "table_name": table_name,
    }

    invite = await create_invite(
        db,
        creator_user_id=user.id,
        deep_link=deep_link,
        ttl_seconds=settings.group_invite_ttl_seconds,
        metadata=metadata,
        game_id=game_id,
        table_id=table.id,
    )

    await db.commit()

    await send_invite_share_message(
        user=user,
        deep_link=deep_link,
        language=language,
    )

    return GroupInviteResponse(
        game_id=invite.game_id,
        deep_link=deep_link,
        startapp_link=startapp_link,
        expires_at=invite.expires_at,
        status=invite.status.value,
    )


@api_app.get(
    "/group-games/invites/{game_id}",
    response_model=GroupInviteStatusResponse,
)
async def get_group_game_invite(
    game_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve public metadata about a group game invite.

    Includes table configuration and current player count.
    """
    invite = await fetch_invite_by_game_id(db, game_id)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    # Get table info if available
    table_id = invite.metadata_json.get("table_id")
    group_title = None

    if table_id:
        try:
            table_info = await table_service.get_table_info(db, table_id)
            group_title = table_info.get("table_name")
        except ValueError:
            pass  # Table no longer exists
    elif invite.group_id:
        result = await db.execute(select(Group).where(Group.id == invite.group_id))
        group = result.scalar_one_or_none()
        if group:
            group_title = group.title

    return GroupInviteStatusResponse(
        game_id=invite.game_id,
        deep_link=invite.deep_link,
        status=invite.status.value,
        expires_at=invite.expires_at,
        group_id=invite.group_id,
        group_title=group_title,
    )


@api_app.post(
    "/group-games/invites/{game_id}/attend",
    response_model=GroupInviteJoinResponse,
)
async def attend_group_game_invite(
    game_id: str,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Signal the user's intent to join the specified group invite.

    This endpoint handles seating the user at the table associated with the invite.
    """
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Telegram init data",
        )

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data",
        )

    user = await ensure_user(db, auth)
    invite = await fetch_invite_by_game_id(db, game_id)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    language = user.language or sanitize_language(auth.language_code)
    translator = get_translation(language)

    # Check invite status
    if invite.status == GroupGameInviteStatus.EXPIRED:
        return GroupInviteJoinResponse(
            game_id=invite.game_id,
            status=invite.status.value,
            message=translator("group_invite_join_expired"),
            group_title=None,
        )

    if invite.status == GroupGameInviteStatus.CONSUMED:
        return GroupInviteJoinResponse(
            game_id=invite.game_id,
            status=invite.status.value,
            message=translator("group_invite_join_consumed"),
            group_title=None,
        )

    # Get table from invite metadata
    table_id = invite.metadata_json.get("table_id")
    if not table_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No table associated with invite",
        )

    # Attempt to seat user at table
    try:
        seat = await table_service.seat_user_at_table(db, table_id, user.id)
        await db.commit()

        # Get table info
        table_info = await table_service.get_table_info(db, table_id)

        message = translator(
            "group_invite_seat_success",
            table_name=table_info.get("table_name", f"Table #{table_id}"),
            position=seat.position + 1,
            chips=seat.chips,
        )

        return GroupInviteJoinResponse(
            game_id=invite.game_id,
            status="seated",
            message=message,
            group_title=table_info.get("group_title"),
        )
    except ValueError as e:
        # User already seated or table full
        await db.rollback()
        return GroupInviteJoinResponse(
            game_id=invite.game_id,
            status="error",
            message=str(e),
            group_title=None,
        )


@api_app.get("/tables/{table_id}")
async def get_table(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get table information."""
    viewer_user_id: Optional[int] = None
    if x_telegram_init_data:
        auth = verify_telegram_init_data(x_telegram_init_data)
        if not auth:
            raise HTTPException(status_code=401, detail="Invalid Telegram init data")
        viewer = await ensure_user(db, auth)
        viewer_user_id = viewer.id

    try:
        table_info = await table_service.get_table_info(
            db,
            table_id,
            viewer_user_id=viewer_user_id,
        )
        return table_info
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_app.get("/tables/{table_id}/status")
async def get_table_status(
    table_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Check if a table is active.

    Returns:
        {"active": true} if table exists and is in ACTIVE or WAITING status
        {"active": false} otherwise

    This endpoint does not require authentication and is used by the frontend
    to validate whether tables are still active before displaying them.
    """
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()

    if not table:
        return {"active": False}

    # Consider ACTIVE and WAITING tables as active
    # PAUSED, ENDED, and EXPIRED are considered inactive
    is_active = table.status in [TableStatus.ACTIVE, TableStatus.WAITING]

    return {"active": is_active}


@api_app.get("/tables")
async def list_tables(
    mode: Optional[str] = None,
    limit: int = 20,
    scope: str = Query(
        "public",
        description="Scope for table visibility: public, all, or mine.",
    ),
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """List available tables."""
    game_mode = None
    if mode:
        try:
            game_mode = GameMode(mode)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")

    viewer_user_id: Optional[int] = None
    if x_telegram_init_data:
        auth = verify_telegram_init_data(x_telegram_init_data)
        if not auth:
            raise HTTPException(status_code=401, detail="Invalid Telegram init data")
        viewer = await ensure_user(db, auth)
        viewer_user_id = viewer.id

    normalized_scope = (scope or "public").strip().lower()
    redis_client = None
    if normalized_scope == "public":
        try:
            matchmaking_pool = await get_matchmaking_pool()
            redis_client = matchmaking_pool.redis
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Redis unavailable for public table cache", error=str(exc))

    try:
        tables = await table_service.list_available_tables(
            db,
            limit=limit,
            mode=game_mode,
            viewer_user_id=viewer_user_id,
            scope=normalized_scope,
            redis_client=redis_client,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"tables": tables}


@api_app.get("/games/join", include_in_schema=False)
async def redirect_games_join(code: Optional[str] = Query(default=None)):
    """Redirect legacy join links to the mini app frontend.

    Players often share invite links that point directly at the API service
    (e.g. ``/games/join?code=ABCD12``). When accessed via the public domain the
    Nginx proxy routes the request to the frontend, but direct hits to the API
    container return 404. This redirect keeps those links working by sending
    visitors to the mini app URL, preserving the invite code when present.
    """

    target = f"{settings.mini_app_url.rstrip('/')}/games/join"

    if code:
        normalized = table_service.normalize_invite_code(code)
        if normalized:
            target = f"{target}?code={normalized}"

    return RedirectResponse(url=target, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@api_app.post("/tables/join-by-invite")
async def join_table_by_invite(
    payload: JoinByInviteRequest,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Join a private table using an invite code."""

    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)
    normalized_code = table_service.normalize_invite_code(payload.invite_code)

    try:
        table, seat, seat_error = await table_service.seat_user_by_invite_code(
            db,
            normalized_code,
            user.id,
        )
        table_info = await table_service.get_table_info(
            db,
            table.id,
            viewer_user_id=user.id,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(exc))

    status_value = "seated" if seat else "joined"
    message = (
        seat_error
        or f"Joined {table_info.get('table_name', f'Table #{table.id}') or f'Table #{table.id}'}"
    )

    if seat_error:
        lower_error = seat_error.lower()
        if "already seated" in lower_error:
            status_value = "already_seated"
        elif "full" in lower_error:
            status_value = "full"
        else:
            status_value = "pending"

    return {
        "table_id": table.id,
        "status": status_value,
        "message": message,
        "table": table_info,
    }


@api_app.post("/tables", status_code=status.HTTP_201_CREATED)
async def create_table(
    payload: Optional[TableCreateRequest] = Body(None),
    small_blind: Optional[int] = Query(default=None, ge=1),
    big_blind: Optional[int] = Query(default=None, ge=1),
    starting_stack: Optional[int] = Query(default=None, ge=1),
    max_players: Optional[int] = Query(default=None, ge=2, le=9),
    table_name: Optional[str] = Query(default=None),
    visibility: Optional[str] = Query(
        default=None, description="Table visibility: public or private"
    ),
    is_private: Optional[bool] = Query(
        default=None, description="Legacy flag for privacy"
    ),
    auto_seat_host: Optional[bool] = Query(
        default=None, description="Whether to seat the creator immediately"
    ),
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Create a new poker table (public or private)."""

    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    request_data = payload or TableCreateRequest()

    updates: Dict[str, Any] = {}
    numeric_overrides = {
        "small_blind": small_blind,
        "big_blind": big_blind,
        "starting_stack": starting_stack,
        "max_players": max_players,
    }
    for field_name, value in numeric_overrides.items():
        if value is not None:
            updates[field_name] = value

    if table_name is not None:
        updates["table_name"] = table_name

    visibility_override = None
    if visibility is not None:
        visibility_override = visibility.strip().lower()
    elif is_private is not None:
        visibility_override = "private" if is_private else "public"

    if visibility_override:
        if visibility_override not in {"public", "private"}:
            raise HTTPException(
                status_code=400, detail=f"Invalid visibility: {visibility_override}"
            )
        updates["visibility"] = (
            TableVisibility.PUBLIC
            if visibility_override == "public"
            else TableVisibility.PRIVATE
        )

    if auto_seat_host is not None:
        updates["auto_seat_host"] = auto_seat_host

    if updates:
        if hasattr(request_data, "model_copy"):
            request_data = request_data.model_copy(update=updates)  # type: ignore[attr-defined]
        else:  # pragma: no cover - Pydantic v1 fallback
            request_data = request_data.copy(update=updates)

    private_flag = request_data.visibility is TableVisibility.PRIVATE
    auto_seat = (
        request_data.auto_seat_host
        if request_data.auto_seat_host is not None
        else not private_flag
    )

    table = await table_service.create_table_with_config(
        db,
        creator_user_id=user.id,
        small_blind=request_data.small_blind,
        big_blind=request_data.big_blind,
        starting_stack=request_data.starting_stack,
        max_players=request_data.max_players,
        table_name=request_data.table_name,
        is_private=private_flag,
        auto_seat_creator=auto_seat,
    )

    await db.commit()

    try:
        matchmaking_pool = await get_matchmaking_pool()
        await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            "Failed to invalidate public table cache after create", error=str(exc)
        )

    table_info = await table_service.get_table_info(
        db,
        table.id,
        viewer_user_id=user.id,
    )
    return table_info


@api_app.post("/tables/{table_id}/sit")
async def sit_at_table(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Sit at a table."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    try:
        seat = await table_service.seat_user_at_table(db, table_id, user.id)

        result = await db.execute(select(Table).where(Table.id == table_id))
        table = result.scalar_one_or_none()
        if table:
            table.last_action_at = datetime.now(timezone.utc)

        await db.commit()

        # CRITICAL FIX: Broadcast FULL table state to all clients
        # This ensures all connected clients see the new player immediately
        try:
            runtime_mgr = get_pokerkit_runtime_manager()
            full_state = await runtime_mgr.get_state(db, table_id, viewer_user_id=None)
            await manager.broadcast(table_id, full_state)
        except Exception as broadcast_err:
            logger.error(
                "Failed to broadcast state after seat",
                table_id=table_id,
                user_id=user.id,
                error=str(broadcast_err),
            )

        try:
            matchmaking_pool = await get_matchmaking_pool()
            await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
        except Exception as exc:
            logger.warning(
                "Failed to invalidate public table cache after seat", error=str(exc)
            )

        return {
            "success": True,
            "table_id": table_id,
            "position": seat.position,
            "chips": seat.chips,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_app.post("/tables/{table_id}/leave")
async def leave_table(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Leave a table by releasing the current player's seat."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    try:
        await table_service.leave_table(db, table_id, user.id)

        result = await db.execute(select(Table).where(Table.id == table_id))
        table = result.scalar_one_or_none()
        if table:
            table.last_action_at = datetime.now(timezone.utc)

        await db.commit()

        # Broadcast full state after player leaves
        try:
            runtime_mgr = get_pokerkit_runtime_manager()
            full_state = await runtime_mgr.get_state(db, table_id, viewer_user_id=None)
            await manager.broadcast(table_id, full_state)
        except Exception as broadcast_err:
            logger.error(
                "Failed to broadcast state after leave",
                table_id=table_id,
                user_id=user.id,
                error=str(broadcast_err),
            )

        try:
            matchmaking_pool = await get_matchmaking_pool()
            await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
        except Exception as exc:
            logger.warning(
                "Failed to invalidate public table cache after leave", error=str(exc)
            )
        return {"success": True, "table_id": table_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_app.post("/tables/{table_id}/sitout")
async def toggle_sitout(
    table_id: int,
    request: SitOutRequest,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table_id,
            Seat.user_id == user.id,
            Seat.left_at.is_(None),
        )
    )
    seat = result.scalar_one_or_none()

    if not seat:
        raise HTTPException(status_code=400, detail="Not seated at this table")

    seat.is_sitting_out_next_hand = request.sit_out

    table_result = await db.execute(select(Table).where(Table.id == table_id))
    table = table_result.scalar_one_or_none()
    if table:
        table.last_action_at = datetime.now(timezone.utc)

    await db.commit()

    await manager.broadcast(
        table_id,
        {
            "type": "player_sitout_changed",
            "user_id": user.id,
            "is_sitting_out": request.sit_out,
        },
    )

    return {"success": True, "is_sitting_out_next_hand": request.sit_out}


@api_app.post("/tables/{table_id}/ready")
async def mark_ready(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Mark the current player as ready for the next hand."""

    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    runtime_mgr = get_pokerkit_runtime_manager()

    try:
        ready_info = await runtime_mgr.mark_player_ready(db, table_id, user.id)
    except ValueError as exc:
        message = str(exc)
        if "Insufficient balance" in message:
            message = "Insufficient Balance"
        raise HTTPException(status_code=400, detail=message)

    await manager.broadcast(
        table_id,
        {
            "type": "player_ready",
            "user_id": user.id,
            "ready_players": ready_info.get("ready_players", []),
        },
    )

    all_ready = set(ready_info.get("ready_players", [])) >= set(
        ready_info.get("seated_user_ids", [])
    )

    if all_ready:
        _cancel_inter_hand_task(table_id)
        result = await runtime_mgr.complete_inter_hand_phase(db, table_id)
        await db.commit()
        await _handle_inter_hand_result(table_id, result)

        if result.get("table_ended"):
            return {"table_ended": True, "reason": result.get("reason")}

        return result.get("state", {})

    return {"ready_players": ready_info.get("ready_players", [])}


@api_app.post("/tables/{table_id}/start")
async def start_table(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Allow the table host to start the game."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    try:
        await table_service.start_table(db, table_id, user_id=user.id)
        state = await get_pokerkit_runtime_manager().start_game(db, table_id)
        await db.commit()

        await manager.broadcast(table_id, state)

        logger.info(
            "Game started and broadcasted", table_id=table_id, started_by=user.id
        )

    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        matchmaking_pool = await get_matchmaking_pool()
        await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            "Failed to invalidate public table cache after start", error=str(exc)
        )

    # Return viewer-specific state (with hero cards) to the caller
    viewer_state = await get_pokerkit_runtime_manager().get_state(db, table_id, user.id)
    # Preserve hand_result if present in the broadcast payload
    if state.get("hand_result"):
        viewer_state["hand_result"] = state["hand_result"]

    return viewer_state


@api_app.post("/tables/{table_id}/next-hand")
async def start_next_hand(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Start the next hand after the inter-hand ready phase.

    This endpoint:
    1. Validates minimum player count (>= 2 active non-sitting-out players)
    2. Checks each player's balance against requirements
    3. Sets players with insufficient balance to sitting_out
    4. Marks table as expired if < 2 active players remain after balance checks
    5. Starts the next hand if all conditions are met
    """
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    user_auth = verify_telegram_init_data(x_telegram_init_data)
    if not user_auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, user_auth)

    try:
        result = await get_pokerkit_runtime_manager().complete_inter_hand_phase(
            db, table_id
        )
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await _handle_inter_hand_result(table_id, result)

    if result.get("table_ended"):
        return {"table_ended": True, "reason": result.get("reason")}

    viewer_state = await get_pokerkit_runtime_manager().get_state(db, table_id, user.id)
    return viewer_state


@api_app.get("/tables/{table_id}/state")
async def get_table_state(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    viewer_id: Optional[int] = None
    if x_telegram_init_data:
        auth = verify_telegram_init_data(x_telegram_init_data)
        if auth:
            user = await ensure_user(db, auth)
            viewer_id = user.id
    try:
        state = await get_pokerkit_runtime_manager().get_state(db, table_id, viewer_id)
        return state
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@api_app.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table(
    table_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a table (host only).

    Behavior:
    - Only the table creator (host) can delete the table
    - Closes all WebSocket connections for this table
    - Marks the table as ENDED (soft-delete)
    - Invalidates the public table cache
    - Returns 204 No Content on success

    Status codes:
    - 204: Table deleted successfully
    - 401: Missing or invalid authentication
    - 403: User is not the table creator
    - 404: Table not found
    """
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Telegram init data",
        )

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data",
        )

    user = await ensure_user(db, auth)

    # Load table from database
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Table not found"
        )

    # Check permissions: only the creator (host) can delete
    config = table.config_json or {}
    creator_user_id = table.creator_user_id or config.get("creator_user_id")

    if creator_user_id is None or creator_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the table creator can delete this table",
        )

    _cancel_inter_hand_task(table_id)

    # Close all WebSocket connections for this table
    await manager.close_all_connections(table_id)

    # Mark table as ENDED (soft-delete) instead of hard deletion
    # This preserves historical data while making the table inactive
    table.status = TableStatus.ENDED
    table.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Table deleted",
        table_id=table_id,
        deleted_by=user.id,
        creator_user_id=creator_user_id,
    )

    await db.commit()

    # Invalidate public table cache
    try:
        matchmaking_pool = await get_matchmaking_pool()
        await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            "Failed to invalidate public table cache after delete", error=str(exc)
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@api_app.get("/users/me/stats")
async def get_my_stats(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's statistics from pre-aggregated UserPokerStats table."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)
    # Use optimized aggregated stats instead of runtime queries
    stats = await user_service.get_user_stats_from_aggregated(db, user.id)

    return stats


@api_app.get("/users/me/balance")
async def get_my_balance(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's chip balance."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    # Use wallet_service to get balance
    from telegram_poker_bot.shared.services.wallet_service import get_wallet_balance

    balance = await get_wallet_balance(db, user.id)

    return {"balance": balance}


@api_app.get("/users/me/transactions")
async def get_my_transactions(
    x_telegram_init_data: Optional[str] = Header(None),
    limit: int = Query(
        50, ge=1, le=100, description="Number of transactions to return"
    ),
    offset: int = Query(0, ge=0, description="Number of transactions to skip"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's transaction history.

    Returns paginated list of transactions ordered by created_at desc.
    """
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    # Get transaction history using wallet_service
    from telegram_poker_bot.shared.services.wallet_service import (
        get_transaction_history,
    )

    transactions = await get_transaction_history(
        db, user.id, limit=limit, offset=offset
    )

    # Format transactions for response
    transactions_data = [
        {
            "id": t.id,
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "amount": t.amount,
            "balance_after": t.balance_after,
            "reference_id": t.reference_id,
            "metadata": t.metadata_json or {},
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in transactions
    ]

    return {
        "transactions": transactions_data,
        "count": len(transactions_data),
        "limit": limit,
        "offset": offset,
    }


@api_app.get("/users/me/avatar")
async def get_my_avatar(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Generate and return the current user's avatar image."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)

    # Generate avatar
    avatar_bytes = generate_avatar(
        user_id=user.id,
        username=user.username or auth.username or auth.first_name,
        size=256,
    )

    # Return as PNG image with caching headers
    return Response(
        content=avatar_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "ETag": f"avatar-{user.id}-v1",
        },
    )


@api_app.get("/users/me/tables")
async def get_my_tables(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's active tables."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)
    tables = await user_service.get_active_tables(db, user.id)

    return {"tables": tables}


@api_app.get("/users/me/history")
async def get_my_history(
    limit: int = 10,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's game history."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)
    games = await user_service.get_recent_games(db, user.id, limit=limit)

    return {"games": games}


@api_app.post("/tables/{table_id}/actions")
async def submit_action(
    table_id: int,
    action: ActionRequest,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Submit a poker action."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")

    user_auth = verify_telegram_init_data(x_telegram_init_data)
    if not user_auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")

    user = await ensure_user(db, user_auth)

    runtime_mgr = get_pokerkit_runtime_manager()

    try:
        action_type = ActionType(action.action_type.lower())
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid action type: {action.action_type}"
        )

    try:
        if action_type == ActionType.READY:
            try:
                ready_info = await runtime_mgr.mark_player_ready(
                    db, table_id, user.id
                )
            except ValueError as exc:
                message = str(exc)
                if "Insufficient balance" in message:
                    message = "Insufficient Balance"
                raise HTTPException(status_code=400, detail=message)

            await manager.broadcast(
                table_id,
                {
                    "type": "player_ready",
                    "user_id": user.id,
                    "ready_players": ready_info.get("ready_players", []),
                },
            )

            ready_players = set(ready_info.get("ready_players", []))
            seated_ids = set(ready_info.get("seated_user_ids", []))
            if seated_ids and ready_players >= seated_ids:
                _cancel_inter_hand_task(table_id)
                result = await runtime_mgr.complete_inter_hand_phase(db, table_id)
                await db.commit()
                await _handle_inter_hand_result(table_id, result)

                if result.get("table_ended"):
                    return {
                        "table_ended": True,
                        "reason": result.get("reason"),
                    }

                viewer_state = await runtime_mgr.get_state(db, table_id, user.id)
                next_state = result.get("state", {}) if result else {}
                if next_state.get("hand_result"):
                    viewer_state["hand_result"] = next_state["hand_result"]

                return viewer_state

            return await runtime_mgr.get_state(db, table_id, user.id)

        public_state = await runtime_mgr.handle_action(
            db,
            table_id=table_id,
            user_id=user.id,
            action=action_type,
            amount=action.amount,
        )

        await manager.broadcast(table_id, public_state)

        if public_state.get("inter_hand_wait"):
            # Broadcast the unified hand_ended event from _apply_hand_result_and_cleanup
            # This is the SINGLE SOURCE OF TRUTH for hand completion broadcasts
            hand_ended_event = public_state.get("hand_ended_event")
            if hand_ended_event:
                await manager.broadcast(table_id, hand_ended_event)
            _schedule_inter_hand_completion(table_id)

        viewer_state = await runtime_mgr.get_state(db, table_id, user.id)
        if public_state.get("hand_result"):
            viewer_state["hand_result"] = public_state["hand_result"]

        return viewer_state
    except NoActorToActError:
        raise HTTPException(
            status_code=400,
            detail="No player to act; hand is complete or waiting for next hand.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error processing action",
            table_id=table_id,
            user_id=user.id,
            action_type=action_type.value,
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))


@api_app.get("/tables/{table_id}/hands")
async def get_table_hand_history(
    table_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get hand history summaries for a table."""
    from telegram_poker_bot.shared.models import HandHistory

    result = await db.execute(
        select(HandHistory)
        .where(HandHistory.table_id == table_id)
        .order_by(HandHistory.hand_no.desc())
        .limit(limit)
    )
    histories = result.scalars().all()

    return {
        "hands": [
            {
                "hand_no": h.hand_no,
                "board": h.payload_json.get("board", []),
                "winners": h.payload_json.get("winners", []),
                "pot_total": h.payload_json.get("pot_total", 0),
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in histories
        ]
    }


@api_app.get("/hands/{hand_id}/history")
async def get_hand_detailed_history(
    hand_id: int,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed action timeline for a specific hand."""
    from telegram_poker_bot.shared.models import Hand, HandHistoryEvent, User

    # Get hand details
    hand_result = await db.execute(select(Hand).where(Hand.id == hand_id))
    hand = hand_result.scalar_one_or_none()
    if not hand:
        raise HTTPException(status_code=404, detail="Hand not found")

    # Get hand history events
    events_result = await db.execute(
        select(HandHistoryEvent)
        .where(HandHistoryEvent.hand_id == hand_id)
        .order_by(HandHistoryEvent.sequence.asc())
    )
    events = events_result.scalars().all()

    # Get usernames for actors
    user_ids = {e.actor_user_id for e in events if e.actor_user_id}
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u.username for u in users_result.scalars().all()}

    return {
        "hand": {
            "hand_id": hand.id,
            "hand_no": hand.hand_no,
            "table_id": hand.table_id,
            "started_at": hand.started_at.isoformat() if hand.started_at else None,
            "ended_at": hand.ended_at.isoformat() if hand.ended_at else None,
        },
        "events": [
            {
                "id": e.id,
                "sequence": e.sequence,
                "street": e.street,
                "action_type": e.action_type,
                "actor_user_id": e.actor_user_id,
                "actor_display_name": users.get(e.actor_user_id),
                "amount": e.amount,
                "pot_size": e.pot_size,
                "board_cards": e.board_cards,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


@api_app.get("/users/me/hands")
async def get_user_hands(
    limit: int = Query(default=20, ge=1, le=100),
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get recent hands for the current user."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Unauthorized")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid authentication")

    user = await ensure_user(db, auth)

    from telegram_poker_bot.shared.models import HandHistory, Seat

    # Find hands where user was seated
    result = await db.execute(
        select(HandHistory)
        .join(Seat, Seat.table_id == HandHistory.table_id)
        .where(Seat.user_id == user.id)
        .order_by(HandHistory.created_at.desc())
        .limit(limit)
        .distinct()
    )
    histories = result.scalars().all()

    return {
        "hands": [
            {
                "hand_no": h.hand_no,
                "table_id": h.table_id,
                "board": h.payload_json.get("board", []),
                "winners": h.payload_json.get("winners", []),
                "pot_total": h.payload_json.get("pot_total", 0),
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in histories
        ]
    }


@api_app.websocket("/ws/{table_id}")
async def websocket_endpoint(websocket: WebSocket, table_id: int):
    """
    WebSocket endpoint for real-time table updates.

    Path: /ws/{table_id}
    - Frontend connects to this endpoint for live table updates
    - Example: /ws/5 connects to table ID 5
    - Upgrades HTTP GET request to WebSocket connection (101 Switching Protocols)

    Design Note:
    - Maintains persistent connection for live updates
    - Broadcasts state changes to all connected clients
    - Handles disconnections gracefully
    - Connections are automatically closed when table is deleted
    - Implements ping/pong heartbeat to keep connection alive
    """
    await manager.connect(websocket, table_id)

    # Task for sending periodic pings to keep connection alive
    ping_task = None

    async def send_pings():
        """Send ping messages every 30 seconds to prevent timeout."""
        try:
            while True:
                await asyncio.sleep(30)
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception as e:
                    logger.debug("Ping send failed", table_id=table_id, error=str(e))
                    break
        except asyncio.CancelledError:
            pass

    try:
        # Start ping task
        ping_task = asyncio.create_task(send_pings())

        while True:
            try:
                # Keep connection alive and handle incoming messages
                data = await websocket.receive_text()

                # Parse message
                try:
                    message = json.loads(data) if data else {}
                    msg_type = (
                        message.get("type") if isinstance(message, dict) else None
                    )

                    # Handle pong responses
                    if msg_type == "pong":
                        logger.debug("Received pong from client", table_id=table_id)
                        continue

                    # Echo back or acknowledge other messages
                    await websocket.send_json({"type": "ack", "data": data})
                except json.JSONDecodeError:
                    # Non-JSON messages - just echo back
                    await websocket.send_json({"type": "pong", "data": data})

            except WebSocketDisconnect:
                # Normal disconnect from client
                logger.info("WebSocket client disconnected normally", table_id=table_id)
                break
            except Exception as e:
                # Log error but keep connection alive for recoverable errors
                logger.warning(
                    "WebSocket receive error (continuing)",
                    table_id=table_id,
                    error=str(e),
                    error_type=type(e).__name__,
                )
                # Only break on critical errors
                if isinstance(e, (ConnectionError, RuntimeError)):
                    break
                # Otherwise continue the loop
                await asyncio.sleep(0.1)

    except Exception as e:
        logger.error("WebSocket fatal error", table_id=table_id, error=str(e))
    finally:
        # Cancel ping task
        if ping_task:
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass

        # Disconnect from manager
        manager.disconnect(websocket, table_id)
        logger.info("WebSocket connection closed", table_id=table_id)


_api_path_prefix = _derive_api_path_prefix(settings.vite_api_url)
mount_targets = {"/"}

if _api_path_prefix:
    mount_targets.add(_api_path_prefix)
else:
    mount_targets.add(DEFAULT_API_PREFIX)

if len(mount_targets) == 1:
    app = api_app
else:
    logger.info(
        "Mounting API under multiple prefixes",
        prefixes=sorted(mount_targets),
    )
    container_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    # Mount longer paths first so more specific prefixes take precedence.
    for prefix in sorted(mount_targets, key=len, reverse=True):
        container_app.mount(prefix, api_app)

    # Register WebSocket endpoint directly on container app to ensure it's accessible
    # WebSocket connections don't work properly when only registered in mounted sub-apps
    @container_app.websocket("/ws/{table_id}")
    async def container_websocket_endpoint(websocket: WebSocket, table_id: int):
        """WebSocket endpoint registered on container app for proper routing."""
        await websocket_endpoint(websocket, table_id)

    app = container_app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
