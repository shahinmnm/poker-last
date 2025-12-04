"""High-level tests for table lifecycle with template-driven configuration.

This module validates table creation, state transitions, and template-based
behavior according to the Phase 1-2 architecture.
"""

import pytest
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_table_creation_with_template(db_session, sample_template, sample_users):
    """Validate table can be created with a template configuration."""
    from telegram_poker_bot.shared.models import Table, TableStatus, GameMode
    
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=sample_template.id,
        creator_id=sample_users[0].id,
    )
    db_session.add(table)
    await db_session.commit()
    await db_session.refresh(table)
    
    assert table.id is not None
    assert table.template_id == sample_template.id
    assert table.status == TableStatus.WAITING


@pytest.mark.asyncio
async def test_persistent_table_does_not_expire(db_session, sample_template, sample_users):
    """Validate PERSISTENT tables do not expire even when old."""
    from telegram_poker_bot.shared.models import (
        Table, TableStatus, GameMode, TableTemplate, TableTemplateType
    )
    from telegram_poker_bot.shared.services.table_lifecycle import should_expire_table
    
    # Create a PERSISTENT template
    persistent_template = TableTemplate(
        name="Persistent Table",
        table_type=TableTemplateType.PERSISTENT,
        config_json={"starting_stack": 1000}
    )
    db_session.add(persistent_template)
    await db_session.commit()
    
    # Create table with old timestamp
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=persistent_template.id,
        creator_id=sample_users[0].id,
        created_at=datetime.now(timezone.utc) - timedelta(days=10),
    )
    db_session.add(table)
    await db_session.commit()
    
    # Persistent tables should never expire
    should_expire = should_expire_table(table)
    assert not should_expire


@pytest.mark.asyncio
async def test_expiring_table_respects_ttl(db_session, sample_users):
    """Validate EXPIRING tables expire after configured TTL."""
    from telegram_poker_bot.shared.models import (
        Table, TableStatus, GameMode, TableTemplate, TableTemplateType
    )
    from telegram_poker_bot.shared.services.table_lifecycle import should_expire_table
    
    # Create an EXPIRING template with 10-minute TTL
    expiring_template = TableTemplate(
        name="Expiring Table",
        table_type=TableTemplateType.EXPIRING,
        config_json={"expiration_minutes": 10, "starting_stack": 1000}
    )
    db_session.add(expiring_template)
    await db_session.commit()
    
    # Create table that's expired
    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        is_public=True,
        template_id=expiring_template.id,
        creator_id=sample_users[0].id,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db_session.add(table)
    await db_session.commit()
    
    # Should expire
    should_expire = should_expire_table(table)
    assert should_expire


@pytest.mark.asyncio
async def test_table_status_transitions(db_session, sample_table):
    """Validate table can transition through expected states."""
    from telegram_poker_bot.shared.models import TableStatus
    
    # Initial state
    assert sample_table.status == TableStatus.WAITING
    
    # Transition to ACTIVE
    sample_table.status = TableStatus.ACTIVE
    await db_session.commit()
    await db_session.refresh(sample_table)
    assert sample_table.status == TableStatus.ACTIVE
    
    # Transition to ENDED
    sample_table.status = TableStatus.ENDED
    await db_session.commit()
    await db_session.refresh(sample_table)
    assert sample_table.status == TableStatus.ENDED


@pytest.mark.asyncio
async def test_template_config_accessible_from_table(db_session, sample_table, sample_template):
    """Validate table can access template configuration."""
    await db_session.refresh(sample_table, ["template"])
    
    assert sample_table.template is not None
    assert sample_table.template.id == sample_template.id
    assert "starting_stack" in sample_table.template.config_json
    assert sample_table.template.config_json["starting_stack"] == 1000


@pytest.mark.asyncio
async def test_multiple_tables_can_share_template(db_session, sample_template, sample_users):
    """Validate multiple tables can use the same template."""
    from telegram_poker_bot.shared.models import Table, TableStatus, GameMode
    
    tables = []
    for i in range(3):
        table = Table(
            mode=GameMode.ANONYMOUS,
            status=TableStatus.WAITING,
            is_public=True,
            template_id=sample_template.id,
            creator_id=sample_users[0].id,
        )
        db_session.add(table)
        tables.append(table)
    
    await db_session.commit()
    
    for table in tables:
        await db_session.refresh(table)
        assert table.template_id == sample_template.id
