"""Game core service - matchmaking and Redis utilities.

NOTE: The deprecated TableManager class has been removed.

The MatchmakingPool class is still actively used for public lobby / Redis caching.

For game runtime, use telegram_poker_bot.game_core.pokerkit_runtime (PokerKitTableRuntime).
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import redis.asyncio as redis

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


class MatchmakingPool:
    """
    Matchmaking pool manager using Redis.

    Design Note:
    - Stores user IDs in Redis sorted set with timestamp
    - Automatically expires entries after TTL
    - Matches players when minimum threshold met
    """

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.pool_key = "matchmaking:pool"
        self.ttl = settings.matchmaking_pool_ttl

    async def add_player(self, user_id: int, prefs: Dict = None):
        """Add player to matchmaking pool."""
        score = datetime.now().timestamp()
        prefs_json = json.dumps(prefs or {})
        await self.redis.zadd(self.pool_key, {f"{user_id}:{prefs_json}": score})
        await self.redis.expire(self.pool_key, self.ttl)
        logger.info("Player added to matchmaking", user_id=user_id)

    async def remove_player(self, user_id: int):
        """Remove player from matchmaking pool."""
        # Remove all entries for this user
        members = await self.redis.zrange(self.pool_key, 0, -1)
        for member in members:
            if member.decode().startswith(f"{user_id}:"):
                await self.redis.zrem(self.pool_key, member)
        logger.info("Player removed from matchmaking", user_id=user_id)

    async def get_waiting_players(self, min_players: int = 2) -> List[int]:
        """Get list of waiting players (if enough for a match)."""
        members = await self.redis.zrange(self.pool_key, 0, min_players - 1)
        if len(members) >= min_players:
            user_ids = [int(m.decode().split(":")[0]) for m in members]
            return user_ids
        return []

    async def clear_expired(self):
        """Clear expired entries from pool."""
        cutoff = (datetime.now() - timedelta(seconds=self.ttl)).timestamp()
        await self.redis.zremrangebyscore(self.pool_key, 0, cutoff)


# Global matchmaking pool instance
_redis_client: Optional[redis.Redis] = None
_matchmaking_pool: Optional[MatchmakingPool] = None


async def get_redis_client() -> redis.Redis:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = await redis.from_url(settings.redis_url_computed)
    return _redis_client


async def get_matchmaking_pool() -> MatchmakingPool:
    """Get matchmaking pool instance."""
    global _matchmaking_pool
    if _matchmaking_pool is None:
        redis_client = await get_redis_client()
        _matchmaking_pool = MatchmakingPool(redis_client)
    return _matchmaking_pool
