#!/usr/bin/env python3
"""CLI tool to repair and canonicalize auto_create configs in templates.

This script:
1. Removes invalid auto_create blocks from templates
2. Inserts canonical defaults when missing required fields
3. Strips invalid fields (lobby_persistent, is_auto_generated) from auto_create
4. Repairs missing tables for templates with valid auto_create configs

Usage:
    python scripts/repair_auto_create.py [--dry-run] [--canonicalize-only]
"""

import asyncio
import argparse
import sys
from typing import List, Dict, Any

from sqlalchemy import select

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import get_db_session
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.shared.models import TableTemplate
from telegram_poker_bot.services.table_auto_creator import ensure_tables_for_template
from telegram_poker_bot.shared.validators import validate_auto_create_config

configure_logging()
logger = get_logger(__name__)


def canonicalize_auto_create(config_json: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    """Canonicalize auto_create config by removing invalid fields.
    
    Args:
        config_json: Template config_json dictionary
        
    Returns:
        Tuple of (updated_config_json, was_modified)
    """
    if "auto_create" not in config_json:
        return config_json, False
    
    auto_create = config_json["auto_create"]
    if not isinstance(auto_create, dict):
        return config_json, False
    
    # Define canonical fields
    canonical_fields = {"enabled", "min_tables", "max_tables", "on_startup_repair", "allow_missing_runtime"}
    
    # Create new auto_create with only canonical fields
    new_auto_create = {
        k: v for k, v in auto_create.items() 
        if k in canonical_fields
    }
    
    # Insert defaults for missing required fields
    if "enabled" not in new_auto_create:
        new_auto_create["enabled"] = False
    if "min_tables" not in new_auto_create and new_auto_create.get("enabled"):
        new_auto_create["min_tables"] = 1
    if "max_tables" not in new_auto_create and new_auto_create.get("enabled"):
        new_auto_create["max_tables"] = 2
    if "on_startup_repair" not in new_auto_create:
        new_auto_create["on_startup_repair"] = True
    if "allow_missing_runtime" not in new_auto_create:
        new_auto_create["allow_missing_runtime"] = True
    
    # Check if anything changed
    was_modified = (auto_create != new_auto_create)
    
    if was_modified:
        # Update config
        config_json["auto_create"] = new_auto_create
    
    return config_json, was_modified


async def canonicalize_templates(dry_run: bool = False) -> Dict[str, Any]:
    """Canonicalize auto_create configs in all templates.
    
    Args:
        dry_run: If True, only simulate the changes without writing to DB
        
    Returns:
        Summary dict with canonicalization statistics
    """
    _ = get_settings()
    
    summary = {
        "total_templates": 0,
        "templates_fixed": 0,
        "templates_with_auto_create": 0,
        "errors": [],
    }
    
    print("\n" + "="*70)
    print("AUTO-CREATE CONFIG CANONICALIZER")
    print("="*70)
    
    if dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made\n")
    else:
        print("\n⚙️  CANONICALIZE MODE - Fixing invalid configs\n")
    
    async with get_db_session() as db:
        # Fetch all templates (active and inactive)
        result = await db.execute(select(TableTemplate))
        templates = result.scalars().all()
        
        summary["total_templates"] = len(templates)
        
        print(f"Found {len(templates)} template(s)\n")
        print("-" * 70)
        
        for template in templates:
            config_json = template.config_json or {}
            
            if "auto_create" not in config_json:
                continue
            
            summary["templates_with_auto_create"] += 1
            
            # Canonicalize the config
            new_config, was_modified = canonicalize_auto_create(config_json.copy())
            
            if was_modified:
                summary["templates_fixed"] += 1
                
                print(f"\n📋 Template: {template.name} (ID: {template.id})")
                print(f"   Status: INVALID auto_create - fixing")
                
                old_auto = config_json.get("auto_create", {})
                new_auto = new_config.get("auto_create", {})
                
                # Show what changed
                all_keys = set(old_auto.keys()) | set(new_auto.keys())
                for key in sorted(all_keys):
                    old_val = old_auto.get(key, "<missing>")
                    new_val = new_auto.get(key, "<missing>")
                    if old_val != new_val:
                        if key in {"lobby_persistent", "is_auto_generated"}:
                            print(f"   ❌ Removed invalid field: {key} = {old_val}")
                        elif old_val == "<missing>":
                            print(f"   ✅ Added default: {key} = {new_val}")
                        else:
                            print(f"   ⚠️  Changed: {key} = {old_val} → {new_val}")
                
                if not dry_run:
                    # Update the template
                    template.config_json = new_config
                    await db.flush()
        
        if not dry_run and summary["templates_fixed"] > 0:
            await db.commit()
            print(f"\n✅ Committed {summary['templates_fixed']} template fixes to database")
        elif dry_run and summary["templates_fixed"] > 0:
            print(f"\n🔍 Would fix {summary['templates_fixed']} templates (dry run)")
    
    # Print summary
    print("\n" + "="*70)
    print("CANONICALIZATION SUMMARY")
    print("="*70)
    print(f"Total Templates: {summary['total_templates']}")
    print(f"Templates with auto_create: {summary['templates_with_auto_create']}")
    print(f"Templates fixed: {summary['templates_fixed']}")
    print("\n" + "="*70 + "\n")
    
    return summary


async def repair_all_templates(dry_run: bool = False) -> Dict[str, Any]:
    """Repair tables for all templates with auto_create enabled.
    
    Args:
        dry_run: If True, only simulate the repair without creating tables
        
    Returns:
        Summary dict with repair statistics
    """
    _ = get_settings()
    
    summary = {
        "total_templates": 0,
        "templates_with_auto_create": 0,
        "templates_processed": 0,
        "templates_failed": 0,
        "tables_created": 0,
        "errors": [],
    }
    
    print("\n" + "="*70)
    print("TABLE AUTO-CREATE REPAIR TOOL")
    print("="*70)
    
    if dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made\n")
    else:
        print("\n⚙️  REPAIR MODE - Tables will be created as needed\n")
    
    async with get_db_session() as db:
        # Fetch all active templates
        result = await db.execute(
            select(TableTemplate).where(TableTemplate.is_active == True)  # noqa: E712
        )
        templates = result.scalars().all()
        
        summary["total_templates"] = len(templates)
        
        print(f"Found {len(templates)} active template(s)\n")
        print("-" * 70)
        
        for template in templates:
            config_json = template.config_json or {}
            auto_create_dict = config_json.get("auto_create")
            
            if not auto_create_dict:
                continue
            
            # Try to parse auto_create config
            try:
                auto_create_config = validate_auto_create_config(auto_create_dict)
            except ValueError as exc:
                error_msg = f"Invalid auto_create config: {exc}"
                print(f"\n❌ Template: {template.name} (ID: {template.id})")
                print(f"   {error_msg}")
                summary["errors"].append({
                    "template_id": str(template.id),
                    "template_name": template.name,
                    "error": error_msg,
                })
                summary["templates_failed"] += 1
                continue
            
            if not auto_create_config:
                continue
            
            summary["templates_with_auto_create"] += 1
            
            print(f"\n📋 Template: {template.name}")
            print(f"   ID: {template.id}")
            print(f"   Min Tables: {auto_create_config.min_tables}")
            print(f"   Max Tables: {auto_create_config.max_tables}")
            
            if dry_run:
                # In dry-run mode, just report what would be done
                from telegram_poker_bot.services.table_auto_creator import get_existing_table_count
                existing_count = await get_existing_table_count(
                    db,
                    template.id,
                )
                would_create = max(0, auto_create_config.min_tables - existing_count)
                
                print(f"   Existing Tables: {existing_count}")
                print(f"   Would Create: {would_create} table(s)")
                
                if would_create > 0:
                    summary["tables_created"] += would_create
            else:
                # Actually repair
                try:
                    result_dict = await ensure_tables_for_template(
                        db,
                        template,
                        auto_create_config=auto_create_config,
                    )
                    
                    if result_dict.get("success"):
                        summary["templates_processed"] += 1
                        tables_created = result_dict.get("tables_created", 0)
                        summary["tables_created"] += tables_created
                        
                        print(f"   Existing Tables: {result_dict.get('tables_existing', 0)}")
                        print(f"   Created: {tables_created} table(s)")
                        
                        if tables_created > 0:
                            print(f"   ✅ Successfully created {tables_created} table(s)")
                        else:
                            print(f"   ✅ Already at minimum count")
                    else:
                        summary["templates_failed"] += 1
                        error_msg = "Failed to ensure tables"
                        print(f"   ❌ {error_msg}")
                        summary["errors"].append({
                            "template_id": str(template.id),
                            "template_name": template.name,
                            "error": error_msg,
                        })
                
                except Exception as exc:
                    summary["templates_failed"] += 1
                    error_msg = str(exc)
                    print(f"   ❌ Error: {error_msg}")
                    summary["errors"].append({
                        "template_id": str(template.id),
                        "template_name": template.name,
                        "error": error_msg,
                    })
                    logger.error(
                        "Failed to repair template",
                        template_id=template.id,
                        template_name=template.name,
                        error=error_msg,
                        exc_info=True,
                    )
    
    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total Templates: {summary['total_templates']}")
    print(f"Templates with auto_create: {summary['templates_with_auto_create']}")
    
    if dry_run:
        print(f"Tables that would be created: {summary['tables_created']}")
    else:
        print(f"Templates processed: {summary['templates_processed']}")
        print(f"Templates failed: {summary['templates_failed']}")
        print(f"Tables created: {summary['tables_created']}")
    
    if summary["errors"]:
        print(f"\n⚠️  {len(summary['errors'])} error(s) occurred:")
        for error in summary["errors"]:
            print(f"   - {error['template_name']}: {error['error']}")
    
    print("\n" + "="*70 + "\n")
    
    return summary


def main():
    """Main entry point for the repair tool."""
    parser = argparse.ArgumentParser(
        description="Repair and canonicalize auto-create configs for templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Canonicalize configs only (fixes invalid fields)
  python scripts/repair_auto_create.py --canonicalize-only
  
  # Canonicalize and repair tables
  python scripts/repair_auto_create.py
  
  # Dry run to see what would be done
  python scripts/repair_auto_create.py --dry-run
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--canonicalize-only",
        action="store_true",
        help="Only canonicalize configs, don't repair tables",
    )
    
    args = parser.parse_args()
    
    try:
        # Always canonicalize first
        canonicalize_summary = asyncio.run(canonicalize_templates(dry_run=args.dry_run))
        
        # Then optionally repair tables
        repair_summary = None
        if not args.canonicalize_only:
            repair_summary = asyncio.run(repair_all_templates(dry_run=args.dry_run))
        
        # Exit with non-zero if there were failures
        if canonicalize_summary.get("errors") or (repair_summary and repair_summary.get("templates_failed", 0) > 0):
            sys.exit(1)
        
        sys.exit(0)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
    
    except Exception as exc:
        logger.error("Fatal error in repair tool", error=str(exc), exc_info=True)
        print(f"\n❌ Fatal error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
