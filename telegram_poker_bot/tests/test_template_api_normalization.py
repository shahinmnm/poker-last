"""Tests for template API normalization."""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import Base, TableTemplateType
from telegram_poker_bot.shared.services.rbac_middleware import CurrentUser
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
    # Override the require_superadmin dependency
    from telegram_poker_bot.api.routes.table_templates import require_superadmin
    api_app.dependency_overrides[require_superadmin] = override_require_admin

    yield TestClient(api_app)

    api_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_template_api_create_normalizes(test_client: TestClient):
    """Test that create endpoint normalizes templates."""
    # Send legacy format
    payload = {
        "name": "Legacy Create Test",
        "table_type": "CASH_GAME",
        "config_json": {
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
            "ui": {
                "layout": {"type": "ring", "seat_count": 8, "radius": 120, "avatar_size": 48, "card_scale": 1.0},
                "theme": {"table_color": "#0b3d2e", "felt_pattern": "classic", "accent_color": "#ffc107", "ui_color_mode": "dark"},
                "timers": {"avatar_ring": True, "ring_color": "#00ffc6", "ring_thickness": 3},
                "icons": {"table_icon": "🃏", "stake_label": "Default", "variant_badge": "NLH"},
                "rules_display": {"show_blinds": True, "show_speed": True, "show_buyin": True},
            },
        },
    }

    response = test_client.post("/api/table-templates", json=payload)
    assert response.status_code == 201, response.text

    data = response.json()
    config = data["config_json"]

    # Verify canonical structure
    assert "backend" in config
    assert "ui_schema" in config
    assert "auto_create" in config

    # Verify backend
    assert config["backend"]["small_blind"] == 25
    assert config["backend"]["big_blind"] == 50

    # Verify auto_create was injected
    auto_create = config["auto_create"]
    assert auto_create["min_tables"] == 1
    assert auto_create["max_tables"] == 2
    assert auto_create["lobby_persistent"] is True
    assert auto_create["is_auto_generated"] is True


@pytest.mark.asyncio
async def test_template_api_update_normalizes(test_client: TestClient):
    """Test that update endpoint normalizes templates."""
    # Create a template first
    create_payload = {
        "name": "Update Test",
        "table_type": "CASH_GAME",
        "config_json": {
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 5000,
                "max_players": 6,
                "game_variant": "no_limit_texas_holdem",
                "currency_type": "REAL",
            },
            "ui_schema": {
                "layout": {"type": "ring", "seat_count": 6, "radius": 150, "avatar_size": 52, "card_scale": 1.0},
                "theme": {"table_color": "#0a5b3c", "felt_pattern": "micro-knit", "accent_color": "#2ee59d", "ui_color_mode": "dark"},
                "timers": {"avatar_ring": True, "ring_color": "#2ee59d", "ring_thickness": 3},
                "icons": {"table_icon": "♠️", "stake_label": "$0.10/$0.20", "variant_badge": "NLHE"},
                "rules_display": {"show_blinds": True, "show_speed": True, "show_buyin": True},
            },
        },
    }

    create_resp = test_client.post("/api/table-templates", json=create_payload)
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]

    # Update with partial config (missing auto_create)
    update_payload = {
        "config_json": {
            "backend": {
                "small_blind": 15,
                "big_blind": 30,
                "starting_stack": 6000,
                "max_players": 6,
                "game_variant": "no_limit_texas_holdem",
                "currency_type": "REAL",
            },
            "ui_schema": {
                "layout": {"type": "ring", "seat_count": 6, "radius": 150, "avatar_size": 52, "card_scale": 1.0},
                "theme": {"table_color": "#0a5b3c", "felt_pattern": "micro-knit", "accent_color": "#2ee59d", "ui_color_mode": "dark"},
                "timers": {"avatar_ring": True, "ring_color": "#2ee59d", "ring_thickness": 3},
                "icons": {"table_icon": "♠️", "stake_label": "$0.15/$0.30", "variant_badge": "NLHE"},
                "rules_display": {"show_blinds": True, "show_speed": True, "show_buyin": True},
            },
        },
    }

    update_resp = test_client.put(f"/api/table-templates/{template_id}", json=update_payload)
    assert update_resp.status_code == 200, update_resp.text

    data = update_resp.json()
    config = data["config_json"]
    
    # DEBUG: print actual values
    import sys
    print(f"\nDEBUG: small_blind = {config['backend']['small_blind']}", file=sys.stderr)
    print(f"DEBUG: big_blind = {config['backend']['big_blind']}", file=sys.stderr)

    # Verify canonical structure maintained
    assert "backend" in config
    assert "ui_schema" in config
    assert "auto_create" in config

    # Verify backend was updated
    assert config["backend"]["small_blind"] == 15
    assert config["backend"]["big_blind"] == 30

    # Verify auto_create still exists
    assert config["auto_create"]["min_tables"] == 1


@pytest.mark.asyncio
async def test_template_api_rejects_missing_backend(test_client: TestClient):
    """Test that API rejects templates missing backend."""
    payload = {
        "name": "Missing Backend",
        "table_type": "CASH_GAME",
        "config_json": {
            "ui_schema": {
                "layout": {"type": "ring", "seat_count": 6, "radius": 150, "avatar_size": 52, "card_scale": 1.0},
                "theme": {"table_color": "#0a5b3c", "felt_pattern": "micro-knit", "accent_color": "#2ee59d", "ui_color_mode": "dark"},
                "timers": {"avatar_ring": True, "ring_color": "#2ee59d", "ring_thickness": 3},
                "icons": {"table_icon": "♠️", "stake_label": "$0.10/$0.20", "variant_badge": "NLHE"},
                "rules_display": {"show_blinds": True, "show_speed": True, "show_buyin": True},
            },
        },
    }

    response = test_client.post("/api/table-templates", json=payload)
    assert response.status_code == 400
    assert "backend" in response.text.lower() or "required" in response.text.lower()


@pytest.mark.asyncio
async def test_template_api_rejects_invalid_game_variant(test_client: TestClient):
    """Test that API rejects invalid game_variant."""
    payload = {
        "name": "Invalid Variant",
        "table_type": "CASH_GAME",
        "config_json": {
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 5000,
                "max_players": 6,
                "game_variant": "invalid_variant",  # Invalid
                "currency_type": "REAL",
            },
            "ui_schema": {
                "layout": {"type": "ring", "seat_count": 6, "radius": 150, "avatar_size": 52, "card_scale": 1.0},
                "theme": {"table_color": "#0a5b3c", "felt_pattern": "micro-knit", "accent_color": "#2ee59d", "ui_color_mode": "dark"},
                "timers": {"avatar_ring": True, "ring_color": "#2ee59d", "ring_thickness": 3},
                "icons": {"table_icon": "♠️", "stake_label": "$0.10/$0.20", "variant_badge": "NLHE"},
                "rules_display": {"show_blinds": True, "show_speed": True, "show_buyin": True},
            },
        },
    }

    response = test_client.post("/api/table-templates", json=payload)
    assert response.status_code == 400
    assert "game_variant" in response.text.lower() or "invalid" in response.text.lower()
