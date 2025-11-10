"""Helper functions for managing group game invites."""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    GroupGameInvite,
    GroupGameInviteStatus,
    Group,
)

DEFAULT_ID_ALPHABET = string.ascii_uppercase + string.digits
DEFAULT_ID_LENGTH = 12


def _generate_candidate_game_id(length: int = DEFAULT_ID_LENGTH) -> str:
    """Return a random, shareable game id token."""
    return "".join(secrets.choice(DEFAULT_ID_ALPHABET) for _ in range(length))


async def generate_unique_game_id(db: AsyncSession, *, max_attempts: int = 5) -> str:
    """Generate a unique game id not already present in the database."""
    for _ in range(max_attempts):
        candidate = _generate_candidate_game_id()
        result = await db.execute(
            select(GroupGameInvite.id).where(GroupGameInvite.game_id == candidate)
        )
        if result.scalar_one_or_none() is None:
            return candidate
    raise RuntimeError("Unable to allocate unique game id after several attempts")


async def create_invite(
    db: AsyncSession,
    *,
    creator_user_id: int,
    deep_link: str,
    ttl_seconds: int,
    metadata: Optional[dict] = None,
    game_id: Optional[str] = None,
) -> GroupGameInvite:
    """Persist a new group invite and return the ORM instance."""
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    game_id = game_id or await generate_unique_game_id(db)

    invite = GroupGameInvite(
        game_id=game_id,
        creator_user_id=creator_user_id,
        deep_link=deep_link,
        expires_at=expires_at,
        status=GroupGameInviteStatus.PENDING,
        metadata_json=metadata or {},
    )
    db.add(invite)
    await db.flush()
    return invite


async def fetch_invite_by_game_id(
    db: AsyncSession,
    game_id: str,
) -> Optional[GroupGameInvite]:
    """Fetch invite by public game id."""
    result = await db.execute(
        select(GroupGameInvite).where(GroupGameInvite.game_id == game_id)
    )
    invite = result.scalar_one_or_none()
    if invite and invite.expires_at < datetime.now(timezone.utc):
        invite.status = GroupGameInviteStatus.EXPIRED
        await db.flush()
    return invite


async def attach_group_to_invite(
    db: AsyncSession,
    *,
    invite: GroupGameInvite,
    group: Group,
) -> GroupGameInvite:
    """Associate a Telegram group with an invite and mark it ready."""
    invite.group_id = group.id
    if invite.status != GroupGameInviteStatus.CONSUMED:
        invite.status = GroupGameInviteStatus.READY
    await db.flush()
    return invite


async def mark_invite_consumed(
    db: AsyncSession,
    invite: GroupGameInvite,
) -> GroupGameInvite:
    """Mark invite as consumed/used."""
    invite.status = GroupGameInviteStatus.CONSUMED
    invite.consumed_at = datetime.now(timezone.utc)
    await db.flush()
    return invite
