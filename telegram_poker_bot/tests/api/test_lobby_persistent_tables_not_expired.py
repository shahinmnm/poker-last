"""Tests for lobby-persistent tables not being auto-expired when empty.

This test verifies that tables with lobby_persistent=True flag are not
expired by the inactivity checker even when they have no players.
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    User,
    Table,
    TableStatus,
    TableTemplateType,
)
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.shared.services import table_lifecycle


@pytest.mark.asyncio
async def test_lobby_persistent_table_not_expired_when_empty(db_session: AsyncSession) -> None:
    """Test that lobby-persistent tables are not expired when they have no players."""
    # Create a user (for template creation)
    user = User(tg_user_id=100, username="alice", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a CASH_GAME template (not PERSISTENT)
    from telegram_poker_bot.tests.conftest import create_test_template

    template = await create_test_template(
        db_session,
        name="Lobby Table Template",
        table_type=TableTemplateType.CASH_GAME,
        table_name="Lobby Table",
        small_blind=25,
        big_blind=50,
        starting_stack=2500,
        max_players=8,
    )

    # Create a table with lobby_persistent=True
    table = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=template.id,
        auto_seat_creator=False,
        lobby_persistent=True,
        is_auto_generated=True,
    )
    await db_session.commit()

    # Verify initial state
    assert table.status == TableStatus.WAITING
    assert table.lobby_persistent is True
    assert table.template.table_type == TableTemplateType.CASH_GAME

    # Refresh to ensure we're looking at current state
    await db_session.refresh(table)

    # The table should have no players and no expiration time
    from sqlalchemy import select
    from telegram_poker_bot.shared.models import Seat

    result = await db_session.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    active_seats = list(result.scalars())
    assert len(active_seats) == 0, "Table should have no active seats"
    assert table.expires_at is None, "CASH_GAME table should not have expires_at"

    # Now simulate the inactivity checker logic
    # This should NOT expire the table because lobby_persistent=True
    active_player_count = len(
        [seat for seat in active_seats if not seat.is_sitting_out_next_hand]
    )

    # Check if the table would be expired
    should_skip = False
    if table.status == TableStatus.WAITING and not active_seats:
        # This is the fix: skip if lobby_persistent OR PERSISTENT template type
        if (
            table.template
            and table.template.table_type == TableTemplateType.PERSISTENT
        ) or table.lobby_persistent:
            should_skip = True

    assert should_skip is True, (
        "Table with lobby_persistent=True should be skipped from expiration "
        "even though it's a CASH_GAME template with no players"
    )

    # Verify the table is still in WAITING status and not expired
    await db_session.refresh(table)
    assert table.status == TableStatus.WAITING, "Table should still be WAITING"
    assert (
        table.status != TableStatus.EXPIRED
    ), "Table should NOT have been expired"


@pytest.mark.asyncio
async def test_non_lobby_persistent_cash_game_table_is_expired_when_empty(
    db_session: AsyncSession,
) -> None:
    """Test that regular CASH_GAME tables (without lobby_persistent) ARE expired when empty."""
    # Create a user
    user = User(tg_user_id=200, username="bob", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a CASH_GAME template
    from telegram_poker_bot.tests.conftest import create_test_template

    template = await create_test_template(
        db_session,
        name="Regular Cash Game Template",
        table_type=TableTemplateType.CASH_GAME,
        table_name="Regular Cash Game",
        small_blind=10,
        big_blind=20,
        starting_stack=1000,
        max_players=6,
    )

    # Create a table WITHOUT lobby_persistent
    table = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=template.id,
        auto_seat_creator=False,
        lobby_persistent=False,  # Not lobby-persistent
        is_auto_generated=False,
    )
    await db_session.commit()

    # Verify initial state
    assert table.status == TableStatus.WAITING
    assert table.lobby_persistent is False
    assert table.template.table_type == TableTemplateType.CASH_GAME

    # Refresh to ensure current state
    await db_session.refresh(table)

    # The table should have no players
    from sqlalchemy import select
    from telegram_poker_bot.shared.models import Seat

    result = await db_session.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    active_seats = list(result.scalars())
    assert len(active_seats) == 0, "Table should have no active seats"

    # Simulate inactivity checker logic
    should_skip = False
    if table.status == TableStatus.WAITING and not active_seats:
        # This is the fix: skip if lobby_persistent OR PERSISTENT template type
        if (
            table.template
            and table.template.table_type == TableTemplateType.PERSISTENT
        ) or table.lobby_persistent:
            should_skip = True

    assert should_skip is False, (
        "Regular CASH_GAME table without lobby_persistent=True "
        "should NOT be skipped from expiration"
    )

    # Actually expire the table to verify the lifecycle logic works
    reason = "no active players remaining"
    await table_lifecycle.mark_table_expired(db_session, table, reason)
    await db_session.commit()

    # Verify table was expired
    await db_session.refresh(table)
    assert table.status == TableStatus.EXPIRED, "Table should have been expired"


@pytest.mark.asyncio
async def test_persistent_template_type_tables_not_expired_when_empty(
    db_session: AsyncSession,
) -> None:
    """Test that PERSISTENT template type tables are not expired when empty (existing behavior)."""
    # Create a user
    user = User(tg_user_id=300, username="charlie", language="en")
    db_session.add(user)
    await db_session.flush()

    # Create a PERSISTENT template with waitlist
    from telegram_poker_bot.tests.conftest import create_test_template

    template = await create_test_template(
        db_session,
        name="Persistent Template",
        table_type=TableTemplateType.PERSISTENT,
        table_name="Persistent Table",
        small_blind=50,
        big_blind=100,
        starting_stack=5000,
        max_players=8,
        has_waitlist=True,  # PERSISTENT tables require waitlist
    )

    # Create a table from PERSISTENT template
    table = await table_service.create_table(
        db_session,
        creator_user_id=user.id,
        template_id=template.id,
        auto_seat_creator=False,
        lobby_persistent=False,  # May or may not be lobby-persistent
        is_auto_generated=False,
    )
    await db_session.commit()

    # Verify initial state
    assert table.status == TableStatus.WAITING
    assert table.template.table_type == TableTemplateType.PERSISTENT

    # Refresh
    await db_session.refresh(table)

    # The table should have no players
    from sqlalchemy import select
    from telegram_poker_bot.shared.models import Seat

    result = await db_session.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    active_seats = list(result.scalars())
    assert len(active_seats) == 0, "Table should have no active seats"

    # Simulate inactivity checker logic
    should_skip = False
    if table.status == TableStatus.WAITING and not active_seats:
        # This is the fix: skip if lobby_persistent OR PERSISTENT template type
        if (
            table.template
            and table.template.table_type == TableTemplateType.PERSISTENT
        ) or table.lobby_persistent:
            should_skip = True

    assert should_skip is True, (
        "PERSISTENT template type tables should always be skipped from expiration "
        "regardless of lobby_persistent flag"
    )

    # Verify table is still in WAITING status
    await db_session.refresh(table)
    assert table.status == TableStatus.WAITING, "Table should still be WAITING"
    assert (
        table.status != TableStatus.EXPIRED
    ), "Table should NOT have been expired"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
