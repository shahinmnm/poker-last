"""Background scheduler for periodic analytics jobs."""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.database import get_db_session
from telegram_poker_bot.shared.services.analytics_service import AnalyticsService

logger = get_logger(__name__)


class AnalyticsScheduler:
    """Scheduler for periodic analytics collection and aggregation."""

    def __init__(self):
        self._running = False
        self._snapshot_task: Optional[asyncio.Task] = None
        self._hourly_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start all periodic jobs."""
        if self._running:
            logger.warning("Analytics scheduler already running")
            return

        self._running = True
        logger.info("Starting analytics scheduler")

        # Start snapshot collection (every 5 minutes)
        self._snapshot_task = asyncio.create_task(self._snapshot_loop())

        # Start hourly stats aggregation (every hour)
        self._hourly_task = asyncio.create_task(self._hourly_stats_loop())

        # Start cleanup task (daily)
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self):
        """Stop all periodic jobs."""
        if not self._running:
            return

        logger.info("Stopping analytics scheduler")
        self._running = False

        # Cancel all tasks
        for task in [self._snapshot_task, self._hourly_task, self._cleanup_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        logger.info("Analytics scheduler stopped")

    async def _snapshot_loop(self):
        """Periodic loop to collect table snapshots."""
        logger.info("Started snapshot collection loop (5-minute interval)")
        
        while self._running:
            try:
                async with get_db_session() as db:
                    count = await AnalyticsService.collect_snapshots_for_active_tables(db)
                    logger.debug(f"Collected {count} table snapshots")
            except Exception as e:
                logger.error("Error in snapshot collection loop", error=str(e))
            
            # Wait 5 minutes before next collection
            await asyncio.sleep(300)

    async def _hourly_stats_loop(self):
        """Periodic loop to generate hourly stats."""
        logger.info("Started hourly stats aggregation loop")
        
        # Wait until the next hour boundary
        await self._wait_until_next_hour()
        
        while self._running:
            try:
                # Generate stats for the previous hour
                async with get_db_session() as db:
                    count = await AnalyticsService.generate_hourly_stats_for_all_tables(db)
                    logger.info(f"Generated {count} hourly stats records")
            except Exception as e:
                logger.error("Error in hourly stats loop", error=str(e))
            
            # Wait until next hour
            await self._wait_until_next_hour()

    async def _cleanup_loop(self):
        """Periodic loop to clean up old snapshots."""
        logger.info("Started cleanup loop (daily interval)")
        
        # Wait until the first cleanup time (e.g., 3 AM UTC)
        await self._wait_until_cleanup_time()
        
        while self._running:
            try:
                async with get_db_session() as db:
                    count = await AnalyticsService.cleanup_old_snapshots(db, days_to_keep=7)
                    logger.info(f"Cleaned up {count} old snapshots")
            except Exception as e:
                logger.error("Error in cleanup loop", error=str(e))
            
            # Wait 24 hours until next cleanup
            await asyncio.sleep(86400)

    async def _wait_until_next_hour(self):
        """Wait until the start of the next hour."""
        now = datetime.now(timezone.utc)
        next_hour = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        wait_seconds = (next_hour - now).total_seconds()
        
        if wait_seconds > 0:
            logger.debug(f"Waiting {wait_seconds:.0f}s until next hour")
            await asyncio.sleep(wait_seconds)

    async def _wait_until_cleanup_time(self):
        """Wait until the next cleanup time (3 AM UTC)."""
        now = datetime.now(timezone.utc)
        next_cleanup = now.replace(hour=3, minute=0, second=0, microsecond=0)
        
        # If we've passed 3 AM today, schedule for tomorrow
        if now >= next_cleanup:
            next_cleanup += timedelta(days=1)
        
        wait_seconds = (next_cleanup - now).total_seconds()
        
        if wait_seconds > 0:
            logger.debug(f"Waiting {wait_seconds:.0f}s until next cleanup")
            await asyncio.sleep(wait_seconds)


# Global scheduler instance
_analytics_scheduler: Optional[AnalyticsScheduler] = None


def get_analytics_scheduler() -> AnalyticsScheduler:
    """Get or create the global analytics scheduler instance."""
    global _analytics_scheduler
    if _analytics_scheduler is None:
        _analytics_scheduler = AnalyticsScheduler()
    return _analytics_scheduler
