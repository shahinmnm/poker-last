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
async def test_uppercase_status_normalizes_to_enum():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        user = User(tg_user_id=10_001, language="en")
        session.add(user)
        await session.flush()

        invite = GroupGameInvite(
            game_id="ABC123",
            creator_user_id=user.id,
            deep_link="https://example.test/invite",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            status="PENDING",
        )

        session.add(invite)
        await session.flush()
        assert invite.status is GroupGameInviteStatus.PENDING

        invite.status = "READY"
        await session.flush()
        assert invite.status is GroupGameInviteStatus.READY

    await engine.dispose()
