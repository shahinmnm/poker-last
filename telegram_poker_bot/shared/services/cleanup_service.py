"""Cleanup and retention service for analytics data.

Implements retention policies to manage database size and comply with
data retention requirements.

Retention policies:
- Raw hands/events: 30-90 days
- Aggregates: 12-18 months
- Table snapshots: 30-60 days
- Redis windows: auto-expire
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from sqlalchemy import select, and_, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    HandAnalytics,
    PlayerSession,
    HourlyTableStats,
    HourlyPlayerStats,
    LeaderboardSnapshot,
    TableSnapshot,
    AnomalyAlert,
    AnalyticsJob,
    HandHistory,
    HandHistoryEvent,
)

logger = get_logger(__name__)


class CleanupService:
    """Manages data retention and cleanup for analytics."""
    
    # Retention periods in days
    RAW_HANDS_RETENTION_DAYS = 90
    RAW_EVENTS_RETENTION_DAYS = 30
    AGGREGATES_RETENTION_DAYS = 547  # 18 months
    SNAPSHOTS_RETENTION_DAYS = 60
    ALERTS_RETENTION_DAYS = 90
    COMPLETED_JOBS_RETENTION_DAYS = 30
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ==================== Cleanup Methods ====================
    
    async def cleanup_old_hand_analytics(self) -> int:
        """Clean up old hand analytics records.
        
        Returns:
            Number of records deleted
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.RAW_HANDS_RETENTION_DAYS)
        
        # Count before deletion
        count_result = await self.db.execute(
            select(func.count(HandAnalytics.id))
            .where(HandAnalytics.created_at < cutoff)
        )
        count = count_result.scalar() or 0
        
        if count == 0:
            logger.info("No old hand analytics to clean up")
            return 0
        
        # Delete old records
        await self.db.execute(
            delete(HandAnalytics)
            .where(HandAnalytics.created_at < cutoff)
        )
        await self.db.commit()
        
        logger.info("Cleaned up hand analytics", count=count, cutoff=cutoff.isoformat())
        return count
    
    async def cleanup_old_hand_history_events(self) -> int:
        """Clean up old hand history events.
        
        Returns:
            Number of records deleted
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.RAW_EVENTS_RETENTION_DAYS)
        
        count_result = await self.db.execute(
            select(func.count(HandHistoryEvent.id))
            .where(HandHistoryEvent.created_at < cutoff)
        )
        count = count_result.scalar() or 0
        
        if count == 0:
            logger.info("No old hand history events to clean up")
            return 0
        
        await self.db.execute(
            delete(HandHistoryEvent)
            .where(HandHistoryEvent.created_at < cutoff)
        )
        await self.db.commit()
        
        logger.info("Cleaned up hand history events", count=count, cutoff=cutoff.isoformat())
        return count
    
    async def cleanup_old_table_snapshots(self) -> int:
        """Clean up old table snapshots.
        
        Returns:
            Number of records deleted
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.SNAPSHOTS_RETENTION_DAYS)
        
        count_result = await self.db.execute(
            select(func.count(TableSnapshot.id))
            .where(TableSnapshot.snapshot_time < cutoff)
        )
        count = count_result.scalar() or 0
        
        if count == 0:
            logger.info("No old table snapshots to clean up")
            return 0
        
        await self.db.execute(
            delete(TableSnapshot)
            .where(TableSnapshot.snapshot_time < cutoff)
        )
        await self.db.commit()
        
        logger.info("Cleaned up table snapshots", count=count, cutoff=cutoff.isoformat())
        return count
    
    async def cleanup_old_hourly_aggregates(self) -> int:
        """Clean up old hourly aggregates.
        
        Returns:
            Number of records deleted
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.AGGREGATES_RETENTION_DAYS)
        
        # Clean table stats
        table_count_result = await self.db.execute(
            select(func.count(HourlyTableStats.id))
            .where(HourlyTableStats.hour_start < cutoff)
        )
        table_count = table_count_result.scalar() or 0
        
        if table_count > 0:
            await self.db.execute(
                delete(HourlyTableStats)
                .where(HourlyTableStats.hour_start < cutoff)
            )
        
        # Clean player stats
        player_count_result = await self.db.execute(
            select(func.count(HourlyPlayerStats.id))
            .where(HourlyPlayerStats.hour_start < cutoff)
        )
        player_count = player_count_result.scalar() or 0
        
        if player_count > 0:
            await self.db.execute(
                delete(HourlyPlayerStats)
                .where(HourlyPlayerStats.hour_start < cutoff)
            )
        
        await self.db.commit()
        
        total_count = table_count + player_count
        logger.info(
            "Cleaned up hourly aggregates",
            table_stats=table_count,
            player_stats=player_count,
            total=total_count,
            cutoff=cutoff.isoformat(),
        )
        return total_count
    
    async def cleanup_old_anomaly_alerts(self) -> int:
        """Clean up old anomaly alerts (reviewed/dismissed only).
        
        Returns:
            Number of records deleted
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.ALERTS_RETENTION_DAYS)
        
        count_result = await self.db.execute(
            select(func.count(AnomalyAlert.id))
            .where(
                and_(
                    AnomalyAlert.created_at < cutoff,
                    AnomalyAlert.status.in_(["reviewed", "dismissed"]),
                )
            )
        )
        count = count_result.scalar() or 0
        
        if count == 0:
            logger.info("No old anomaly alerts to clean up")
            return 0
        
        await self.db.execute(
            delete(AnomalyAlert)
            .where(
                and_(
                    AnomalyAlert.created_at < cutoff,
                    AnomalyAlert.status.in_(["reviewed", "dismissed"]),
                )
            )
        )
        await self.db.commit()
        
        logger.info("Cleaned up anomaly alerts", count=count, cutoff=cutoff.isoformat())
        return count
    
    async def cleanup_completed_jobs(self) -> int:
        """Clean up old completed analytics jobs.
        
        Returns:
            Number of records deleted
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.COMPLETED_JOBS_RETENTION_DAYS)
        
        count_result = await self.db.execute(
            select(func.count(AnalyticsJob.id))
            .where(
                and_(
                    AnalyticsJob.completed_at < cutoff,
                    AnalyticsJob.status == "completed",
                )
            )
        )
        count = count_result.scalar() or 0
        
        if count == 0:
            logger.info("No old completed jobs to clean up")
            return 0
        
        await self.db.execute(
            delete(AnalyticsJob)
            .where(
                and_(
                    AnalyticsJob.completed_at < cutoff,
                    AnalyticsJob.status == "completed",
                )
            )
        )
        await self.db.commit()
        
        logger.info("Cleaned up completed jobs", count=count, cutoff=cutoff.isoformat())
        return count
    
    # ==================== Vacuum and Optimize ====================
    
    async def vacuum_tables(self):
        """Run VACUUM ANALYZE on analytics tables to reclaim space.
        
        Note: This requires a raw connection and cannot run in a transaction.
        """
        tables = [
            "hand_analytics",
            "hand_history_events",
            "table_snapshots",
            "hourly_table_stats",
            "hourly_player_stats",
            "anomaly_alerts",
            "analytics_jobs",
        ]
        
        # This is a placeholder - actual implementation would need raw connection
        logger.info("Vacuum operation placeholder", tables=tables)
        # TODO: Implement actual VACUUM using raw connection
        # Example:
        # async with engine.begin() as conn:
        #     await conn.execute(text("VACUUM ANALYZE hand_analytics"))
    
    # ==================== Full Cleanup ====================
    
    async def run_full_cleanup(self) -> Dict[str, int]:
        """Run full cleanup of all analytics data.
        
        Returns:
            Dictionary with counts of deleted records by category
        """
        logger.info("Starting full analytics cleanup")
        
        results = {
            "hand_analytics": await self.cleanup_old_hand_analytics(),
            "hand_history_events": await self.cleanup_old_hand_history_events(),
            "table_snapshots": await self.cleanup_old_table_snapshots(),
            "hourly_aggregates": await self.cleanup_old_hourly_aggregates(),
            "anomaly_alerts": await self.cleanup_old_anomaly_alerts(),
            "completed_jobs": await self.cleanup_completed_jobs(),
        }
        
        total = sum(results.values())
        logger.info("Completed full analytics cleanup", total=total, breakdown=results)
        
        # Optionally run vacuum
        await self.vacuum_tables()
        
        return results
    
    # ==================== Reporting ====================
    
    async def get_storage_stats(self) -> Dict[str, int]:
        """Get storage statistics for analytics tables.
        
        Returns:
            Dictionary with record counts by table
        """
        stats = {}
        
        # Hand analytics
        result = await self.db.execute(select(func.count(HandAnalytics.id)))
        stats["hand_analytics"] = result.scalar() or 0
        
        # Hand history events
        result = await self.db.execute(select(func.count(HandHistoryEvent.id)))
        stats["hand_history_events"] = result.scalar() or 0
        
        # Table snapshots
        result = await self.db.execute(select(func.count(TableSnapshot.id)))
        stats["table_snapshots"] = result.scalar() or 0
        
        # Hourly table stats
        result = await self.db.execute(select(func.count(HourlyTableStats.id)))
        stats["hourly_table_stats"] = result.scalar() or 0
        
        # Hourly player stats
        result = await self.db.execute(select(func.count(HourlyPlayerStats.id)))
        stats["hourly_player_stats"] = result.scalar() or 0
        
        # Anomaly alerts
        result = await self.db.execute(select(func.count(AnomalyAlert.id)))
        stats["anomaly_alerts"] = result.scalar() or 0
        
        # Analytics jobs
        result = await self.db.execute(select(func.count(AnalyticsJob.id)))
        stats["analytics_jobs"] = result.scalar() or 0
        
        # Player sessions
        result = await self.db.execute(select(func.count(PlayerSession.id)))
        stats["player_sessions"] = result.scalar() or 0
        
        stats["total"] = sum(stats.values())
        
        logger.info("Storage statistics", stats=stats)
        return stats
