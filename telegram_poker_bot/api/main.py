"""FastAPI service for Mini App - REST + WebSocket API."""

from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional, List, Dict, Any
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
from sqlalchemy.ext.asyncio import AsyncSession

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.models import (
    Table,
    Hand,
    Action,
    ActionType,
    User,
    Group,
    GroupGameInviteStatus,
    TableStatus,
)
from telegram_poker_bot.shared.types import GameMode, TableCreateRequest, TableVisibility
from telegram_poker_bot.shared.services.group_invites import (
    create_invite,
    fetch_invite_by_game_id,
    generate_unique_game_id,
    token_length_for_ttl,
)
from telegram_poker_bot.shared.services import user_service, table_service
from telegram_poker_bot.shared.services.avatar_service import generate_avatar
from telegram_poker_bot.bot.i18n import get_translation
from telegram_poker_bot.game_core import TableManager, get_matchmaking_pool

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
    allow_origins=settings.cors_origins.split(",") if "," in settings.cors_origins else [settings.cors_origins],
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


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}  # table_id -> [websockets]
    
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
        if table_id in self.active_connections:
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
    
    async def close_all_connections(self, table_id: int):
        """Close all WebSocket connections for a table (e.g., when table is deleted)."""
        if table_id not in self.active_connections:
            return
        
        connections = self.active_connections[table_id].copy()
        for connection in connections:
            try:
                await connection.close()
            except Exception as e:
                logger.warning("Error closing WebSocket connection", table_id=table_id, error=str(e))
        
        # Clear all connections for this table
        if table_id in self.active_connections:
            del self.active_connections[table_id]
        
        logger.info("Closed all WebSocket connections", table_id=table_id, count=len(connections))


manager = ConnectionManager()


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
            "WebAppData".encode(),
            settings.telegram_bot_token.encode(),
            hashlib.sha256
        ).digest()
        
        # Verify signature
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
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
    user = await find_user_by_tg_id(db, auth.user_id)
    normalized_language = sanitize_language(auth.language_code)

    if user:
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

    user = User(
        tg_user_id=auth.user_id,
        username=auth.username,
        language=normalized_language or "en",
    )
    db.add(user)
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Telegram init data")

    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")

    user = await ensure_user(db, auth)
    invite = await fetch_invite_by_game_id(db, game_id)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No table associated with invite")

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
    visibility: Optional[str] = Query(default=None, description="Table visibility: public or private"),
    is_private: Optional[bool] = Query(default=None, description="Legacy flag for privacy"),
    auto_seat_host: Optional[bool] = Query(default=None, description="Whether to seat the creator immediately"),
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
            raise HTTPException(status_code=400, detail=f"Invalid visibility: {visibility_override}")
        updates["visibility"] = (
            TableVisibility.PUBLIC if visibility_override == "public" else TableVisibility.PRIVATE
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
        logger.warning("Failed to invalidate public table cache after create", error=str(exc))

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
        await db.commit()

        # Broadcast player joined event to all connected clients
        await manager.broadcast(table_id, {
            "type": "player_joined",
            "user_id": user.id,
            "position": seat.position,
            "chips": seat.chips,
        })

        try:
            matchmaking_pool = await get_matchmaking_pool()
            await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to invalidate public table cache after seat", error=str(exc))

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
        await db.commit()

        # Broadcast player left event to all connected clients
        await manager.broadcast(table_id, {
            "type": "player_left",
            "user_id": user.id,
        })

        try:
            matchmaking_pool = await get_matchmaking_pool()
            await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to invalidate public table cache after leave", error=str(exc))
        return {"success": True, "table_id": table_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
        # Update table status to ACTIVE
        await table_service.start_table(db, table_id, user_id=user.id)
        await db.commit()
        
        # Get table info to broadcast to clients
        table_info = await table_service.get_table_info(
            db,
            table_id,
            viewer_user_id=user.id,
        )
        
        # Broadcast table state update to all connected clients
        await manager.broadcast(table_id, {
            "type": "table_started",
            "table": table_info,
        })
        
        logger.info("Game started and broadcasted", table_id=table_id, started_by=user.id)
        
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        matchmaking_pool = await get_matchmaking_pool()
        await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to invalidate public table cache after start", error=str(exc))

    return table_info


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Telegram init data")
    
    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")
    
    user = await ensure_user(db, auth)
    
    # Load table from database
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
    
    # Check permissions: only the creator (host) can delete
    config = table.config_json or {}
    creator_user_id = table.creator_user_id or config.get("creator_user_id")
    
    if creator_user_id is None or creator_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the table creator can delete this table"
        )
    
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
        logger.warning("Failed to invalidate public table cache after delete", error=str(exc))
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@api_app.get("/users/me/stats")
async def get_my_stats(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's statistics."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")
    
    auth = verify_telegram_init_data(x_telegram_init_data)
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")
    
    user = await ensure_user(db, auth)
    stats = await user_service.get_user_stats(db, user.id)
    
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
    
    # Ensure wallet exists
    await user_service.ensure_wallet(db, user.id)
    await db.commit()
    
    balance = await user_service.get_user_balance(db, user.id)
    
    return {"balance": balance}


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
        size=256
    )
    
    # Return as PNG image with caching headers
    return Response(
        content=avatar_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "ETag": f"avatar-{user.id}-v1",
        }
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
    # Verify user
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")
    
    user_auth = verify_telegram_init_data(x_telegram_init_data)
    if not user_auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")
    
    # Process action
    table_manager = TableManager(db, await get_matchmaking_pool().redis)
    action_type = ActionType(action.action_type)
    
    try:
        action_obj = await table_manager.process_action(
            table_id=table_id,
            user_id=user_auth.user_id,
            action_type=action_type,
            amount=action.amount,
        )
        
        # Broadcast update to all connected clients
        await manager.broadcast(table_id, {
            "type": "action",
            "action": {
                "id": action_obj.id,
                "user_id": action_obj.user_id,
                "type": action_obj.type.value,
                "amount": action_obj.amount,
            },
        })
        
        return {"success": True, "action_id": action_obj.id}
    except Exception as e:
        logger.error("Error processing action", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


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
    """
    await manager.connect(websocket, table_id)
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back or process message
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, table_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(websocket, table_id)


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
