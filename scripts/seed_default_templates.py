"""Seed default table templates for the poker application.

This script creates a set of default templates that users can select when creating tables.
It can be run as a standalone script or imported and used in migrations.
"""

import asyncio
import os
from typing import Any, Dict, List

from sqlalchemy import select

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import get_db_session
from telegram_poker_bot.shared.models import (
    CurrencyType,
    GameVariant,
    TableTemplate,
    TableTemplateType,
)
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.shared.types import (
    TableTemplateCreateRequest,
    TableTemplateUpdateRequest,
)


DEFAULT_TEMPLATES: List[Dict[str, Any]] = [
    # Play Money Templates
    {
        "name": "Beginner - Play Money (10/20)",
        "table_type": TableTemplateType.EXPIRING,
        "has_waitlist": False,
        "config": {
            "table_name": "Beginner Table",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 1000,
            "max_players": 6,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "expiration_minutes": 30,
            "turn_timeout_seconds": 30,
            "rake_percentage": 0.0,
            "rake_cap": 0,
        },
    },
    {
        "name": "Standard - Play Money (25/50)",
        "table_type": TableTemplateType.EXPIRING,
        "has_waitlist": False,
        "config": {
            "table_name": "Standard Table",
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 2500,
            "max_players": 8,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "expiration_minutes": 60,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.0,
            "rake_cap": 0,
        },
    },
    {
        "name": "High Stakes - Play Money (100/200)",
        "table_type": TableTemplateType.EXPIRING,
        "has_waitlist": False,
        "config": {
            "table_name": "High Stakes Table",
            "small_blind": 100,
            "big_blind": 200,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "expiration_minutes": 120,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.0,
            "rake_cap": 0,
        },
    },
    # Real Money Templates
    {
        "name": "Micro Stakes - Real Money (1/2)",
        "table_type": TableTemplateType.EXPIRING,
        "has_waitlist": False,
        "config": {
            "table_name": "Micro Stakes",
            "small_blind": 1,
            "big_blind": 2,
            "starting_stack": 200,
            "max_players": 6,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.REAL.value,
            "expiration_minutes": 60,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.05,
            "rake_cap": 10,
        },
    },
    {
        "name": "Low Stakes - Real Money (5/10)",
        "table_type": TableTemplateType.EXPIRING,
        "has_waitlist": False,
        "config": {
            "table_name": "Low Stakes",
            "small_blind": 5,
            "big_blind": 10,
            "starting_stack": 1000,
            "max_players": 8,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.REAL.value,
            "expiration_minutes": 120,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.05,
            "rake_cap": 50,
        },
    },
    # Private Game Template
    {
        "name": "Private Game - Play Money",
        "table_type": TableTemplateType.PRIVATE,
        "has_waitlist": False,
        "config": {
            "table_name": "Private Game",
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 5000,
            "max_players": 8,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "expiration_minutes": 180,
            "turn_timeout_seconds": 30,
            "rake_percentage": 0.0,
            "rake_cap": 0,
            "allow_invite_code": True,
        },
    },
    # Short Deck Template
    {
        "name": "Short Deck - Play Money (10/20)",
        "table_type": TableTemplateType.EXPIRING,
        "has_waitlist": False,
        "config": {
            "table_name": "Short Deck Table",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "game_variant": GameVariant.NO_LIMIT_SHORT_DECK_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "expiration_minutes": 60,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.0,
            "rake_cap": 0,
        },
    },
    # Persistent Lobby Templates with Auto-Create
    {
        "name": "Lobby - Play Money (25/50)",
        "table_type": TableTemplateType.PERSISTENT,
        "has_waitlist": True,
        "config": {
            "table_name": "Lobby Table",
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 2500,
            "max_players": 8,
            "game_variant": GameVariant.NO_LIMIT_TEXAS_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.0,
            "rake_cap": 0,
            "lobby_persistent": True,
            "is_auto_generated": True,
            "auto_create": {
                "enabled": True,
                "min_tables": 2,
                "max_tables": 5,
                "on_startup_repair": True,
                "allow_missing_runtime": True,
            },
        },
    },
    {
        "name": "Lobby - Short Deck (10/20)",
        "table_type": TableTemplateType.PERSISTENT,
        "has_waitlist": True,
        "config": {
            "table_name": "Short Deck Lobby",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "game_variant": GameVariant.NO_LIMIT_SHORT_DECK_HOLDEM.value,
            "currency_type": CurrencyType.PLAY.value,
            "turn_timeout_seconds": 25,
            "rake_percentage": 0.0,
            "rake_cap": 0,
            "lobby_persistent": True,
            "is_auto_generated": True,
            "auto_create": {
                "enabled": True,
                "min_tables": 1,
                "max_tables": 3,
                "on_startup_repair": True,
                "allow_missing_runtime": True,
            },
        },
    },
]


async def seed_default_templates() -> None:
    """Create or update default table templates in the database.
    
    This function is idempotent - it will create templates if they don't exist,
    or update them if they do (based on template name).
    """
    _ = get_settings()
    
    async with get_db_session() as session:
        created_count = 0
        updated_count = 0
        
        for entry in DEFAULT_TEMPLATES:
            name = entry["name"]
            table_type = entry["table_type"]
            has_waitlist = entry["has_waitlist"]
            config = entry["config"]

            # Check if template already exists
            template = await session.scalar(
                select(TableTemplate).where(TableTemplate.name == name)
            )

            payload = TableTemplateCreateRequest(
                name=name,
                table_type=table_type,
                has_waitlist=has_waitlist,
                config=config,
            )

            if template:
                update_payload = TableTemplateUpdateRequest(
                    name=name,
                    table_type=table_type,
                    has_waitlist=has_waitlist,
                    config=config,
                )
                template = await table_service.update_table_template(
                    session, template.id, update_payload
                )
                action = "Updated"
                updated_count += 1
            else:
                template = await table_service.create_table_template(
                    session, payload=payload
                )
                action = "Created"
                created_count += 1

            await session.flush()
            print(f"{action} template '{name}' (id={template.id})")
        
        await session.commit()
        print(f"\nTemplate seeding complete:")
        print(f"  Created: {created_count}")
        print(f"  Updated: {updated_count}")
        print(f"  Total: {len(DEFAULT_TEMPLATES)}")


if __name__ == "__main__":
    if os.getenv("AUTO_SEED_TEMPLATES") == "1":
        asyncio.run(seed_default_templates())
    else:
        print("AUTO_SEED_TEMPLATES not set to 1; skipping seeding.")
