"""Runtime registry for poker tables managed by the game core."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.engine_adapter import PokerEngineAdapter
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import Seat, Table

logger = get_logger(__name__)


@dataclass
class RuntimeSeat:
    """Lightweight snapshot of a seated player."""

    user_id: int
    position: int
    chips: int
    joined_at: Optional[datetime] = None


@dataclass
class TableRuntime:
    """In-memory view of a table tracked by the game core."""

    table_id: int
    visibility: str
    status: str
    max_players: int
    small_blind: int
    big_blind: int
    starting_stack: int
    seats: List[RuntimeSeat] = field(default_factory=list)
    engine: Optional[PokerEngineAdapter] = None
    last_refreshed: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_runtime_cache: Dict[int, TableRuntime] = {}
_runtime_lock = asyncio.Lock()


def reset_runtime_cache() -> None:
    """Clear runtime cache (primarily for tests)."""

    _runtime_cache.clear()


def _extract_config(table: Table) -> Dict[str, int]:
    config = table.config_json or {}
    return {
        "small_blind": int(config.get("small_blind", 25)),
        "big_blind": int(config.get("big_blind", 50)),
        "starting_stack": int(config.get("starting_stack", 10000)),
        "max_players": int(config.get("max_players", 8)),
    }


async def refresh_table_runtime(
    db: AsyncSession,
    table_id: int,
    *,
    warm_engine: bool = False,
) -> TableRuntime:
    """Synchronise the cached runtime snapshot for a table."""

    async with _runtime_lock:
        table_result = await db.execute(select(Table).where(Table.id == table_id))
        table = table_result.scalar_one_or_none()
        if table is None:
            raise ValueError(f"Table {table_id} not found")

        config = _extract_config(table)

        seats_result = await db.execute(
            select(Seat)
            .where(Seat.table_id == table_id, Seat.left_at.is_(None))
            .order_by(Seat.position.asc())
        )
        seats = [
            RuntimeSeat(
                user_id=seat.user_id,
                position=seat.position,
                chips=seat.chips,
                joined_at=seat.joined_at,
            )
            for seat in seats_result.scalars().all()
        ]

        visibility = "public" if table.is_public else "private"
        runtime = TableRuntime(
            table_id=table.id,
            visibility=visibility,
            status=table.status.value,
            max_players=config["max_players"],
            small_blind=config["small_blind"],
            big_blind=config["big_blind"],
            starting_stack=config["starting_stack"],
            seats=seats,
        )

        player_count = len(seats)
        if warm_engine or player_count >= 2:
            try:
                runtime.engine = PokerEngineAdapter(
                    player_count=player_count,
                    starting_stacks=[seat.chips for seat in seats],
                    small_blind=runtime.small_blind,
                    big_blind=runtime.big_blind,
                )
            except ValueError as exc:
                logger.warning(
                    "Failed to initialise Poker engine", table_id=table_id, error=str(exc)
                )

        _runtime_cache[table_id] = runtime
        logger.debug(
            "Runtime snapshot refreshed",
            table_id=table_id,
            visibility=visibility,
            players=len(seats),
        )
        return runtime


async def get_table_runtime(db: AsyncSession, table_id: int) -> TableRuntime:
    """Return cached runtime, refreshing it if necessary."""

    async with _runtime_lock:
        runtime = _runtime_cache.get(table_id)
        if runtime is not None:
            return runtime

    return await refresh_table_runtime(db, table_id)


async def invalidate_table_runtime(table_id: int) -> None:
    """Remove a table from the runtime cache."""

    async with _runtime_lock:
        _runtime_cache.pop(table_id, None)
