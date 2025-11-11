"""Helpers for generating shareable invite tokens compatible with Telegram deep links."""

from __future__ import annotations

import base64
import math
import secrets
from typing import Final


# Telegram allows up to 64 characters containing A-Z, a-z, 0-9, '-' and '_'
_MAX_TOKEN_LENGTH: Final[int] = 48
_MIN_TOKEN_LENGTH: Final[int] = 8


def _bytes_for_length(length: int) -> int:
    """Return the number of random bytes required to cover ``length`` base64 characters."""
    return math.ceil(length * 3 / 4)


def generate_invite_token(length: int = 16) -> str:
    """
    Generate a URL-safe invite token suitable for Telegram ``start``/``startgroup`` payloads.

    The implementation mirrors best practices from Telegram’s documentation and open-source
    Mini App projects – we derive a cryptographically secure random byte sequence, encode it
    with URL-safe base64, strip padding, and trim to the requested length. The resulting token
    only contains ``A-Z``, ``0-9``, ``-`` and ``_`` which are allowed in deep-link payloads.
    """
    if length < _MIN_TOKEN_LENGTH or length > _MAX_TOKEN_LENGTH:
        raise ValueError(f"Invite token length must be between {_MIN_TOKEN_LENGTH} and {_MAX_TOKEN_LENGTH}")

    while True:
        random_bytes = secrets.token_bytes(_bytes_for_length(length))
        token = base64.urlsafe_b64encode(random_bytes).decode("ascii").rstrip("=")
        if len(token) < length:
            # Extremely unlikely, but request another batch to satisfy desired size.
            continue
        # Telegram payloads are case-sensitive; upper-casing improves readability while
        # keeping entropy high because the alphabet already includes uppercase variants.
        return token[:length].upper()

