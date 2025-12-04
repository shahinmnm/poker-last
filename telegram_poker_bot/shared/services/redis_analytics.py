"""Redis analytics service for real-time table metrics.

Provides non-blocking atomic operations for live counters, rolling windows,
and real-time statistics used by the admin dashboard and analytics engine.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json

import redis.asyncio as redis

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


class RedisAnalytics:
    """Redis-based real-time analytics service.
    
    Key naming convention:
    - table:{id}:analytics:hand_count_live
    - table:{id}:analytics:pot_sum_rolling
    - table:{id}:analytics:active_seats
    - table:{id}:analytics:timeouts
    - table:{id}:analytics:autofolds
    - table:{id}:analytics:waitlist_count
    - table:{id}:analytics:rolling:300s:{metric}
    - table:{id}:analytics:rolling:30min:{metric}
    - table:{id}:analytics:actions_histogram
    - table:{id}:analytics:pot_sizes
    - table:{id}:analytics:showdown_flags
    - table:{id}:analytics:turn_times_p95
    """

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        
        # Expiration strategies
        self.SHORT_WINDOW_TTL = 300  # 5 minutes
        self.MEDIUM_WINDOW_TTL = 1800  # 30 minutes
        self.DEFAULT_TTL = 86400  # 24 hours
    
    # ==================== Core Counters ====================
    
    async def increment_hand_count(self, table_id: int) -> int:
        """Increment live hand counter for a table."""
        key = f"table:{table_id}:analytics:hand_count_live"
        count = await self.redis.incr(key)
        await self.redis.expire(key, self.DEFAULT_TTL)
        logger.debug("Incremented hand count", table_id=table_id, count=count)
        return count
    
    async def get_hand_count(self, table_id: int) -> int:
        """Get current live hand count."""
        key = f"table:{table_id}:analytics:hand_count_live"
        count = await self.redis.get(key)
        return int(count) if count else 0
    
    async def add_to_pot_sum(self, table_id: int, amount: int) -> int:
        """Add to rolling pot sum."""
        key = f"table:{table_id}:analytics:pot_sum_rolling"
        total = await self.redis.incrby(key, amount)
        await self.redis.expire(key, self.DEFAULT_TTL)
        return total
    
    async def get_pot_sum(self, table_id: int) -> int:
        """Get current rolling pot sum."""
        key = f"table:{table_id}:analytics:pot_sum_rolling"
        total = await self.redis.get(key)
        return int(total) if total else 0
    
    async def set_active_seats(self, table_id: int, count: int):
        """Set active seats count."""
        key = f"table:{table_id}:analytics:active_seats"
        await self.redis.set(key, count, ex=self.DEFAULT_TTL)
    
    async def get_active_seats(self, table_id: int) -> int:
        """Get active seats count."""
        key = f"table:{table_id}:analytics:active_seats"
        count = await self.redis.get(key)
        return int(count) if count else 0
    
    async def increment_timeout(self, table_id: int) -> int:
        """Increment timeout counter."""
        key = f"table:{table_id}:analytics:timeouts"
        count = await self.redis.incr(key)
        await self.redis.expire(key, self.DEFAULT_TTL)
        return count
    
    async def increment_autofold(self, table_id: int) -> int:
        """Increment autofold counter."""
        key = f"table:{table_id}:analytics:autofolds"
        count = await self.redis.incr(key)
        await self.redis.expire(key, self.DEFAULT_TTL)
        return count
    
    async def set_waitlist_count(self, table_id: int, count: int):
        """Set waitlist count."""
        key = f"table:{table_id}:analytics:waitlist_count"
        await self.redis.set(key, count, ex=self.DEFAULT_TTL)
    
    async def get_waitlist_count(self, table_id: int) -> int:
        """Get waitlist count."""
        key = f"table:{table_id}:analytics:waitlist_count"
        count = await self.redis.get(key)
        return int(count) if count else 0
    
    # ==================== Rolling Windows ====================
    
    async def add_to_rolling_window(
        self,
        table_id: int,
        metric: str,
        value: float,
        window_seconds: int = 300
    ):
        """Add value to rolling window using sorted set with timestamp scores.
        
        Args:
            table_id: Table ID
            metric: Metric name (e.g., 'pot_sizes', 'turn_times')
            value: Value to add
            window_seconds: Window size in seconds (300 or 1800)
        """
        window_label = f"{window_seconds}s"
        key = f"table:{table_id}:analytics:rolling:{window_label}:{metric}"
        
        score = datetime.now().timestamp()
        await self.redis.zadd(key, {str(value): score})
        
        # Remove old entries
        cutoff = score - window_seconds
        await self.redis.zremrangebyscore(key, 0, cutoff)
        
        # Set expiration
        ttl = window_seconds * 2  # Keep for double the window
        await self.redis.expire(key, ttl)
    
    async def get_rolling_window_values(
        self,
        table_id: int,
        metric: str,
        window_seconds: int = 300
    ) -> List[float]:
        """Get all values in rolling window."""
        window_label = f"{window_seconds}s"
        key = f"table:{table_id}:analytics:rolling:{window_label}:{metric}"
        
        # Get all members
        members = await self.redis.zrange(key, 0, -1)
        return [float(m.decode()) for m in members]
    
    async def get_rolling_window_stats(
        self,
        table_id: int,
        metric: str,
        window_seconds: int = 300
    ) -> Dict[str, float]:
        """Get statistics for rolling window (avg, min, max, count)."""
        values = await self.get_rolling_window_values(table_id, metric, window_seconds)
        
        if not values:
            return {"count": 0, "avg": 0.0, "min": 0.0, "max": 0.0}
        
        return {
            "count": len(values),
            "avg": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
        }
    
    # ==================== Actions Histogram ====================
    
    async def record_action(self, table_id: int, action_type: str):
        """Record an action in the histogram."""
        key = f"table:{table_id}:analytics:actions_histogram"
        await self.redis.hincrby(key, action_type, 1)
        await self.redis.expire(key, self.DEFAULT_TTL)
    
    async def get_actions_histogram(self, table_id: int) -> Dict[str, int]:
        """Get actions histogram."""
        key = f"table:{table_id}:analytics:actions_histogram"
        histogram = await self.redis.hgetall(key)
        return {k.decode(): int(v) for k, v in histogram.items()}
    
    async def calculate_aggression_metrics(self, table_id: int) -> Dict[str, float]:
        """Calculate AF and AFq from actions histogram.
        
        AF = (bets + raises) / calls
        AFq = (bets + raises) / (calls + folds)
        """
        histogram = await self.get_actions_histogram(table_id)
        
        bets = histogram.get("bet", 0)
        raises = histogram.get("raise", 0)
        calls = histogram.get("call", 0)
        folds = histogram.get("fold", 0)
        
        aggressive = bets + raises
        
        af = aggressive / calls if calls > 0 else 0.0
        afq = aggressive / (calls + folds) if (calls + folds) > 0 else 0.0
        
        return {
            "af": af,
            "afq": afq,
            "bets": bets,
            "raises": raises,
            "calls": calls,
            "folds": folds,
        }
    
    # ==================== Recent Pot Sizes ====================
    
    async def record_pot_size(self, table_id: int, pot_size: int):
        """Record a pot size in the rolling window."""
        await self.add_to_rolling_window(table_id, "pot_sizes", float(pot_size), 300)
    
    async def get_recent_pot_stats(self, table_id: int) -> Dict[str, float]:
        """Get statistics for recent pot sizes."""
        return await self.get_rolling_window_stats(table_id, "pot_sizes", 300)
    
    async def detect_pot_spike(
        self,
        table_id: int,
        current_pot: int,
        std_dev_threshold: float = 3.0
    ) -> bool:
        """Detect if current pot is a spike (outlier).
        
        Returns True if pot is more than std_dev_threshold standard deviations
        above the rolling average.
        """
        values = await self.get_rolling_window_values(table_id, "pot_sizes", 300)
        
        if len(values) < 5:  # Need enough data
            return False
        
        import statistics
        avg = statistics.mean(values)
        std_dev = statistics.stdev(values)
        
        if std_dev == 0:
            return False
        
        z_score = (current_pot - avg) / std_dev
        return z_score > std_dev_threshold
    
    # ==================== Showdown Tracking ====================
    
    async def record_showdown(self, table_id: int, went_to_showdown: bool):
        """Record whether hand went to showdown."""
        key = f"table:{table_id}:analytics:showdown_flags"
        await self.redis.rpush(key, 1 if went_to_showdown else 0)
        
        # Keep only recent 100 hands
        await self.redis.ltrim(key, -100, -1)
        await self.redis.expire(key, self.DEFAULT_TTL)
    
    async def get_showdown_frequency(self, table_id: int) -> float:
        """Get showdown frequency (percentage of hands going to showdown)."""
        key = f"table:{table_id}:analytics:showdown_flags"
        flags = await self.redis.lrange(key, 0, -1)
        
        if not flags:
            return 0.0
        
        showdowns = sum(int(f) for f in flags)
        return showdowns / len(flags)
    
    # ==================== Turn Time P95 ====================
    
    async def record_turn_time(self, table_id: int, turn_time_ms: int):
        """Record turn time in rolling window."""
        await self.add_to_rolling_window(table_id, "turn_times", float(turn_time_ms), 1800)
    
    async def get_turn_time_p95(self, table_id: int) -> float:
        """Get 95th percentile turn time."""
        values = await self.get_rolling_window_values(table_id, "turn_times", 1800)
        
        if not values:
            return 0.0
        
        values.sort()
        p95_index = int(len(values) * 0.95)
        return values[p95_index] if p95_index < len(values) else values[-1]
    
    # ==================== Bulk Operations ====================
    
    async def get_all_table_metrics(self, table_id: int) -> Dict[str, Any]:
        """Get all metrics for a table at once (efficient bulk read)."""
        return {
            "hand_count": await self.get_hand_count(table_id),
            "pot_sum": await self.get_pot_sum(table_id),
            "active_seats": await self.get_active_seats(table_id),
            "waitlist_count": await self.get_waitlist_count(table_id),
            "actions_histogram": await self.get_actions_histogram(table_id),
            "aggression_metrics": await self.calculate_aggression_metrics(table_id),
            "recent_pot_stats": await self.get_recent_pot_stats(table_id),
            "showdown_frequency": await self.get_showdown_frequency(table_id),
            "turn_time_p95": await self.get_turn_time_p95(table_id),
        }
    
    async def flush_table_counters(self, table_id: int) -> Dict[str, Any]:
        """Flush all counters for a table and return their values.
        
        Used during hourly aggregation to capture current state
        before resetting counters.
        
        Returns:
            Dict with all counter values
        """
        metrics = await self.get_all_table_metrics(table_id)
        
        # Note: We don't actually delete the keys here, just return values
        # The hourly aggregator can decide whether to reset counters
        
        return metrics
    
    async def reset_table_counters(self, table_id: int):
        """Reset all counters for a table (typically after aggregation)."""
        keys_to_delete = [
            f"table:{table_id}:analytics:hand_count_live",
            f"table:{table_id}:analytics:pot_sum_rolling",
            f"table:{table_id}:analytics:timeouts",
            f"table:{table_id}:analytics:autofolds",
            f"table:{table_id}:analytics:actions_histogram",
        ]
        
        if keys_to_delete:
            await self.redis.delete(*keys_to_delete)
        
        logger.info("Reset table counters", table_id=table_id)
    
    async def cleanup_table(self, table_id: int):
        """Clean up all analytics data for a table."""
        pattern = f"table:{table_id}:analytics:*"
        
        cursor = 0
        while True:
            cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)
            if keys:
                await self.redis.delete(*keys)
            if cursor == 0:
                break
        
        logger.info("Cleaned up table analytics", table_id=table_id)


# Global instance
_redis_analytics: Optional[RedisAnalytics] = None


async def get_redis_analytics(redis_client: redis.Redis) -> RedisAnalytics:
    """Get or create Redis analytics service instance."""
    global _redis_analytics
    if _redis_analytics is None:
        _redis_analytics = RedisAnalytics(redis_client)
    return _redis_analytics
