"""Shared type definitions."""

from enum import Enum
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field

from telegram_poker_bot.shared.models import GameVariant, CurrencyType, TableTemplateType
from telegram_poker_bot.shared.schemas import TableTemplateConfig


class GameMode(str, Enum):
    """Game mode enumeration."""

    ANONYMOUS = "anonymous"
    GROUP = "group"


class TableStatus(str, Enum):
    """Table status enumeration."""

    WAITING = "waiting"  # Waiting for players
    ACTIVE = "active"  # Game in progress
    PAUSED = "paused"  # Temporarily paused
    ENDED = "ended"  # Game ended


class HandStatus(str, Enum):
    """Hand status enumeration."""

    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"
    ENDED = "ended"


class ActionType(str, Enum):
    """Action type enumeration."""

    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    BET = "bet"
    RAISE = "raise"
    ALL_IN = "all_in"
    READY = "ready"


class TableVisibility(str, Enum):
    """Visibility flag for tables exposed via the API."""

    PUBLIC = "public"
    PRIVATE = "private"


class TableCreateRequest(BaseModel):
    """Validated payload for creating poker tables."""

    template_id: UUID
    auto_seat_host: Optional[bool] = None


class TableTemplateCreateRequest(BaseModel):
    """Validated payload for creating table templates."""

    name: str
    table_type: TableTemplateType
    config_json: Dict[str, Any]  # Accept any dict, normalize in service layer
    has_waitlist: bool = False
    is_active: bool = True

    class Config:
        allow_population_by_field_name = True
        fields = {"config_json": "config"}


class TableTemplateUpdateRequest(BaseModel):
    """Validated payload for updating table templates (all fields optional)."""

    name: Optional[str] = None
    table_type: Optional[TableTemplateType] = None
    has_waitlist: Optional[bool] = None
    is_active: Optional[bool] = None
    config_json: Optional[Dict[str, Any]] = Field(default=None, alias="config")  # Accept any dict

    class Config:
        allow_population_by_field_name = True


class TableTemplateResponse(BaseModel):
    """Response schema for table templates."""

    id: UUID
    name: str
    table_type: TableTemplateType
    has_waitlist: bool
    is_active: bool = True
    config_json: Dict[str, Any]  # Return normalized dict
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        orm_mode = True
        populate_by_name = True


class GroupGameInviteStatus(str, Enum):
    """Group game invite status enumeration."""

    PENDING = "pending"
    READY = "ready"
    CONSUMED = "consumed"
    EXPIRED = "expired"


class User(BaseModel):
    """User model."""

    id: int
    tg_user_id: int
    language: str = "en"
    username: Optional[str] = None
    first_seen_at: Optional[str] = None
    last_seen_at: Optional[str] = None


class Table(BaseModel):
    """Table model."""

    id: int
    mode: GameMode
    group_id: Optional[int] = None
    status: TableStatus
    created_at: str
    updated_at: str
    template_id: UUID
    creator_user_id: Optional[int] = None
    is_public: bool = True
    expires_at: Optional[str] = None
    invite_code: Optional[str] = None
    last_action_at: Optional[str] = None


class Seat(BaseModel):
    """Seat model."""

    id: int
    table_id: int
    user_id: int
    position: int
    chips: int
    joined_at: str
    left_at: Optional[str] = None


class Hand(BaseModel):
    """Hand model."""

    id: int
    table_id: int
    hand_no: int
    status: HandStatus
    engine_state_json: dict
    started_at: str
    ended_at: Optional[str] = None


class Action(BaseModel):
    """Action model."""

    id: int
    hand_id: int
    user_id: int
    type: ActionType
    amount: int
    created_at: str


class Pot(BaseModel):
    """Pot model."""

    id: int
    hand_id: int
    pot_index: int
    size: int


class GroupGameInvite(BaseModel):
    """Group game invite model."""

    id: int
    game_id: str
    creator_user_id: int
    group_id: Optional[int]
    status: GroupGameInviteStatus
    deep_link: str
    created_at: str
    updated_at: Optional[str] = None
    expires_at: str
    consumed_at: Optional[str] = None
    metadata_json: dict = Field(default_factory=dict)
