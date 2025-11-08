"""Shared type definitions."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


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
    config_json: dict


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
