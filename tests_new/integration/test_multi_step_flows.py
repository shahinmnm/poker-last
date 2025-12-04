"""High-level integration tests for multi-step flows.

This module validates end-to-end scenarios across multiple components
including table creation, waitlist, seating, and hand execution.
"""

import pytest
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_user_joins_waitlist_gets_seated_flow(db_session, sample_table, sample_users):
    """Validate complete flow: user joins waitlist → gets seated → ready for hand."""
    from telegram_poker_bot.shared.models import Seat, TableStatus
    from telegram_poker_bot.shared.services.waitlist import add_to_waitlist, get_next_waiting_player
    
    # User joins waitlist
    user = sample_users[0]
    entry = await add_to_waitlist(db_session, sample_table.id, user.id)
    assert entry is not None
    
    # Get next player from waitlist
    next_player = await get_next_waiting_player(db_session, sample_table.id)
    assert next_player.user_id == user.id
    
    # Seat the player
    seat = Seat(
        table_id=sample_table.id,
        user_id=user.id,
        position=0,
        stack=1000,
        is_sitting_out=False,
    )
    db_session.add(seat)
    await db_session.commit()
    
    # Verify seated
    await db_session.refresh(seat)
    assert seat.id is not None
    assert seat.user_id == user.id


@pytest.mark.asyncio
async def test_table_creation_with_template_to_active(db_session, sample_template, sample_users):
    """Validate flow: create table → add players → activate table."""
    from telegram_poker_bot.shared.models import Table, Seat, TableStatus, GameMode
    
    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=sample_template.id,
        creator_id=sample_users[0].id,
    )
    db_session.add(table)
    await db_session.commit()
    await db_session.refresh(table)
    
    # Add players
    for i, user in enumerate(sample_users[:2]):
        seat = Seat(
            table_id=table.id,
            user_id=user.id,
            position=i,
            stack=1000,
            is_sitting_out=False,
        )
        db_session.add(seat)
    
    await db_session.commit()
    
    # Activate table
    table.status = TableStatus.ACTIVE
    await db_session.commit()
    await db_session.refresh(table)
    
    assert table.status == TableStatus.ACTIVE


@pytest.mark.asyncio
async def test_analytics_snapshot_to_hourly_stats_flow(db_session, sample_table):
    """Validate flow: collect snapshots → generate hourly stats."""
    from telegram_poker_bot.shared.models import TableSnapshot, TableStatus
    from telegram_poker_bot.shared.services.analytics_service import AnalyticsService
    from datetime import timedelta
    
    # Set table to active
    sample_table.status = TableStatus.ACTIVE
    await db_session.commit()
    
    # Create snapshots over an hour
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    for i in range(6):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=base_time + timedelta(minutes=i * 10),
            player_count=2 + (i % 2),
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
async def test_waitlist_surge_creates_insight(db_session):
    """Validate flow: waitlist grows → analytics detects → insight generated."""
    from telegram_poker_bot.shared.models import (
        Table, TableTemplate, TableTemplateType, GameMode, TableStatus,
        User, WaitlistEntry
    )
    from telegram_poker_bot.shared.services.insights_engine import InsightsEngine
    
    # Create template and table
    template = TableTemplate(
        name="Test",
        table_type=TableTemplateType.PERSISTENT,
        config_json={"starting_stack": 1000}
    )
    db_session.add(template)
    await db_session.flush()
    
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        is_public=True,
        template_id=template.id,
    )
    db_session.add(table)
    await db_session.flush()
    
    # Create users on waitlist
    for i in range(5):
        user = User(tg_user_id=2000 + i, username=f"waiter{i}")
        db_session.add(user)
        await db_session.flush()
        
        entry = WaitlistEntry(
            table_id=table.id,
            user_id=user.id,
            entered=False,
        )
        db_session.add(entry)
    
    await db_session.commit()
    
    # Generate insights (should detect waitlist surge)
    insights = await InsightsEngine.generate_all_insights(db_session, analysis_hours=1)
    
    # Should have waitlist-related insights
    waitlist_insights = [i for i in insights if "waitlist" in i.insight_type.lower()]
    assert len(waitlist_insights) > 0


@pytest.mark.asyncio
async def test_persistent_table_lifecycle_complete_flow(db_session, sample_users):
    """Validate PERSISTENT table remains active through full lifecycle."""
    from telegram_poker_bot.shared.models import (
        Table, TableTemplate, TableTemplateType, GameMode, TableStatus, Seat
    )
    from telegram_poker_bot.shared.services.table_lifecycle import should_expire_table
    from datetime import timedelta
    
    # Create persistent template
    template = TableTemplate(
        name="Persistent Game",
        table_type=TableTemplateType.PERSISTENT,
        config_json={"starting_stack": 1000}
    )
    db_session.add(template)
    await db_session.flush()
    
    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=template.id,
        creator_id=sample_users[0].id,
        created_at=datetime.now(timezone.utc) - timedelta(days=30),  # Old table
    )
    db_session.add(table)
    await db_session.commit()
    
    # Should not expire even though old
    assert not should_expire_table(table)
    
    # Add players and activate
    for i, user in enumerate(sample_users[:2]):
        seat = Seat(
            table_id=table.id,
            user_id=user.id,
            position=i,
            stack=1000,
            is_sitting_out=False,
        )
        db_session.add(seat)
    
    table.status = TableStatus.ACTIVE
    await db_session.commit()
    
    # Still should not expire when active
    await db_session.refresh(table)
    assert not should_expire_table(table)
    assert table.status == TableStatus.ACTIVE


@pytest.mark.asyncio
async def test_template_config_propagates_to_behavior(db_session, sample_users):
    """Validate template configuration affects table behavior."""
    from telegram_poker_bot.shared.models import (
        Table, TableTemplate, TableTemplateType, GameMode, TableStatus
    )
    
    # Create template with specific config
    template = TableTemplate(
        name="Custom Config",
        table_type=TableTemplateType.EXPIRING,
        config_json={
            "starting_stack": 2000,
            "small_blind": 10,
            "big_blind": 20,
            "max_players": 9,
        }
    )
    db_session.add(template)
    await db_session.flush()
    
    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=template.id,
        creator_id=sample_users[0].id,
    )
    db_session.add(table)
    await db_session.commit()
    
    # Verify template accessible
    await db_session.refresh(table, ["template"])
    assert table.template.config_json["starting_stack"] == 2000
    assert table.template.config_json["max_players"] == 9
