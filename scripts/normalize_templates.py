#!/usr/bin/env python3
"""
Template Normalization CLI Tool

Loads templates from database, normalizes them to canonical structure,
and optionally saves the changes.

Usage:
    python scripts/normalize_templates.py           # Dry run - show what would change
    python scripts/normalize_templates.py --repair  # Apply changes to database
"""

import argparse
import asyncio
import json
import sys
from typing import Dict, Any

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.config import settings
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.services.template_normalizer import TemplateNormalizer

logger = get_logger(__name__)


def format_diff(diff: Dict[str, Any]) -> str:
    """Format a diff dictionary for display."""
    lines = []
    
    if diff.get("added"):
        lines.append(f"  Added keys: {', '.join(diff['added'])}")
    
    if diff.get("removed"):
        lines.append(f"  Removed keys: {', '.join(diff['removed'])}")
    
    if diff.get("changed"):
        lines.append("  Changed:")
        for change in diff["changed"]:
            key = change["key"]
            lines.append(f"    {key}:")
            # Show compact diff for nested structures
            if isinstance(change["before"], dict) or isinstance(change["after"], dict):
                lines.append(f"      (nested structure changed)")
            else:
                lines.append(f"      before: {change['before']}")
                lines.append(f"      after:  {change['after']}")
    
    return "\n".join(lines) if lines else "  (no changes)"


def print_separator():
    """Print a separator line."""
    print("-" * 80)


async def main(repair: bool = False):
    """
    Main execution function.
    
    Args:
        repair: If True, save changes to database. If False, dry run only.
    """
    print("🔧 Template Normalization Tool")
    print_separator()
    
    if repair:
        print("⚠️  REPAIR MODE: Changes will be saved to the database")
    else:
        print("📋 DRY RUN MODE: No changes will be saved (use --repair to apply)")
    
    print_separator()
    
    # Create database engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
    
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    try:
        async with session_factory() as db:
            # Run normalization
            results = await TemplateNormalizer.normalize_all_templates(
                db,
                dry_run=not repair,
            )
            
            if not results:
                print("\n✅ No templates found in database")
                return 0
            
            # Print results
            total = len(results)
            changed_count = sum(1 for r in results if r.get("changed"))
            error_count = sum(1 for r in results if "error" in r)
            
            print(f"\n📊 Normalization Summary:")
            print(f"   Total templates: {total}")
            print(f"   Changed: {changed_count}")
            print(f"   Unchanged: {total - changed_count - error_count}")
            print(f"   Errors: {error_count}")
            print_separator()
            
            # Print details for each changed template
            if changed_count > 0:
                print("\n📝 Changes per template:\n")
                for result in results:
                    if result.get("changed"):
                        print(f"Template: {result['template_name']} ({result['template_id']})")
                        diff = result.get("diff", {})
                        print(format_diff(diff))
                        print()
            
            # Print errors if any
            if error_count > 0:
                print("\n❌ Errors:\n")
                for result in results:
                    if "error" in result:
                        print(f"Template: {result.get('template_name', 'Unknown')} ({result.get('template_id', 'Unknown')})")
                        print(f"  Error: {result['error']}")
                        print()
            
            # Commit changes if repair mode
            if repair and changed_count > 0:
                await db.commit()
                print(f"\n✅ Successfully normalized {changed_count} template(s)")
            elif repair and changed_count == 0:
                print("\n✅ All templates already normalized")
            else:
                print(f"\n💡 Run with --repair to apply {changed_count} change(s)")
            
            print_separator()
            
            return 0 if error_count == 0 else 1
            
    except Exception as exc:
        logger.error("Failed to normalize templates", error=str(exc), exc_info=True)
        print(f"\n❌ Error: {exc}")
        return 1
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Normalize table template configurations to canonical structure"
    )
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Apply changes to database (default is dry run)",
    )
    
    args = parser.parse_args()
    
    try:
        exit_code = asyncio.run(main(repair=args.repair))
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
