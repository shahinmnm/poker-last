"""Tests for the GET /tables/{table_id}/status endpoint."""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import Base, User, TableStatus
from telegram_poker_bot.shared.services import table_service

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


@pytest.mark.asyncio
async def test_table_status_active(db_session: AsyncSession) -> None:
    """Test that status endpoint returns active=true for ACTIVE tables."""
    # Create users
    user1 = User(tg_user_id=100, username="testuser", language="en")
    user2 = User(tg_user_id=101, username="testuser2", language="en")
    db_session.add_all([user1, user2])
    await db_session.flush()

    # Create an active table
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user1.id,
        small_blind=25,
        big_blind=50,
        starting_stack=10000,
        max_players=8,
        table_name="Test Table",
        is_private=False,
        auto_seat_creator=True,
    )

    # Add second player
    await table_service.seat_user_at_table(db_session, table.id, user2.id)

    # Start the table to make it ACTIVE
    await table_service.start_table(db_session, table.id, user_id=user1.id)
    await db_session.commit()

    # Import after table is created to ensure proper initialization
    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(api_app)
        response = client.get(f"/tables/{table.id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data == {"active": True}
    finally:
        api_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_table_status_waiting(db_session: AsyncSession) -> None:
    """Test that status endpoint returns active=true for WAITING tables."""
    # Create a user and table
    user = User(tg_user_id=101, username="testuser2", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a waiting table (default status)
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        small_blind=25,
        big_blind=50,
        starting_stack=10000,
        max_players=8,
        table_name="Waiting Table",
        is_private=False,
        auto_seat_creator=True,
    )
    await db_session.commit()

    # Verify table is in WAITING status
    assert table.status == TableStatus.WAITING

    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(api_app)
        response = client.get(f"/tables/{table.id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data == {"active": True}
    finally:
        api_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_table_status_ended(db_session: AsyncSession) -> None:
    """Test that status endpoint returns active=false for ENDED tables."""
    # Create a user and table
    user = User(tg_user_id=102, username="testuser3", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a table and mark it as ended
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        small_blind=25,
        big_blind=50,
        starting_stack=10000,
        max_players=8,
        table_name="Ended Table",
        is_private=False,
        auto_seat_creator=True,
    )

    # Mark table as ended
    table.status = TableStatus.ENDED
    await db_session.commit()

    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(api_app)
        response = client.get(f"/tables/{table.id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data == {"active": False}
    finally:
        api_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_table_status_expired(db_session: AsyncSession) -> None:
    """Test that status endpoint returns active=false for EXPIRED tables."""
    # Create a user and table
    user = User(tg_user_id=103, username="testuser4", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a table and mark it as expired
    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        small_blind=25,
        big_blind=50,
        starting_stack=10000,
        max_players=8,
        table_name="Expired Table",
        is_private=False,
        auto_seat_creator=True,
    )

    # Mark table as expired
    table.status = TableStatus.EXPIRED
    await db_session.commit()

    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(api_app)
        response = client.get(f"/tables/{table.id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data == {"active": False}
    finally:
        api_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_table_status_not_found(db_session: AsyncSession) -> None:
    """Test that status endpoint returns active=false for non-existent tables."""
    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(api_app)
        # Use a table ID that doesn't exist
        response = client.get("/tables/99999/status")

        assert response.status_code == 200
        data = response.json()
        assert data == {"active": False}
    finally:
        api_app.dependency_overrides.clear()
