"""Tests for auto_create configuration validation."""

import pytest

from telegram_poker_bot.shared.validators import validate_auto_create_config


class TestAutoCreateValidation:
    """Test auto_create config validation."""
    
    def test_validate_disabled_config(self):
        """Test that disabled config returns None."""
        config = {
            "enabled": False,
            "min_tables": 1,
            "max_tables": 3,
        }
        result = validate_auto_create_config(config)
        assert result is None
    
    def test_validate_none_config(self):
        """Test that None config returns None."""
        result = validate_auto_create_config(None)
        assert result is None
    
    def test_validate_empty_config(self):
        """Test that empty config returns None."""
        result = validate_auto_create_config({})
        assert result is None
    
    def test_validate_valid_config(self):
        """Test valid config is accepted."""
        config = {
            "enabled": True,
            "min_tables": 1,
            "max_tables": 3,
            "on_startup_repair": True,
            "allow_missing_runtime": True,
        }
        result = validate_auto_create_config(config)
        
        assert result is not None
        assert result.enabled is True
        assert result.min_tables == 1
        assert result.max_tables == 3
        assert result.on_startup_repair is True
        assert result.allow_missing_runtime is True
    
    def test_validate_with_defaults(self):
        """Test config with only required fields uses defaults."""
        config = {
            "enabled": True,
            "min_tables": 2,
            "max_tables": 5,
        }
        result = validate_auto_create_config(config)
        
        assert result is not None
        assert result.enabled is True
        assert result.min_tables == 2
        assert result.max_tables == 5
        assert result.on_startup_repair is True  # default
        assert result.allow_missing_runtime is True  # default
    
    def test_missing_min_tables(self):
        """Test that missing min_tables raises error."""
        config = {
            "enabled": True,
            "max_tables": 3,
        }
        with pytest.raises(ValueError, match="min_tables is required"):
            validate_auto_create_config(config)
    
    def test_missing_max_tables(self):
        """Test that missing max_tables raises error."""
        config = {
            "enabled": True,
            "min_tables": 1,
        }
        with pytest.raises(ValueError, match="max_tables is required"):
            validate_auto_create_config(config)
    
    def test_invalid_min_tables_type(self):
        """Test that non-integer min_tables raises error."""
        config = {
            "enabled": True,
            "min_tables": "invalid",
            "max_tables": 3,
        }
        with pytest.raises(ValueError, match="min_tables must be an integer"):
            validate_auto_create_config(config)
    
    def test_invalid_max_tables_type(self):
        """Test that non-integer max_tables raises error."""
        config = {
            "enabled": True,
            "min_tables": 1,
            "max_tables": "invalid",
        }
        with pytest.raises(ValueError, match="max_tables must be an integer"):
            validate_auto_create_config(config)
    
    def test_negative_min_tables(self):
        """Test that negative min_tables raises error."""
        config = {
            "enabled": True,
            "min_tables": -1,
            "max_tables": 3,
        }
        with pytest.raises(ValueError, match="min_tables must be non-negative"):
            validate_auto_create_config(config)
    
    def test_zero_max_tables(self):
        """Test that zero max_tables raises error."""
        config = {
            "enabled": True,
            "min_tables": 0,
            "max_tables": 0,
        }
        with pytest.raises(ValueError, match="max_tables must be at least 1"):
            validate_auto_create_config(config)
    
    def test_min_exceeds_max(self):
        """Test that min_tables > max_tables raises error."""
        config = {
            "enabled": True,
            "min_tables": 5,
            "max_tables": 3,
        }
        with pytest.raises(ValueError, match="cannot exceed"):
            validate_auto_create_config(config)
    
    def test_invalid_enabled_type(self):
        """Test that non-boolean enabled raises error."""
        config = {
            "enabled": "yes",
            "min_tables": 1,
            "max_tables": 3,
        }
        with pytest.raises(ValueError, match="enabled must be a boolean"):
            validate_auto_create_config(config)
    
    def test_invalid_on_startup_repair_type(self):
        """Test that non-boolean on_startup_repair raises error."""
        config = {
            "enabled": True,
            "min_tables": 1,
            "max_tables": 3,
            "on_startup_repair": "yes",
        }
        with pytest.raises(ValueError, match="on_startup_repair must be a boolean"):
            validate_auto_create_config(config)
    
    def test_invalid_allow_missing_runtime_type(self):
        """Test that non-boolean allow_missing_runtime raises error."""
        config = {
            "enabled": True,
            "min_tables": 1,
            "max_tables": 3,
            "allow_missing_runtime": "yes",
        }
        with pytest.raises(ValueError, match="allow_missing_runtime must be a boolean"):
            validate_auto_create_config(config)
    
    def test_invalid_config_type(self):
        """Test that non-dict config raises error."""
        with pytest.raises(ValueError, match="must be an object"):
            validate_auto_create_config("invalid")
