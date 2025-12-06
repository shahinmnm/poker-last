"""Table auto-creation service for maintaining persistent lobby tables."""

import asyncio
from typing import Optional, Dict, Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import OperationalError, IntegrityError

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import TableTemplate, Table, GameMode
from telegram_poker_bot.shared.validators import validate_auto_create_config, AutoCreateConfig
from telegram_poker_bot.shared.services import table_service

logger = get_logger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF = 0.1  # 100ms
MAX_BACKOFF = 2.0  # 2 seconds


async def get_existing_table_count(
    db: AsyncSession,
    template_id: UUID,
    *,
    lobby_persistent_only: bool = False,
) -> int:
    """Count existing tables for a template.
    
    Args:
        db: Database session
        template_id: Template UUID
        lobby_persistent_only: Deprecated. Kept for backward compatibility.
        
    Returns:
        Number of existing auto-generated tables
    """
    # Count all auto-generated tables for this template
    result = await db.execute(
        select(func.count(Table.id))
        .where(Table.template_id == template_id)
        .where(Table.is_auto_generated)
    )
    count = result.scalar() or 0
    return count


async def safe_commit_with_retry(db: AsyncSession, max_retries: int = MAX_RETRIES) -> bool:
    """Commit database changes with retry on transient failures.
    
    Args:
        db: Database session
        max_retries: Maximum number of retry attempts
        
    Returns:
        True if commit succeeded, False otherwise
    """
    backoff = INITIAL_BACKOFF
    
    for attempt in range(max_retries):
        try:
            await db.commit()
            return True
        except OperationalError as exc:
            # Check if it's a transient DB lock error
            error_msg = str(exc).lower()
            if "lock" in error_msg or "deadlock" in error_msg:
                if attempt < max_retries - 1:
                    logger.warning(
                        "Database lock error, retrying",
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        backoff=backoff,
                        error=str(exc),
                    )
                    await db.rollback()
                    await asyncio.sleep(backoff)  # Use asyncio.sleep instead of time.sleep
                    backoff = min(backoff * 2, MAX_BACKOFF)
                    continue
            
            # Non-retryable error or max retries exceeded
            logger.error(
                "Database commit failed",
                attempt=attempt + 1,
                error=str(exc),
            )
            await db.rollback()
            return False
        except Exception as exc:
            logger.error(
                "Unexpected error during commit",
                attempt=attempt + 1,
                error=str(exc),
                exc_info=True,
            )
            await db.rollback()
            return False
    
    return False


async def create_single_table(
    db: AsyncSession,
    template: TableTemplate,
    *,
    on_startup_repair: bool = False,
) -> Optional[Table]:
    """Create a single table from a template.
    
    Args:
        db: Database session
        template: TableTemplate to create from
        on_startup_repair: Value from auto_create.on_startup_repair to set lobby_persistent
        
    Returns:
        Created Table instance or None on failure
    """
    try:
        # Always set is_auto_generated=True and lobby_persistent based on on_startup_repair
        # These fields come from the auto_create config, NOT from the template config_json
        table = await table_service.create_table(
            db,
            creator_user_id=None,  # System-generated
            template_id=template.id,
            mode=GameMode.ANONYMOUS,
            group_id=None,
            auto_seat_creator=False,
            lobby_persistent=on_startup_repair,
            is_auto_generated=True,
        )
        
        await db.flush()
        
        logger.info(
            "Created table from template",
            template_id=template.id,
            template_name=template.name,
            table_id=table.id,
            lobby_persistent=on_startup_repair,
            is_auto_generated=True,
        )
        
        return table
    except Exception as exc:
        logger.error(
            "Failed to create table from template",
            template_id=template.id,
            template_name=template.name,
            error=str(exc),
            exc_info=True,
        )
        return None


async def ensure_tables_for_template(
    db: AsyncSession,
    template: TableTemplate,
    *,
    auto_create_config: Optional[AutoCreateConfig] = None,
) -> Dict[str, Any]:
    """Ensure minimum number of tables exist for a template.
    
    This is the main entry point for auto-creation logic.
    
    Args:
        db: Database session
        template: TableTemplate to ensure tables for
        auto_create_config: Optional pre-parsed auto-create config
        
    Returns:
        Dict with keys:
            - tables_created: Number of tables created
            - tables_existing: Number of tables that already existed
            - target_min: Target minimum from config
            - success: Whether operation succeeded
    """
    result = {
        "tables_created": 0,
        "tables_existing": 0,
        "target_min": 0,
        "success": False,
    }
    
    try:
        # Parse auto_create config if not provided
        if auto_create_config is None:
            config_json = template.config_json or {}
            auto_create_dict = config_json.get("auto_create")
            
            if not auto_create_dict:
                # No auto_create config, nothing to do
                result["success"] = True
                return result
            
            try:
                auto_create_config = validate_auto_create_config(auto_create_dict)
            except ValueError as exc:
                logger.error(
                    "Invalid auto_create config for template",
                    template_id=template.id,
                    template_name=template.name,
                    error=str(exc),
                )
                return result
        
        if not auto_create_config:
            # Auto-create disabled (enabled=False)
            result["success"] = True
            return result
        
        min_tables = auto_create_config.min_tables
        max_tables = auto_create_config.max_tables
        on_startup_repair = auto_create_config.on_startup_repair
        result["target_min"] = min_tables
        
        # Count existing auto-generated tables (not from template config)
        existing_count = await get_existing_table_count(
            db,
            template.id,
            lobby_persistent_only=False,  # Count all auto-generated tables
        )
        result["tables_existing"] = existing_count
        
        logger.info(
            "Checking table count for template",
            template_id=template.id,
            template_name=template.name,
            existing_count=existing_count,
            min_tables=min_tables,
            max_tables=max_tables,
        )
        
        # Calculate how many to create
        tables_to_create = max(0, min_tables - existing_count)
        
        if tables_to_create == 0:
            result["success"] = True
            logger.info(
                "Template has sufficient tables",
                template_id=template.id,
                template_name=template.name,
                existing_count=existing_count,
            )
            return result
        
        # Don't exceed max_tables
        if existing_count + tables_to_create > max_tables:
            tables_to_create = max(0, max_tables - existing_count)
        
        # Create tables with on_startup_repair value
        for i in range(tables_to_create):
            table = await create_single_table(db, template, on_startup_repair=on_startup_repair)
            if table:
                result["tables_created"] += 1
            else:
                logger.warning(
                    "Failed to create table for template",
                    template_id=template.id,
                    template_name=template.name,
                    attempt=i + 1,
                    total_attempts=tables_to_create,
                )
                # Continue trying to create remaining tables
        
        # Commit all created tables
        if result["tables_created"] > 0:
            commit_success = await safe_commit_with_retry(db)
            if not commit_success:
                logger.error(
                    "Failed to commit created tables",
                    template_id=template.id,
                    template_name=template.name,
                    tables_created=result["tables_created"],
                )
                result["tables_created"] = 0
                return result
        
        result["success"] = True
        logger.info(
            "Completed table auto-creation for template",
            template_id=template.id,
            template_name=template.name,
            tables_created=result["tables_created"],
            existing_count=existing_count,
            final_count=existing_count + result["tables_created"],
        )
        
    except Exception as exc:
        logger.error(
            "Error in ensure_tables_for_template",
            template_id=template.id,
            template_name=template.name,
            error=str(exc),
            exc_info=True,
        )
        await db.rollback()
    
    return result


async def auto_create_worker(
    db: AsyncSession,
    template: TableTemplate,
) -> Dict[str, Any]:
    """Background worker to ensure tables for a template.
    
    This is a convenience wrapper around ensure_tables_for_template
    for use in background tasks.
    
    Args:
        db: Database session
        template: TableTemplate to process
        
    Returns:
        Result dict from ensure_tables_for_template
    """
    return await ensure_tables_for_template(db, template)
