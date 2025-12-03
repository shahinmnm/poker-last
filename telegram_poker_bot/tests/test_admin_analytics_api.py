"""Tests for admin analytics API endpoints."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
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


@pytest.fixture
def test_client(db_session: AsyncSession):
    """Create a test client with database dependency override."""
    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db

    yield TestClient(api_app)

    api_app.dependency_overrides.clear()


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
async def test_get_realtime_analytics(
    db_session: AsyncSession, test_client: TestClient, sample_table: Table
) -> None:
    """Test fetching realtime analytics."""
    # Create some snapshots
    snapshot1 = TableSnapshot(
        table_id=sample_table.id,
        player_count=5,
        is_active=True,
        metadata_json={"status": "active"},
    )
    snapshot2 = TableSnapshot(
        table_id=sample_table.id,
        player_count=6,
        is_active=True,
        metadata_json={"status": "active"},
    )
    
    db_session.add(snapshot1)
    db_session.add(snapshot2)
    await db_session.commit()
    
    # Fetch realtime analytics
    response = test_client.get("/admin/analytics/realtime")
    assert response.status_code == 200
    
    data = response.json()
    assert "timestamp" in data
    assert "snapshots" in data
    assert "count" in data
    assert data["count"] >= 1
    
    # Should return only the latest snapshot per table
    table_snapshots = [s for s in data["snapshots"] if s["table_id"] == sample_table.id]
    assert len(table_snapshots) == 1
    assert table_snapshots[0]["player_count"] == 6  # Latest


@pytest.mark.asyncio
async def test_get_hourly_aggregates(
    db_session: AsyncSession, test_client: TestClient, sample_table: Table
) -> None:
    """Test fetching hourly aggregates."""
    # Create hourly stats
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    
    stat = HourlyTableStats(
        table_id=sample_table.id,
        hour_start=hour_ago,
        avg_players=4.5,
        max_players=7,
        total_hands=12,
        activity_minutes=55,
        metadata_json={},
    )
    
    db_session.add(stat)
    await db_session.commit()
    
    # Fetch hourly aggregates
    response = test_client.get("/admin/analytics/hourly?hours=24")
    assert response.status_code == 200
    
    data = response.json()
    assert "period" in data
    assert "hourly_stats" in data
    assert "count" in data
    assert data["count"] >= 1
    
    # Verify period
    assert data["period"]["hours"] == 24
    
    # Find our stat
    table_stats = [s for s in data["hourly_stats"] if s["table_id"] == sample_table.id]
    assert len(table_stats) >= 1
    assert table_stats[0]["avg_players"] == 4.5
    assert table_stats[0]["max_players"] == 7


@pytest.mark.asyncio
async def test_get_hourly_aggregates_filtered(
    db_session: AsyncSession, test_client: TestClient, sample_table: Table
) -> None:
    """Test fetching hourly aggregates filtered by table."""
    # Create hourly stats
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    
    stat = HourlyTableStats(
        table_id=sample_table.id,
        hour_start=hour_ago,
        avg_players=4.5,
        max_players=7,
        total_hands=12,
        activity_minutes=55,
        metadata_json={},
    )
    
    db_session.add(stat)
    await db_session.commit()
    
    # Fetch hourly aggregates for specific table
    response = test_client.get(f"/admin/analytics/hourly?hours=24&table_id={sample_table.id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["count"] >= 1
    
    # All stats should be for this table
    for stat in data["hourly_stats"]:
        assert stat["table_id"] == sample_table.id


@pytest.mark.asyncio
async def test_get_historical_range_hourly(
    db_session: AsyncSession, test_client: TestClient, sample_table: Table
) -> None:
    """Test fetching historical range for hourly metrics."""
    # Create hourly stats
    now = datetime.now(timezone.utc)
    two_days_ago = now - timedelta(days=2)
    
    stat = HourlyTableStats(
        table_id=sample_table.id,
        hour_start=two_days_ago,
        avg_players=3.5,
        max_players=5,
        total_hands=8,
        activity_minutes=45,
        metadata_json={},
    )
    
    db_session.add(stat)
    await db_session.commit()
    
    # Fetch historical range
    start_date = (now - timedelta(days=3)).isoformat()
    end_date = now.isoformat()
    
    response = test_client.get(
        f"/admin/analytics/historical?start_date={start_date}&end_date={end_date}&metric_type=hourly"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["metric_type"] == "hourly"
    assert "period" in data
    assert "data" in data
    assert "count" in data


@pytest.mark.asyncio
async def test_get_historical_range_snapshot(
    db_session: AsyncSession, test_client: TestClient, sample_table: Table
) -> None:
    """Test fetching historical range for snapshot metrics."""
    # Create snapshots
    now = datetime.now(timezone.utc)
    snapshot_time = now - timedelta(hours=12)
    
    snapshot = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=snapshot_time,
        player_count=4,
        is_active=True,
        metadata_json={},
    )
    
    db_session.add(snapshot)
    await db_session.commit()
    
    # Fetch historical range
    start_date = (now - timedelta(days=1)).isoformat()
    end_date = now.isoformat()
    
    response = test_client.get(
        f"/admin/analytics/historical?start_date={start_date}&end_date={end_date}&metric_type=snapshot"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["metric_type"] == "snapshot"
    assert "data" in data


@pytest.mark.asyncio
async def test_get_historical_range_invalid_dates(test_client: TestClient) -> None:
    """Test historical range with invalid date parameters."""
    now = datetime.now(timezone.utc)
    
    # Start date after end date
    start_date = now.isoformat()
    end_date = (now - timedelta(days=1)).isoformat()
    
    response = test_client.get(
        f"/admin/analytics/historical?start_date={start_date}&end_date={end_date}&metric_type=hourly"
    )
    assert response.status_code == 400
    assert "before end_date" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_historical_range_exceeds_limit(test_client: TestClient) -> None:
    """Test historical range exceeding 90-day limit."""
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=100)).isoformat()
    end_date = now.isoformat()
    
    response = test_client.get(
        f"/admin/analytics/historical?start_date={start_date}&end_date={end_date}&metric_type=hourly"
    )
    assert response.status_code == 400
    assert "90 days" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_analytics_summary(
    db_session: AsyncSession, test_client: TestClient, sample_table: Table
) -> None:
    """Test fetching analytics summary."""
    # Create some data
    snapshot = TableSnapshot(
        table_id=sample_table.id,
        player_count=5,
        is_active=True,
        metadata_json={},
    )
    
    stat = HourlyTableStats(
        table_id=sample_table.id,
        hour_start=datetime.now(timezone.utc) - timedelta(hours=1),
        avg_players=4.5,
        max_players=7,
        total_hands=12,
        activity_minutes=55,
        metadata_json={},
    )
    
    db_session.add(snapshot)
    db_session.add(stat)
    await db_session.commit()
    
    # Fetch summary
    response = test_client.get("/admin/analytics/summary")
    assert response.status_code == 200
    
    data = response.json()
    assert "timestamp" in data
    assert "tables" in data
    assert "analytics" in data
    
    # Check tables section
    assert "by_status" in data["tables"]
    assert "total" in data["tables"]
    
    # Check analytics section
    assert "total_snapshots" in data["analytics"]
    assert "total_hourly_stats" in data["analytics"]
    assert data["analytics"]["total_snapshots"] >= 1
    assert data["analytics"]["total_hourly_stats"] >= 1
