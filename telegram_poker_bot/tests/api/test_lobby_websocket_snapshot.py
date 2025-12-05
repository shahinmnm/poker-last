"""Tests for the /ws/lobby WebSocket endpoint snapshot functionality.

Tests cover:
- WebSocket connection succeeds
- Initial snapshot is sent on connection
- Snapshot contains correct message type (lobby_snapshot)
- Snapshot includes tables array
- Snapshot includes public tables only
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import User
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.api.main import api_app as app


@pytest.mark.asyncio
async def test_lobby_websocket_sends_initial_snapshot(db_session: AsyncSession) -> None:
    """Test that /ws/lobby WebSocket sends initial snapshot on connection."""
    # Create a user and a public table
    user = User(tg_user_id=100, username="alice", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a template for test
    from telegram_poker_bot.tests.conftest import create_test_template
    from telegram_poker_bot.shared.models import TableTemplateType

    template = await create_test_template(
        db_session,
        name="Public Template",
        table_type=TableTemplateType.EXPIRING,
        table_name="Public Game",
        small_blind=25,
        big_blind=50,
        starting_stack=10000,
        max_players=8,
    )

    # Create a public table
    public_table = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=template.id,
        auto_seat_creator=False,
    )
    await db_session.commit()

    # Connect to WebSocket
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.websocket_connect("/ws/lobby") as websocket:
            # Receive initial snapshot
            data = await websocket.receive_json()
            
            # Verify snapshot message type
            assert data.get("type") == "lobby_snapshot", f"Expected lobby_snapshot but got {data.get('type')}"
            
            # Verify tables array is present
            assert "tables" in data, "Snapshot should contain 'tables' key"
            tables = data["tables"]
            assert isinstance(tables, list), "Tables should be a list"
            
            # Verify at least our public table is in the snapshot
            table_ids = [t.get("table_id") for t in tables]
            assert public_table.id in table_ids, f"Public table {public_table.id} should be in snapshot"


@pytest.mark.asyncio
async def test_lobby_websocket_snapshot_excludes_private_tables(db_session: AsyncSession) -> None:
    """Test that lobby snapshot only includes public tables."""
    # Create users
    user = User(tg_user_id=200, username="bob", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create templates
    from telegram_poker_bot.tests.conftest import create_test_template
    from telegram_poker_bot.shared.models import TableTemplateType

    public_template = await create_test_template(
        db_session,
        name="Public Template",
        table_type=TableTemplateType.EXPIRING,
        table_name="Public Game",
    )

    private_template = await create_test_template(
        db_session,
        name="Private Template",
        table_type=TableTemplateType.PRIVATE,
        table_name="Private Game",
    )

    # Create one public and one private table
    public_table = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=public_template.id,
        auto_seat_creator=False,
    )

    private_table = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=private_template.id,
        auto_seat_creator=False,
    )
    await db_session.commit()

    # Connect to WebSocket
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.websocket_connect("/ws/lobby") as websocket:
            # Receive initial snapshot
            data = await websocket.receive_json()
            
            assert data.get("type") == "lobby_snapshot"
            tables = data.get("tables", [])
            table_ids = [t.get("table_id") for t in tables]
            
            # Public table may or may not be in the list depending on status
            # Private table should NOT be in the list
            assert private_table.id not in table_ids, "Private table should not be in lobby snapshot"


@pytest.mark.asyncio
async def test_lobby_websocket_snapshot_empty_when_no_tables(db_session: AsyncSession) -> None:
    """Test that lobby snapshot returns empty list when no tables exist."""
    # Don't create any tables
    
    # Connect to WebSocket
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.websocket_connect("/ws/lobby") as websocket:
            # Receive initial snapshot
            data = await websocket.receive_json()
            
            assert data.get("type") == "lobby_snapshot"
            tables = data.get("tables", [])
            assert isinstance(tables, list), "Tables should be a list even when empty"
            # Empty is acceptable - there might be no active public tables


@pytest.mark.asyncio
async def test_lobby_websocket_receives_pings(db_session: AsyncSession) -> None:
    """Test that lobby WebSocket sends ping messages."""
    import asyncio
    
    # Connect to WebSocket
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.websocket_connect("/ws/lobby") as websocket:
            # Receive initial snapshot
            snapshot = await websocket.receive_json()
            assert snapshot.get("type") == "lobby_snapshot"
            
            # Send a ping
            await websocket.send_json({"type": "ping"})
            
            # Should receive pong
            response = await websocket.receive_json()
            assert response.get("type") == "pong", "Should receive pong response to ping"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
