"""High-level tests for admin insights API (Phase 4).

This module validates the insights engine and delivery system
for detecting patterns and delivering notifications.
"""

import pytest
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_insights_engine_detects_high_traffic(db_session):
    """Validate insights engine detects high traffic patterns."""
    from telegram_poker_bot.shared.models import HourlyTableStats
    from telegram_poker_bot.shared.services.insights_engine import InsightsEngine
    
    # Create stats with high player count
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    stats = HourlyTableStats(
        table_id=1,
        hour_start=base_time,
        avg_players=9,  # High traffic
        max_players=10,
        total_hands=15,
        activity_minutes=60,
        metadata_json={}
    )
    db_session.add(stats)
    await db_session.commit()
    
    # Generate insights
    insights = await InsightsEngine.generate_all_insights(db_session, analysis_hours=1)
    
    # Should detect high traffic
    high_traffic_insights = [i for i in insights if i.insight_type == "high_traffic"]
    assert len(high_traffic_insights) > 0


@pytest.mark.asyncio
async def test_insights_engine_detects_low_traffic(db_session):
    """Validate insights engine detects low traffic patterns."""
    from telegram_poker_bot.shared.models import HourlyTableStats
    from telegram_poker_bot.shared.services.insights_engine import InsightsEngine
    
    # Create stats with low player count
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    stats = HourlyTableStats(
        table_id=1,
        hour_start=base_time,
        avg_players=1,  # Low traffic
        max_players=1,
        total_hands=2,
        activity_minutes=30,
        metadata_json={}
    )
    db_session.add(stats)
    await db_session.commit()
    
    # Generate insights
    insights = await InsightsEngine.generate_all_insights(db_session, analysis_hours=1)
    
    # Should detect low traffic
    low_traffic_insights = [i for i in insights if i.insight_type == "low_traffic"]
    assert len(low_traffic_insights) > 0


@pytest.mark.asyncio
async def test_insights_have_severity_levels(db_session):
    """Validate insights are assigned appropriate severity levels."""
    from telegram_poker_bot.shared.models import HourlyTableStats
    from telegram_poker_bot.shared.services.insights_engine import InsightsEngine
    
    # Create stats
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    stats = HourlyTableStats(
        table_id=1,
        hour_start=base_time,
        avg_players=9,
        max_players=10,
        total_hands=15,
        activity_minutes=60,
        metadata_json={}
    )
    db_session.add(stats)
    await db_session.commit()
    
    # Generate insights
    insights = await InsightsEngine.generate_all_insights(db_session, analysis_hours=1)
    
    # All insights should have severity
    for insight in insights:
        assert insight.severity in ["info", "warning", "critical"]


@pytest.mark.asyncio
async def test_insights_delivery_logging_channel():
    """Validate insights can be delivered via logging channel."""
    from telegram_poker_bot.shared.services.insights_delivery import (
        LoggingChannel, InsightsDeliveryService
    )
    from telegram_poker_bot.shared.services.insights_engine import Insight
    
    # Create sample insight
    insight = Insight(
        insight_type="high_traffic",
        severity="info",
        message="Test insight message",
        table_id=1,
        metadata={}
    )
    
    # Setup delivery service with logging channel
    channel = LoggingChannel()
    service = InsightsDeliveryService(channels=[channel])
    
    # Deliver insights
    results = await service.deliver_insights([insight])
    
    assert len(results) == 1
    assert results[0]["channel"] == "LoggingChannel"
    assert results[0]["success"] is True


@pytest.mark.asyncio
async def test_insights_delivery_handles_empty_list():
    """Validate insights delivery handles empty insight list gracefully."""
    from telegram_poker_bot.shared.services.insights_delivery import (
        LoggingChannel, InsightsDeliveryService
    )
    
    # Setup delivery service
    channel = LoggingChannel()
    service = InsightsDeliveryService(channels=[channel])
    
    # Deliver empty list
    results = await service.deliver_insights([])
    
    assert len(results) == 0


@pytest.mark.asyncio
async def test_insights_metadata_structure(db_session):
    """Validate insights include proper metadata structure."""
    from telegram_poker_bot.shared.models import HourlyTableStats
    from telegram_poker_bot.shared.services.insights_engine import InsightsEngine
    
    # Create stats
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    stats = HourlyTableStats(
        table_id=123,
        hour_start=base_time,
        avg_players=9,
        max_players=10,
        total_hands=15,
        activity_minutes=60,
        metadata_json={}
    )
    db_session.add(stats)
    await db_session.commit()
    
    # Generate insights
    insights = await InsightsEngine.generate_all_insights(db_session, analysis_hours=1)
    
    # Check metadata structure
    for insight in insights:
        assert insight.table_id is not None
        assert insight.metadata is not None
        assert isinstance(insight.metadata, dict)


@pytest.mark.asyncio
async def test_insights_non_intrusive_generation(db_session):
    """Validate insights generation does not modify underlying data."""
    from telegram_poker_bot.shared.models import HourlyTableStats
    from telegram_poker_bot.shared.services.insights_engine import InsightsEngine
    from sqlalchemy import select
    
    # Create stats
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    
    stats = HourlyTableStats(
        table_id=1,
        hour_start=base_time,
        avg_players=5,
        max_players=6,
        total_hands=10,
        activity_minutes=60,
        metadata_json={}
    )
    db_session.add(stats)
    await db_session.commit()
    
    # Store original values
    original_avg = stats.avg_players
    original_max = stats.max_players
    
    # Generate insights
    await InsightsEngine.generate_all_insights(db_session, analysis_hours=1)
    
    # Verify data unchanged
    result = await db_session.execute(
        select(HourlyTableStats).where(HourlyTableStats.id == stats.id)
    )
    refreshed_stats = result.scalar_one()
    
    assert refreshed_stats.avg_players == original_avg
    assert refreshed_stats.max_players == original_max
