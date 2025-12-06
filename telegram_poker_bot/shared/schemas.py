"""Pydantic schemas for validated template payloads."""

from typing import Dict, Any, Literal

from pydantic import BaseModel, Field, validator


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


class TableTemplateConfig(BaseModel):
    """Top-level template config with backend rules and UI schema."""

    backend: Dict[str, Any]
    ui_schema: TemplateUISchema

    class Config:
        extra = "allow"  # Allow extra fields like auto_create, lobby_persistent, etc.

    @validator("backend")
    def validate_backend(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(value, dict) or not value:
            raise ValueError("backend must be a non-empty object")
        return value

