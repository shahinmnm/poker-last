"""Template normalization service for enforcing canonical JSON structure."""

from typing import Dict, Any, List, Tuple, Optional
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import TableTemplate, GameVariant, TableTemplateType
from telegram_poker_bot.shared.schemas import (
    TableTemplateConfig,
    AutoCreateConfig,
    TemplateUISchema,
)
from telegram_poker_bot.shared.services.table_service import DEFAULT_UI_SCHEMA

logger = get_logger(__name__)


class TemplateNormalizer:
    """Service for normalizing and repairing table template configurations."""

    @staticmethod
    def _extract_backend(raw_config: Dict[str, Any]) -> Dict[str, Any]:
        """Extract backend config, handling legacy structures."""
        # If already has backend key, use it
        if "backend" in raw_config:
            backend = raw_config["backend"]
            if isinstance(backend, dict):
                return dict(backend)
        
        # Otherwise, treat the whole config as backend (legacy format)
        # Filter out known non-backend keys
        non_backend_keys = {"ui_schema", "ui", "auto_create", "lobby_persistent"}
        backend = {k: v for k, v in raw_config.items() if k not in non_backend_keys}
        return backend

    @staticmethod
    def _extract_ui_schema(raw_config: Dict[str, Any]) -> Dict[str, Any]:
        """Extract UI schema, using defaults if missing."""
        # Try ui_schema first, then ui (legacy), then default
        ui_schema = raw_config.get("ui_schema") or raw_config.get("ui")
        if ui_schema and isinstance(ui_schema, dict):
            return dict(ui_schema)
        return dict(DEFAULT_UI_SCHEMA)

    @staticmethod
    def _extract_auto_create(raw_config: Dict[str, Any]) -> Dict[str, Any]:
        """Extract auto_create config, using defaults if missing."""
        auto_create = raw_config.get("auto_create")
        if auto_create and isinstance(auto_create, dict):
            return dict(auto_create)
        
        # Return default auto_create config
        return {
            "min_tables": 1,
            "max_tables": 2,
            "lobby_persistent": True,
            "is_auto_generated": True,
        }

    @staticmethod
    def _validate_backend_enums(backend: Dict[str, Any]) -> None:
        """Validate that backend enums match allowed values."""
        # Validate game_variant
        game_variant = backend.get("game_variant")
        if game_variant:
            try:
                GameVariant(game_variant)
            except ValueError:
                raise ValueError(f"Invalid game_variant: {game_variant}. Must be one of {[e.value for e in GameVariant]}")

        # Validate table_type if present
        table_type = backend.get("table_type")
        if table_type:
            try:
                TableTemplateType(table_type)
            except ValueError:
                raise ValueError(f"Invalid table_type: {table_type}. Must be one of {[e.value for e in TableTemplateType]}")

        # Validate max_players range
        max_players = backend.get("max_players")
        if max_players is not None:
            try:
                max_players_int = int(max_players)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"max_players must be an integer, got {max_players}") from exc
            
            if max_players_int < 2 or max_players_int > 8:
                raise ValueError(f"max_players must be between 2 and 8, got {max_players_int}")

    @classmethod
    def normalize_config(cls, raw_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize a template config to canonical structure.
        
        Args:
            raw_config: Raw config_json from database or file
            
        Returns:
            Normalized config with backend, ui_schema, and auto_create
            
        Raises:
            ValueError: If config is invalid or cannot be normalized
        """
        if not isinstance(raw_config, dict):
            raise ValueError("config must be a dictionary")

        # Extract sections
        backend = cls._extract_backend(raw_config)
        ui_schema_dict = cls._extract_ui_schema(raw_config)
        auto_create_dict = cls._extract_auto_create(raw_config)

        # Validate backend enums
        cls._validate_backend_enums(backend)

        # Build canonical structure
        canonical = {
            "backend": backend,
            "ui_schema": ui_schema_dict,
            "auto_create": auto_create_dict,
        }

        # Validate using Pydantic
        try:
            validated = TableTemplateConfig.model_validate(canonical)
            return validated.model_dump()
        except ValidationError as exc:
            logger.error(
                "Template config validation failed",
                error=str(exc),
                raw_config=raw_config,
            )
            raise ValueError(f"Invalid template configuration: {exc}") from exc

    @classmethod
    def compute_diff(cls, before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute differences between before and after configs.
        
        Returns a dict with keys: added, removed, changed
        """
        diff = {
            "added": [],
            "removed": [],
            "changed": [],
        }

        # Check top-level keys
        before_keys = set(before.keys())
        after_keys = set(after.keys())

        for key in after_keys - before_keys:
            diff["added"].append(key)

        for key in before_keys - after_keys:
            diff["removed"].append(key)

        for key in before_keys & after_keys:
            if before[key] != after[key]:
                diff["changed"].append({
                    "key": key,
                    "before": before[key],
                    "after": after[key],
                })

        return diff

    @classmethod
    async def normalize_template(
        cls,
        template: TableTemplate,
        dry_run: bool = True,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Normalize a single template.
        
        Args:
            template: Template to normalize
            dry_run: If True, don't save changes
            
        Returns:
            Tuple of (changed, diff_info)
        """
        original_config = dict(template.config_json or {})
        
        try:
            normalized_config = cls.normalize_config(original_config)
        except ValueError as exc:
            logger.error(
                "Failed to normalize template",
                template_id=template.id,
                template_name=template.name,
                error=str(exc),
            )
            return False, {"error": str(exc)}

        # Check if anything changed
        changed = original_config != normalized_config
        diff = cls.compute_diff(original_config, normalized_config) if changed else {}

        if changed and not dry_run:
            template.config_json = normalized_config
            logger.info(
                "Normalized template config",
                template_id=template.id,
                template_name=template.name,
                diff=diff,
            )

        return changed, {
            "template_id": str(template.id),
            "template_name": template.name,
            "changed": changed,
            "diff": diff,
            "before": original_config,
            "after": normalized_config,
        }

    @classmethod
    async def normalize_all_templates(
        cls,
        db: AsyncSession,
        dry_run: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Load and normalize all templates from database.
        
        Args:
            db: Database session
            dry_run: If True, don't save changes to database
            
        Returns:
            List of normalization results for each template
        """
        result = await db.execute(select(TableTemplate))
        templates = result.scalars().all()

        results = []
        for template in templates:
            changed, info = await cls.normalize_template(template, dry_run=dry_run)
            results.append(info)

        if not dry_run:
            await db.flush()
            logger.info(
                "Normalized all templates",
                total=len(templates),
                changed=sum(1 for r in results if r.get("changed")),
            )

        return results
