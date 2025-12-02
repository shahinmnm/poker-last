"""Seed predefined persistent poker tables.

Run this script to insert permanent lobby tables that never expire.
"""

import asyncio
from typing import List

from sqlalchemy import select

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import get_db_session
from telegram_poker_bot.shared.models import (
    GameMode,
    GameVariant,
    Table,
    TableStatus,
)


PERSISTENT_TABLES: List[dict] = [
    {
        "table_name": "NLHE - Micro Stakes (1/2)",
        "small_blind": 1,
        "big_blind": 2,
        "starting_stack": 200,
        "max_players": 6,
        "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM,
    },
    {
        "table_name": "NLHE - High Roller (100/200)",
        "small_blind": 100,
        "big_blind": 200,
        "starting_stack": 20000,
        "max_players": 8,
        "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM,
    },
    {
        "table_name": "Short-Deck - All In! (10/20)",
        "small_blind": 10,
        "big_blind": 20,
        "starting_stack": 2000,
        "max_players": 7,
        "game_variant": GameVariant.NO_LIMIT_SHORT_DECK_HOLDEM,
    },
]


async def seed_persistent_tables() -> None:
    _ = get_settings()
    async with get_db_session() as session:
        for entry in PERSISTENT_TABLES:
            name = entry["table_name"]
            # Avoid duplicates on reruns
            existing = await session.execute(
                select(Table).where(
                    Table.is_persistent.is_(True),
                    Table.config_json["table_name"].astext == name,
                )
            )
            if existing.scalar_one_or_none():
                print(f"Skipping existing persistent table: {name}")
                continue

            table = Table(
                mode=GameMode.ANONYMOUS,
                status=TableStatus.WAITING,
                is_public=True,
                is_persistent=True,
                invite_code=None,
                expires_at=None,
                game_variant=entry["game_variant"],
                config_json={
                    "table_name": name,
                    "small_blind": entry["small_blind"],
                    "big_blind": entry["big_blind"],
                    "starting_stack": entry["starting_stack"],
                    "max_players": entry["max_players"],
                    "visibility": "public",
                    "is_private": False,
                    "creator_user_id": None,
                },
            )
            session.add(table)
            print(f"Created persistent table: {name}")

        await session.commit()
        print("Persistent table seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed_persistent_tables())
