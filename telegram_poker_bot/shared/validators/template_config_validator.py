"""Validator for table template configurations including auto_create block.

DEPRECATED: This module contains legacy validation logic. New code should use:
- telegram_poker_bot.shared.schemas.AutoCreateConfig (Pydantic model)
- telegram_poker_bot.shared.services.template_normalizer.TemplateNormalizer

This module is kept for backward compatibility with table_auto_creator service.

Canonical auto_create schema (REQUIRED):
- enabled: boolean (required)
- min_tables: int (required)
- max_tables: int (required)
- on_startup_repair: boolean (required)
- allow_missing_runtime: boolean (required)

NO other fields are allowed (lobby_persistent, is_auto_generated belong in tables DB columns).
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class AutoCreateConfig:
    """Canonical auto-create configuration dataclass.
    
    This is the canonical schema for auto_create configs.
    
    Fields:
    - enabled: boolean (required)
    - min_tables: int (required)
    - max_tables: int (required)
    - on_startup_repair: boolean (required)
    - allow_missing_runtime: boolean (required)
    
    Fields like lobby_persistent and is_auto_generated belong ONLY in the
    tables DB table columns, NOT in the template config.
    """
    
    enabled: bool
    min_tables: int
    max_tables: int
    on_startup_repair: bool
    allow_missing_runtime: bool


# Legacy alias for backward compatibility
LegacyAutoCreateConfig = AutoCreateConfig


def validate_auto_create_config(config: Dict[str, Any]) -> Optional[AutoCreateConfig]:
    """Validate and parse auto_create configuration block.
    
    Validates against the canonical auto_create schema:
    - enabled: boolean (required)
    - min_tables: int (required)
    - max_tables: int (required)
    - on_startup_repair: boolean (required)
    - allow_missing_runtime: boolean (required)
    
    Args:
        config: The auto_create config dictionary
        
    Returns:
        AutoCreateConfig if enabled and valid, None if disabled or missing
        
    Raises:
        ValueError: If configuration is invalid
    """
    if not config:
        return None
        
    if not isinstance(config, dict):
        raise ValueError("auto_create must be an object")
    
    enabled = config.get("enabled", False)
    if not isinstance(enabled, bool):
        raise ValueError("auto_create.enabled must be a boolean")
    
    if not enabled:
        return None
    
    # Validate min_tables
    min_tables = config.get("min_tables")
    if min_tables is None:
        raise ValueError("auto_create.min_tables is required when enabled is true")
    
    try:
        min_tables = int(min_tables)
    except (TypeError, ValueError) as exc:
        raise ValueError("auto_create.min_tables must be an integer") from exc
    
    if min_tables < 0:
        raise ValueError("auto_create.min_tables must be non-negative")
    
    # Validate max_tables
    max_tables = config.get("max_tables")
    if max_tables is None:
        raise ValueError("auto_create.max_tables is required when enabled is true")
    
    try:
        max_tables = int(max_tables)
    except (TypeError, ValueError) as exc:
        raise ValueError("auto_create.max_tables must be an integer") from exc
    
    if max_tables < 1:
        raise ValueError("auto_create.max_tables must be at least 1")
    
    if min_tables > max_tables:
        raise ValueError(
            f"auto_create.min_tables ({min_tables}) cannot exceed "
            f"max_tables ({max_tables})"
        )
    
    # Validate on_startup_repair
    on_startup_repair = config.get("on_startup_repair", True)
    if not isinstance(on_startup_repair, bool):
        raise ValueError("auto_create.on_startup_repair must be a boolean")
    
    # Validate allow_missing_runtime
    allow_missing_runtime = config.get("allow_missing_runtime", False)
    if not isinstance(allow_missing_runtime, bool):
        raise ValueError("auto_create.allow_missing_runtime must be a boolean")
    
    return AutoCreateConfig(
        enabled=enabled,
        min_tables=min_tables,
        max_tables=max_tables,
        on_startup_repair=on_startup_repair,
        allow_missing_runtime=allow_missing_runtime,
    )


def extract_auto_create_config(template_config: Dict[str, Any]) -> Optional[AutoCreateConfig]:
    """Extract and validate auto_create config from a template's config_json.
    
    Args:
        template_config: Full template config_json dictionary
        
    Returns:
        AutoCreateConfig if enabled and valid, None otherwise
        
    Raises:
        ValueError: If auto_create configuration is invalid
    """
    auto_create = template_config.get("auto_create")
    if not auto_create:
        return None
    
    return validate_auto_create_config(auto_create)
