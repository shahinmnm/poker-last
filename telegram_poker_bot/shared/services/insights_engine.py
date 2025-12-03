"""Insights Delivery Engine for analyzing analytics and generating actionable insights."""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    TableSnapshot,
    Table,
    TableStatus,
)
from telegram_poker_bot.shared.services.insights_models import (
    Insight,
    InsightType,
    InsightSeverity,
)

logger = get_logger(__name__)


class InsightsEngineConfig:
    """Configuration for insights engine thresholds.
    
    These can be overridden via environment variables or settings in production.
    """
    
    def __init__(
        self,
        high_traffic_threshold: int = 8,
        low_traffic_threshold: int = 2,
        rapid_change_threshold: int = 4,
        inactivity_hours: int = 2,
        waitlist_surge_threshold: int = 3,
    ):
        self.high_traffic_threshold = high_traffic_threshold
        self.low_traffic_threshold = low_traffic_threshold
        self.rapid_change_threshold = rapid_change_threshold
        self.inactivity_hours = inactivity_hours
        self.waitlist_surge_threshold = waitlist_surge_threshold


class InsightsEngine:
    """Engine for analyzing analytics data and generating insights."""
    
    def __init__(self, config: Optional[InsightsEngineConfig] = None):
        """Initialize insights engine with optional configuration.
        
        Args:
            config: Optional configuration for thresholds
        """
        self.config = config or InsightsEngineConfig()
    
    async def analyze_recent_activity(
        self,
        db: AsyncSession,
        hours: int = 1,
    ) -> List[Insight]:
        """Analyze recent activity and generate insights.
        
        Args:
            db: Database session
            hours: Number of hours to analyze
            
        Returns:
            List of generated insights
        """
        insights: List[Insight] = []
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        # Get recent snapshots
        result = await db.execute(
            select(TableSnapshot)
            .where(TableSnapshot.snapshot_time >= cutoff_time)
            .order_by(TableSnapshot.table_id, TableSnapshot.snapshot_time)
        )
        snapshots = result.scalars().all()
        
        # Group snapshots by table
        snapshots_by_table: Dict[int, List[TableSnapshot]] = {}
        for snapshot in snapshots:
            if snapshot.table_id not in snapshots_by_table:
                snapshots_by_table[snapshot.table_id] = []
            snapshots_by_table[snapshot.table_id].append(snapshot)
        
        # Analyze each table
        for table_id, table_snapshots in snapshots_by_table.items():
            if not table_snapshots:
                continue
            
            # Check for high traffic
            max_players = max(s.player_count for s in table_snapshots)
            if max_players >= self.config.high_traffic_threshold:
                insights.append(Insight(
                    insight_type=InsightType.HIGH_TRAFFIC,
                    severity=InsightSeverity.INFO,
                    title=f"High traffic on table {table_id}",
                    message=f"Table reached {max_players} players in the last {hours} hour(s)",
                    table_id=table_id,
                    metadata={"max_players": max_players, "period_hours": hours},
                ))
            
            # Check for low traffic
            avg_players = sum(s.player_count for s in table_snapshots) / len(table_snapshots)
            if avg_players < self.config.low_traffic_threshold:
                insights.append(Insight(
                    insight_type=InsightType.LOW_TRAFFIC,
                    severity=InsightSeverity.WARNING,
                    title=f"Low traffic on table {table_id}",
                    message=f"Table averaged {avg_players:.1f} players in the last {hours} hour(s)",
                    table_id=table_id,
                    metadata={"avg_players": avg_players, "period_hours": hours},
                ))
            
            # Check for rapid player changes
            if len(table_snapshots) >= 2:
                player_changes = [
                    abs(table_snapshots[i].player_count - table_snapshots[i-1].player_count)
                    for i in range(1, len(table_snapshots))
                ]
                max_change = max(player_changes) if player_changes else 0
                
                if max_change >= self.config.rapid_change_threshold:
                    insights.append(Insight(
                        insight_type=InsightType.RAPID_PLAYER_CHANGE,
                        severity=InsightSeverity.WARNING,
                        title=f"Rapid player change on table {table_id}",
                        message=f"Player count changed by {max_change} in a single interval",
                        table_id=table_id,
                        metadata={"max_change": max_change, "period_hours": hours},
                    ))
        
        return insights
    
    async def detect_inactivity_patterns(
        self,
        db: AsyncSession,
    ) -> List[Insight]:
        """Detect tables with prolonged inactivity.
        
        Args:
            db: Database session
            
        Returns:
            List of inactivity insights
        """
        insights: List[Insight] = []
        cutoff_time = datetime.now(timezone.utc) - timedelta(
            hours=self.config.inactivity_hours
        )
        
        # Get all active/waiting tables
        result = await db.execute(
            select(Table).where(
                Table.status.in_([TableStatus.ACTIVE, TableStatus.WAITING])
            )
        )
        tables = result.scalars().all()
        
        for table in tables:
            # Get latest snapshot for this table
            snapshot_result = await db.execute(
                select(TableSnapshot)
                .where(TableSnapshot.table_id == table.id)
                .order_by(desc(TableSnapshot.snapshot_time))
                .limit(1)
            )
            latest_snapshot = snapshot_result.scalar_one_or_none()
            
            if latest_snapshot and latest_snapshot.snapshot_time < cutoff_time:
                hours_inactive = (
                    datetime.now(timezone.utc) - latest_snapshot.snapshot_time
                ).total_seconds() / 3600
                
                insights.append(Insight(
                    insight_type=InsightType.INACTIVITY_PATTERN,
                    severity=InsightSeverity.WARNING,
                    title=f"Prolonged inactivity on table {table.id}",
                    message=f"No activity for {hours_inactive:.1f} hours",
                    table_id=table.id,
                    metadata={
                        "hours_inactive": hours_inactive,
                        "last_snapshot_time": latest_snapshot.snapshot_time.isoformat(),
                    },
                ))
        
        return insights
    
    async def analyze_waitlist_trends(
        self,
        db: AsyncSession,
        hours: int = 24,
    ) -> List[Insight]:
        """Analyze waitlist patterns from metadata.
        
        Args:
            db: Database session
            hours: Number of hours to analyze
            
        Returns:
            List of waitlist insights
        """
        insights: List[Insight] = []
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        # Get recent snapshots with waitlist metadata
        result = await db.execute(
            select(TableSnapshot)
            .where(TableSnapshot.snapshot_time >= cutoff_time)
            .order_by(TableSnapshot.table_id, TableSnapshot.snapshot_time)
        )
        snapshots = result.scalars().all()
        
        # Group by table and check for waitlist surges
        snapshots_by_table: Dict[int, List[TableSnapshot]] = {}
        for snapshot in snapshots:
            if snapshot.table_id not in snapshots_by_table:
                snapshots_by_table[snapshot.table_id] = []
            snapshots_by_table[snapshot.table_id].append(snapshot)
        
        for table_id, table_snapshots in snapshots_by_table.items():
            # Extract waitlist counts from metadata
            waitlist_counts = []
            for snapshot in table_snapshots:
                metadata = snapshot.metadata_json or {}
                if "waitlist_count" in metadata:
                    waitlist_counts.append(metadata["waitlist_count"])
            
            if waitlist_counts and max(waitlist_counts) > self.config.waitlist_surge_threshold:
                max_waitlist = max(waitlist_counts)
                insights.append(Insight(
                    insight_type=InsightType.WAITLIST_SURGE,
                    severity=InsightSeverity.INFO,
                    title=f"Waitlist surge on table {table_id}",
                    message=f"Waitlist reached {max_waitlist} players in the last {hours} hour(s)",
                    table_id=table_id,
                    metadata={"max_waitlist": max_waitlist, "period_hours": hours},
                ))
        
        return insights
    
    async def generate_all_insights(
        self,
        db: AsyncSession,
        analysis_hours: int = 1,
    ) -> List[Insight]:
        """Generate all types of insights.
        
        Args:
            db: Database session
            analysis_hours: Hours of data to analyze for recent activity
            
        Returns:
            Combined list of all insights
        """
        all_insights: List[Insight] = []
        
        # Gather insights from different analyzers
        all_insights.extend(
            await self.analyze_recent_activity(db, hours=analysis_hours)
        )
        all_insights.extend(
            await self.detect_inactivity_patterns(db)
        )
        all_insights.extend(
            await self.analyze_waitlist_trends(db, hours=24)
        )
        
        logger.info(
            "Generated insights",
            total_count=len(all_insights),
            by_type={
                t.value: sum(1 for i in all_insights if i.insight_type == t)
                for t in InsightType
            },
        )
        
        return all_insights


# Singleton instance with default configuration
_default_engine: Optional[InsightsEngine] = None


def get_insights_engine(config: Optional[InsightsEngineConfig] = None) -> InsightsEngine:
    """Get or create the default insights engine instance.
    
    Args:
        config: Optional configuration for thresholds
        
    Returns:
        InsightsEngine instance
    """
    global _default_engine
    if _default_engine is None or config is not None:
        _default_engine = InsightsEngine(config)
    return _default_engine
