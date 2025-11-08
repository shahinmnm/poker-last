"""Game core module initialization."""

from telegram_poker_bot.game_core.manager import (
    MatchmakingPool,
    TableManager,
    get_matchmaking_pool,
    get_redis_client,
)

__all__ = [
    "MatchmakingPool",
    "TableManager",
    "get_matchmaking_pool",
    "get_redis_client",
]
