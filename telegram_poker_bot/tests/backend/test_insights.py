"""Tests for insights engine and delivery."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import (
    Base,
    TableSnapshot,
    HourlyTableStats,
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    GameMode,
)
from telegram_poker_bot.shared.services.insights_engine import (
    get_insights_engine,
)
from telegram_poker_bot.shared.services.insights_models import (
    InsightType,
    InsightSeverity,
)
from telegram_poker_bot.shared.services.insights_delivery import (
    LoggingChannel,
    InsightsDeliveryService,
    Insight,
)

pytest.importorskip("aiosqlite")


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Create an in-memory SQLite database for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest_asyncio.fixture
async def sample_table(db_session: AsyncSession) -> Table:
    """Create a sample table for testing."""
    template = TableTemplate(
        name="Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=False,
        config_json={"max_players": 6},
    )
    db_session.add(template)
    await db_session.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=template.id,
        is_public=True,
    )
    db_session.add(table)
    await db_session.flush()

    return table


@pytest.mark.asyncio
async def test_analyze_high_traffic(db_session: AsyncSession, sample_table: Table) -> None:
    """Test detection of high traffic patterns."""
    # Create snapshots showing high traffic
    now = datetime.now(timezone.utc)
    
    for i in range(3):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 10),
            player_count=9,  # High traffic
            is_active=True,
            metadata_json={},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Analyze
    insights = await get_insights_engine().analyze_recent_activity(db_session, hours=1)
    
    # Should detect high traffic
    high_traffic_insights = [
        i for i in insights if i.insight_type == InsightType.HIGH_TRAFFIC
    ]
    assert len(high_traffic_insights) >= 1
    assert high_traffic_insights[0].table_id == sample_table.id


@pytest.mark.asyncio
async def test_analyze_low_traffic(db_session: AsyncSession, sample_table: Table) -> None:
    """Test detection of low traffic patterns."""
    # Create snapshots showing low traffic
    now = datetime.now(timezone.utc)
    
    for i in range(5):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 10),
            player_count=1,  # Low traffic
            is_active=True,
            metadata_json={},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Analyze
    insights = await get_insights_engine().analyze_recent_activity(db_session, hours=1)
    
    # Should detect low traffic
    low_traffic_insights = [
        i for i in insights if i.insight_type == InsightType.LOW_TRAFFIC
    ]
    assert len(low_traffic_insights) >= 1
    assert low_traffic_insights[0].severity == InsightSeverity.WARNING


@pytest.mark.asyncio
async def test_analyze_rapid_player_change(db_session: AsyncSession, sample_table: Table) -> None:
    """Test detection of rapid player changes."""
    # Create snapshots with rapid changes
    now = datetime.now(timezone.utc)
    player_counts = [2, 8, 3, 7, 2]  # Large swings
    
    for i, count in enumerate(player_counts):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 5),
            player_count=count,
            is_active=True,
            metadata_json={},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Analyze
    insights = await get_insights_engine().analyze_recent_activity(db_session, hours=1)
    
    # Should detect rapid changes
    rapid_change_insights = [
        i for i in insights if i.insight_type == InsightType.RAPID_PLAYER_CHANGE
    ]
    assert len(rapid_change_insights) >= 1


@pytest.mark.asyncio
async def test_detect_inactivity_patterns(db_session: AsyncSession, sample_table: Table) -> None:
    """Test detection of inactivity patterns."""
    # Make table active but create old snapshot
    sample_table.status = TableStatus.ACTIVE
    
    old_snapshot = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=datetime.now(timezone.utc) - timedelta(hours=3),
        player_count=2,
        is_active=True,
        metadata_json={},
    )
    
    db_session.add(old_snapshot)
    await db_session.commit()
    
    # Analyze
    insights = await get_insights_engine().detect_inactivity_patterns(db_session)
    
    # Should detect inactivity
    inactivity_insights = [
        i for i in insights if i.insight_type == InsightType.INACTIVITY_PATTERN
    ]
    assert len(inactivity_insights) >= 1
    assert inactivity_insights[0].table_id == sample_table.id


@pytest.mark.asyncio
async def test_analyze_waitlist_trends(db_session: AsyncSession, sample_table: Table) -> None:
    """Test analysis of waitlist trends."""
    # Create snapshots with waitlist metadata
    now = datetime.now(timezone.utc)
    
    for i, waitlist_count in enumerate([1, 2, 5, 4, 6]):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(hours=i),
            player_count=8,
            is_active=True,
            metadata_json={"waitlist_count": waitlist_count},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Analyze
    insights = await get_insights_engine().analyze_waitlist_trends(db_session, hours=24)
    
    # Should detect waitlist surge
    waitlist_insights = [
        i for i in insights if i.insight_type == InsightType.WAITLIST_SURGE
    ]
    assert len(waitlist_insights) >= 1
    assert waitlist_insights[0].metadata["max_waitlist"] >= 5


@pytest.mark.asyncio
async def test_generate_all_insights(db_session: AsyncSession, sample_table: Table) -> None:
    """Test generating all insight types together."""
    # Create varied data
    now = datetime.now(timezone.utc)
    
    # High traffic
    snapshot1 = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=now - timedelta(minutes=10),
        player_count=9,
        is_active=True,
        metadata_json={"waitlist_count": 5},
    )
    
    db_session.add(snapshot1)
    await db_session.commit()
    
    # Generate all insights
    insights = await get_insights_engine().generate_all_insights(db_session, analysis_hours=1)
    
    assert isinstance(insights, list)
    # Should have at least one insight
    assert len(insights) >= 1
    
    # All insights should have required fields
    for insight in insights:
        assert insight.insight_type is not None
        assert insight.severity is not None
        assert insight.title
        assert insight.message
        assert insight.timestamp


@pytest.mark.asyncio
async def test_logging_channel_delivery():
    """Test logging channel delivery."""
    channel = LoggingChannel()
    
    # Create test insights
    insights = [
        Insight(
            insight_type=InsightType.HIGH_TRAFFIC,
            severity=InsightSeverity.INFO,
            title="Test Insight",
            message="This is a test",
            table_id=123,
            metadata={"test": "data"},
        )
    ]
    
    # Deliver
    success = await channel.deliver(insights)
    assert success is True
    assert channel.get_channel_name() == "logging"


@pytest.mark.asyncio
async def test_insights_delivery_service():
    """Test insights delivery service."""
    service = InsightsDeliveryService(channels=[LoggingChannel()])
    
    # Create test insights
    insights = [
        Insight(
            insight_type=InsightType.LOW_TRAFFIC,
            severity=InsightSeverity.WARNING,
            title="Low Traffic Alert",
            message="Traffic is low",
            table_id=456,
        )
    ]
    
    # Deliver
    results = await service.deliver_insights(insights)
    
    assert "logging" in results
    assert results["logging"] is True


@pytest.mark.asyncio
async def test_insights_delivery_service_no_insights():
    """Test delivery service with no insights."""
    service = InsightsDeliveryService()
    
    results = await service.deliver_insights([])
    assert results == {}


@pytest.mark.asyncio
async def test_insight_to_dict():
    """Test insight serialization."""
    insight = Insight(
        insight_type=InsightType.RAPID_PLAYER_CHANGE,
        severity=InsightSeverity.WARNING,
        title="Rapid Change",
        message="Players changed rapidly",
        table_id=789,
        metadata={"max_change": 5},
    )
    
    data = insight.to_dict()
    
    assert data["type"] == "rapid_player_change"
    assert data["severity"] == "warning"
    assert data["title"] == "Rapid Change"
    assert data["message"] == "Players changed rapidly"
    assert data["table_id"] == 789
    assert data["metadata"]["max_change"] == 5
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_delivery_service_add_remove_channels():
    """Test adding and removing delivery channels."""
    service = InsightsDeliveryService()
    
    # Initially has default logging channel
    assert len(service.channels) == 1
    
    # Add another channel
    new_channel = LoggingChannel()
    service.add_channel(new_channel)
    assert len(service.channels) == 2
    
    # Remove channel (removes ALL channels with name "logging")
    removed = service.remove_channel("logging")
    assert removed is True
    # All logging channels should be removed
    assert len(service.channels) == 0
