"""CRUD tests for table template endpoints."""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import Base, User, TableTemplateType
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.shared.services.rbac_middleware import CurrentUser, require_admin
from telegram_poker_bot.shared.auth_models import UserRole

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
    """Create a test client with database and admin dependency overrides."""
    from telegram_poker_bot.api.main import api_app
    from telegram_poker_bot.shared.database import get_db

    async def override_get_db():
        yield db_session

    async def override_require_admin():
        return CurrentUser(user_id=1, roles=[UserRole.ADMIN], token_payload=None)

    api_app.dependency_overrides[get_db] = override_get_db
    api_app.dependency_overrides[require_admin] = override_require_admin

    yield TestClient(api_app)

    api_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_template_success(db_session: AsyncSession, test_client: TestClient):
    payload = {
        "name": "NLH 25/50",
        "table_type": "EXPIRING",
        "has_waitlist": False,
        "config": {
            "table_name": "NLH 25/50",
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "expiration_minutes": 60,
        },
    }
    response = test_client.post("/api/table-templates", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["name"] == "NLH 25/50"
    assert data["table_type"] == "EXPIRING"
    assert data["config"]["small_blind"] == 25


@pytest.mark.asyncio
async def test_create_template_validation_failure(test_client: TestClient):
    payload = {
        "name": "Invalid",
        "table_type": "EXPIRING",
        "config": {"big_blind": 50},  # missing small_blind, starting_stack, etc.
    }
    response = test_client.post("/api/table-templates", json=payload)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_template_merges_config(db_session: AsyncSession, test_client: TestClient):
    create_payload = {
        "name": "Merge Test",
        "table_type": "EXPIRING",
        "config": {
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "expiration_minutes": 60,
        },
    }
    create_resp = test_client.post("/api/table-templates", json=create_payload)
    template_id = create_resp.json()["id"]

    update_payload = {"name": "Merge Test Updated", "config": {"big_blind": 75}}
    update_resp = test_client.put(f"/api/table-templates/{template_id}", json=update_payload)
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["name"] == "Merge Test Updated"
    # small_blind preserved from original config, big_blind updated
    assert data["config"]["small_blind"] == 25
    assert data["config"]["big_blind"] == 75


@pytest.mark.asyncio
async def test_delete_template_blocked_when_in_use(db_session: AsyncSession, test_client: TestClient):
    payload = {
        "name": "In-Use Template",
        "table_type": "EXPIRING",
        "config": {
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "expiration_minutes": 60,
        },
    }
    create_resp = test_client.post("/api/table-templates", json=payload)
    template_id = create_resp.json()["id"]

    user = User(tg_user_id=500, username="player", language="en")
    db_session.add(user)
    await db_session.flush()

    await table_service.create_table(
        db_session, creator_user_id=user.id, template_id=template_id
    )
    await db_session.commit()

    delete_resp = test_client.delete(f"/api/table-templates/{template_id}")
    assert delete_resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_template_success(db_session: AsyncSession, test_client: TestClient):
    payload = {
        "name": "Deletable Template",
        "table_type": "PRIVATE",
        "config": {
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 5000,
            "max_players": 6,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "expiration_minutes": 120,
            "allow_invite_code": True,
        },
    }
    create_resp = test_client.post("/api/table-templates", json=payload)
    template_id = create_resp.json()["id"]

    delete_resp = test_client.delete(f"/api/table-templates/{template_id}")
    assert delete_resp.status_code == 204


@pytest.mark.asyncio
async def test_filtering_and_pagination(test_client: TestClient):
    # Create two different variants
    for idx, variant in enumerate(["no_limit_texas_holdem", "no_limit_short_deck_holdem"]):
        payload = {
            "name": f"Variant {variant}",
            "table_type": "EXPIRING",
            "config": {
                "small_blind": 10 + idx,
                "big_blind": 20 + idx,
                "starting_stack": 5000,
                "max_players": 6,
                "game_variant": variant,
                "currency_type": "PLAY",
                "expiration_minutes": 60,
            },
        }
        test_client.post("/api/table-templates", json=payload)

    resp = test_client.get("/api/table-templates?variant=no_limit_short_deck_holdem")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["templates"]) == 1
    assert data["templates"][0]["config"]["game_variant"] == "no_limit_short_deck_holdem"

    paged = test_client.get("/api/table-templates?page=2&per_page=1")
    assert paged.status_code == 200
    assert paged.json()["per_page"] == 1
    assert len(paged.json()["templates"]) == 1
    assert paged.json()["total"] >= 2


@pytest.mark.asyncio
async def test_table_creation_uses_new_template(db_session: AsyncSession, test_client: TestClient):
    payload = {
        "name": "Integration Template",
        "table_type": "EXPIRING",
        "config": {
            "small_blind": 5,
            "big_blind": 10,
            "starting_stack": 1000,
            "max_players": 6,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "expiration_minutes": 30,
        },
    }
    create_resp = test_client.post("/api/table-templates", json=payload)
    template_id = create_resp.json()["id"]

    user = User(tg_user_id=600, username="creator", language="en")
    db_session.add(user)
    await db_session.flush()

    table = await table_service.create_table(
        db_session, creator_user_id=user.id, template_id=template_id
    )
    await db_session.commit()

    assert table.template_id == template_id
    assert table.template.config_json["small_blind"] == 5


@pytest.mark.asyncio
async def test_template_auto_creates_table(db_session: AsyncSession, test_client: TestClient):
    """Test that creating a template automatically creates a lobby-persistent table."""
    from sqlalchemy import select
    from telegram_poker_bot.shared.models import Table
    
    payload = {
        "name": "Auto Table Template",
        "table_type": "EXPIRING",
        "config": {
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "expiration_minutes": 60,
        },
    }
    
    # Create template via API
    create_resp = test_client.post("/api/table-templates", json=payload)
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]
    
    # Verify auto-generated table was created
    result = await db_session.execute(
        select(Table).where(
            Table.template_id == template_id,
            Table.is_auto_generated == True,
            Table.lobby_persistent == True,
        )
    )
    auto_table = result.scalar_one_or_none()
    
    assert auto_table is not None, "Auto-generated table should exist"
    assert auto_table.creator_user_id is None, "Auto-generated table should have no creator"
    assert auto_table.lobby_persistent is True
    assert auto_table.is_auto_generated is True

