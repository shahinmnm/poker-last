"""Seed predefined persistent poker tables using table templates."""

import asyncio
from typing import Any, Dict, List

from sqlalchemy import select

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import get_db_session
from telegram_poker_bot.shared.models import (
    CurrencyType,
    GameMode,
    GameVariant,
    Table,
    TableStatus,
    TableTemplate,
    TableTemplateType,
)
from telegram_poker_bot.shared.services import table_service


PERSISTENT_TABLES: List[Dict[str, Any]] = [
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


def _build_template_config(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a table entry into a template config payload."""

    currency = entry.get("currency_type", CurrencyType.REAL)
    currency_value = currency.value if isinstance(currency, CurrencyType) else str(currency)

    variant = entry.get("game_variant", GameVariant.NO_LIMIT_TEXAS_HOLDEM)
    variant_value = variant.value if isinstance(variant, GameVariant) else str(variant)

    return {
        "table_name": entry["table_name"],
        "small_blind": int(entry["small_blind"]),
        "big_blind": int(entry["big_blind"]),
        "starting_stack": int(entry["starting_stack"]),
        "max_players": int(entry.get("max_players", 8)),
        "game_variant": variant_value,
        "currency_type": currency_value,
        "allow_invite_code": False,
    }


async def seed_persistent_tables() -> None:
    _ = get_settings()
    async with get_db_session() as session:
        for entry in PERSISTENT_TABLES:
            name = entry["table_name"]
            config = _build_template_config(entry)

            template = await session.scalar(
                select(TableTemplate).where(TableTemplate.name == name)
            )
            if template:
                template.table_type = TableTemplateType.PERSISTENT
                template.has_waitlist = True
                template.config_json = config
                action = "Updated"
            else:
                template = await table_service.create_table_template(
                    session,
                    name=name,
                    table_type=TableTemplateType.PERSISTENT,
                    has_waitlist=True,
                    config=config,
                )
                action = "Created"

            await session.flush()
            print(f"{action} template '{name}' (id={template.id})")

            existing_table = await session.scalar(
                select(Table).where(Table.template_id == template.id)
            )
            if existing_table:
                existing_table.status = TableStatus.WAITING
                existing_table.expires_at = None
                existing_table.is_public = True
                print(
                    f"Persistent table already exists for '{name}' (table_id={existing_table.id})"
                )
                continue

            table = await table_service.create_table(
                session,
                creator_user_id=None,
                template_id=template.id,
                mode=GameMode.ANONYMOUS,
                auto_seat_creator=False,
            )
            print(f"Created persistent table '{name}' (table_id={table.id})")

        await session.commit()
        print("Persistent table seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed_persistent_tables())
