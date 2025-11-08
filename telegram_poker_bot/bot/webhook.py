"""Webhook verification utilities."""

import hmac
import hashlib
from typing import Optional

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


def verify_webhook_secret(token: Optional[str], secret: str) -> bool:
    """
    Verify webhook secret token.
    
    Design Note:
    - Compares provided token with expected secret
    - Uses constant-time comparison to prevent timing attacks
    """
    if not token:
        return False
    
    return hmac.compare_digest(token, secret)
