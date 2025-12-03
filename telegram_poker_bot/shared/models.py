"""Database models for the Telegram Poker Bot."""

import enum
from enum import Enum as PyEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    Enum as PgEnum,
    ForeignKey,
    Integer,
    String,
    Index,
    event,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class GameMode(PyEnum):
    """Game mode enumeration."""

    ANONYMOUS = "anonymous"
    GROUP = "group"


class TableStatus(PyEnum):
    """Table status enumeration."""

    WAITING = "waiting"
    ACTIVE = "active"  # Game started and running
    PAUSED = "paused"
    ENDED = "ended"
    EXPIRED = "expired"  # Table expired due to inactivity or time limit


class HandStatus(PyEnum):
    """Hand status enumeration."""

    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"
    ENDED = "ended"
    INTER_HAND_WAIT = "inter_hand_wait"  # 20-second wait phase between hands


class GameVariant(str, enum.Enum):
    """Supported game variants for poker tables."""

    NO_LIMIT_TEXAS_HOLDEM = "no_limit_texas_holdem"
    NO_LIMIT_SHORT_DECK_HOLDEM = "no_limit_short_deck_holdem"


class ActionType(PyEnum):
    """Action type enumeration."""

    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    BET = "bet"
    RAISE = "raise"
    ALL_IN = "all_in"
    READY = "ready"  # Signal readiness for next hand during inter-hand phase


class TransactionType(str, PyEnum):
    """Transaction type enumeration for wallet ledger system.

    Types:
    - DEPOSIT: External deposit to wallet
    - WITHDRAWAL: External withdrawal from wallet
    - ADMIN_ADJUSTMENT: Manual adjustments performed by administrators
    - BUY_IN: Transfer from wallet to table
    - CASH_OUT: Transfer from table back to wallet
    - GAME_WIN: Game winnings (new transactions)
    - GAME_PAYOUT: Game payout (legacy, for backwards compatibility)
    - RAKE: System commission (no user_id)
    """

    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    ADMIN_ADJUSTMENT = "admin_adjustment"
    BUY_IN = "buy_in"  # Wallet -> Table
    CASH_OUT = "cash_out"  # Table -> Wallet
    GAME_WIN = "game_win"
    GAME_PAYOUT = "game_payout"  # Generic game payout (backwards compatible)
    RAKE = "rake"  # System Commission


class CurrencyType(str, PyEnum):
    """Currency type for tables and wallets."""

    REAL = "REAL"
    PLAY = "PLAY"


class GroupGameInviteStatus(str, PyEnum):
    """Status for group game invite lifecycle."""

    PENDING = "pending"
    READY = "ready"
    CONSUMED = "consumed"
    EXPIRED = "expired"


class User(Base):
    """User model."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    balance_real = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        default=0,
    )  # Real money balance stored in cents
    balance_play = Column(
        BigInteger,
        nullable=False,
        server_default="100000",
        default=100000,
    )  # Play money balance stored in cents
    tg_user_id = Column(BigInteger, unique=True, nullable=False, index=True)
    language = Column(String(10), default="en", nullable=False)
    username = Column(String(255), nullable=True)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), onupdate=func.now())
    stats_blob = Column(JSONB, default=dict)

    # Relationships
    seats = relationship("Seat", back_populates="user", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="user")
    group_game_invites = relationship(
        "GroupGameInvite",
        back_populates="creator",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tables_created = relationship(
        "Table",
        back_populates="creator",
        foreign_keys="Table.creator_user_id",
    )

    __table_args__ = (Index("idx_users_tg_user_id", "tg_user_id"),)


class Group(Base):
    """Telegram group model."""

    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    tg_chat_id = Column(BigInteger, unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=True)
    type = Column(String(50), nullable=False)  # 'group', 'supergroup', 'channel'
    settings_json = Column(JSONB, default=dict)

    # Relationships
    tables = relationship("Table", back_populates="group")
    invites = relationship(
        "GroupGameInvite",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (Index("idx_groups_tg_chat_id", "tg_chat_id"),)


class Table(Base):
    """Table model."""

    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    mode = Column(Enum(GameMode), nullable=False, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True
    )
    status = Column(
        Enum(
            TableStatus,
            values_callable=lambda enum: [status.value for status in enum],
            name="tablestatus",
        ),
        nullable=False,
        default=TableStatus.WAITING,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    config_json = Column(JSONB, default=dict)
    creator_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_public = Column(Boolean, nullable=False, server_default="true", default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    invite_code = Column(String(16), nullable=True, unique=True, index=True)
    last_action_at = Column(DateTime(timezone=True), nullable=True, index=True)
    min_buy_in = Column(
        BigInteger, nullable=False, default=0, server_default="0"
    )  # Minimum buy-in stored as bigint for precision
    is_persistent = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    game_variant = Column(
        PgEnum(
            GameVariant,
            values_callable=lambda enum: [variant.value for variant in enum],
            name="gamevariant",
        ),
        nullable=False,
        default=GameVariant.NO_LIMIT_TEXAS_HOLDEM,
        server_default=GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
    )
    currency_type = Column(
        Enum(
            CurrencyType,
            values_callable=lambda enum: [member.value for member in enum],
            name="currencytype",
        ),
        nullable=False,
        default=CurrencyType.REAL,
        server_default=CurrencyType.REAL.value,
    )

    # Relationships
    group = relationship("Group", back_populates="tables")
    seats = relationship(
        "Seat",
        back_populates="table",
        cascade="all, delete-orphan",
        order_by="Seat.position",
    )
    hands = relationship(
        "Hand",
        back_populates="table",
        cascade="all, delete-orphan",
        order_by="Hand.hand_no",
    )
    messages = relationship(
        "Message", back_populates="table", cascade="all, delete-orphan"
    )
    creator = relationship(
        "User",
        back_populates="tables_created",
        foreign_keys=[creator_user_id],
    )

    __table_args__ = (
        Index("idx_tables_mode_status", "mode", "status"),
        Index("ix_tables_is_public_status", "is_public", "status"),
        Index("ix_tables_status_created_at", "status", "created_at"),
    )


class Seat(Base):
    """Seat model."""

    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position = Column(Integer, nullable=False)  # 0-7 (8 max players)
    chips = Column(
        BigInteger, nullable=False, default=0
    )  # Changed to BigInteger for precision
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    left_at = Column(DateTime(timezone=True), nullable=True)
    is_sitting_out_next_hand = Column(
        Boolean, nullable=False, server_default="false", default=False
    )

    # Relationships
    table = relationship("Table", back_populates="seats")
    user = relationship("User", back_populates="seats")

    __table_args__ = (
        Index("idx_seats_table_user", "table_id", "user_id"),
        Index("idx_seats_table_position", "table_id", "position"),
        Index("ix_seats_user_left_at", "user_id", "left_at"),
    )


class Hand(Base):
    """Hand model."""

    __tablename__ = "hands"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hand_no = Column(Integer, nullable=False)  # Sequential hand number per table
    status = Column(Enum(HandStatus), nullable=False, default=HandStatus.PREFLOP)
    engine_state_json = Column(JSONB, nullable=False)  # Serialized PokerKit State
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    pot_size = Column(
        BigInteger, nullable=False, default=0
    )  # Track total pot size for auditing
    timeout_tracking = Column(
        JSONB, nullable=True, server_default="{}"
    )  # Consecutive timeout tracking

    # Relationships
    table = relationship("Table", back_populates="hands")
    actions = relationship(
        "Action",
        back_populates="hand",
        cascade="all, delete-orphan",
        order_by="Action.created_at",
    )
    pots = relationship(
        "Pot",
        back_populates="hand",
        cascade="all, delete-orphan",
        order_by="Pot.pot_index",
    )

    __table_args__ = (Index("idx_hands_table_hand_no", "table_id", "hand_no"),)


class Action(Base):
    """Action model."""

    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)
    hand_id = Column(
        Integer, ForeignKey("hands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type = Column(Enum(ActionType), nullable=False)
    amount = Column(
        BigInteger, nullable=False, default=0
    )  # Changed to BigInteger for precision
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    hand = relationship("Hand", back_populates="actions")
    user = relationship("User", back_populates="actions")

    __table_args__ = (Index("idx_actions_hand_created", "hand_id", "created_at"),)


class Pot(Base):
    """Pot model."""

    __tablename__ = "pots"

    id = Column(Integer, primary_key=True, index=True)
    hand_id = Column(
        Integer, ForeignKey("hands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pot_index = Column(Integer, nullable=False)  # 0 = main pot, 1+ = side pots
    size = Column(BigInteger, nullable=False)  # Changed to BigInteger for precision

    # Relationships
    hand = relationship("Hand", back_populates="pots")

    __table_args__ = (Index("idx_pots_hand_index", "hand_id", "pot_index"),)


class HandHistory(Base):
    """Hand history model for storing completed hand summaries."""

    __tablename__ = "hand_histories"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hand_no = Column(Integer, nullable=False)
    payload_json = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_hand_histories_table_hand", "table_id", "hand_no", unique=True),
    )


class HandHistoryEvent(Base):
    """Hand history event model for detailed action-by-action tracking."""

    __tablename__ = "hand_history_events"

    id = Column(Integer, primary_key=True, index=True)
    hand_id = Column(
        Integer, ForeignKey("hands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence = Column(Integer, nullable=False)
    street = Column(String(20), nullable=False)  # preflop, flop, turn, river, showdown
    action_type = Column(
        String(30), nullable=False
    )  # deal_flop, bet, raise, fold, etc.
    actor_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    amount = Column(BigInteger, nullable=True)  # Changed to BigInteger for precision
    pot_size = Column(
        BigInteger, nullable=False, default=0
    )  # Changed to BigInteger for precision
    board_cards = Column(JSONB, nullable=True)  # Board cards at this point
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_hand_events_hand_seq", "hand_id", "sequence"),
        Index("idx_hand_events_table", "table_id"),
    )


class Message(Base):
    """Table anchor message model."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tg_chat_id = Column(BigInteger, nullable=False, index=True)
    tg_message_id = Column(Integer, nullable=False)
    anchor = Column(
        Boolean, default=True, nullable=False
    )  # True for table anchor messages
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    table = relationship("Table", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_table_chat", "table_id", "tg_chat_id"),
        Index("idx_messages_chat_message", "tg_chat_id", "tg_message_id"),
    )


# Group invitations -----------------------------------------------------


class GroupGameInvite(Base):
    """Group game invite and deep link metadata."""

    __tablename__ = "group_game_invites"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String(64), nullable=False, unique=True, index=True)
    creator_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status = Column(
        Enum(
            GroupGameInviteStatus,
            values_callable=lambda enum: [member.value for member in enum],
            name="groupgameinvitestatus",
        ),
        nullable=False,
        default=GroupGameInviteStatus.PENDING,
        server_default=GroupGameInviteStatus.PENDING.value,
        index=True,
    )
    deep_link = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSONB, default=dict)

    creator = relationship("User", back_populates="group_game_invites")
    group = relationship("Group", back_populates="invites")

    __table_args__ = (
        Index("idx_group_invites_status_expires", "status", "expires_at"),
    )


@event.listens_for(GroupGameInvite.status, "set", retval=True)
def _normalize_group_invite_status(target, value, oldvalue, initiator):
    """Allow string inputs while normalizing to lowercase enum values."""
    if value is None:
        return value
    if isinstance(value, GroupGameInviteStatus):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        try:
            return GroupGameInviteStatus(normalized)
        except ValueError as exc:  # pragma: no cover - defensive branch
            raise ValueError(f"Invalid group invite status: {value!r}") from exc
    raise TypeError(
        f"Unsupported type for group invite status: {type(value)!r}"
    )  # pragma: no cover - defensive branch


# Wallet placeholder models (feature flagged)
class Wallet(Base):
    """Wallet model for user balance management."""

    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    balance = Column(
        BigInteger, nullable=False, default=0
    )  # Changed to BigInteger for precision (stored in smallest unit, e.g., cents)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Transaction(Base):
    """Transaction model for complete wallet ledger system."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,  # Null for system transactions like RAKE
        index=True,
    )
    amount = Column(
        BigInteger, nullable=False
    )  # Changed to BigInteger (positive or negative)
    balance_after = Column(
        BigInteger, nullable=True
    )  # Snapshot of balance after transaction when applicable
    type = Column(
        Enum(
            TransactionType,
            values_callable=lambda enum: [member.value for member in enum],
            name="transactiontype",
        ),
        nullable=False,
    )
    table_id = Column(Integer, ForeignKey("tables.id", ondelete="SET NULL"), nullable=True)
    hand_id = Column(Integer, ForeignKey("hands.id", ondelete="SET NULL"), nullable=True)
    reference_id = Column(String(255), nullable=True)  # e.g., "hand_123" or "table_5"
    metadata_json = Column(JSONB, default=dict)  # Additional context data
    currency_type = Column(
        Enum(
            CurrencyType,
            values_callable=lambda enum: [member.value for member in enum],
            name="currencytype",
        ),
        nullable=False,
        default=CurrencyType.REAL,
        server_default=CurrencyType.REAL.value,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("idx_transactions_user_created", "user_id", "created_at"),)


class UserPokerStats(Base):
    """User poker statistics model for aggregated stats."""

    __tablename__ = "user_poker_stats"

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    total_hands = Column(Integer, nullable=False, default=0)
    wins = Column(Integer, nullable=False, default=0)
    vpip_count = Column(Integer, nullable=False, default=0)  # Voluntarily Put $ In Pot
    pfr_count = Column(Integer, nullable=False, default=0)  # Pre-Flop Raise
    total_winnings = Column(
        BigInteger, nullable=False, default=0
    )  # Changed to BigInteger for precision
    best_hand_rank = Column(String(50), nullable=True)  # Best hand achieved
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (Index("idx_user_poker_stats_user_id", "user_id"),)
