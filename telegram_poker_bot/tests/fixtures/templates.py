"""Template configuration fixtures for all poker variants."""

from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from telegram_poker_bot.shared.models import TableTemplate, TableTemplateType


# Normalized variant configurations following Phase 1-5 schema
VARIANT_CONFIGS = {
    "no_limit_texas_holdem": {
        "game_variant": "no_limit_texas_holdem",
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 5000,
        "max_players": 9,
        "min_players": 2,
        "ante": 0,
        "min_bet": 50,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
    },
    "pot_limit_omaha": {
        "game_variant": "pot_limit_omaha",
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 5000,
        "max_players": 9,
        "min_players": 2,
        "ante": 0,
        "min_bet": 50,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
        "hole_cards": 4,  # PLO uses 4 hole cards
    },
    "five_card_draw": {
        "game_variant": "five_card_draw",
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 5000,
        "max_players": 6,
        "min_players": 2,
        "ante": 0,
        "min_bet": 50,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 45,  # More time for draw decisions
        "currency_type": "PLAY",
        "draw_rounds": 1,
        "max_draw_cards": 5,
    },
    "deuce_to_seven_triple_draw": {
        "game_variant": "deuce_to_seven_triple_draw",
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 5000,
        "max_players": 6,
        "min_players": 2,
        "ante": 0,
        "min_bet": 50,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 45,
        "currency_type": "PLAY",
        "draw_rounds": 3,
        "max_draw_cards": 5,
        "lowball": True,
    },
    "seven_card_stud": {
        "game_variant": "seven_card_stud",
        "ante": 10,
        "bring_in": 15,
        "small_bet": 50,
        "big_bet": 100,
        "starting_stack": 5000,
        "max_players": 8,
        "min_players": 2,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
        "up_cards": 4,
        "down_cards": 3,
    },
    "seven_card_stud_hi_lo": {
        "game_variant": "seven_card_stud_hi_lo",
        "ante": 10,
        "bring_in": 15,
        "small_bet": 50,
        "big_bet": 100,
        "starting_stack": 5000,
        "max_players": 8,
        "min_players": 2,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
        "up_cards": 4,
        "down_cards": 3,
        "split_pot": True,
        "qualifier": "eight_or_better",
    },
    "omaha_hi_lo": {
        "game_variant": "omaha_hi_lo",
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 5000,
        "max_players": 9,
        "min_players": 2,
        "ante": 0,
        "min_bet": 50,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
        "hole_cards": 4,
        "split_pot": True,
        "qualifier": "eight_or_better",
    },
    "short_deck": {
        "game_variant": "short_deck",
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 5000,
        "max_players": 9,
        "min_players": 2,
        "ante": 50,  # Short deck typically has antes
        "min_bet": 50,
        "rake_percentage": 0.05,
        "rake_cap": 100,
        "turn_timeout_seconds": 30,
        "currency_type": "PLAY",
        "deck_size": 36,  # Remove 2-5
    },
}


async def create_variant_template(
    db: AsyncSession,
    variant: str = "no_limit_texas_holdem",
    name: Optional[str] = None,
    table_type: TableTemplateType = TableTemplateType.EXPIRING,
    has_waitlist: bool = False,
    expiration_minutes: Optional[int] = 60,
    **config_overrides
) -> TableTemplate:
    """Create a template for a specific poker variant.
    
    Args:
        db: Database session
        variant: Poker variant key from VARIANT_CONFIGS
        name: Template name (defaults to variant name)
        table_type: EXPIRING or PERSISTENT
        has_waitlist: Whether to enable waitlist
        expiration_minutes: Expiration time for EXPIRING tables
        **config_overrides: Override any config values
        
    Returns:
        Created TableTemplate instance
    """
    if variant not in VARIANT_CONFIGS:
        raise ValueError(f"Unknown variant: {variant}. Available: {list(VARIANT_CONFIGS.keys())}")
    
    config = VARIANT_CONFIGS[variant].copy()
    config.update(config_overrides)
    
    if name is None:
        name = variant.replace("_", " ").title()
    
    from telegram_poker_bot.shared.services import table_service
    
    template = await table_service.create_table_template(
        db,
        name=name,
        table_type=table_type,
        has_waitlist=has_waitlist,
        config=config,
        expiration_minutes=expiration_minutes if table_type == TableTemplateType.EXPIRING else None,
    )
    
    return template
