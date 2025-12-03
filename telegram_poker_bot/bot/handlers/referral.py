"""Referral helpers for user-facing flows."""

from __future__ import annotations

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.models import User

settings = get_settings()


def build_referral_link(referral_code: str) -> str:
    """Compose a referral link with start payload."""
    return f"https://t.me/{settings.bot_username_clean}?start={referral_code}"


def display_name(user: User) -> str:
    """Resolve a user friendly display name."""
    if user.username:
        return f"@{user.username}"
    return f"Player #{user.id}"
