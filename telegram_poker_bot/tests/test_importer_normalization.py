"""Tests for template importer normalization."""

import pytest
from import_all_templates import normalize_template


def test_importer_normalizes():
    """Test that importer normalizes templates correctly."""
    # Legacy format template
    legacy_template = {
        "name": "NLHE 6-Max Micro",
        "backend": {
            "template_name": "NLHE 6-Max Micro",
            "game_type": "cash",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
        "ui_schema": {
            "layout": {
                "type": "ring",
                "seat_count": 6,
                "radius": 150,
                "avatar_size": 52,
                "card_scale": 1,
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
    normalized = normalize_template(legacy_template)

    # Verify structure
    assert "name" in normalized
    assert "table_type" in normalized
    assert "config_json" in normalized

    # Verify name extracted from backend.template_name
    assert normalized["name"] == "NLHE 6-Max Micro"

    # Verify table_type mapped from game_type
    assert normalized["table_type"] == "CASH_GAME"

    # Verify config_json has canonical structure
    config = normalized["config_json"]
    assert "backend" in config
    assert "ui_schema" in config
    assert "auto_create" in config

    # Verify backend preserved
    assert config["backend"]["game_variant"] == "no_limit_texas_holdem"
    assert config["backend"]["small_blind"] == 10

    # Verify ui_schema preserved
    assert config["ui_schema"]["layout"]["type"] == "ring"

    # Verify auto_create injected
    assert config["auto_create"]["min_tables"] == 1
    assert config["auto_create"]["max_tables"] == 2
    assert config["auto_create"]["lobby_persistent"] is True
    assert config["auto_create"]["is_auto_generated"] is True


def test_importer_maps_game_type_cash():
    """Test that game_type 'cash' maps to 'CASH_GAME'."""
    template = {
        "backend": {
            "template_name": "Test Cash",
            "game_type": "cash",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
    }

    normalized = normalize_template(template)
    assert normalized["table_type"] == "CASH_GAME"


def test_importer_maps_game_type_tournament():
    """Test that game_type 'tournament' maps to 'TOURNAMENT'."""
    template = {
        "backend": {
            "template_name": "Test Tournament",
            "game_type": "tournament",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
    }

    normalized = normalize_template(template)
    assert normalized["table_type"] == "TOURNAMENT"


def test_importer_defaults_to_cash_game():
    """Test that missing game_type defaults to CASH_GAME."""
    template = {
        "backend": {
            "template_name": "Default Type",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
    }

    normalized = normalize_template(template)
    assert normalized["table_type"] == "CASH_GAME"


def test_importer_handles_ui_key():
    """Test that importer handles 'ui' key as alias for 'ui_schema'."""
    template = {
        "backend": {
            "template_name": "UI Alias Test",
            "game_type": "cash",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
        "ui": {  # Note: using 'ui' instead of 'ui_schema'
            "layout": {
                "type": "ring",
                "seat_count": 6,
                "radius": 150,
                "avatar_size": 52,
                "card_scale": 1,
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

    normalized = normalize_template(template)
    config = normalized["config_json"]

    # Verify ui_schema is present
    assert "ui_schema" in config
    assert config["ui_schema"]["layout"]["type"] == "ring"


def test_importer_extracts_name_from_backend():
    """Test that name is extracted from backend.template_name."""
    template = {
        "backend": {
            "template_name": "Extracted Name",
            "game_type": "cash",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
    }

    normalized = normalize_template(template)
    assert normalized["name"] == "Extracted Name"


def test_importer_falls_back_to_top_level_name():
    """Test that name falls back to top-level name if backend.template_name missing."""
    template = {
        "name": "Top Level Name",
        "backend": {
            "game_type": "cash",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
    }

    normalized = normalize_template(template)
    assert normalized["name"] == "Top Level Name"


def test_importer_defaults_name_to_unknown():
    """Test that name defaults to 'Unknown' if not present."""
    template = {
        "backend": {
            "game_type": "cash",
            "game_variant": "no_limit_texas_holdem",
            "small_blind": 10,
            "big_blind": 20,
            "starting_stack": 2000,
            "max_players": 6,
            "currency_type": "REAL",
        },
    }

    normalized = normalize_template(template)
    assert normalized["name"] == "Unknown"
