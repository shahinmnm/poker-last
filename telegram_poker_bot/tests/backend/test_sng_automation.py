"""Tests for Sit & Go automation for PERSISTENT tables."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from telegram_poker_bot.shared.models import (
    Base,
    Table,
    TableTemplate,
    TableTemplateType,
    TableStatus,
    User,
    Seat,
    GameMode,
)
from telegram_poker_bot.shared.services import sng_manager, table_service


@pytest_asyncio.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest_asyncio.fixture
async def persistent_template(db_session: AsyncSession):
    """Create a persistent table template."""
    template = TableTemplate(
        name="Persistent Test Template",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=True,
        config_json={
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 1000,
                "max_players": 6,
                "currency_type": "PLAY",
                "game_variant": "no_limit_texas_holdem",
                "table_name": "Test Persistent Table",
            }
        },
    )
    db_session.add(template)
    await db_session.flush()
    return template


@pytest_asyncio.fixture
async def test_users(db_session: AsyncSession):
    """Create test users."""
    users = []
    for i in range(3):
        user = User(
            tg_user_id=1000 + i,
            username=f"testuser{i}",
            language="en",
        )
        db_session.add(user)
        users.append(user)
    await db_session.flush()
    return users


@pytest.mark.asyncio
async def test_persistent_table_auto_start_with_two_players(
    db_session: AsyncSession, persistent_template: TableTemplate, test_users: list
):
    """Test that PERSISTENT tables auto-start when 2nd player joins."""
    # Create a persistent table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=persistent_template.id,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Initially, should not auto-start with 0 players
    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is False
    assert reason is None

    # Add first player - should not auto-start
    seat1 = Seat(
        table_id=table.id,
        user_id=test_users[0].id,
        position=0,
        chips=1000,
        joined_at=datetime.now(timezone.utc),
    )
    db_session.add(seat1)
    await db_session.flush()

    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is False
    assert reason is None

    # Add second player - should auto-start
    seat2 = Seat(
        table_id=table.id,
        user_id=test_users[1].id,
        position=1,
        chips=1000,
        joined_at=datetime.now(timezone.utc),
    )
    db_session.add(seat2)
    await db_session.flush()

    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is True
    assert reason == "persistent_min_players_met"


@pytest.mark.asyncio
async def test_persistent_table_auto_start_with_more_players(
    db_session: AsyncSession, persistent_template: TableTemplate, test_users: list
):
    """Test that PERSISTENT tables auto-start with more than 2 players."""
    # Create a persistent table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=persistent_template.id,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add three players
    for i in range(3):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # Should auto-start with 3 players
    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is True
    assert reason == "persistent_min_players_met"


@pytest.mark.asyncio
async def test_system_can_start_persistent_table(
    db_session: AsyncSession, persistent_template: TableTemplate, test_users: list
):
    """Test that system (user_id=None) can start a PERSISTENT table."""
    # Create a persistent table with 2 players
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=persistent_template.id,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add two players
    for i in range(2):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # System should be able to start the table (user_id=None)
    result_table = await table_service.start_table(db_session, table.id, user_id=None)
    
    assert result_table.status == TableStatus.ACTIVE
    assert result_table.expires_at is None  # Should clear expiration


@pytest.mark.asyncio
async def test_non_creator_cannot_start_table(
    db_session: AsyncSession, persistent_template: TableTemplate, test_users: list
):
    """Test that non-creator users cannot start a table."""
    # Create a persistent table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=persistent_template.id,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add two players
    for i in range(2):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # Non-creator should not be able to start
    with pytest.raises(PermissionError, match="Only the table creator can start"):
        await table_service.start_table(db_session, table.id, user_id=test_users[1].id)


@pytest.mark.asyncio
async def test_creator_can_start_table(
    db_session: AsyncSession, persistent_template: TableTemplate, test_users: list
):
    """Test that creator can manually start a table."""
    # Create a persistent table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=persistent_template.id,
    )
    table.template = persistent_template
    db_session.add(table)
    await db_session.flush()

    # Add two players
    for i in range(2):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # Creator should be able to start
    result_table = await table_service.start_table(
        db_session, table.id, user_id=test_users[0].id
    )
    
    assert result_table.status == TableStatus.ACTIVE


@pytest.mark.asyncio
async def test_persistent_table_ignores_sng_config(
    db_session: AsyncSession, test_users: list
):
    """Test that PERSISTENT tables ignore SNG config and use fixed min_players=2."""
    # Create a persistent template with SNG config that would require 4 players
    template = TableTemplate(
        name="Persistent With SNG Config",
        table_type=TableTemplateType.PERSISTENT,
        has_waitlist=True,
        config_json={
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 1000,
                "max_players": 6,
                "currency_type": "PLAY",
                "game_variant": "no_limit_texas_holdem",
                "table_name": "Test Table",
                "sng_enabled": True,
                "sng_min_players": 4,  # This should be ignored
            }
        },
    )
    db_session.add(template)
    await db_session.flush()

    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=template.id,
    )
    table.template = template
    db_session.add(table)
    await db_session.flush()

    # Add only 2 players (less than sng_min_players=4)
    for i in range(2):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # Should still auto-start because PERSISTENT tables use min_players=2
    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is True
    assert reason == "persistent_min_players_met"


@pytest.mark.asyncio
async def test_cash_game_table_auto_start(
    db_session: AsyncSession, test_users: list
):
    """Test that CASH_GAME tables auto-start with 2 players."""
    # Create a CASH_GAME template
    template = TableTemplate(
        name="Cash Game Template",
        table_type=TableTemplateType.CASH_GAME,
        has_waitlist=True,
        config_json={
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 1000,
                "max_players": 6,
                "currency_type": "PLAY",
                "game_variant": "no_limit_texas_holdem",
                "table_name": "Test Cash Game",
            }
        },
    )
    db_session.add(template)
    await db_session.flush()

    # Create table
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=template.id,
    )
    table.template = template
    db_session.add(table)
    await db_session.flush()

    # Add 2 players
    for i in range(2):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # Should auto-start with 2 players
    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is True
    assert reason == "persistent_min_players_met"


@pytest.mark.asyncio
async def test_lobby_persistent_table_auto_start(
    db_session: AsyncSession, test_users: list
):
    """Test that lobby_persistent tables auto-start with 2 players."""
    # Create a regular template
    template = TableTemplate(
        name="Regular Template",
        table_type=TableTemplateType.EXPIRING,
        has_waitlist=False,
        config_json={
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 1000,
                "max_players": 6,
                "currency_type": "PLAY",
                "game_variant": "no_limit_texas_holdem",
                "table_name": "Test Table",
                "expiration_minutes": 30,
            }
        },
    )
    db_session.add(template)
    await db_session.flush()

    # Create table with lobby_persistent=True
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        creator_user_id=test_users[0].id,
        is_public=True,
        template_id=template.id,
        lobby_persistent=True,  # This makes it persistent
    )
    table.template = template
    db_session.add(table)
    await db_session.flush()

    # Add 2 players
    for i in range(2):
        seat = Seat(
            table_id=table.id,
            user_id=test_users[i].id,
            position=i,
            chips=1000,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(seat)
    await db_session.flush()

    # Should auto-start with 2 players
    should_start, reason = await sng_manager.check_auto_start_conditions(
        db_session, table
    )
    assert should_start is True
    assert reason == "persistent_min_players_met"
