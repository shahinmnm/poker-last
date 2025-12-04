# Phase 2: Detailed Implementation Plan

## File-by-File Implementation Guide

This document provides explicit, function-level changes for Phase 2 implementation.

---

## 1. Database Models (`shared/models.py`)

### 1.1 Add SNG State Enum
```python
# Add after TableStatus enum (line ~42)
class SNGState(str, PyEnum):
    """SNG tournament state enumeration."""
    
    WAITING = "waiting"           # Waiting for first player
    JOIN_WINDOW = "join_window"   # Registration countdown active
    READY = "ready"               # Min players met, ready to start
    ACTIVE = "active"             # Game in progress
    COMPLETED = "completed"       # Game finished
```

### 1.2 Add Fields to Table Model
```python
# Add to Table class (after line ~257)
sng_state = Column(
    Enum(
        SNGState,
        values_callable=lambda enum: [member.value for member in enum],
        name="sngstate",
    ),
    nullable=True,  # NULL for non-SNG tables
    index=True,
)
sng_join_window_started_at = Column(
    DateTime(timezone=True),
    nullable=True,
)
```

### 1.3 Create GlobalWaitlistEntry Model
```python
# Add after WaitlistEntry class (line ~716)
class GlobalWaitlistEntry(Base):
    """Global waitlist entry for cross-table player routing."""
    
    __tablename__ = "global_waitlist_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    game_variant = Column(String(50), nullable=True)  # NULL = any variant
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(
        Enum(
            WaitlistStatus,
            values_callable=lambda enum: [member.value for member in enum],
            name="waitliststatus",
        ),
        nullable=False,
        default=WaitlistStatus.WAITING,
        server_default=WaitlistStatus.WAITING.value,
        index=True,
    )
    routed_table_id = Column(
        Integer,
        ForeignKey("tables.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # Relationships
    user = relationship("User", backref="global_waitlist_entries")
    routed_table = relationship("Table", backref="global_waitlist_routings")
    
    __table_args__ = (
        Index("idx_global_waitlist_user_status", "user_id", "status"),
        Index("idx_global_waitlist_variant_status", "game_variant", "status"),
        Index("idx_global_waitlist_created", "created_at"),
    )
```

---

## 2. Database Migration

### 2.1 Create Migration File
**File**: `telegram_poker_bot/migrations/versions/024_add_sng_and_global_waitlist.py`

```python
"""Add SNG state and global waitlist support

Revision ID: 024_add_sng_and_global_waitlist
Revises: 023_add_analytics_tables
Create Date: 2024-12-04 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '024_add_sng_and_global_waitlist'
down_revision = '023_add_analytics_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Create SNG state enum
    sngstate_enum = postgresql.ENUM(
        'waiting', 'join_window', 'ready', 'active', 'completed',
        name='sngstate',
        create_type=True
    )
    sngstate_enum.create(op.get_bind(), checkfirst=True)
    
    # Add SNG fields to tables
    op.add_column('tables', sa.Column('sng_state', sngstate_enum, nullable=True))
    op.add_column('tables', sa.Column(
        'sng_join_window_started_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.create_index('idx_tables_sng_state', 'tables', ['sng_state'])
    
    # Create global waitlist table
    op.create_table(
        'global_waitlist_entries',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), nullable=False, index=True),
        sa.Column('game_variant', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('status', postgresql.ENUM(
            'waiting', 'entered', 'cancelled',
            name='waitliststatus',
            create_type=False  # Already exists
        ), nullable=False, server_default='waiting'),
        sa.Column('routed_table_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['routed_table_id'], ['tables.id'], ondelete='SET NULL'),
    )
    
    # Create indexes for global waitlist
    op.create_index(
        'idx_global_waitlist_user_status',
        'global_waitlist_entries',
        ['user_id', 'status']
    )
    op.create_index(
        'idx_global_waitlist_variant_status',
        'global_waitlist_entries',
        ['game_variant', 'status']
    )
    op.create_index(
        'idx_global_waitlist_created',
        'global_waitlist_entries',
        ['created_at']
    )


def downgrade():
    # Drop global waitlist table and indexes
    op.drop_index('idx_global_waitlist_created', 'global_waitlist_entries')
    op.drop_index('idx_global_waitlist_variant_status', 'global_waitlist_entries')
    op.drop_index('idx_global_waitlist_user_status', 'global_waitlist_entries')
    op.drop_table('global_waitlist_entries')
    
    # Drop SNG fields from tables
    op.drop_index('idx_tables_sng_state', 'tables')
    op.drop_column('tables', 'sng_join_window_started_at')
    op.drop_column('tables', 'sng_state')
    
    # Drop SNG state enum
    sa.Enum(name='sngstate').drop(op.get_bind(), checkfirst=True)
```

---

## 3. SNG Manager Service

### 3.1 Create New Module
**File**: `telegram_poker_bot/shared/services/sng_manager.py`

```python
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

if TYPE_CHECKING:
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


async def start_join_window(
    db: AsyncSession,
    table: Table,
) -> None:
    """Start the join window countdown for an SNG table.
    
    Args:
        db: Database session
        table: Table instance
        
    Raises:
        ValueError: If SNG is not enabled or window already started
    """
    if not table.template or not table.template.config_json:
        raise ValueError("Table must have a template with config")
    
    config = table.template.config_json
    if not is_sng_enabled(config):
        raise ValueError("SNG is not enabled for this table")
    
    if table.sng_state == SNGState.JOIN_WINDOW:
        logger.warning("Join window already started", table_id=table.id)
        return
    
    table.sng_state = SNGState.JOIN_WINDOW
    table.sng_join_window_started_at = datetime.now(timezone.utc)
    await db.flush()
    
    logger.info(
        "SNG join window started",
        table_id=table.id,
        duration_seconds=get_sng_config(config)["join_window_seconds"],
    )


async def check_auto_start_conditions(
    db: AsyncSession,
    table: Table,
) -> tuple[bool, Optional[str]]:
    """Check if table meets conditions for auto-start.
    
    Returns:
        (should_start, reason) tuple
    """
    if not table.template or not table.template.config_json:
        return False, None
    
    config = table.template.config_json
    sng_config = get_sng_config(config)
    
    if not sng_config["enabled"] or not sng_config["auto_start"]:
        return False, None
    
    # Count active seats
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    seats = result.scalars().all()
    player_count = len(seats)
    
    # Check if table is full
    if player_count >= sng_config["max_players"]:
        if sng_config["force_start_on_full"]:
            return True, "table_full"
    
    # Check if min players met
    if player_count >= sng_config["min_players"]:
        # If join window expired, auto-start
        if table.sng_state == SNGState.JOIN_WINDOW:
            if table.sng_join_window_started_at:
                now = datetime.now(timezone.utc)
                elapsed = (now - table.sng_join_window_started_at).total_seconds()
                if elapsed >= sng_config["join_window_seconds"]:
                    return True, "join_window_expired"
        
        # Transition to READY state
        if table.sng_state != SNGState.READY:
            table.sng_state = SNGState.READY
            await db.flush()
            logger.info(
                "SNG transitioned to READY",
                table_id=table.id,
                player_count=player_count,
            )
    
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
    
    if not table.template or not is_sng_enabled(table.template.config_json or {}):
        raise ValueError("Table is not an SNG table")
    
    # Check minimum players
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    seats = result.scalars().all()
    
    config = table.template.config_json or {}
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


async def on_player_seated(
    db: AsyncSession,
    table: Table,
) -> None:
    """Handle SNG logic when a player is seated.
    
    Args:
        db: Database session
        table: Table instance
    """
    if not table.template or not is_sng_enabled(table.template.config_json or {}):
        return
    
    # Start join window if this is the first player
    result = await db.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    seats = result.scalars().all()
    
    if len(seats) == 1 and table.sng_state == SNGState.WAITING:
        await start_join_window(db, table)
    
    # Check auto-start conditions
    await check_auto_start_conditions(db, table)
```

---

## 4. Global Waitlist Service

### 4.1 Create New Module
**File**: `telegram_poker_bot/shared/services/global_waitlist.py`

```python
"""Global waitlist service for intelligent cross-table player routing.

This service manages a global player queue and routes players to optimal tables
based on multiple scoring factors.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, TYPE_CHECKING

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from telegram_poker_bot.shared.models import (
    GlobalWaitlistEntry,
    WaitlistStatus,
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    Seat,
    User,
    GameVariant,
    SNGState,
)
from telegram_poker_bot.shared.logging import get_logger

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)


async def join_global_waitlist(
    db: AsyncSession,
    user_id: int,
    game_variant: Optional[str] = None,
) -> GlobalWaitlistEntry:
    """Add user to global waitlist.
    
    Args:
        db: Database session
        user_id: User ID
        game_variant: Optional game variant filter (NULL = any variant)
        
    Returns:
        Created entry
        
    Raises:
        ValueError: If user is already in global waitlist
    """
    # Check if user already in global waitlist
    result = await db.execute(
        select(GlobalWaitlistEntry).where(
            GlobalWaitlistEntry.user_id == user_id,
            GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("User is already in the global waitlist")
    
    entry = GlobalWaitlistEntry(
        user_id=user_id,
        game_variant=game_variant,
        status=WaitlistStatus.WAITING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()
    
    logger.info(
        "User joined global waitlist",
        user_id=user_id,
        game_variant=game_variant,
        entry_id=entry.id,
    )
    
    return entry


async def leave_global_waitlist(
    db: AsyncSession,
    user_id: int,
) -> Optional[GlobalWaitlistEntry]:
    """Remove user from global waitlist.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        Cancelled entry or None if not found
    """
    result = await db.execute(
        select(GlobalWaitlistEntry).where(
            GlobalWaitlistEntry.user_id == user_id,
            GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None
    
    entry.status = WaitlistStatus.CANCELLED
    await db.flush()
    
    logger.info("User left global waitlist", user_id=user_id, entry_id=entry.id)
    
    return entry


async def get_next_waiting_player(
    db: AsyncSession,
    table: Table,
) -> Optional[int]:
    """Get next player from global waitlist for a table.
    
    Uses scoring algorithm to find best match:
    1. Variant match (if specified)
    2. Earliest join time
    
    Args:
        db: Database session
        table: Table instance
        
    Returns:
        User ID or None if no suitable player
    """
    if not table.template:
        return None
    
    config = table.template.config_json or {}
    table_variant = config.get("game_variant")
    
    # Build query for waiting players
    query = select(GlobalWaitlistEntry).where(
        GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
    )
    
    # Filter by variant if specified
    if table_variant:
        query = query.where(
            or_(
                GlobalWaitlistEntry.game_variant == table_variant,
                GlobalWaitlistEntry.game_variant.is_(None),  # Accepts any variant
            )
        )
    
    # Order by creation time (FIFO within variant match)
    query = query.order_by(GlobalWaitlistEntry.created_at)
    
    result = await db.execute(query)
    entry = result.scalar_one_or_none()
    
    if entry:
        logger.info(
            "Found player in global waitlist",
            user_id=entry.user_id,
            table_id=table.id,
            entry_id=entry.id,
        )
        return entry.user_id
    
    return None


async def route_player_to_table(
    db: AsyncSession,
    entry_id: int,
    table_id: int,
) -> None:
    """Mark global waitlist entry as routed to a specific table.
    
    Args:
        db: Database session
        entry_id: GlobalWaitlistEntry ID
        table_id: Target table ID
    """
    entry = await db.get(GlobalWaitlistEntry, entry_id)
    if not entry:
        raise ValueError(f"GlobalWaitlistEntry {entry_id} not found")
    
    entry.status = WaitlistStatus.ENTERED
    entry.routed_table_id = table_id
    await db.flush()
    
    logger.info(
        "Player routed from global waitlist",
        user_id=entry.user_id,
        entry_id=entry_id,
        table_id=table_id,
    )


async def find_best_table_for_player(
    db: AsyncSession,
    user_id: int,
    game_variant: Optional[str] = None,
) -> Optional[Table]:
    """Find the best table for a player using scoring algorithm.
    
    Scoring priority:
    1. Persistent SNG tables in JOIN_WINDOW state (highest priority)
    2. Partially filled tables (50-75% capacity)
    3. Tables with active players
    4. Variant match
    
    Args:
        db: Database session
        user_id: User ID
        game_variant: Optional variant preference
        
    Returns:
        Best table or None if no suitable table
    """
    # Find tables that have open seats
    query = (
        select(Table)
        .options(joinedload(Table.template))
        .where(
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE]),
        )
    )
    
    result = await db.execute(query)
    tables = result.scalars().all()
    
    scored_tables = []
    
    for table in tables:
        if not table.template:
            continue
        
        config = table.template.config_json or {}
        max_players = config.get("max_players", 8)
        table_variant = config.get("game_variant")
        
        # Count current seats
        seat_result = await db.execute(
            select(func.count(Seat.id)).where(
                Seat.table_id == table.id,
                Seat.left_at.is_(None),
            )
        )
        seat_count = seat_result.scalar() or 0
        
        # Skip full tables
        if seat_count >= max_players:
            continue
        
        score = 0
        
        # Priority 1: Persistent SNG in JOIN_WINDOW
        if (
            table.template.table_type == TableTemplateType.PERSISTENT
            and table.sng_state == SNGState.JOIN_WINDOW
        ):
            score += 1000
        
        # Priority 2: Partially filled (50-75% capacity)
        fill_ratio = seat_count / max_players
        if 0.5 <= fill_ratio <= 0.75:
            score += 500
        
        # Priority 3: Has active players
        if seat_count > 0:
            score += 100
        
        # Priority 4: Variant match
        if game_variant and table_variant == game_variant:
            score += 50
        
        # Penalty: Nearly dead tables (1 player)
        if seat_count == 1:
            score -= 200
        
        scored_tables.append((score, table))
    
    if not scored_tables:
        return None
    
    # Sort by score descending and return best
    scored_tables.sort(key=lambda x: x[0], reverse=True)
    best_table = scored_tables[0][1]
    
    logger.info(
        "Best table found for player",
        user_id=user_id,
        table_id=best_table.id,
        score=scored_tables[0][0],
    )
    
    return best_table


async def get_global_waitlist_stats(
    db: AsyncSession,
) -> Dict[str, Any]:
    """Get statistics about global waitlist.
    
    Returns:
        Dict with total_waiting and by_variant counts
    """
    result = await db.execute(
        select(GlobalWaitlistEntry).where(
            GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    entries = result.scalars().all()
    
    total = len(entries)
    by_variant: Dict[str, int] = {}
    
    for entry in entries:
        variant = entry.game_variant or "any"
        by_variant[variant] = by_variant.get(variant, 0) + 1
    
    return {
        "total_waiting": total,
        "by_variant": by_variant,
    }
```

---

## 5. Table Service Modifications

### 5.1 Modify `seat_user_at_table` Function
**File**: `telegram_poker_bot/shared/services/table_service.py`

**Replace lines 648-738 with:**

```python
async def seat_user_at_table(
    db: AsyncSession,
    table_id: int,
    user_id: int,
) -> Seat:
    """
    Seat a user at a table using template rules with race condition protection.
    
    This is the unified entry point for all seat assignments:
    - Manual joins
    - Host auto-seat
    - Waitlist promotions
    - Global waitlist routing
    """
    from telegram_poker_bot.shared.services import sng_manager
    
    # Use row-level locking to prevent race conditions
    table_result = await db.execute(
        select(Table)
        .options(joinedload(Table.template))
        .where(Table.id == table_id)
        .with_for_update()
    )
    table = table_result.scalar_one_or_none()
    if not table:
        raise ValueError(f"Table {table_id} not found")
    
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

    await _refresh_table_runtime(db, table_id)
    
    # Trigger SNG logic if applicable
    await sng_manager.on_player_seated(db, table)

    return seat
```

### 5.2 Add SNG Template Validation
**File**: `telegram_poker_bot/shared/services/table_service.py`

**Add to `validate_template_config` function (after line 107):**

```python
    # Validate SNG config if enabled
    if config.get("sng_enabled", False):
        sng_min = config.get("sng_min_players")
        if sng_min is not None:
            try:
                sng_min_int = int(sng_min)
                if sng_min_int < 2:
                    raise ValueError("sng_min_players must be at least 2")
            except (TypeError, ValueError) as exc:
                raise ValueError("sng_min_players must be an integer >= 2") from exc
        
        sng_window = config.get("sng_join_window_seconds")
        if sng_window is not None:
            try:
                sng_window_int = int(sng_window)
                if sng_window_int <= 0:
                    raise ValueError("sng_join_window_seconds must be positive")
            except (TypeError, ValueError) as exc:
                raise ValueError("sng_join_window_seconds must be a positive integer") from exc
```

---

## 6. Table Lifecycle Modifications

### 6.1 Modify Persistent Table Immunity
**File**: `telegram_poker_bot/shared/services/table_lifecycle.py`

**Add new function after line 92:**

```python
async def is_persistent_table(table: Table) -> bool:
    """Check if a table is persistent and should be immune from auto-cleanup.
    
    Args:
        table: Table instance
        
    Returns:
        True if table is persistent, False otherwise
    """
    if not table.template:
        return False
    return table.template.table_type == TableTemplateType.PERSISTENT
```

**Modify `compute_prestart_expiry` (lines 95-137):**

```python
async def compute_prestart_expiry(
    db: AsyncSession, table: Table
) -> Tuple[bool, Optional[str]]:
    """
    Check if a pre-start table should be expired.
    
    PERSISTENT tables are immune from expiry.

    Args:
        db: Database session
        table: Table to check

    Returns:
        (should_expire, reason) tuple
    """
    # PERSISTENT tables never expire
    if await is_persistent_table(table):
        return False, None
    
    # Rest of existing logic unchanged...
    if table.status != TableStatus.WAITING:
        return False, None

    if not table.expires_at:
        return False, None

    now = datetime.now(timezone.utc)
    if table.expires_at <= now:
        return True, "pre-start expiry window elapsed"

    return False, None
```

---

## 7. API Main - Background Tasks

### 7.1 Add Join Window Monitor
**File**: `telegram_poker_bot/api/main.py`

**Add new background task after `_check_table_inactivity` (around line 790):**

```python
async def _monitor_sng_join_windows():
    """Background task to monitor SNG join windows and trigger auto-starts.
    
    Runs every second to:
    1. Check all tables in JOIN_WINDOW state
    2. Emit WebSocket tick events
    3. Trigger auto-start when window expires
    """
    from telegram_poker_bot.shared.database import get_db_session
    from telegram_poker_bot.shared.services import sng_manager
    
    logger.info("SNG join window monitor started")
    
    while True:
        try:
            await asyncio.sleep(1)  # Check every second
            
            async with get_db_session() as db:
                # Find all tables in JOIN_WINDOW state
                result = await db.execute(
                    select(Table)
                    .options(joinedload(Table.template))
                    .where(
                        Table.sng_state == SNGState.JOIN_WINDOW,
                        Table.status == TableStatus.WAITING,
                    )
                )
                tables = result.scalars().all()
                
                for table in tables:
                    try:
                        if not table.template or not table.template.config_json:
                            continue
                        
                        config = table.template.config_json
                        sng_config = sng_manager.get_sng_config(config)
                        
                        if not table.sng_join_window_started_at:
                            continue
                        
                        now = datetime.now(timezone.utc)
                        elapsed = (now - table.sng_join_window_started_at).total_seconds()
                        remaining = max(0, sng_config["join_window_seconds"] - elapsed)
                        
                        # Broadcast tick event
                        await manager.broadcast(table.id, {
                            "type": "sng_join_window_tick",
                            "table_id": table.id,
                            "remaining_seconds": int(remaining),
                        })
                        
                        # Check if window expired
                        if remaining <= 0:
                            should_start, reason = await sng_manager.check_auto_start_conditions(
                                db, table
                            )
                            
                            if should_start:
                                # Trigger auto-start
                                await manager.broadcast(table.id, {
                                    "type": "sng_auto_start_triggered",
                                    "table_id": table.id,
                                    "reason": reason,
                                })
                                
                                # Actually start the table (would integrate with existing start logic)
                                table.status = TableStatus.ACTIVE
                                table.sng_state = SNGState.ACTIVE
                                await db.commit()
                                
                                logger.info(
                                    "SNG auto-started",
                                    table_id=table.id,
                                    reason=reason,
                                )
                            else:
                                # Window expired but not enough players
                                await manager.broadcast(table.id, {
                                    "type": "sng_join_window_ended",
                                    "table_id": table.id,
                                    "auto_starting": False,
                                })
                                
                                # Reset to WAITING state
                                table.sng_state = SNGState.WAITING
                                table.sng_join_window_started_at = None
                                await db.commit()
                                
                                logger.info(
                                    "SNG join window expired without enough players",
                                    table_id=table.id,
                                )
                    
                    except Exception as exc:
                        logger.error(
                            "Error processing SNG join window",
                            table_id=table.id,
                            error=str(exc),
                        )
        
        except Exception as exc:
            logger.error("Error in SNG join window monitor", error=str(exc))
            await asyncio.sleep(5)  # Back off on error
```

### 7.2 Modify Inactivity Cleanup
**File**: `telegram_poker_bot/api/main.py`

**Modify `_check_table_inactivity` around lines 628-638 to skip persistent tables:**

```python
                            if table.status == TableStatus.WAITING and not active_seats:
                                # Skip persistent tables
                                if table.template and table.template.table_type == TableTemplateType.PERSISTENT:
                                    logger.debug(
                                        "Skipping cleanup for persistent table",
                                        table_id=table.id,
                                    )
                                    continue
                                
                                reason = "no active players remaining"
                                await table_lifecycle.mark_table_expired(
                                    db, table, reason
                                )
                                # ... rest unchanged
```

**Modify around lines 657-663:**

```python
                            if table.status == TableStatus.ACTIVE and active_player_count < 2:
                                # Skip persistent tables
                                if table.template and table.template.table_type == TableTemplateType.PERSISTENT:
                                    logger.debug(
                                        "Skipping min-player cleanup for persistent table",
                                        table_id=table.id,
                                    )
                                    continue
                                
                                reason = (
                                    f"lack of minimum player ({active_player_count}/2 required)"
                                )
                                await table_lifecycle.mark_table_completed_and_cleanup(
                                    db, table, reason
                                )
                                # ... rest unchanged
```

### 7.3 Start Background Tasks
**File**: `telegram_poker_bot/api/main.py`

**Modify `_start_background_tasks` (around line 1079):**

```python
async def _start_background_tasks():
    """Start background tasks on application startup."""
    global auto_fold_task, inactivity_check_task, sng_monitor_task
    
    logger.info("Starting background tasks...")
    
    auto_fold_task = asyncio.create_task(_auto_fold_inactive_players())
    inactivity_check_task = asyncio.create_task(_check_table_inactivity())
    sng_monitor_task = asyncio.create_task(_monitor_sng_join_windows())
    
    analytics_scheduler = get_analytics_scheduler()
    await analytics_scheduler.start()
    
    logger.info("Started background tasks: auto-fold, inactivity check, SNG monitor, and analytics scheduler")
```

**Add global variable declaration (around line 100):**

```python
auto_fold_task: Optional[asyncio.Task] = None
inactivity_check_task: Optional[asyncio.Task] = None
sng_monitor_task: Optional[asyncio.Task] = None
```

**Modify shutdown (around line 1093):**

```python
async def _stop_background_tasks():
    """Clean up background tasks on application shutdown."""
    global auto_fold_task, inactivity_check_task, sng_monitor_task
    
    logger.info("Stopping background tasks...")
    
    tasks_to_cancel = [
        auto_fold_task,
        inactivity_check_task,
        sng_monitor_task,
    ]
    
    for task in tasks_to_cancel:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    
    analytics_scheduler = get_analytics_scheduler()
    await analytics_scheduler.stop()
    
    logger.info("Stopped background tasks")
```

---

## 8. API Routes - Global Waitlist

### 8.1 Create New Routes File
**File**: `telegram_poker_bot/api/routes/global_waitlist.py`

```python
"""Global waitlist API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.services import global_waitlist
from telegram_poker_bot.api.main import get_user  # Assuming auth dependency exists

router = APIRouter(prefix="/global-waitlist", tags=["global_waitlist"])


class JoinGlobalWaitlistRequest(BaseModel):
    game_variant: Optional[str] = None


class JoinGlobalWaitlistResponse(BaseModel):
    position: int
    estimated_wait_time: int  # seconds


class GlobalWaitlistStatsResponse(BaseModel):
    total_waiting: int
    by_variant: dict


@router.post("/join", response_model=JoinGlobalWaitlistResponse)
async def join_global_waitlist_endpoint(
    request: JoinGlobalWaitlistRequest,
    user_id: int = Depends(get_user),
    db: AsyncSession = Depends(get_db),
):
    """Join the global waitlist for auto-routing to available tables."""
    try:
        entry = await global_waitlist.join_global_waitlist(
            db,
            user_id=user_id,
            game_variant=request.game_variant,
        )
        await db.commit()
        
        # Calculate position (simplified - count earlier entries)
        from telegram_poker_bot.shared.models import GlobalWaitlistEntry, WaitlistStatus
        from sqlalchemy import select, func
        
        result = await db.execute(
            select(func.count(GlobalWaitlistEntry.id)).where(
                GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
                GlobalWaitlistEntry.created_at <= entry.created_at,
            )
        )
        position = result.scalar() or 1
        
        return JoinGlobalWaitlistResponse(
            position=position,
            estimated_wait_time=position * 30,  # Rough estimate: 30s per position
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/leave")
async def leave_global_waitlist_endpoint(
    user_id: int = Depends(get_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave the global waitlist."""
    entry = await global_waitlist.leave_global_waitlist(db, user_id)
    await db.commit()
    
    if not entry:
        raise HTTPException(status_code=404, detail="User not in global waitlist")
    
    return {"success": True}


@router.get("", response_model=GlobalWaitlistStatsResponse)
async def get_global_waitlist_stats_endpoint(
    db: AsyncSession = Depends(get_db),
):
    """Get global waitlist statistics."""
    stats = await global_waitlist.get_global_waitlist_stats(db)
    return GlobalWaitlistStatsResponse(**stats)
```

### 8.2 Mount Routes in Main
**File**: `telegram_poker_bot/api/main.py`

**Add import (around line 71):**

```python
from telegram_poker_bot.api.routes import global_waitlist
```

**Mount router (around line 150, after admin_router):**

```python
api_app.include_router(global_waitlist.router, prefix=api_prefix)
```

---

## 9. API Routes - SNG Controls

### 9.1 Add SNG Endpoint to Tables Routes
**File**: `telegram_poker_bot/api/main.py` (or separate routes file if exists)

**Add new endpoint:**

```python
@api_app.post(f"{api_prefix}/tables/{{table_id}}/sng/force-start")
async def force_start_sng_endpoint(
    table_id: int,
    user_id: int = Depends(get_user),
    db: AsyncSession = Depends(get_db),
):
    """Force-start an SNG table (admin/creator only)."""
    from telegram_poker_bot.shared.services import sng_manager
    
    # Load table to check permissions
    table = await db.get(Table, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check if user is creator or admin (simplified - add proper auth)
    if table.creator_user_id != user_id:
        # TODO: Add admin check
        raise HTTPException(status_code=403, detail="Only table creator can force-start")
    
    try:
        table = await sng_manager.force_start_sng(db, table_id)
        await db.commit()
        
        # Broadcast to all players
        runtime_mgr = get_pokerkit_runtime_manager()
        state = await runtime_mgr.get_state(db, table.id, viewer_user_id=None)
        await manager.broadcast(table.id, {
            "type": "sng_force_started",
            "table": state,
        })
        
        return {"success": True, "table_id": table.id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
```

---

## 10. WebSocket Event Enhancements

### 10.1 Add Lobby Table Update Events
**File**: `telegram_poker_bot/api/main.py`

**Modify table creation/update logic to broadcast lobby updates.**

**Add helper function:**

```python
async def _broadcast_lobby_table_update(table: Table, db: AsyncSession):
    """Broadcast lobby update when table state changes."""
    # Count seats and waitlist
    from sqlalchemy import select, func
    
    seat_count_result = await db.execute(
        select(func.count(Seat.id)).where(
            Seat.table_id == table.id,
            Seat.left_at.is_(None),
        )
    )
    seat_count = seat_count_result.scalar() or 0
    
    from telegram_poker_bot.shared.models import WaitlistEntry, WaitlistStatus
    
    waitlist_count_result = await db.execute(
        select(func.count(WaitlistEntry.id)).where(
            WaitlistEntry.table_id == table.id,
            WaitlistEntry.status == WaitlistStatus.WAITING,
        )
    )
    waitlist_count = waitlist_count_result.scalar() or 0
    
    # Calculate join window remaining
    join_window_remaining = None
    if table.sng_state == SNGState.JOIN_WINDOW and table.sng_join_window_started_at:
        from telegram_poker_bot.shared.services import sng_manager
        config = table.template.config_json or {}
        sng_config = sng_manager.get_sng_config(config)
        
        now = datetime.now(timezone.utc)
        elapsed = (now - table.sng_join_window_started_at).total_seconds()
        join_window_remaining = max(0, sng_config["join_window_seconds"] - elapsed)
    
    await lobby_manager.broadcast({
        "type": "lobby_table_updated",
        "table": {
            "id": table.id,
            "seat_count": seat_count,
            "waitlist_count": waitlist_count,
            "sng_state": table.sng_state.value if table.sng_state else None,
            "join_window_remaining": int(join_window_remaining) if join_window_remaining else None,
            "status": table.status.value,
        }
    })
```

**Call this function after seat assignments, waitlist changes, etc.**

---

## Conclusion

This implementation plan provides file-by-file, function-by-function changes needed for Phase 2. All modifications are minimal, surgical, and maintain backward compatibility while adding powerful SNG and global waitlist capabilities.

The next step is to execute these changes incrementally, testing each module independently before integration.
