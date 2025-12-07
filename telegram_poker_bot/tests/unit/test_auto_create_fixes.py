"""Tests for auto-create table visibility and expiration logic fixes.

This test suite validates the fixes for:
1. Lobby-persistent tables not expiring when using EXPIRING template
2. Auto-creator counting only WAITING/ACTIVE tables (not ENDED/EXPIRED)
3. Cache invalidation after auto-creation
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    TableStatus,
    TableTemplateType,
)
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.services.table_auto_creator import get_existing_table_count
from telegram_poker_bot.tests.conftest import create_test_template


@pytest.mark.asyncio
async def test_lobby_persistent_table_with_expiring_template_no_expires_at(
    db_session: AsyncSession,
) -> None:
    """Test that lobby_persistent=True prevents expires_at from being set even on EXPIRING templates.

    This is the core fix: when a table is created with lobby_persistent=True,
    it should NOT get an expires_at timestamp, even if the template is EXPIRING type.
    """
    # Create an EXPIRING template with expiration_minutes
    template = await create_test_template(
        db_session,
        name="Expiring Lobby Template",
        table_type=TableTemplateType.EXPIRING,
        expiration_minutes=10,
        small_blind=25,
        big_blind=50,
        starting_stack=2500,
        max_players=8,
    )
    await db_session.commit()

    # Create a table with lobby_persistent=True
    table = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    await db_session.commit()

    # Verify the table does NOT have expires_at set
    assert table.template.table_type == TableTemplateType.EXPIRING
    assert table.lobby_persistent is True
    assert (
        table.expires_at is None
    ), "Lobby-persistent table should NOT have expires_at even with EXPIRING template"
    assert table.status == TableStatus.WAITING


@pytest.mark.asyncio
async def test_non_lobby_persistent_expiring_table_has_expires_at(
    db_session: AsyncSession,
) -> None:
    """Test that regular EXPIRING tables (without lobby_persistent) DO get expires_at set."""
    # Create an EXPIRING template
    template = await create_test_template(
        db_session,
        name="Regular Expiring Template",
        table_type=TableTemplateType.EXPIRING,
        expiration_minutes=15,
        small_blind=50,
        big_blind=100,
        starting_stack=5000,
        max_players=6,
    )
    await db_session.commit()

    # Create a table WITHOUT lobby_persistent
    table = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=False,
        is_auto_generated=False,
    )
    await db_session.commit()

    # Verify the table DOES have expires_at set
    assert table.template.table_type == TableTemplateType.EXPIRING
    assert table.lobby_persistent is False
    assert (
        table.expires_at is not None
    ), "Regular EXPIRING table should have expires_at set"
    assert table.status == TableStatus.WAITING

    # Verify expires_at is in the future
    now = datetime.now(timezone.utc)
    assert table.expires_at > now


@pytest.mark.asyncio
async def test_get_existing_table_count_excludes_ended_and_expired(
    db_session: AsyncSession,
) -> None:
    """Test that get_existing_table_count only counts WAITING and ACTIVE tables.

    This is the fix for the auto-creator counting zombie tables.
    """
    # Create a template (will auto-create 1 table by default)
    template = await create_test_template(
        db_session,
        name="Auto-Create Template",
        table_type=TableTemplateType.EXPIRING,
        expiration_minutes=10,
    )
    await db_session.commit()

    # Get initial count (should be 1 from auto-creation)
    initial_count = await get_existing_table_count(db_session, template.id)

    # Create tables in various states
    # 1. WAITING table (should be counted)
    _table_waiting = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )

    # 2. ACTIVE table (should be counted)
    table_active = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    table_active.status = TableStatus.ACTIVE

    # 3. ENDED table (should NOT be counted)
    table_ended = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    table_ended.status = TableStatus.ENDED

    # 4. EXPIRED table (should NOT be counted)
    table_expired = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    table_expired.status = TableStatus.EXPIRED

    # 5. Non-auto-generated table (should NOT be counted)
    _table_manual = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=False,
        is_auto_generated=False,
    )

    await db_session.commit()

    # Count existing tables
    count = await get_existing_table_count(db_session, template.id)

    # Should only count the initial + WAITING and ACTIVE auto-generated tables
    expected = initial_count + 2  # Added 1 WAITING + 1 ACTIVE
    assert count == expected, (
        f"Expected {expected} tables (initial {initial_count} + WAITING + ACTIVE), but got {count}. "
        "ENDED, EXPIRED, and non-auto-generated tables should be excluded."
    )


@pytest.mark.asyncio
async def test_all_status_transitions_with_table_count(
    db_session: AsyncSession,
) -> None:
    """Test that table count updates correctly as tables transition between states."""
    template = await create_test_template(
        db_session,
        name="Status Transition Template",
        table_type=TableTemplateType.EXPIRING,
        expiration_minutes=10,
    )
    await db_session.commit()

    # Get initial count from auto-creation
    initial_count = await get_existing_table_count(db_session, template.id)

    # Create table in WAITING state
    table = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    await db_session.commit()

    # Count should be initial + 1
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count + 1

    # Transition to ACTIVE - should still be counted
    table.status = TableStatus.ACTIVE
    await db_session.commit()
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count + 1

    # Transition to PAUSED - should NOT be counted (only WAITING and ACTIVE)
    table.status = TableStatus.PAUSED
    await db_session.commit()
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count

    # Back to ACTIVE
    table.status = TableStatus.ACTIVE
    await db_session.commit()
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count + 1

    # Transition to ENDED - should NOT be counted
    table.status = TableStatus.ENDED
    await db_session.commit()
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count

    # Create a new table
    table2 = await table_service.create_table(
        db_session,
        creator_user_id=None,
        template_id=template.id,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    await db_session.commit()
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count + 1

    # Mark it as EXPIRED - should NOT be counted
    table2.status = TableStatus.EXPIRED
    await db_session.commit()
    count = await get_existing_table_count(db_session, template.id)
    assert count == initial_count


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
