"""Analytics service for periodic table snapshots and hourly stats."""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    Table,
    TableSnapshot,
    HourlyTableStats,
    TableStatus,
    Seat,
    Hand,
)

logger = get_logger(__name__)


class AnalyticsService:
    """Service for collecting and aggregating table analytics."""

    @staticmethod
    async def create_table_snapshot(
        db: AsyncSession,
        table_id: int,
    ) -> Optional[TableSnapshot]:
        """Create a lightweight snapshot of a table's current state.
        
        Args:
            db: Database session
            table_id: ID of the table to snapshot
            
        Returns:
            Created snapshot or None if table not found
        """
        # Get table with seats
        result = await db.execute(
            select(Table)
            .where(Table.id == table_id)
            .options(joinedload(Table.seats))
        )
        table = result.unique().scalar_one_or_none()
        
        if not table:
            logger.warning("Table not found for snapshot", table_id=table_id)
            return None
        
        # Count active players (not left)
        active_seats = [s for s in table.seats if s.left_at is None]
        player_count = len(active_seats)
        
        # Table is active if it's in ACTIVE status
        is_active = table.status == TableStatus.ACTIVE
        
        snapshot = TableSnapshot(
            table_id=table_id,
            player_count=player_count,
            is_active=is_active,
            metadata_json={
                "status": table.status.value if table.status else None,
            }
        )
        
        db.add(snapshot)
        await db.flush()
        
        logger.info(
            "Created table snapshot",
            table_id=table_id,
            player_count=player_count,
            is_active=is_active,
        )
        
        return snapshot

    @staticmethod
    async def collect_snapshots_for_active_tables(db: AsyncSession) -> int:
        """Collect snapshots for all active and waiting tables.
        
        This is called periodically (e.g., every few minutes) to capture
        the current state of all tables.
        
        Args:
            db: Database session
            
        Returns:
            Number of snapshots created
        """
        # Get all tables that are not ended or expired
        result = await db.execute(
            select(Table).where(
                Table.status.in_([
                    TableStatus.WAITING,
                    TableStatus.ACTIVE,
                    TableStatus.PAUSED,
                ])
            )
        )
        tables = result.scalars().all()
        
        count = 0
        for table in tables:
            try:
                snapshot = await AnalyticsService.create_table_snapshot(db, table.id)
                if snapshot:
                    count += 1
            except Exception as e:
                logger.error(
                    "Failed to create snapshot",
                    table_id=table.id,
                    error=str(e),
                )
                continue
        
        await db.commit()
        
        logger.info("Collected snapshots for active tables", count=count)
        return count

    @staticmethod
    async def generate_hourly_stats(
        db: AsyncSession,
        table_id: int,
        hour_start: datetime,
    ) -> Optional[HourlyTableStats]:
        """Generate hourly aggregated stats for a table.
        
        Args:
            db: Database session
            table_id: ID of the table
            hour_start: Start of the hour (rounded down)
            
        Returns:
            Created hourly stats or None if no data
        """
        hour_end = hour_start + timedelta(hours=1)
        
        # Get snapshots for this hour
        result = await db.execute(
            select(TableSnapshot)
            .where(
                and_(
                    TableSnapshot.table_id == table_id,
                    TableSnapshot.snapshot_time >= hour_start,
                    TableSnapshot.snapshot_time < hour_end,
                )
            )
        )
        snapshots = result.scalars().all()
        
        if not snapshots:
            logger.debug(
                "No snapshots found for hourly stats",
                table_id=table_id,
                hour_start=hour_start,
            )
            return None
        
        # Calculate aggregated metrics
        total_players = sum(s.player_count for s in snapshots)
        avg_players = total_players // len(snapshots) if snapshots else 0
        max_players = max((s.player_count for s in snapshots), default=0)
        activity_minutes = sum(1 for s in snapshots if s.is_active) * 5  # Assuming 5-min intervals
        
        # Count hands completed in this hour
        hands_result = await db.execute(
            select(func.count(Hand.id))
            .where(
                and_(
                    Hand.table_id == table_id,
                    Hand.started_at >= hour_start,
                    Hand.started_at < hour_end,
                )
            )
        )
        total_hands = hands_result.scalar() or 0
        
        # Create or update hourly stats
        existing_result = await db.execute(
            select(HourlyTableStats)
            .where(
                and_(
                    HourlyTableStats.table_id == table_id,
                    HourlyTableStats.hour_start == hour_start,
                )
            )
        )
        existing_stats = existing_result.scalar_one_or_none()
        
        if existing_stats:
            # Update existing stats
            existing_stats.avg_players = avg_players
            existing_stats.max_players = max_players
            existing_stats.total_hands = total_hands
            existing_stats.activity_minutes = activity_minutes
            stats = existing_stats
        else:
            # Create new stats
            stats = HourlyTableStats(
                table_id=table_id,
                hour_start=hour_start,
                avg_players=avg_players,
                max_players=max_players,
                total_hands=total_hands,
                activity_minutes=activity_minutes,
                metadata_json={},
            )
            db.add(stats)
        
        await db.flush()
        
        logger.info(
            "Generated hourly table stats",
            table_id=table_id,
            hour_start=hour_start,
            avg_players=avg_players,
            total_hands=total_hands,
        )
        
        return stats

    @staticmethod
    async def generate_hourly_stats_for_all_tables(
        db: AsyncSession,
        hour_start: Optional[datetime] = None,
    ) -> int:
        """Generate hourly stats for all tables.
        
        Args:
            db: Database session
            hour_start: Hour to process (defaults to previous hour)
            
        Returns:
            Number of hourly stats generated
        """
        if hour_start is None:
            # Default to previous hour
            now = datetime.now(timezone.utc)
            hour_start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
        
        # Get all tables that had activity in this hour
        hour_end = hour_start + timedelta(hours=1)
        result = await db.execute(
            select(TableSnapshot.table_id)
            .where(
                and_(
                    TableSnapshot.snapshot_time >= hour_start,
                    TableSnapshot.snapshot_time < hour_end,
                )
            )
            .distinct()
        )
        table_ids = [row[0] for row in result.all()]
        
        count = 0
        for table_id in table_ids:
            try:
                stats = await AnalyticsService.generate_hourly_stats(
                    db, table_id, hour_start
                )
                if stats:
                    count += 1
            except Exception as e:
                logger.error(
                    "Failed to generate hourly stats",
                    table_id=table_id,
                    hour_start=hour_start,
                    error=str(e),
                )
                continue
        
        await db.commit()
        
        logger.info(
            "Generated hourly stats for all tables",
            count=count,
            hour_start=hour_start,
        )
        return count

    @staticmethod
    async def cleanup_old_snapshots(
        db: AsyncSession,
        days_to_keep: int = 7,
    ) -> int:
        """Clean up old snapshots to prevent unbounded growth.
        
        Args:
            db: Database session
            days_to_keep: Number of days of snapshots to keep
            
        Returns:
            Number of snapshots deleted
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
        
        result = await db.execute(
            select(func.count(TableSnapshot.id))
            .where(TableSnapshot.snapshot_time < cutoff_time)
        )
        count_before = result.scalar() or 0
        
        if count_before > 0:
            await db.execute(
                TableSnapshot.__table__.delete()
                .where(TableSnapshot.snapshot_time < cutoff_time)
            )
            await db.commit()
            
            logger.info(
                "Cleaned up old snapshots",
                deleted_count=count_before,
                cutoff_time=cutoff_time,
            )
        
        return count_before
