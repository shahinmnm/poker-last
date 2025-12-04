"""Tests for the GET /users/me/tables endpoint and related functionality."""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import Base, User, Table, Seat, TableStatus, GameMode
from telegram_poker_bot.shared.services import user_service, table_service

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
async def test_get_active_tables_with_creator_and_visibility(db_session: AsyncSession) -> None:
    """Test that get_active_tables properly returns creator_user_id and is_public fields.
    
    This is the core test for the fix to the UndefinedColumnError.
    """
    # Create two users
    user_a = User(tg_user_id=100, username="alice", language="en")
    user_b = User(tg_user_id=200, username="bob", language="en")
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    # Create templates for test
    from telegram_poker_bot.tests.conftest import create_test_template
    from telegram_poker_bot.shared.models import TableTemplateType
    
    public_template = await create_test_template(
        db_session,
        name="Public Template",
        table_type=TableTemplateType.EXPIRING,
        table_name="Alice's Public Game",
        small_blind=25,
        big_blind=50,
        starting_stack=10000,
        max_players=8,
    )
    
    private_template = await create_test_template(
        db_session,
        name="Private Template",
        table_type=TableTemplateType.PRIVATE,
        table_name="Alice's Private Game",
        small_blind=10,
        big_blind=20,
        starting_stack=5000,
        max_players=6,
    )

    # User A creates a public table and sits at it
    public_table = await table_service.create_table(
        db_session,
        creator_user_id=user_a.id,
        template_id=public_template.id,
        auto_seat_creator=True,
    )

    # User A creates a private table and sits at it
    private_table = await table_service.create_table(
        db_session,
        creator_user_id=user_a.id,
        template_id=private_template.id,
        auto_seat_creator=True,
    )

    # User B joins the public table
    await table_service.seat_user_at_table(db_session, public_table.id, user_b.id)

    # Test: User A's active tables
    user_a_tables = await user_service.get_active_tables(db_session, user_a.id)
    
    # User A should see both tables
    assert len(user_a_tables) == 2
    
    # Find each table in the response
    public_table_data = next((t for t in user_a_tables if t["table_id"] == public_table.id), None)
    private_table_data = next((t for t in user_a_tables if t["table_id"] == private_table.id), None)
    
    assert public_table_data is not None, "User A should see their public table"
    assert private_table_data is not None, "User A should see their private table"
    
    # Verify public table data
    assert public_table_data["is_public"] is True
    assert public_table_data["visibility"] == "public"
    assert public_table_data["table_name"] == "Alice's Public Game"
    assert public_table_data["host"]["user_id"] == user_a.id
    assert public_table_data["host"]["username"] == "alice"
    assert public_table_data["viewer"]["is_creator"] is True
    assert public_table_data["viewer"]["is_seated"] is True
    assert public_table_data["player_count"] == 2  # Alice and Bob
    
    # Verify private table data
    assert private_table_data["is_public"] is False
    assert private_table_data["visibility"] == "private"
    assert private_table_data["table_name"] == "Alice's Private Game"
    assert private_table_data["host"]["user_id"] == user_a.id
    assert private_table_data["viewer"]["is_creator"] is True
    assert private_table_data["viewer"]["is_seated"] is True
    assert private_table_data["player_count"] == 1  # Only Alice
    
    # Test: User B's active tables
    user_b_tables = await user_service.get_active_tables(db_session, user_b.id)
    
    # User B should see only the public table (where they're seated)
    assert len(user_b_tables) == 1
    
    bob_table_data = user_b_tables[0]
    assert bob_table_data["table_id"] == public_table.id
    assert bob_table_data["is_public"] is True
    assert bob_table_data["visibility"] == "public"
    assert bob_table_data["host"]["user_id"] == user_a.id
    assert bob_table_data["host"]["username"] == "alice"
    assert bob_table_data["viewer"]["is_creator"] is False  # Bob is not the creator
    assert bob_table_data["viewer"]["is_seated"] is True
    assert bob_table_data["player_count"] == 2


@pytest.mark.asyncio
async def test_get_active_tables_empty_state(db_session: AsyncSession) -> None:
    """Test that get_active_tables returns empty list for users with no seats."""
    user = User(tg_user_id=300, username="charlie", language="en")
    db_session.add(user)
    await db_session.flush()

    # User has no tables
    tables = await user_service.get_active_tables(db_session, user.id)
    assert tables == []


@pytest.mark.asyncio
async def test_get_active_tables_filters_by_status(db_session: AsyncSession) -> None:
    """Test that get_active_tables only returns WAITING and ACTIVE tables."""
    user = User(tg_user_id=400, username="dave", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a waiting table
    waiting_table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        is_private=False,
        auto_seat_creator=True,
    )
    assert waiting_table.status == TableStatus.WAITING

    # Create an active table
    active_table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        is_private=False,
        auto_seat_creator=True,
    )
    active_table.status = TableStatus.ACTIVE
    await db_session.flush()

    # Create an ended table
    ended_table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        is_private=False,
        auto_seat_creator=True,
    )
    ended_table.status = TableStatus.ENDED
    await db_session.flush()

    # Get active tables
    tables = await user_service.get_active_tables(db_session, user.id)
    
    # Should only see waiting and active tables
    assert len(tables) == 2
    table_ids = [t["table_id"] for t in tables]
    assert waiting_table.id in table_ids
    assert active_table.id in table_ids
    assert ended_table.id not in table_ids


@pytest.mark.asyncio
async def test_get_active_tables_filters_left_seats(db_session: AsyncSession) -> None:
    """Test that get_active_tables only returns tables where user has not left."""
    user = User(tg_user_id=500, username="eve", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create two tables
    table1 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        is_private=False,
        auto_seat_creator=True,
    )

    table2 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        is_private=False,
        auto_seat_creator=True,
    )

    # User leaves table2
    await table_service.leave_table(db_session, table2.id, user.id)

    # Get active tables
    tables = await user_service.get_active_tables(db_session, user.id)
    
    # Should only see table1 (still seated)
    assert len(tables) == 1
    assert tables[0]["table_id"] == table1.id


@pytest.mark.asyncio
async def test_get_active_tables_ordering(db_session: AsyncSession) -> None:
    """Test that get_active_tables orders by joined_at DESC, then created_at DESC."""
    user = User(tg_user_id=600, username="frank", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create three tables at different times
    table1 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        table_name="Table 1",
        is_private=False,
        auto_seat_creator=True,
    )
    
    table2 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        table_name="Table 2",
        is_private=False,
        auto_seat_creator=True,
    )
    
    table3 = await table_service.create_table_with_config(
        db_session,
        creator_user_id=user.id,
        table_name="Table 3",
        is_private=False,
        auto_seat_creator=True,
    )

    # Get active tables
    tables = await user_service.get_active_tables(db_session, user.id)
    
    # Should be ordered by most recent join first
    # Since all were auto-seated at creation, newer tables should be first
    assert len(tables) == 3
    assert tables[0]["table_id"] == table3.id
    assert tables[1]["table_id"] == table2.id
    assert tables[2]["table_id"] == table1.id


@pytest.mark.asyncio
async def test_table_model_has_required_columns(db_session: AsyncSession) -> None:
    """Test that the Table model has creator_user_id and is_public columns.
    
    This test verifies that the model matches what migration 004 creates.
    """
    user = User(tg_user_id=700, username="grace", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a table directly using the model
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=user.id,
        is_public=True,
        config_json={"small_blind": 10, "big_blind": 20},
    )
    db_session.add(table)
    await db_session.flush()

    # Verify the table was created with the columns
    result = await db_session.execute(
        select(Table).where(Table.id == table.id)
    )
    saved_table = result.scalar_one()
    
    assert saved_table.creator_user_id == user.id
    assert saved_table.is_public is True
    assert hasattr(saved_table, "creator")  # Relationship exists
    
    # Verify the relationship works
    assert saved_table.creator.id == user.id
    assert saved_table.creator.username == "grace"
