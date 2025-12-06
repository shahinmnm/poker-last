#!/usr/bin/env python3
"""
Automated Template Import Script for Container Startup

This script imports table templates from JSON files in the templates/ directory
into the database. It runs on container startup to ensure all templates are available.

Features:
- Idempotent: Updates existing templates or creates new ones
- Handles multiple JSON files
- Validates template structure
- Integrates with auto-creation system
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import get_db_session
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.shared.models import TableTemplate, TableTemplateType
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.shared.types import TableTemplateCreateRequest

configure_logging()
logger = get_logger(__name__)


def scan_json_files(templates_dir: Path) -> List[Path]:
    """Scan the templates directory for JSON files."""
    if not templates_dir.exists():
        logger.warning(f"Templates directory '{templates_dir}' not found")
        return []
    
    if not templates_dir.is_dir():
        logger.error(f"'{templates_dir}' is not a directory")
        return []
    
    json_files = list(templates_dir.glob("*.json"))
    logger.info(f"Found {len(json_files)} JSON file(s) in templates directory")
    return json_files


def parse_json_file(filepath: Path) -> List[Dict[str, Any]]:
    """Parse a JSON file and extract template objects."""
    templates = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle both single object and array of objects
        if isinstance(data, list):
            templates.extend(data)
        elif isinstance(data, dict):
            templates.append(data)
        else:
            logger.warning(f"Unexpected JSON format in {filepath.name}")
    
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing {filepath.name}: {e}")
    except Exception as e:
        logger.error(f"Error reading {filepath.name}: {e}")
    
    return templates


def normalize_template(template: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize template structure into canonical format.
    
    Ensures all required fields are present and properly formatted.
    """
    backend = template.get("backend", {})
    ui_schema = template.get("ui_schema") or template.get("ui") or {}
    auto_create = template.get("auto_create", {})
    
    # Extract name
    name = backend.get("template_name") or template.get("name") or "Unknown"
    
    # Map game_type to table_type
    raw_game_type = (backend.get("game_type") or "").lower()
    if raw_game_type == "cash":
        table_type = TableTemplateType.CASH_GAME
    elif raw_game_type == "tournament":
        table_type = TableTemplateType.TOURNAMENT
    else:
        table_type = TableTemplateType.CASH_GAME  # Default
    
    # Ensure auto_create has required fields
    if not auto_create:
        auto_create = {
            "enabled": True,
            "min_tables": 1,
            "max_tables": 2,
            "on_startup_repair": True,
        }
    
    # Build config_json
    config_json = {
        "backend": backend,
        "ui_schema": ui_schema,
        "auto_create": auto_create,
    }
    
    return {
        "name": name,
        "table_type": table_type,
        "config_json": config_json,
    }


async def upsert_template(
    db: AsyncSession,
    template_data: Dict[str, Any],
) -> tuple[TableTemplate, bool]:
    """
    Create or update a template.
    
    Returns:
        Tuple of (template, was_created)
    """
    normalized = normalize_template(template_data)
    name = normalized["name"]
    
    # Check if template exists by name
    result = await db.execute(
        select(TableTemplate).where(TableTemplate.name == name)
    )
    existing_template = result.scalar_one_or_none()
    
    if existing_template:
        # Update existing template
        logger.info(f"Updating existing template: {name}")
        
        # Update fields
        existing_template.table_type = normalized["table_type"]
        existing_template.config_json = normalized["config_json"]
        existing_template.is_active = True
        
        await db.flush()
        
        # Auto-create tables if needed
        try:
            from telegram_poker_bot.services.table_auto_creator import ensure_tables_for_template
            result_dict = await ensure_tables_for_template(db, existing_template)
            if result_dict.get("success"):
                logger.info(
                    f"Auto-creation check completed for template '{name}'",
                    tables_created=result_dict.get("tables_created", 0),
                    tables_existing=result_dict.get("tables_existing", 0),
                )
        except Exception as exc:
            logger.error(f"Failed to auto-create tables for template '{name}': {exc}")
        
        return existing_template, False
    else:
        # Create new template
        logger.info(f"Creating new template: {name}")
        
        payload = TableTemplateCreateRequest(
            name=name,
            table_type=normalized["table_type"],
            has_waitlist=False,
            config_json=normalized["config_json"],
        )
        
        template = await table_service.create_table_template(db, payload=payload)
        await db.flush()
        
        return template, True


async def import_all_templates() -> Dict[str, int]:
    """
    Import all templates from the templates directory.
    
    Returns:
        Dictionary with counts of created, updated, and failed templates
    """
    stats = {
        "created": 0,
        "updated": 0,
        "failed": 0,
        "total": 0,
    }
    
    try:
        logger.info("=" * 80)
        logger.info("TEMPLATE IMPORT: Starting template import process")
        logger.info("=" * 80)
        
        # Get templates directory path
        script_dir = Path(__file__).parent.parent
        templates_dir = script_dir / "templates"
        
        # Scan for JSON files
        json_files = scan_json_files(templates_dir)
        if not json_files:
            logger.warning("No template files found to import")
            return stats
        
        # Parse all templates from all files
        all_templates = []
        for filepath in sorted(json_files):
            logger.info(f"Reading file: {filepath.name}")
            templates = parse_json_file(filepath)
            all_templates.extend(templates)
        
        stats["total"] = len(all_templates)
        logger.info(f"Loaded {stats['total']} template(s) from JSON files")
        
        if not all_templates:
            logger.warning("No valid templates found to import")
            return stats
        
        # Import templates into database
        async with get_db_session() as db:
            for idx, template_data in enumerate(all_templates, start=1):
                try:
                    template, was_created = await upsert_template(db, template_data)
                    
                    if was_created:
                        stats["created"] += 1
                        logger.info(f"[{idx}/{stats['total']}] ✅ Created: {template.name}")
                    else:
                        stats["updated"] += 1
                        logger.info(f"[{idx}/{stats['total']}] ✅ Updated: {template.name}")
                
                except Exception as exc:
                    stats["failed"] += 1
                    template_name = template_data.get("name") or template_data.get("backend", {}).get("template_name") or "Unknown"
                    logger.error(
                        f"[{idx}/{stats['total']}] ❌ Failed: {template_name}",
                        error=str(exc),
                        exc_info=True,
                    )
            
            # Commit all changes
            try:
                await db.commit()
                logger.info("All template changes committed successfully")
            except Exception as exc:
                logger.error(f"Failed to commit template changes: {exc}")
                await db.rollback()
                raise
        
        logger.info("=" * 80)
        logger.info("TEMPLATE IMPORT: Complete")
        logger.info(f"  Created: {stats['created']}")
        logger.info(f"  Updated: {stats['updated']}")
        logger.info(f"  Failed:  {stats['failed']}")
        logger.info(f"  Total:   {stats['total']}")
        logger.info("=" * 80)
    
    except Exception as exc:
        logger.error(f"Template import process failed: {exc}", exc_info=True)
        raise
    
    return stats


async def main():
    """Main entry point."""
    try:
        # Initialize settings
        _ = get_settings()
        
        # Run import
        stats = await import_all_templates()
        
        # Exit with error code if any templates failed
        if stats["failed"] > 0:
            sys.exit(1)
        
        sys.exit(0)
    
    except Exception as exc:
        logger.error(f"Fatal error in template import: {exc}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
