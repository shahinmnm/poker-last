"""Test that group invite status correctly inserts into database."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import (
    Base,
    GroupGameInvite,
    GroupGameInviteStatus,
    User,
)


@pytest.mark.asyncio
async def test_enum_inserts_with_correct_lowercase_value():
    """Verify that GroupGameInviteStatus enum uses lowercase values when inserting."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        # Create a user
        user = User(tg_user_id=12345, language="en")
        session.add(user)
        await session.flush()

        # Create invite using enum member directly (as the service does)
        invite = GroupGameInvite(
            game_id="TEST123",
            creator_user_id=user.id,
            deep_link="https://t.me/pokerbazabot?startgroup=TEST123",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            status=GroupGameInviteStatus.PENDING,  # Using enum, not string
            metadata_json={"test": "data"},
        )

        session.add(invite)
        await session.commit()  # This should not raise

        # Verify it was inserted correctly
        assert invite.id is not None
        assert invite.status == GroupGameInviteStatus.PENDING
        assert invite.status.value == "pending"

    await engine.dispose()


@pytest.mark.asyncio
async def test_string_status_normalizes_on_assignment():
    """Verify that string status values are normalized via the event listener."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        user = User(tg_user_id=67890, language="en")
        session.add(user)
        await session.flush()

        # Create invite with uppercase string (simulating API input)
        invite = GroupGameInvite(
            game_id="TEST456",
            creator_user_id=user.id,
            deep_link="https://t.me/pokerbazabot?startgroup=TEST456",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            status="PENDING",  # Uppercase string
        )

        session.add(invite)
        await session.flush()

        # Event listener should have converted it
        assert invite.status is GroupGameInviteStatus.PENDING
        assert invite.status.value == "pending"

        # Update to another uppercase string
        invite.status = "READY"
        await session.flush()

        assert invite.status is GroupGameInviteStatus.READY
        assert invite.status.value == "ready"

    await engine.dispose()


@pytest.mark.asyncio
async def test_all_status_transitions():
    """Test all status values work correctly."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        user = User(tg_user_id=99999, language="en")
        session.add(user)
        await session.flush()

        invite = GroupGameInvite(
            game_id="TEST789",
            creator_user_id=user.id,
            deep_link="https://t.me/pokerbazabot?startgroup=TEST789",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            status=GroupGameInviteStatus.PENDING,
        )
        session.add(invite)
        await session.flush()

        # Test all transitions
        for status in [
            GroupGameInviteStatus.READY,
            GroupGameInviteStatus.CONSUMED,
            GroupGameInviteStatus.EXPIRED,
        ]:
            invite.status = status
            await session.flush()
            assert invite.status == status
            assert isinstance(invite.status, str)  # Should be a string subclass
            assert invite.status.value == status.value

    await engine.dispose()
