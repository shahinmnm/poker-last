"""Game core module initialization."""

from telegram_poker_bot.game_core.manager import (
    MatchmakingPool,
    get_matchmaking_pool,
    get_redis_client,
)
from telegram_poker_bot.game_core.pokerkit_runtime import (
    PokerKitTableRuntime,
    PokerKitTableRuntimeManager,
    get_pokerkit_runtime_manager,
    refresh_table_runtime,
    reset_pokerkit_runtime_cache,
)

__all__ = [
    # Matchmaking (still used)
    "MatchmakingPool",
    "get_matchmaking_pool",
    "get_redis_client",
    # PokerKit Runtime (actively used)
    "PokerKitTableRuntime",
    "PokerKitTableRuntimeManager",
    "get_pokerkit_runtime_manager",
    "refresh_table_runtime",
    "reset_pokerkit_runtime_cache",
]
