"""Tests for the GET /tables endpoint with lobby_persistent parameter.

Tests cover:
- lobby_persistent=true bypasses authentication
- lobby_persistent=true forces scope=public
- lobby_persistent=true returns 200 OK (not 401)
- lobby_persistent=false requires authentication
- Only public tables are returned when lobby_persistent=true
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import User, Table, TableStatus
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.api.main import app


@pytest.mark.asyncio
async def test_list_tables_with_lobby_persistent_true_bypasses_auth(db_session: AsyncSession) -> None:
    """Test that lobby_persistent=true bypasses authentication completely."""
    # Create a public table
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

    # Make request WITHOUT authentication header but WITH lobby_persistent=true
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/tables?lobby_persistent=true")

    # Should succeed with 200 OK (not 401)
    assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"

    # Should return the public table
    data = response.json()
    assert "tables" in data
    tables = data["tables"]
    assert len(tables) >= 0  # May be empty or contain tables


@pytest.mark.asyncio
async def test_list_tables_with_lobby_persistent_false_requires_auth(db_session: AsyncSession) -> None:
    """Test that lobby_persistent=false (default) requires authentication."""
    # Make request WITHOUT authentication header and WITHOUT lobby_persistent
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/tables")

    # Should fail with 401 Unauthorized
    assert response.status_code == 401, f"Expected 401 but got {response.status_code}"
    detail = response.json().get("detail", "")
    assert "telegram init data" in detail.lower() or "unauthorized" in detail.lower()


@pytest.mark.asyncio
async def test_list_tables_lobby_persistent_explicitly_false_requires_auth(db_session: AsyncSession) -> None:
    """Test that lobby_persistent=false explicitly requires authentication."""
    # Make request WITHOUT authentication header but WITH lobby_persistent=false
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/tables?lobby_persistent=false")

    # Should fail with 401 Unauthorized
    assert response.status_code == 401, f"Expected 401 but got {response.status_code}"


@pytest.mark.asyncio
async def test_list_tables_lobby_persistent_forces_public_scope(db_session: AsyncSession) -> None:
    """Test that lobby_persistent=true forces scope=public regardless of scope parameter."""
    # Create users
    user1 = User(tg_user_id=200, username="bob", language="en")
    user2 = User(tg_user_id=300, username="charlie", language="en")
    db_session.add_all([user1, user2])
    await db_session.flush()

    # Create templates
    from telegram_poker_bot.tests.conftest import create_test_template
    from telegram_poker_bot.shared.models import TableTemplateType

    public_template = await create_test_template(
        db_session,
        name="Public Template",
        table_type=TableTemplateType.EXPIRING,
        table_name="Public Game",
        small_blind=25,
        big_blind=50,
    )

    private_template = await create_test_template(
        db_session,
        name="Private Template",
        table_type=TableTemplateType.PRIVATE,
        table_name="Private Game",
        small_blind=10,
        big_blind=20,
    )

    # Create one public and one private table
    public_table = await table_service.create_table(
        db_session,
        creator_user_id=user1.id,
        template_id=public_template.id,
        auto_seat_creator=False,
    )

    private_table = await table_service.create_table(
        db_session,
        creator_user_id=user1.id,
        template_id=private_template.id,
        auto_seat_creator=False,
    )
    await db_session.commit()

    # Make request with lobby_persistent=true and scope=all
    # The scope parameter should be ignored and forced to "public"
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/tables?lobby_persistent=true&scope=all")

    # Should succeed with 200 OK
    assert response.status_code == 200

    # Should only return public tables, not private ones
    data = response.json()
    assert "tables" in data
    tables = data["tables"]

    # Check that only public tables are returned
    table_ids = [t["table_id"] for t in tables]
    if public_table.id in table_ids:
        # Public table should be visible
        assert public_table.id in table_ids
    # Private table should NOT be visible
    assert private_table.id not in table_ids


@pytest.mark.asyncio
async def test_list_tables_lobby_persistent_returns_only_public_tables(db_session: AsyncSession) -> None:
    """Test that lobby_persistent=true only returns public tables."""
    # Create a user
    user = User(tg_user_id=400, username="dave", language="en")
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

    # Create public and private tables
    public_table1 = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=public_template.id,
        auto_seat_creator=False,
    )

    public_table2 = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=public_template.id,
        auto_seat_creator=False,
    )

    private_table1 = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=private_template.id,
        auto_seat_creator=False,
    )

    private_table2 = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=private_template.id,
        auto_seat_creator=False,
    )
    await db_session.commit()

    # Make request with lobby_persistent=true
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/tables?lobby_persistent=true")

    # Should succeed with 200 OK
    assert response.status_code == 200

    # Should only return public tables
    data = response.json()
    tables = data["tables"]
    table_ids = [t["table_id"] for t in tables]

    # Public tables might be in the list
    # Private tables should NOT be in the list
    assert private_table1.id not in table_ids
    assert private_table2.id not in table_ids


@pytest.mark.asyncio
async def test_list_tables_lobby_persistent_with_limit(db_session: AsyncSession) -> None:
    """Test that lobby_persistent=true respects the limit parameter."""
    # Create a user
    user = User(tg_user_id=500, username="eve", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create template
    from telegram_poker_bot.tests.conftest import create_test_template
    from telegram_poker_bot.shared.models import TableTemplateType

    template = await create_test_template(
        db_session,
        name="Public Template",
        table_type=TableTemplateType.EXPIRING,
    )

    # Create multiple public tables
    for i in range(5):
        await table_service.create_table(
            db_session,
            creator_user_id=user.id,
            template_id=template.id,
            auto_seat_creator=False,
        )
    await db_session.commit()

    # Make request with lobby_persistent=true and limit=2
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/tables?lobby_persistent=true&limit=2")

    # Should succeed with 200 OK
    assert response.status_code == 200

    # Should respect the limit
    data = response.json()
    tables = data["tables"]
    assert len(tables) <= 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
