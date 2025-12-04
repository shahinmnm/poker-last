"""High-level tests for analytics aggregation (Phase 3).

This module validates the analytics service functionality including
snapshot collection and hourly statistics generation.
"""

import pytest
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_create_table_snapshot(db_session, sample_table):
    """Validate snapshot creation for active table."""
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    from telegram_poker_bot.shared.models import TableStatus
    
    # Make table active
    sample_table.status = TableStatus.ACTIVE
    await db_session.commit()
    
    # Create snapshot
    snapshot = await AnalyticsService.create_table_snapshot(db_session, sample_table.id)
    
    assert snapshot is not None
    assert snapshot.table_id == sample_table.id
    assert snapshot.snapshot_time is not None


@pytest.mark.asyncio
async def test_collect_snapshots_for_multiple_tables(db_session, sample_template, sample_users):
    """Validate snapshot collection across multiple active tables."""
    from telegram_poker_bot.shared.models import Table, TableStatus, GameMode
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    
    # Create multiple active tables
    tables = []
    for i in range(3):
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            is_public=True,
            template_id=sample_template.id,
            creator_id=sample_users[0].id,
        )
        db_session.add(table)
        tables.append(table)
    
    await db_session.commit()
    
    # Collect snapshots
    snapshots = await AnalyticsService.collect_snapshots_for_active_tables(db_session)
    
    assert len(snapshots) == 3


@pytest.mark.asyncio
async def test_generate_hourly_stats(db_session, sample_table):
    """Validate hourly statistics generation from snapshots."""
    from telegram_poker_bot.shared.models import TableSnapshot, TableStatus
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    
    # Make table active
    sample_table.status = TableStatus.ACTIVE
    await db_session.commit()
    
    # Create some snapshots
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    for i in range(5):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=base_time + timedelta(minutes=i * 10),
            player_count=2 + (i % 3),
            is_active=True,
            metadata_json={}
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Generate hourly stats
    stats = await AnalyticsService.generate_hourly_stats(
        db_session, sample_table.id, base_time
    )
    
    assert stats is not None
    assert stats.table_id == sample_table.id
    assert stats.avg_players > 0


@pytest.mark.asyncio
async def test_cleanup_old_snapshots(db_session, sample_table):
    """Validate cleanup of old snapshot data."""
    from telegram_poker_bot.shared.models import TableSnapshot
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    
    # Create old snapshot
    old_snapshot = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=datetime.now(timezone.utc) - timedelta(days=10),
        player_count=2,
        is_active=True,
        metadata_json={}
    )
    db_session.add(old_snapshot)
    
    # Create recent snapshot
    recent_snapshot = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=datetime.now(timezone.utc),
        player_count=3,
        is_active=True,
        metadata_json={}
    )
    db_session.add(recent_snapshot)
    await db_session.commit()
    
    # Cleanup old snapshots (keep 7 days)
    deleted = await AnalyticsService.cleanup_old_snapshots(db_session, days_to_keep=7)
    
    assert deleted > 0


@pytest.mark.asyncio
async def test_analytics_does_not_affect_gameplay(db_session, sample_table):
    """Validate analytics operations don't modify table state."""
    from telegram_poker_bot.shared.models import TableStatus
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    
    # Store original state
    original_status = sample_table.status
    sample_table.status = TableStatus.ACTIVE
    await db_session.commit()
    
    # Collect snapshot
    await AnalyticsService.create_table_snapshot(db_session, sample_table.id)
    
    # Refresh and verify state unchanged
    await db_session.refresh(sample_table)
    assert sample_table.status == TableStatus.ACTIVE


@pytest.mark.asyncio
async def test_hourly_stats_for_all_tables(db_session, sample_template, sample_users):
    """Validate hourly stats generation for all tables."""
    from telegram_poker_bot.shared.models import (
        Table, TableStatus, GameMode, TableSnapshot
    )
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    
    # Create tables with snapshots
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    for i in range(2):
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            is_public=True,
            template_id=sample_template.id,
            creator_id=sample_users[0].id,
        )
        db_session.add(table)
        await db_session.flush()
        
        # Add snapshot
        snapshot = TableSnapshot(
            table_id=table.id,
            snapshot_time=base_time + timedelta(minutes=10),
            player_count=2,
            is_active=True,
            metadata_json={}
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Generate hourly stats for all
    stats_list = await AnalyticsService.generate_hourly_stats_for_all_tables(
        db_session, base_time
    )
    
    assert len(stats_list) == 2
