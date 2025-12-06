"""Validators for template configurations."""

from telegram_poker_bot.shared.validators.template_config_validator import (
    validate_auto_create_config,
    extract_auto_create_config,
    AutoCreateConfig,
)

__all__ = [
    "validate_auto_create_config",
    "extract_auto_create_config",
    "AutoCreateConfig",
]
