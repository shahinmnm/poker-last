"""Tests for analytics API endpoints."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import (
    Base,
    Table,
    TableSnapshot,
    HourlyTableStats,
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


@pytest.mark.asyncio
async def test_get_table_snapshots(
    db_session: AsyncSession, test_client: TestClient
) -> None:
    """Test GET /analytics/tables/{table_id}/snapshots endpoint."""
    # Create a test template
    template = TableTemplate(
        name="Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=False,
        config_json={"max_players": 6},
    )
    db_session.add(template)
    await db_session.flush()

    # Create a test table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=template.id,
        is_public=True,
    )
    db_session.add(table)
    await db_session.flush()

    # Create snapshots
    now = datetime.now(timezone.utc)
    for i in range(5):
        snapshot = TableSnapshot(
            table_id=table.id,
            snapshot_time=now - timedelta(minutes=i * 10),
            player_count=3 + i,
            is_active=True,
        )
        db_session.add(snapshot)
    await db_session.commit()

    # Call the endpoint
    response = test_client.get(f"/analytics/tables/{table.id}/snapshots?hours=24")

    assert response.status_code == 200
    data = response.json()
    assert data["table_id"] == table.id
    assert data["count"] == 5
    assert len(data["snapshots"]) == 5
    # Should be ordered by snapshot_time desc
    assert data["snapshots"][0]["player_count"] == 3


@pytest.mark.asyncio
async def test_get_table_hourly_stats(
    db_session: AsyncSession, test_client: TestClient
) -> None:
    """Test GET /analytics/tables/{table_id}/hourly-stats endpoint."""
    # Create a test template
    template = TableTemplate(
        name="Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=False,
        config_json={"max_players": 6},
    )
    db_session.add(template)
    await db_session.flush()

    # Create a test table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.ACTIVE,
        template_id=template.id,
        is_public=True,
    )
    db_session.add(table)
    await db_session.flush()

    # Create hourly stats
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for i in range(3):
        stats = HourlyTableStats(
            table_id=table.id,
            hour_start=now - timedelta(hours=i),
            avg_players=4,
            max_players=6,
            total_hands=10,
            activity_minutes=55,
        )
        db_session.add(stats)
    await db_session.commit()

    # Call the endpoint
    response = test_client.get(f"/analytics/tables/{table.id}/hourly-stats?days=7")

    assert response.status_code == 200
    data = response.json()
    assert data["table_id"] == table.id
    assert data["count"] == 3
    assert len(data["hourly_stats"]) == 3
    assert data["hourly_stats"][0]["avg_players"] == 4
    assert data["hourly_stats"][0]["total_hands"] == 10


@pytest.mark.asyncio
async def test_get_recent_snapshots(
    db_session: AsyncSession, test_client: TestClient
) -> None:
    """Test GET /analytics/snapshots/recent endpoint."""
    # Create test templates
    template = TableTemplate(
        name="Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=False,
        config_json={"max_players": 6},
    )
    db_session.add(template)
    await db_session.flush()

    # Create multiple tables
    tables = []
    for i in range(3):
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db_session.add(table)
        tables.append(table)
    await db_session.flush()

    # Create snapshots for each table
    now = datetime.now(timezone.utc)
    for table in tables:
        for i in range(2):
            snapshot = TableSnapshot(
                table_id=table.id,
                snapshot_time=now - timedelta(minutes=i * 5),
                player_count=2,
                is_active=True,
            )
            db_session.add(snapshot)
    await db_session.commit()

    # Call the endpoint
    response = test_client.get("/analytics/snapshots/recent?limit=10")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 6
    assert len(data["snapshots"]) == 6
    # Should have snapshots from all tables
    table_ids = {s["table_id"] for s in data["snapshots"]}
    assert len(table_ids) == 3


@pytest.mark.asyncio
async def test_get_recent_hourly_stats(
    db_session: AsyncSession, test_client: TestClient
) -> None:
    """Test GET /analytics/hourly-stats/recent endpoint."""
    # Create test template
    template = TableTemplate(
        name="Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=False,
        config_json={"max_players": 6},
    )
    db_session.add(template)
    await db_session.flush()

    # Create multiple tables
    tables = []
    for i in range(2):
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.ACTIVE,
            template_id=template.id,
            is_public=True,
        )
        db_session.add(table)
        tables.append(table)
    await db_session.flush()

    # Create hourly stats for each table
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for table in tables:
        for i in range(2):
            stats = HourlyTableStats(
                table_id=table.id,
                hour_start=now - timedelta(hours=i),
                avg_players=3,
                max_players=5,
                total_hands=8,
                activity_minutes=50,
            )
            db_session.add(stats)
    await db_session.commit()

    # Call the endpoint
    response = test_client.get("/analytics/hourly-stats/recent?limit=10")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 4
    assert len(data["hourly_stats"]) == 4
    # Should have stats from all tables
    table_ids = {s["table_id"] for s in data["hourly_stats"]}
    assert len(table_ids) == 2


@pytest.mark.asyncio
async def test_analytics_endpoints_empty_data(
    db_session: AsyncSession, test_client: TestClient
) -> None:
    """Test analytics endpoints with no data."""
    # Create a test template and table but no analytics data
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
    await db_session.commit()

    # Test snapshots endpoint
    response = test_client.get(f"/analytics/tables/{table.id}/snapshots")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert len(data["snapshots"]) == 0

    # Test hourly stats endpoint
    response = test_client.get(f"/analytics/tables/{table.id}/hourly-stats")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert len(data["hourly_stats"]) == 0

    # Test recent snapshots
    response = test_client.get("/analytics/snapshots/recent")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0

    # Test recent hourly stats
    response = test_client.get("/analytics/hourly-stats/recent")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
