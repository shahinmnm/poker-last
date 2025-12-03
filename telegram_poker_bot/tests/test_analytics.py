"""Tests for analytics service and scheduler."""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select

from telegram_poker_bot.shared.models import (
    Table,
    TableSnapshot,
    HourlyTableStats,
    TableStatus,
    TableTemplate,
    TableTemplateType,
    User,
    Seat,
    Hand,
    HandStatus,
    GameMode,
)
from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
from telegram_poker_bot.shared.database import get_db_session


@pytest.mark.asyncio
async def test_create_table_snapshot():
    """Test creating a snapshot of a table's current state."""
    async with get_db_session() as db:
        # Create a test user
        user = User(tg_user_id=12345, username="testuser")
        db.add(user)
        await db.flush()

        # Create a test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create a test table
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db.add(table)
        await db.flush()

        # Add seats to the table
        seat1 = Seat(
            table_id=table.id,
            user_id=user.id,
            position=0,
            chips=1000,
        )
        db.add(seat1)
        await db.flush()

        # Create snapshot
        snapshot = await AnalyticsService.create_table_snapshot(db, table.id)

        assert snapshot is not None
        assert snapshot.table_id == table.id
        assert snapshot.player_count == 1
        assert snapshot.is_active is True
        assert snapshot.metadata_json["status"] == "active"


@pytest.mark.asyncio
async def test_create_snapshot_inactive_table():
    """Test creating a snapshot for an inactive table."""
    async with get_db_session() as db:
        # Create a test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create a waiting table with no players
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.WAITING,
            template_id=template.id,
            is_public=True,
        )
        db.add(table)
        await db.flush()

        # Create snapshot
        snapshot = await AnalyticsService.create_table_snapshot(db, table.id)

        assert snapshot is not None
        assert snapshot.table_id == table.id
        assert snapshot.player_count == 0
        assert snapshot.is_active is False


@pytest.mark.asyncio
async def test_create_snapshot_nonexistent_table():
    """Test creating a snapshot for a table that doesn't exist."""
    async with get_db_session() as db:
        snapshot = await AnalyticsService.create_table_snapshot(db, 99999)
        assert snapshot is None


@pytest.mark.asyncio
async def test_collect_snapshots_for_active_tables():
    """Test collecting snapshots for all active tables."""
    async with get_db_session() as db:
        # Create test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create multiple tables in different states
        table1 = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        table2 = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.WAITING,
            template_id=template.id,
            is_public=True,
        )
        table3 = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ENDED,
            template_id=template.id,
            is_public=True,
        )
        db.add_all([table1, table2, table3])
        await db.flush()

        # Collect snapshots
        count = await AnalyticsService.collect_snapshots_for_active_tables(db)

        # Should create snapshots for active and waiting tables, not ended
        assert count == 2

        # Verify snapshots were created
        result = await db.execute(select(TableSnapshot))
        snapshots = result.scalars().all()
        assert len(snapshots) == 2


@pytest.mark.asyncio
async def test_generate_hourly_stats():
    """Test generating hourly aggregated stats for a table."""
    async with get_db_session() as db:
        # Create test user
        user = User(tg_user_id=54321, username="testuser2")
        db.add(user)
        await db.flush()

        # Create test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create test table
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db.add(table)
        await db.flush()

        # Create snapshots for the last hour
        hour_start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        for i in range(12):  # 12 snapshots over an hour (5-min intervals)
            snapshot_time = hour_start + timedelta(minutes=i * 5)
            snapshot = TableSnapshot(
                table_id=table.id,
                snapshot_time=snapshot_time,
                player_count=3 + (i % 3),  # Varying player count
                is_active=True,
            )
            db.add(snapshot)
        await db.flush()

        # Create some hands in this hour
        for i in range(5):
            hand = Hand(
                table_id=table.id,
                hand_no=i + 1,
                status=HandStatus.ENDED,
                engine_state_json={},
                started_at=hour_start + timedelta(minutes=i * 10),
            )
            db.add(hand)
        await db.flush()

        # Generate hourly stats
        stats = await AnalyticsService.generate_hourly_stats(db, table.id, hour_start)

        assert stats is not None
        assert stats.table_id == table.id
        assert stats.hour_start == hour_start
        assert stats.avg_players == 4  # Average of varying player counts
        assert stats.max_players >= 3
        assert stats.total_hands == 5
        assert stats.activity_minutes == 60  # 12 active snapshots * 5 min


@pytest.mark.asyncio
async def test_generate_hourly_stats_no_data():
    """Test generating hourly stats when no snapshots exist."""
    async with get_db_session() as db:
        # Create test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create test table
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db.add(table)
        await db.flush()

        hour_start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        # Try to generate stats with no snapshots
        stats = await AnalyticsService.generate_hourly_stats(db, table.id, hour_start)

        assert stats is None


@pytest.mark.asyncio
async def test_generate_hourly_stats_for_all_tables():
    """Test generating hourly stats for all tables that had activity."""
    async with get_db_session() as db:
        # Create test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create multiple tables
        table1 = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        table2 = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.WAITING,
            template_id=template.id,
            is_public=True,
        )
        db.add_all([table1, table2])
        await db.flush()

        # Create snapshots for both tables in the previous hour
        hour_start = datetime.now(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        ) - timedelta(hours=1)

        for table in [table1, table2]:
            for i in range(6):
                snapshot = TableSnapshot(
                    table_id=table.id,
                    snapshot_time=hour_start + timedelta(minutes=i * 10),
                    player_count=2,
                    is_active=True,
                )
                db.add(snapshot)
        await db.flush()

        # Generate hourly stats for all tables
        count = await AnalyticsService.generate_hourly_stats_for_all_tables(db, hour_start)

        assert count == 2

        # Verify stats were created for both tables
        result = await db.execute(
            select(HourlyTableStats).where(HourlyTableStats.hour_start == hour_start)
        )
        stats = result.scalars().all()
        assert len(stats) == 2


@pytest.mark.asyncio
async def test_cleanup_old_snapshots():
    """Test cleaning up old snapshots."""
    async with get_db_session() as db:
        # Create test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create test table
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db.add(table)
        await db.flush()

        # Create old snapshots (10 days old)
        old_time = datetime.now(timezone.utc) - timedelta(days=10)
        for i in range(5):
            snapshot = TableSnapshot(
                table_id=table.id,
                snapshot_time=old_time + timedelta(minutes=i * 10),
                player_count=2,
                is_active=True,
            )
            db.add(snapshot)

        # Create recent snapshots (1 day old)
        recent_time = datetime.now(timezone.utc) - timedelta(days=1)
        for i in range(5):
            snapshot = TableSnapshot(
                table_id=table.id,
                snapshot_time=recent_time + timedelta(minutes=i * 10),
                player_count=3,
                is_active=True,
            )
            db.add(snapshot)
        await db.flush()

        # Clean up old snapshots (keep 7 days)
        deleted_count = await AnalyticsService.cleanup_old_snapshots(db, days_to_keep=7)

        assert deleted_count >= 5  # At least 5 from this test

        # Verify only recent snapshots remain for this table
        result = await db.execute(
            select(TableSnapshot).where(TableSnapshot.table_id == table.id)
        )
        remaining_snapshots = result.scalars().all()
        assert len(remaining_snapshots) == 5
        assert all(s.player_count == 3 for s in remaining_snapshots)


@pytest.mark.asyncio
async def test_hourly_stats_update_existing():
    """Test that generating hourly stats updates existing records."""
    async with get_db_session() as db:
        # Create test template
        template = TableTemplate(
            name="Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=False,
            config_json={"max_players": 6},
        )
        db.add(template)
        await db.flush()

        # Create test table
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db.add(table)
        await db.flush()

        hour_start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        # Create initial snapshot
        snapshot1 = TableSnapshot(
            table_id=table.id,
            snapshot_time=hour_start + timedelta(minutes=5),
            player_count=2,
            is_active=True,
        )
        db.add(snapshot1)
        await db.flush()

        # Generate initial stats
        stats1 = await AnalyticsService.generate_hourly_stats(db, table.id, hour_start)
        assert stats1.max_players == 2

        # Add more snapshots
        snapshot2 = TableSnapshot(
            table_id=table.id,
            snapshot_time=hour_start + timedelta(minutes=15),
            player_count=5,
            is_active=True,
        )
        db.add(snapshot2)
        await db.flush()

        # Regenerate stats
        stats2 = await AnalyticsService.generate_hourly_stats(db, table.id, hour_start)

        # Should update the same record
        assert stats2.id == stats1.id
        assert stats2.max_players == 5

        # Verify only one stats record exists
        result = await db.execute(
            select(HourlyTableStats).where(
                HourlyTableStats.table_id == table.id,
                HourlyTableStats.hour_start == hour_start,
            )
        )
        all_stats = result.scalars().all()
        assert len(all_stats) == 1
