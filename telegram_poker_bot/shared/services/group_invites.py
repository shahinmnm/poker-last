"""Helper functions for managing group game invites."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    GroupGameInvite,
    GroupGameInviteStatus,
    Group,
)
from telegram_poker_bot.shared.services.invite_tokens import generate_invite_token

DEFAULT_TOKEN_LENGTH = 16


async def generate_unique_game_id(
    db: AsyncSession,
    *,
    max_attempts: int = 8,
    token_length: int = DEFAULT_TOKEN_LENGTH,
) -> str:
    """Generate a unique game id not already present in the database."""
    for _ in range(max_attempts):
        candidate = generate_invite_token(token_length)
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
    table_id: Optional[int] = None,
) -> GroupGameInvite:
    """
    Persist a new group invite and return the ORM instance.
    
    Args:
        db: Database session
        creator_user_id: User who created the invite
        deep_link: Telegram deep link for the invite
        ttl_seconds: Time to live in seconds
        metadata: Additional metadata (table config, creator info, etc.)
        game_id: Optional specific game ID
        table_id: Optional existing table ID to link
    
    Returns:
        Created GroupGameInvite instance
    """
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    game_id = game_id or await generate_unique_game_id(db, token_length=token_length_for_ttl(ttl_seconds))

    # Ensure metadata includes table configuration
    full_metadata = metadata or {}
    if table_id:
        full_metadata["table_id"] = table_id
    
    invite = GroupGameInvite(
        game_id=game_id,
        creator_user_id=creator_user_id,
        deep_link=deep_link,
        expires_at=expires_at,
        status=GroupGameInviteStatus.PENDING,
        metadata_json=full_metadata,
    )
    db.add(invite)
    await db.flush()
    return invite


def token_length_for_ttl(ttl_seconds: int) -> int:
    """
    Derive an invite length based on TTL.

    Longer-lived invites receive longer tokens which reduces collision probability further.
    The defaults have been tested against public mini-app implementations and keep the payload
    comfortably below Telegram’s 64 character limit.
    """
    if ttl_seconds >= 3600:
        return DEFAULT_TOKEN_LENGTH
    if ttl_seconds >= 1800:
        return 14
    if ttl_seconds >= 900:
        return 12
    return 10


async def fetch_invite_by_game_id(
    db: AsyncSession,
    game_id: str,
) -> Optional[GroupGameInvite]:
    """Fetch invite by public game id."""
    result = await db.execute(
        select(GroupGameInvite).where(GroupGameInvite.game_id == game_id)
    )
    invite = result.scalar_one_or_none()
    if invite and invite.expires_at:
        expires_at = invite.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
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
