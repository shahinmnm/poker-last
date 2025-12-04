"""Outlier detection service for anomaly alerts.

Detects suspicious patterns and unusual behavior for admin monitoring.
PLUS Edition feature.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
import statistics

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    AnomalyAlert,
    HandAnalytics,
    PlayerSession,
    User,
    Table,
)
from telegram_poker_bot.shared.services.redis_analytics import RedisAnalytics

logger = get_logger(__name__)


class OutlierDetector:
    """Detects anomalies and suspicious patterns in poker gameplay.
    
    Detection types:
    1. Big pot spikes (>X std dev above average)
    2. Timeout surges (unusual number of timeouts)
    3. VPIP/PFR mismatches (collusion indicators)
    4. Rapid action patterns (bot-like behavior)
    """
    
    def __init__(self, db: AsyncSession, redis_analytics: RedisAnalytics):
        self.db = db
        self.redis = redis_analytics
        
        # Thresholds
        self.POT_SPIKE_THRESHOLD = 3.0  # std deviations
        self.TIMEOUT_SURGE_THRESHOLD = 5  # timeouts per hour
        self.VPIP_MISMATCH_THRESHOLD = 0.5  # difference threshold
        self.RAPID_ACTION_MS = 500  # milliseconds
    
    # ==================== Detection Methods ====================
    
    async def detect_pot_spike(
        self,
        table_id: int,
        hand_id: int,
        pot_size: int,
    ) -> Optional[AnomalyAlert]:
        """Detect if pot size is unusually large (outlier).
        
        Args:
            table_id: Table ID
            hand_id: Hand ID
            pot_size: Current pot size
            
        Returns:
            AnomalyAlert if spike detected, None otherwise
        """
        # Use Redis to check against rolling average
        is_spike = await self.redis.detect_pot_spike(
            table_id,
            pot_size,
            self.POT_SPIKE_THRESHOLD,
        )
        
        if not is_spike:
            return None
        
        # Get recent pot stats for context
        pot_stats = await self.redis.get_recent_pot_stats(table_id)
        
        alert = AnomalyAlert(
            alert_type="big_pot",
            severity="high",
            table_id=table_id,
            hand_id=hand_id,
            message=f"Pot size {pot_size} is {self.POT_SPIKE_THRESHOLD}x std dev above average",
            metadata={
                "pot_size": pot_size,
                "avg_pot": pot_stats.get("avg", 0),
                "max_pot": pot_stats.get("max", 0),
                "threshold": self.POT_SPIKE_THRESHOLD,
            },
        )
        
        self.db.add(alert)
        await self.db.flush()
        
        logger.warning(
            "Detected pot spike",
            table_id=table_id,
            hand_id=hand_id,
            pot_size=pot_size,
        )
        
        return alert
    
    async def detect_timeout_surge(
        self,
        table_id: int,
        user_id: Optional[int] = None,
    ) -> Optional[AnomalyAlert]:
        """Detect unusual number of timeouts.
        
        Args:
            table_id: Table ID
            user_id: Optional user ID to check specific player
            
        Returns:
            AnomalyAlert if surge detected, None otherwise
        """
        # Check recent player sessions for timeout counts
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        
        if user_id:
            # Check specific player
            sessions_result = await self.db.execute(
                select(PlayerSession)
                .where(
                    and_(
                        PlayerSession.user_id == user_id,
                        PlayerSession.table_id == table_id,
                        PlayerSession.session_start >= hour_ago,
                    )
                )
            )
            sessions = list(sessions_result.scalars().all())
            
            total_timeouts = sum(s.timeouts for s in sessions)
            
            if total_timeouts >= self.TIMEOUT_SURGE_THRESHOLD:
                alert = AnomalyAlert(
                    alert_type="timeout_surge",
                    severity="medium",
                    table_id=table_id,
                    user_id=user_id,
                    message=f"Player has {total_timeouts} timeouts in the last hour",
                    metadata={
                        "timeouts": total_timeouts,
                        "threshold": self.TIMEOUT_SURGE_THRESHOLD,
                    },
                )
                
                self.db.add(alert)
                await self.db.flush()
                
                logger.warning(
                    "Detected timeout surge",
                    table_id=table_id,
                    user_id=user_id,
                    timeouts=total_timeouts,
                )
                
                return alert
        
        return None
    
    async def detect_vpip_pfr_mismatch(
        self,
        user_id: int,
        table_id: Optional[int] = None,
    ) -> Optional[AnomalyAlert]:
        """Detect suspicious VPIP/PFR patterns (potential collusion).
        
        Normal players have VPIP >= PFR. If VPIP < PFR, it's suspicious.
        Also checks for extremely tight or extremely loose play.
        
        Args:
            user_id: User ID to check
            table_id: Optional table ID to scope check
            
        Returns:
            AnomalyAlert if mismatch detected, None otherwise
        """
        # Get recent player sessions
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        
        query = select(PlayerSession).where(
            and_(
                PlayerSession.user_id == user_id,
                PlayerSession.session_start >= hour_ago,
            )
        )
        
        if table_id:
            query = query.where(PlayerSession.table_id == table_id)
        
        sessions_result = await self.db.execute(query)
        sessions = list(sessions_result.scalars().all())
        
        if not sessions:
            return None
        
        # Calculate aggregate VPIP and PFR
        total_hands = sum(s.hands_played for s in sessions)
        total_vpip = sum(s.vpip_count for s in sessions)
        total_pfr = sum(s.pfr_count for s in sessions)
        
        if total_hands < 10:  # Need minimum sample size
            return None
        
        vpip_pct = total_vpip / total_hands
        pfr_pct = total_pfr / total_hands
        
        # Check for anomalies
        is_suspicious = False
        reason = ""
        
        if pfr_pct > vpip_pct + 0.05:  # PFR should never be > VPIP
            is_suspicious = True
            reason = "PFR exceeds VPIP (impossible)"
        elif vpip_pct > 0.9:  # Playing >90% of hands
            is_suspicious = True
            reason = "Extremely loose play (>90% VPIP)"
        elif vpip_pct < 0.05 and total_hands > 50:  # Playing <5% of hands
            is_suspicious = True
            reason = "Extremely tight play (<5% VPIP)"
        
        if is_suspicious:
            alert = AnomalyAlert(
                alert_type="vpip_mismatch",
                severity="medium",
                table_id=table_id,
                user_id=user_id,
                message=f"Suspicious VPIP/PFR pattern: {reason}",
                metadata={
                    "vpip_pct": vpip_pct,
                    "pfr_pct": pfr_pct,
                    "hands": total_hands,
                    "reason": reason,
                },
            )
            
            self.db.add(alert)
            await self.db.flush()
            
            logger.warning(
                "Detected VPIP/PFR mismatch",
                user_id=user_id,
                table_id=table_id,
                vpip=vpip_pct,
                pfr=pfr_pct,
            )
            
            return alert
        
        return None
    
    async def detect_rapid_actions(
        self,
        table_id: int,
        user_id: int,
    ) -> Optional[AnomalyAlert]:
        """Detect rapid action patterns (potential bot behavior).
        
        Args:
            table_id: Table ID
            user_id: User ID
            
        Returns:
            AnomalyAlert if pattern detected, None otherwise
        """
        # Check turn time P95 from Redis
        p95_turn_time = await self.redis.get_turn_time_p95(table_id)
        
        if p95_turn_time < self.RAPID_ACTION_MS:
            alert = AnomalyAlert(
                alert_type="rapid_action",
                severity="low",
                table_id=table_id,
                user_id=user_id,
                message=f"Player consistently acts in <{self.RAPID_ACTION_MS}ms (P95: {p95_turn_time}ms)",
                metadata={
                    "p95_turn_time": p95_turn_time,
                    "threshold": self.RAPID_ACTION_MS,
                },
            )
            
            self.db.add(alert)
            await self.db.flush()
            
            logger.warning(
                "Detected rapid actions",
                table_id=table_id,
                user_id=user_id,
                p95_turn_time=p95_turn_time,
            )
            
            return alert
        
        return None
    
    # ==================== Batch Detection ====================
    
    async def scan_table_for_anomalies(self, table_id: int) -> List[AnomalyAlert]:
        """Scan a table for all types of anomalies.
        
        Args:
            table_id: Table ID to scan
            
        Returns:
            List of detected alerts
        """
        alerts = []
        
        # Get recent hands for this table
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        
        hands_result = await self.db.execute(
            select(HandAnalytics)
            .where(
                and_(
                    HandAnalytics.table_id == table_id,
                    HandAnalytics.created_at >= hour_ago,
                )
            )
            .order_by(HandAnalytics.created_at.desc())
            .limit(100)
        )
        hands = list(hands_result.scalars().all())
        
        # Check for pot spikes
        for hand in hands:
            alert = await self.detect_pot_spike(
                table_id,
                hand.hand_id,
                hand.total_pot,
            )
            if alert:
                alerts.append(alert)
        
        # Check for timeout surges
        alert = await self.detect_timeout_surge(table_id)
        if alert:
            alerts.append(alert)
        
        return alerts
    
    async def scan_all_active_tables(self) -> List[AnomalyAlert]:
        """Scan all active tables for anomalies.
        
        Returns:
            List of all detected alerts
        """
        # Get active tables
        tables_result = await self.db.execute(
            select(Table.id)
            .where(Table.status == "active")
        )
        table_ids = [row[0] for row in tables_result.all()]
        
        all_alerts = []
        for table_id in table_ids:
            alerts = await self.scan_table_for_anomalies(table_id)
            all_alerts.extend(alerts)
        
        logger.info("Scanned tables for anomalies", tables=len(table_ids), alerts=len(all_alerts))
        
        return all_alerts
    
    # ==================== Alert Management ====================
    
    async def get_open_alerts(
        self,
        alert_type: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
    ) -> List[AnomalyAlert]:
        """Get open alerts.
        
        Args:
            alert_type: Optional filter by alert type
            severity: Optional filter by severity
            limit: Maximum number of alerts to return
            
        Returns:
            List of open alerts
        """
        query = select(AnomalyAlert).where(
            AnomalyAlert.status == "open"
        ).order_by(AnomalyAlert.created_at.desc())
        
        if alert_type:
            query = query.where(AnomalyAlert.alert_type == alert_type)
        
        if severity:
            query = query.where(AnomalyAlert.severity == severity)
        
        query = query.limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def review_alert(
        self,
        alert_id: int,
        reviewed_by: int,
        new_status: str = "reviewed",
    ):
        """Mark alert as reviewed.
        
        Args:
            alert_id: Alert ID
            reviewed_by: Admin user ID
            new_status: New status (reviewed or dismissed)
        """
        result = await self.db.execute(
            select(AnomalyAlert).where(AnomalyAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        
        if not alert:
            logger.warning("Alert not found", alert_id=alert_id)
            return
        
        alert.status = new_status
        alert.reviewed_at = datetime.now(timezone.utc)
        alert.reviewed_by = reviewed_by
        
        await self.db.flush()
        
        logger.info(
            "Reviewed alert",
            alert_id=alert_id,
            reviewed_by=reviewed_by,
            new_status=new_status,
        )
