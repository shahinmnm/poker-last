"""Pydantic schemas for validated template payloads."""

from typing import Dict, Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class LayoutSchema(BaseModel):
    """Seat and table layout definition."""

    type: Literal["ring", "oval", "double-board"]
    seat_count: int = Field(..., ge=2)
    radius: int = Field(..., gt=0)
    avatar_size: int = Field(..., gt=0)
    card_scale: float = Field(..., gt=0)


class ThemeSchema(BaseModel):
    """Table theme colors and look."""

    table_color: str
    felt_pattern: str
    accent_color: str
    ui_color_mode: Literal["light", "dark"]


class TimerSchema(BaseModel):
    """Timer ring styling."""

    avatar_ring: bool
    ring_color: str
    ring_thickness: int = Field(..., ge=0)


class IconSchema(BaseModel):
    """Iconography used by the template."""

    table_icon: str
    stake_label: str
    variant_badge: str


class RulesDisplaySchema(BaseModel):
    """Visibility toggles for rule metadata."""

    show_blinds: bool
    show_speed: bool
    show_buyin: bool


class TemplateUISchema(BaseModel):
    """Full UI schema grouping layout/theme/timers/icons/rules_display."""

    layout: LayoutSchema
    theme: ThemeSchema
    timers: TimerSchema
    icons: IconSchema
    rules_display: RulesDisplaySchema


class AutoCreateConfig(BaseModel):
    """Auto-create configuration for lobby-persistent tables.
    
    Canonical schema - these are the ONLY allowed fields:
    - enabled: boolean (required)
    - min_tables: int (required)
    - max_tables: int (required)
    - on_startup_repair: boolean (required)
    - allow_missing_runtime: boolean (required)
    
    Fields like lobby_persistent and is_auto_generated belong ONLY in the tables DB table,
    not in the template config.
    """
    
    model_config = ConfigDict(extra="forbid")  # Strictly forbid any extra fields

    enabled: bool = Field(description="Whether auto-creation is enabled")
    min_tables: int = Field(ge=0, description="Minimum number of tables to maintain")
    max_tables: int = Field(ge=1, description="Maximum number of tables to create")
    on_startup_repair: bool = Field(description="Whether to repair missing tables on startup")
    allow_missing_runtime: bool = Field(description="Whether to allow missing tables at runtime")

    @field_validator("max_tables")
    @classmethod
    def validate_max_tables(cls, v: int, info) -> int:
        """Ensure max_tables is at least min_tables."""
        min_tables = info.data.get("min_tables", 0)
        if v < min_tables:
            raise ValueError(f"max_tables ({v}) must be >= min_tables ({min_tables})")
        return v


class TableTemplateConfig(BaseModel):
    """Top-level template config with backend rules and UI schema."""

    model_config = ConfigDict(extra="forbid")  # Strictly enforce canonical structure - no unknown root keys

    backend: Dict[str, Any]
    ui_schema: TemplateUISchema
    auto_create: Optional[AutoCreateConfig] = Field(default=None)

    @field_validator("backend")
    @classmethod
    def validate_backend(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(value, dict) or not value:
            raise ValueError("backend must be a non-empty object")
        return value

