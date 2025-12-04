"""Utility functions for error handling and anti-flood."""

import time
from typing import Dict

from telegram.error import BadRequest

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


class AntiFloodMiddleware:
    """Simple anti-flood protection using rate limiting."""
    
    # Configuration constants - can be overridden in __init__
    DEFAULT_MAX_REQUESTS = 20
    DEFAULT_WINDOW_SECONDS = 60
    
    def __init__(self, max_requests: int = None, window_seconds: int = None):
        self.max_requests = max_requests or self.DEFAULT_MAX_REQUESTS
        self.window_seconds = window_seconds or self.DEFAULT_WINDOW_SECONDS
        # Map of user_id -> list of timestamps
        self._requests: Dict[int, list] = {}
        
    def check_rate_limit(self, user_id: int) -> bool:
        """
        Check if user is within rate limit.
        
        Returns:
            True if request is allowed, False if rate limited
        """
        now = time.time()
        
        # Get user's request history
        if user_id not in self._requests:
            self._requests[user_id] = []
        
        user_requests = self._requests[user_id]
        
        # Remove old requests outside the window
        user_requests[:] = [ts for ts in user_requests if now - ts < self.window_seconds]
        
        # Check if within limit
        if len(user_requests) >= self.max_requests:
            logger.warning(
                "Rate limit exceeded",
                user_id=user_id,
                requests=len(user_requests),
                window=self.window_seconds,
            )
            return False
        
        # Add current request
        user_requests.append(now)
        return True
    
    def clear_user(self, user_id: int):
        """Clear rate limit history for a user."""
        if user_id in self._requests:
            del self._requests[user_id]


# Global anti-flood instance with defaults
anti_flood = AntiFloodMiddleware()


def format_chips(amount: int) -> str:
    """Format chip amount for display."""
    return f"{amount / 100:.2f}"


def format_card(card: str) -> str:
    """Format a card for display with emoji suits."""
    if not card or len(card) < 2:
        return card
    
    rank = card[:-1]
    suit = card[-1].upper()
    
    suit_emoji = {
        'H': '♥️',
        'D': '♦️',
        'C': '♣️',
        'S': '♠️',
    }
    
    return f"{rank}{suit_emoji.get(suit, suit)}"


def format_cards(cards: list) -> str:
    """Format a list of cards for display."""
    return " ".join(format_card(card) for card in cards)


async def safe_answer_callback_query(query, log=None, **kwargs):
    """
    Answer a callback query while ignoring stale/invalid query errors.

    Telegram returns BadRequest when a query is too old or already answered.
    Those errors are non-fatal, so we swallow them to keep handlers running.
    """
    if query is None:
        return

    try:
        await query.answer(**kwargs)
    except BadRequest as exc:
        message = str(exc)
        lowered = message.lower()
        if "query is too old" in lowered or "query id is invalid" in lowered:
            (log or logger).debug("Ignoring stale callback query", error=message)
            return
        raise
