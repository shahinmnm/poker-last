"""Analytics event hooks for PokerKit runtime integration.

Hooks into PokerKit runtime events to capture analytics data.
Integrates with Redis counters and hand analytics processor.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.services.redis_analytics import RedisAnalytics
from telegram_poker_bot.shared.services.hand_analytics_processor import HandAnalyticsProcessor
from telegram_poker_bot.shared.services.outlier_detector import OutlierDetector
from telegram_poker_bot.shared.services.admin_analytics_ws import get_admin_analytics_ws_manager
from telegram_poker_bot.shared.models import Hand, Table, User

logger = get_logger(__name__)


class AnalyticsEventHooks:
    """Event hooks for analytics data collection.
    
    Integrates with PokerKit runtime to capture:
    - Hand lifecycle events
    - Player actions
    - Timeout/autofold events
    - Pot evolution
    - Showdown resolution
    """
    
    def __init__(
        self,
        db: AsyncSession,
        redis_analytics: RedisAnalytics,
        outlier_detector: OutlierDetector,
    ):
        self.db = db
        self.redis = redis_analytics
        self.detector = outlier_detector
        self.ws_manager = get_admin_analytics_ws_manager()
    
    # ==================== Table Events ====================
    
    async def on_table_started(self, table_id: int, metadata: Dict[str, Any]):
        """Handle table started event.
        
        Args:
            table_id: Table ID
            metadata: Event metadata
        """
        logger.info("Table started", table_id=table_id)
        
        # Initialize Redis counters
        await self.redis.set_active_seats(table_id, metadata.get("player_count", 0))
    
    async def on_table_ended(self, table_id: int, metadata: Dict[str, Any]):
        """Handle table ended event.
        
        Args:
            table_id: Table ID
            metadata: Event metadata
        """
        logger.info("Table ended", table_id=table_id)
        
        # Flush final metrics
        metrics = await self.redis.flush_table_counters(table_id)
        
        # Optional: Clean up Redis data
        # await self.redis.cleanup_table(table_id)
    
    # ==================== Hand Events ====================
    
    async def on_hand_started(self, table_id: int, hand_id: int, metadata: Dict[str, Any]):
        """Handle hand started event.
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            metadata: Event metadata
        """
        logger.debug("Hand started", table_id=table_id, hand_id=hand_id)
        
        # Increment hand counter
        await self.redis.increment_hand_count(table_id)
        
        # Update active seats
        player_count = metadata.get("player_count", 0)
        await self.redis.set_active_seats(table_id, player_count)
    
    async def on_hand_finished(self, table_id: int, hand_id: int, metadata: Dict[str, Any]):
        """Handle hand finished event.
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            metadata: Event metadata (includes pot, winners, etc.)
        """
        logger.info("Hand finished", table_id=table_id, hand_id=hand_id)
        
        # Process hand analytics
        hand_analytics = await HandAnalyticsProcessor.process_hand(self.db, hand_id)
        
        if hand_analytics:
            # Record pot size in rolling window
            await self.redis.record_pot_size(table_id, hand_analytics.total_pot)
            
            # Record showdown
            await self.redis.record_showdown(table_id, hand_analytics.went_to_showdown)
            
            # Add to pot sum
            await self.redis.add_to_pot_sum(table_id, hand_analytics.total_pot)
            
            # Check for anomalies
            await self._check_hand_anomalies(table_id, hand_id, hand_analytics, metadata)
            
            # Update player sessions
            if hand_analytics.positions:
                for user_id in hand_analytics.positions.keys():
                    await HandAnalyticsProcessor.update_player_session(
                        self.db,
                        user_id,
                        table_id,
                        hand_analytics,
                    )
        
        await self.db.commit()
    
    async def _check_hand_anomalies(
        self,
        table_id: int,
        hand_id: int,
        hand_analytics,
        metadata: Dict[str, Any],
    ):
        """Check for anomalies after hand completion."""
        
        # Check for pot spike
        alert = await self.detector.detect_pot_spike(
            table_id,
            hand_id,
            hand_analytics.total_pot,
        )
        
        if alert:
            # Broadcast to admin WebSocket
            await self.ws_manager.broadcast_anomaly_alert(alert)
            await self.ws_manager.broadcast_pot_spike(
                table_id,
                hand_id,
                hand_analytics.total_pot,
            )
    
    # ==================== Street Events ====================
    
    async def on_street_changed(self, table_id: int, hand_id: int, street: str, metadata: Dict[str, Any]):
        """Handle street changed event.
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            street: New street (preflop, flop, turn, river, showdown)
            metadata: Event metadata
        """
        logger.debug("Street changed", table_id=table_id, hand_id=hand_id, street=street)
        
        # Update pot sum if pot changed
        if "pot_size" in metadata:
            await self.redis.add_to_pot_sum(table_id, metadata["pot_size"])
    
    # ==================== Player Action Events ====================
    
    async def on_player_action(
        self,
        table_id: int,
        hand_id: int,
        user_id: int,
        action_type: str,
        metadata: Dict[str, Any],
    ):
        """Handle player action event.
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            user_id: User ID
            action_type: Action type (fold, check, call, bet, raise)
            metadata: Event metadata (includes amount, turn_time_ms)
        """
        logger.debug(
            "Player action",
            table_id=table_id,
            hand_id=hand_id,
            user_id=user_id,
            action_type=action_type,
        )
        
        # Record action in histogram
        await self.redis.record_action(table_id, action_type)
        
        # Record turn time if available
        turn_time_ms = metadata.get("turn_time_ms")
        if turn_time_ms is not None:
            await self.redis.record_turn_time(table_id, turn_time_ms)
    
    # ==================== Timeout Events ====================
    
    async def on_timeout(self, table_id: int, hand_id: int, user_id: int, metadata: Dict[str, Any]):
        """Handle timeout event.
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            user_id: User ID
            metadata: Event metadata
        """
        logger.warning("Player timeout", table_id=table_id, hand_id=hand_id, user_id=user_id)
        
        # Increment timeout counter
        await self.redis.increment_timeout(table_id)
        
        # Check for timeout surge
        alert = await self.detector.detect_timeout_surge(table_id, user_id)
        
        if alert:
            # Broadcast to admin WebSocket
            await self.ws_manager.broadcast_anomaly_alert(alert)
            
            # Get timeout count for broadcast
            # (simplified - would need to query actual count)
            await self.ws_manager.broadcast_timeout_surge(table_id, user_id, 5)
    
    async def on_autofold(self, table_id: int, hand_id: int, user_id: int, metadata: Dict[str, Any]):
        """Handle autofold event.
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            user_id: User ID
            metadata: Event metadata
        """
        logger.info("Player autofold", table_id=table_id, hand_id=hand_id, user_id=user_id)
        
        # Increment autofold counter
        await self.redis.increment_autofold(table_id)
        
        # Record as fold action
        await self.redis.record_action(table_id, "fold")
    
    # ==================== Seat Events ====================
    
    async def on_seat_join(self, table_id: int, user_id: int, seat_position: int, metadata: Dict[str, Any]):
        """Handle seat join event.
        
        Args:
            table_id: Table ID
            user_id: User ID
            seat_position: Seat position
            metadata: Event metadata (includes buy_in, template_id)
        """
        logger.info("Seat join", table_id=table_id, user_id=user_id, seat=seat_position)
        
        # Update active seats count
        active_seats = metadata.get("active_seats", 0)
        await self.redis.set_active_seats(table_id, active_seats)
        
        # Create player session
        buy_in = metadata.get("buy_in", 0)
        template_id = metadata.get("template_id")
        
        if template_id:
            await HandAnalyticsProcessor.create_player_session(
                self.db,
                user_id,
                table_id,
                template_id,
                buy_in,
            )
            await self.db.commit()
    
    async def on_seat_leave(self, table_id: int, user_id: int, seat_position: int, metadata: Dict[str, Any]):
        """Handle seat leave event.
        
        Args:
            table_id: Table ID
            user_id: User ID
            seat_position: Seat position
            metadata: Event metadata (includes cash_out)
        """
        logger.info("Seat leave", table_id=table_id, user_id=user_id, seat=seat_position)
        
        # Update active seats count
        active_seats = metadata.get("active_seats", 0)
        await self.redis.set_active_seats(table_id, active_seats)
        
        # End player session
        cash_out = metadata.get("cash_out", 0)
        
        await HandAnalyticsProcessor.end_player_session(
            self.db,
            user_id,
            table_id,
            cash_out,
        )
        await self.db.commit()
    
    # ==================== Waitlist Events ====================
    
    async def on_waitlist_join(self, table_id: int, user_id: int, metadata: Dict[str, Any]):
        """Handle waitlist join event.
        
        Args:
            table_id: Table ID
            user_id: User ID
            metadata: Event metadata
        """
        logger.debug("Waitlist join", table_id=table_id, user_id=user_id)
        
        # Update waitlist count
        waitlist_count = metadata.get("waitlist_count", 0)
        await self.redis.set_waitlist_count(table_id, waitlist_count)
    
    async def on_waitlist_leave(self, table_id: int, user_id: int, metadata: Dict[str, Any]):
        """Handle waitlist leave event.
        
        Args:
            table_id: Table ID
            user_id: User ID
            metadata: Event metadata
        """
        logger.debug("Waitlist leave", table_id=table_id, user_id=user_id)
        
        # Update waitlist count
        waitlist_count = metadata.get("waitlist_count", 0)
        await self.redis.set_waitlist_count(table_id, waitlist_count)
    
    # ==================== Periodic Updates ====================
    
    async def send_periodic_metrics_update(self, table_id: int):
        """Send periodic metrics update to admin WebSocket.
        
        Should be called periodically (e.g., every 5 seconds) to push
        live metrics to admin dashboard.
        """
        metrics = await self.redis.get_all_table_metrics(table_id)
        await self.ws_manager.broadcast_table_metrics(table_id, metrics)


# ==================== Helper Functions ====================

async def create_analytics_event_hooks(
    db: AsyncSession,
    redis_analytics: RedisAnalytics,
    outlier_detector: OutlierDetector,
) -> AnalyticsEventHooks:
    """Create analytics event hooks instance.
    
    Args:
        db: Database session
        redis_analytics: Redis analytics service
        outlier_detector: Outlier detector service
        
    Returns:
        AnalyticsEventHooks instance
    """
    return AnalyticsEventHooks(db, redis_analytics, outlier_detector)
