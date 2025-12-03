"""Middleware for error handling and logging."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors in the telegram bot."""
    logger.error("Exception while handling an update", exc_info=context.error)
    
    # Try to send error message to user
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(
                "⚠️ An error occurred while processing your request. Please try again later."
            )
        except Exception as e:
            logger.error("Failed to send error message to user", error=str(e))
