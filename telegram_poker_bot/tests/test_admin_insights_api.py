"""Tests for admin insights API endpoints."""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient

from telegram_poker_bot.shared.models import (
    TableSnapshot,
    Table,
    TableStatus,
)


@pytest.mark.asyncio
async def test_generate_insights_endpoint(client: AsyncClient, db_session, sample_table):
    """Test the insights generation endpoint."""
    # Create data that will generate insights
    now = datetime.now(timezone.utc)
    
    # High traffic snapshots
    for i in range(3):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 5),
            player_count=9,
            is_active=True,
            metadata_json={},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Generate insights
    response = await client.get("/admin/insights/generate?hours=1")
    assert response.status_code == 200
    
    data = response.json()
    assert "timestamp" in data
    assert "analysis_period_hours" in data
    assert "insights" in data
    assert "count" in data
    assert "by_type" in data
    assert "by_severity" in data
    
    assert data["analysis_period_hours"] == 1
    assert isinstance(data["insights"], list)
    
    # Should have detected high traffic
    assert data["by_type"]["high_traffic"] >= 1


@pytest.mark.asyncio
async def test_generate_insights_custom_hours(client: AsyncClient, db_session, sample_table):
    """Test insights generation with custom hour parameter."""
    now = datetime.now(timezone.utc)
    
    # Create recent snapshot
    snapshot = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=now - timedelta(minutes=30),
        player_count=8,
        is_active=True,
        metadata_json={},
    )
    db_session.add(snapshot)
    await db_session.commit()
    
    # Generate insights for last 2 hours
    response = await client.get("/admin/insights/generate?hours=2")
    assert response.status_code == 200
    
    data = response.json()
    assert data["analysis_period_hours"] == 2


@pytest.mark.asyncio
async def test_generate_insights_no_data(client: AsyncClient, db_session):
    """Test insights generation with no analytics data."""
    response = await client.get("/admin/insights/generate?hours=1")
    assert response.status_code == 200
    
    data = response.json()
    assert data["count"] == 0
    assert len(data["insights"]) == 0


@pytest.mark.asyncio
async def test_deliver_insights_endpoint(client: AsyncClient, db_session, sample_table):
    """Test the insights delivery endpoint."""
    # Create data
    now = datetime.now(timezone.utc)
    
    snapshot = TableSnapshot(
        table_id=sample_table.id,
        snapshot_time=now - timedelta(minutes=10),
        player_count=1,  # Low traffic
        is_active=True,
        metadata_json={},
    )
    db_session.add(snapshot)
    await db_session.commit()
    
    # Deliver insights
    response = await client.post("/admin/insights/deliver?hours=1")
    assert response.status_code == 200
    
    data = response.json()
    assert "timestamp" in data
    assert "insights_generated" in data
    assert "delivery_results" in data
    assert "insights" in data
    
    # Should have delivery results
    assert "logging" in data["delivery_results"]
    assert data["delivery_results"]["logging"] is True


@pytest.mark.asyncio
async def test_insights_structure(client: AsyncClient, db_session, sample_table):
    """Test that insights have correct structure."""
    # Create data for multiple insight types
    now = datetime.now(timezone.utc)
    
    # High traffic
    for i in range(2):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 5),
            player_count=9,
            is_active=True,
            metadata_json={"waitlist_count": 5},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    # Generate insights
    response = await client.get("/admin/insights/generate?hours=1")
    assert response.status_code == 200
    
    data = response.json()
    
    if data["count"] > 0:
        insight = data["insights"][0]
        
        # Verify insight structure
        assert "type" in insight
        assert "severity" in insight
        assert "title" in insight
        assert "message" in insight
        assert "timestamp" in insight
        
        # Type should be valid
        assert insight["type"] in [
            "unusual_activity",
            "high_traffic",
            "low_traffic",
            "waitlist_surge",
            "inactivity_pattern",
            "rapid_player_change",
        ]
        
        # Severity should be valid
        assert insight["severity"] in ["info", "warning", "critical"]


@pytest.mark.asyncio
async def test_insights_by_type_counts(client: AsyncClient, db_session, sample_table):
    """Test that by_type counts match actual insights."""
    now = datetime.now(timezone.utc)
    
    # Create high traffic scenario
    for i in range(3):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 5),
            player_count=9,
            is_active=True,
            metadata_json={},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    response = await client.get("/admin/insights/generate?hours=1")
    assert response.status_code == 200
    
    data = response.json()
    
    # Count insights by type manually
    high_traffic_count = sum(
        1 for i in data["insights"] if i["type"] == "high_traffic"
    )
    
    # Should match by_type count
    assert data["by_type"]["high_traffic"] == high_traffic_count


@pytest.mark.asyncio
async def test_insights_by_severity_counts(client: AsyncClient, db_session, sample_table):
    """Test that by_severity counts match actual insights."""
    now = datetime.now(timezone.utc)
    
    # Create low traffic (warning severity)
    for i in range(4):
        snapshot = TableSnapshot(
            table_id=sample_table.id,
            snapshot_time=now - timedelta(minutes=i * 5),
            player_count=1,
            is_active=True,
            metadata_json={},
        )
        db_session.add(snapshot)
    
    await db_session.commit()
    
    response = await client.get("/admin/insights/generate?hours=1")
    assert response.status_code == 200
    
    data = response.json()
    
    # Count insights by severity manually
    warning_count = sum(
        1 for i in data["insights"] if i["severity"] == "warning"
    )
    info_count = sum(
        1 for i in data["insights"] if i["severity"] == "info"
    )
    critical_count = sum(
        1 for i in data["insights"] if i["severity"] == "critical"
    )
    
    # Should match by_severity counts
    assert data["by_severity"]["warning"] == warning_count
    assert data["by_severity"]["info"] == info_count
    assert data["by_severity"]["critical"] == critical_count
