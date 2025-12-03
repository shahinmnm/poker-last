"""Insights Delivery Engine for analyzing analytics and generating actionable insights."""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from enum import Enum
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    TableSnapshot,
    HourlyTableStats,
    Table,
    TableStatus,
)

logger = get_logger(__name__)


class InsightType(str, Enum):
    """Types of insights that can be generated."""
    
    UNUSUAL_ACTIVITY = "unusual_activity"
    HIGH_TRAFFIC = "high_traffic"
    LOW_TRAFFIC = "low_traffic"
    WAITLIST_SURGE = "waitlist_surge"
    INACTIVITY_PATTERN = "inactivity_pattern"
    RAPID_PLAYER_CHANGE = "rapid_player_change"


class InsightSeverity(str, Enum):
    """Severity levels for insights."""
    
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Insight:
    """Represents a generated insight about table or system behavior."""
    
    def __init__(
        self,
        insight_type: InsightType,
        severity: InsightSeverity,
        title: str,
        message: str,
        table_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.insight_type = insight_type
        self.severity = severity
        self.title = title
        self.message = message
        self.table_id = table_id
        self.metadata = metadata or {}
        self.timestamp = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert insight to dictionary for serialization."""
        return {
            "type": self.insight_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "table_id": self.table_id,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
        }


class InsightsEngine:
    """Engine for analyzing analytics data and generating insights."""
    
    # Configuration thresholds
    HIGH_TRAFFIC_THRESHOLD = 8  # Players
    LOW_TRAFFIC_THRESHOLD = 2   # Players
    RAPID_CHANGE_THRESHOLD = 4  # Players changed in snapshot interval
    INACTIVITY_HOURS = 2        # Hours without activity
    
    @staticmethod
    async def analyze_recent_activity(
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
            if max_players >= InsightsEngine.HIGH_TRAFFIC_THRESHOLD:
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
            if avg_players < InsightsEngine.LOW_TRAFFIC_THRESHOLD:
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
                
                if max_change >= InsightsEngine.RAPID_CHANGE_THRESHOLD:
                    insights.append(Insight(
                        insight_type=InsightType.RAPID_PLAYER_CHANGE,
                        severity=InsightSeverity.WARNING,
                        title=f"Rapid player change on table {table_id}",
                        message=f"Player count changed by {max_change} in a single interval",
                        table_id=table_id,
                        metadata={"max_change": max_change, "period_hours": hours},
                    ))
        
        return insights
    
    @staticmethod
    async def detect_inactivity_patterns(
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
            hours=InsightsEngine.INACTIVITY_HOURS
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
    
    @staticmethod
    async def analyze_waitlist_trends(
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
            
            if waitlist_counts and max(waitlist_counts) > 3:
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
    
    @staticmethod
    async def generate_all_insights(
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
            await InsightsEngine.analyze_recent_activity(db, hours=analysis_hours)
        )
        all_insights.extend(
            await InsightsEngine.detect_inactivity_patterns(db)
        )
        all_insights.extend(
            await InsightsEngine.analyze_waitlist_trends(db, hours=24)
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
