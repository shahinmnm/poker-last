"""Register all new command and callback handlers."""

from telegram.ext import Application, CommandHandler, CallbackQueryHandler

from telegram_poker_bot.bot.handlers.commands import (
    start_command,
    menu_command,
    language_command,
    help_command,
)
from telegram_poker_bot.bot.handlers.lobby import (
    lobby_command,
    table_info_command,
)
from telegram_poker_bot.bot.handlers.profile import (
    profile_command,
    stats_command,
    history_deposits_command,
    history_withdrawals_command,
    invite_command,
)
from telegram_poker_bot.bot.handlers.callbacks import callback_query_handler
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


def register_new_handlers(application: Application):
    """Register all new bot handlers."""
    
    # Command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("menu", menu_command))
    application.add_handler(CommandHandler("lobby", lobby_command))
    application.add_handler(CommandHandler("table", table_info_command))
    application.add_handler(CommandHandler("profile", profile_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("history_deposits", history_deposits_command))
    application.add_handler(CommandHandler("history_withdrawals", history_withdrawals_command))
    application.add_handler(CommandHandler("invite", invite_command))
    application.add_handler(CommandHandler("language", language_command))
    application.add_handler(CommandHandler("help", help_command))
    
    # Callback query handler for all inline keyboard interactions
    application.add_handler(CallbackQueryHandler(callback_query_handler))
    
    logger.info("Registered new bot handlers")
