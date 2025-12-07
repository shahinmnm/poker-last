"""Tests for template normalization service."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import Base, TableTemplate, TableTemplateType
from telegram_poker_bot.shared.services.template_normalizer import TemplateNormalizer
from telegram_poker_bot.shared.schemas import TableTemplateConfig

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
async def test_template_normalization():
    """Test normalization of garbage input to canonical JSON."""
    # Input: legacy format with mixed structure
    garbage_input = {
        "small_blind": 25,
        "big_blind": 50,
        "starting_stack": 10000,
        "max_players": 8,
        "game_variant": "no_limit_texas_holdem",
        "currency_type": "PLAY",
        "some_random_key": "should_be_removed",
        "ui": {
            "layout": {
                "type": "ring",
                "seat_count": 8,
                "radius": 120,
                "avatar_size": 48,
                "card_scale": 1.0,
            },
            "theme": {
                "table_color": "#0b3d2e",
                "felt_pattern": "classic",
                "accent_color": "#ffc107",
                "ui_color_mode": "dark",
            },
            "timers": {
                "avatar_ring": True,
                "ring_color": "#00ffc6",
                "ring_thickness": 3,
            },
            "icons": {
                "table_icon": "🃏",
                "stake_label": "Default",
                "variant_badge": "NLH",
            },
            "rules_display": {
                "show_blinds": True,
                "show_speed": True,
                "show_buyin": True,
            },
        },
    }

    # Normalize
    normalized = TemplateNormalizer.normalize_config(garbage_input)

    # Verify canonical structure
    assert "backend" in normalized
    assert "ui_schema" in normalized
    assert "auto_create" in normalized

    # Verify backend contains game rules
    backend = normalized["backend"]
    assert backend["small_blind"] == 25
    assert backend["big_blind"] == 50
    assert backend["starting_stack"] == 10000
    assert backend["max_players"] == 8
    assert backend["game_variant"] == "no_limit_texas_holdem"

    # Verify unknown keys are NOT in root
    assert "some_random_key" not in normalized
    # But should be preserved in backend
    assert backend["some_random_key"] == "should_be_removed"

    # Verify ui_schema
    assert "layout" in normalized["ui_schema"]
    assert normalized["ui_schema"]["layout"]["type"] == "ring"

    # Verify auto_create was injected
    auto_create = normalized["auto_create"]
    assert auto_create["min_tables"] == 1
    assert auto_create["max_tables"] == 2
    assert auto_create["lobby_persistent"] is True
    assert auto_create["is_auto_generated"] is True


@pytest.mark.asyncio
async def test_template_auto_create_injected():
    """Test that missing auto_create block is automatically added."""
    # Input: config without auto_create
    input_config = {
        "backend": {
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 5000,
            "max_players": 6,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "REAL",
        },
        "ui_schema": {
            "layout": {
                "type": "ring",
                "seat_count": 6,
                "radius": 150,
                "avatar_size": 52,
                "card_scale": 1.0,
            },
            "theme": {
                "table_color": "#0a5b3c",
                "felt_pattern": "micro-knit",
                "accent_color": "#2ee59d",
                "ui_color_mode": "dark",
            },
            "timers": {
                "avatar_ring": True,
                "ring_color": "#2ee59d",
                "ring_thickness": 3,
            },
            "icons": {
                "table_icon": "♠️",
                "stake_label": "$0.10/$0.20",
                "variant_badge": "NLHE",
            },
            "rules_display": {
                "show_blinds": True,
                "show_speed": True,
                "show_buyin": True,
            },
        },
    }

    # Normalize
    normalized = TemplateNormalizer.normalize_config(input_config)

    # Verify auto_create was injected with defaults
    assert "auto_create" in normalized
    auto_create = normalized["auto_create"]
    assert auto_create["min_tables"] == 1
    assert auto_create["max_tables"] == 2
    assert auto_create["lobby_persistent"] is True
    assert auto_create["is_auto_generated"] is True


@pytest.mark.asyncio
async def test_template_with_existing_auto_create():
    """Test that existing auto_create config is preserved."""
    input_config = {
        "backend": {
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 5000,
            "max_players": 6,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "REAL",
        },
        "ui_schema": {
            "layout": {
                "type": "ring",
                "seat_count": 6,
                "radius": 150,
                "avatar_size": 52,
                "card_scale": 1.0,
            },
            "theme": {
                "table_color": "#0a5b3c",
                "felt_pattern": "micro-knit",
                "accent_color": "#2ee59d",
                "ui_color_mode": "dark",
            },
            "timers": {
                "avatar_ring": True,
                "ring_color": "#2ee59d",
                "ring_thickness": 3,
            },
            "icons": {
                "table_icon": "♠️",
                "stake_label": "$0.10/$0.20",
                "variant_badge": "NLHE",
            },
            "rules_display": {
                "show_blinds": True,
                "show_speed": True,
                "show_buyin": True,
            },
        },
        "auto_create": {
            "min_tables": 3,
            "max_tables": 5,
            "lobby_persistent": False,
            "is_auto_generated": False,
        },
    }

    # Normalize
    normalized = TemplateNormalizer.normalize_config(input_config)

    # Verify auto_create was preserved
    auto_create = normalized["auto_create"]
    assert auto_create["min_tables"] == 3
    assert auto_create["max_tables"] == 5
    assert auto_create["lobby_persistent"] is False
    assert auto_create["is_auto_generated"] is False


@pytest.mark.asyncio
async def test_template_max_players_validation():
    """Test that max_players is validated."""
    # Test invalid max_players (too low)
    with pytest.raises(ValueError, match="max_players must be between 2 and 9"):
        TemplateNormalizer.normalize_config({
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 5000,
                "max_players": 1,  # Invalid
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
        })

    # Test invalid max_players (too high)
    with pytest.raises(ValueError, match="max_players must be between 2 and 9"):
        TemplateNormalizer.normalize_config({
            "backend": {
                "small_blind": 10,
                "big_blind": 20,
                "starting_stack": 5000,
                "max_players": 10,  # Invalid
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
        })


@pytest.mark.asyncio
async def test_normalize_all_templates(db_session: AsyncSession):
    """Test normalizing all templates in database."""
    # Create templates with various formats
    template1 = TableTemplate(
        name="Legacy Template",
        table_type=TableTemplateType.CASH_GAME,
        config_json={
            "small_blind": 25,
            "big_blind": 50,
            "starting_stack": 10000,
            "max_players": 8,
            "game_variant": "no_limit_texas_holdem",
            "currency_type": "PLAY",
        },
    )

    template2 = TableTemplate(
        name="Modern Template",
        table_type=TableTemplateType.CASH_GAME,
        config_json={
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
    )

    db_session.add(template1)
    db_session.add(template2)
    await db_session.flush()

    # Normalize all (dry run)
    results = await TemplateNormalizer.normalize_all_templates(db_session, dry_run=True)

    assert len(results) == 2
    assert all(r["changed"] for r in results)  # Both should be marked as changed
    assert all("diff" in r for r in results)

    # Verify original configs unchanged (dry run)
    await db_session.refresh(template1)
    assert "auto_create" not in template1.config_json

    # Now normalize with repair
    results = await TemplateNormalizer.normalize_all_templates(db_session, dry_run=False)
    await db_session.flush()

    # Verify configs were updated
    await db_session.refresh(template1)
    await db_session.refresh(template2)

    assert "backend" in template1.config_json
    assert "ui_schema" in template1.config_json
    assert "auto_create" in template1.config_json

    assert "auto_create" in template2.config_json
