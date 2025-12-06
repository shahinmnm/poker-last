"""Integration tests for table auto-creation."""

import pytest

from telegram_poker_bot.shared.models import TableTemplateType, Table
from telegram_poker_bot.services.table_auto_creator import (
    ensure_tables_for_template,
    get_existing_table_count,
    create_single_table,
)
from telegram_poker_bot.shared.validators import validate_auto_create_config
from telegram_poker_bot.tests.conftest import create_test_template_config
from telegram_poker_bot.shared.services import table_service
from sqlalchemy import select


@pytest.mark.asyncio
class TestAutoCreateOnAPICall:
    """Test auto-creation when templates are created via API."""
    
    async def test_create_template_with_auto_create(self, db_session):
        """Test that creating a template with auto_create creates tables."""
        # Create config with auto_create
        config = create_test_template_config(
            small_blind=10,
            big_blind=20,
            starting_stack=1000,
            max_players=6,
        )
        config["lobby_persistent"] = True
        config["is_auto_generated"] = True
        config["auto_create"] = {
            "enabled": True,
            "min_tables": 2,
            "max_tables": 5,
            "on_startup_repair": True,
            "allow_missing_runtime": True,
        }
        
        # Create template
        template = await table_service.create_table_template(
            db_session,
            name="Auto-Create Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=True,
            config=config,
        )
        await db_session.commit()
        
        # Check that tables were created
        count = await get_existing_table_count(
            db_session,
            template.id,
            lobby_persistent_only=True,
        )
        
        assert count == 2, f"Expected 2 tables, got {count}"
    
    async def test_create_template_without_auto_create(self, db_session):
        """Test that creating a template without auto_create doesn't create tables."""
        config = create_test_template_config(
            small_blind=10,
            big_blind=20,
        )
        # No auto_create block
        
        template = await table_service.create_table_template(
            db_session,
            name="No Auto-Create Template",
            table_type=TableTemplateType.EXPIRING,
            has_waitlist=False,
            config=config,
        )
        await db_session.commit()
        
        # Check that no tables were created
        result = await db_session.execute(
            select(Table).where(Table.template_id == template.id)
        )
        tables = result.scalars().all()
        
        assert len(tables) == 0


@pytest.mark.asyncio
class TestRepairMissingTables:
    """Test repair of missing tables."""
    
    async def test_repair_creates_missing_tables(self, db_session):
        """Test that repair creates missing tables."""
        # Create template with auto_create
        config = create_test_template_config()
        config["lobby_persistent"] = True
        config["auto_create"] = {
            "enabled": True,
            "min_tables": 3,
            "max_tables": 5,
            "on_startup_repair": True,
            "allow_missing_runtime": True,
        }
        
        template = await table_service.create_table_template(
            db_session,
            name="Repair Test Template",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=True,
            config=config,
        )
        await db_session.commit()
        
        # Initial count should be 3
        count = await get_existing_table_count(db_session, template.id)
        assert count == 3
        
        # Manually delete one table to simulate missing table
        result = await db_session.execute(
            select(Table).where(Table.template_id == template.id).limit(1)
        )
        table_to_delete = result.scalar_one()
        await db_session.delete(table_to_delete)
        await db_session.commit()
        
        # Verify count is now 2
        count = await get_existing_table_count(db_session, template.id)
        assert count == 2
        
        # Run repair
        result = await ensure_tables_for_template(db_session, template)
        assert result["success"] is True
        assert result["tables_created"] == 1
        
        # Verify count is back to 3
        count = await get_existing_table_count(db_session, template.id)
        assert count == 3


@pytest.mark.asyncio
class TestNoDoubleCreation:
    """Test that tables are not created twice."""
    
    async def test_idempotency(self, db_session):
        """Test that calling ensure_tables_for_template multiple times doesn't create duplicates."""
        config = create_test_template_config()
        config["lobby_persistent"] = True
        config["auto_create"] = {
            "enabled": True,
            "min_tables": 2,
            "max_tables": 4,
            "on_startup_repair": True,
            "allow_missing_runtime": True,
        }
        
        template = await table_service.create_table_template(
            db_session,
            name="Idempotency Test",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=True,
            config=config,
        )
        await db_session.commit()
        
        # Initial count
        count = await get_existing_table_count(db_session, template.id)
        assert count == 2
        
        # Call ensure_tables_for_template again
        result = await ensure_tables_for_template(db_session, template)
        assert result["success"] is True
        assert result["tables_created"] == 0  # No new tables created
        
        # Verify count is still 2
        count = await get_existing_table_count(db_session, template.id)
        assert count == 2


@pytest.mark.asyncio
class TestMaxTablesRespected:
    """Test that max_tables limit is respected."""
    
    async def test_max_tables_limit(self, db_session):
        """Test that tables are not created beyond max_tables."""
        config = create_test_template_config()
        config["lobby_persistent"] = True
        config["auto_create"] = {
            "enabled": True,
            "min_tables": 2,
            "max_tables": 2,  # Same as min
            "on_startup_repair": True,
            "allow_missing_runtime": True,
        }
        
        template = await table_service.create_table_template(
            db_session,
            name="Max Tables Test",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=True,
            config=config,
        )
        await db_session.commit()
        
        # Should create exactly 2 tables
        count = await get_existing_table_count(db_session, template.id)
        assert count == 2
        
        # Try to create more manually
        result = await ensure_tables_for_template(db_session, template)
        assert result["success"] is True
        assert result["tables_created"] == 0
        
        # Count should still be 2
        count = await get_existing_table_count(db_session, template.id)
        assert count == 2


@pytest.mark.asyncio
class TestGetExistingTableCount:
    """Test get_existing_table_count function."""
    
    async def test_count_lobby_persistent_tables(self, db_session):
        """Test counting lobby-persistent tables only."""
        config = create_test_template_config()
        config["lobby_persistent"] = True
        config["auto_create"] = {
            "enabled": True,
            "min_tables": 1,
            "max_tables": 1,
            "on_startup_repair": True,
            "allow_missing_runtime": True,
        }
        
        template = await table_service.create_table_template(
            db_session,
            name="Count Test",
            table_type=TableTemplateType.PERSISTENT,
            has_waitlist=True,
            config=config,
        )
        await db_session.commit()
        
        # Should have 1 lobby-persistent table
        count = await get_existing_table_count(
            db_session,
            template.id,
            lobby_persistent_only=True,
        )
        assert count == 1
