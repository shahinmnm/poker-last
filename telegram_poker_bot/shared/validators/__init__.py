"""Validators for template configurations.

DEPRECATED: This module is deprecated. Use telegram_poker_bot.shared.schemas instead.
The AutoCreateConfig Pydantic model and normalization logic have been moved to:
- telegram_poker_bot.shared.schemas.AutoCreateConfig (new Pydantic model)
- telegram_poker_bot.shared.services.template_normalizer.TemplateNormalizer

This module is kept for backward compatibility with existing code that uses the
legacy dataclass-based AutoCreateConfig.
"""

# Keep old validation functions and legacy dataclass for backward compatibility
from telegram_poker_bot.shared.validators.template_config_validator import (
    validate_auto_create_config,
    extract_auto_create_config,
    AutoCreateConfig,  # This is the legacy dataclass, not the new Pydantic model
)

__all__ = [
    "validate_auto_create_config",
    "extract_auto_create_config",
    "AutoCreateConfig",
]
