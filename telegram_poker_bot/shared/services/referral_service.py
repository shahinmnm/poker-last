"""Referral and invite utilities."""

from __future__ import annotations

import secrets
import string
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import ReferralStats, User


def _random_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def generate_unique_referral_code(db: AsyncSession, *, length: int = 8) -> str:
    """Generate a unique referral code."""
    for _ in range(10):
        candidate = _random_code(length)
        result = await db.execute(
            select(User.id).where(User.referral_code == candidate)
        )
        if result.scalar_one_or_none() is None:
            return candidate
    # Fallback with longer code
    return _random_code(length=12)


async def ensure_referral_code(db: AsyncSession, user: User) -> str:
    """Ensure a user has a referral code."""
    if user.referral_code:
        return user.referral_code
    code = await generate_unique_referral_code(db)
    user.referral_code = code
    await db.flush()
    return code


async def find_user_by_referral_code(
    db: AsyncSession, code: str
) -> Optional[User]:
    """Find a user by referral code."""
    normalized = (code or "").strip()
    if not normalized:
        return None
    result = await db.execute(
        select(User).where(User.referral_code == normalized)
    )
    return result.scalar_one_or_none()


async def record_referral(db: AsyncSession, referrer_id: int) -> None:
    """Increment referral stats for a referrer."""
    result = await db.execute(
        select(ReferralStats).where(ReferralStats.user_id == referrer_id).with_for_update()
    )
    stats = result.scalar_one_or_none()
    if stats is None:
        stats = ReferralStats(user_id=referrer_id, invited_count=1, total_earnings=0)
        db.add(stats)
    else:
        stats.invited_count += 1
    await db.flush()


async def get_referral_stats(db: AsyncSession, user_id: int) -> dict:
    """Fetch referral stats."""
    result = await db.execute(select(ReferralStats).where(ReferralStats.user_id == user_id))
    stats = result.scalar_one_or_none()
    return {
        "invited_count": stats.invited_count if stats else 0,
        "total_earnings": stats.total_earnings if stats else 0,
    }
