#!/usr/bin/env python3
"""CLI tool to repair auto-created tables for all templates.

This script connects to the backend database and ensures that all templates
with auto_create enabled have the correct number of tables.

Usage:
    python scripts/repair_auto_create.py [--dry-run]
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
                    lobby_persistent_only=True,
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
        description="Repair auto-created tables for templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Perform actual repair
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
    
    args = parser.parse_args()
    
    try:
        summary = asyncio.run(repair_all_templates(dry_run=args.dry_run))
        
        # Exit with non-zero if there were failures
        if summary.get("templates_failed", 0) > 0 or summary.get("errors"):
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
