"""Lobby and table browsing handlers."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.keyboards.menu import (
    get_lobby_keyboard,
    get_back_to_menu_keyboard,
)
from telegram_poker_bot.bot.api.client import api_client
from telegram_poker_bot.bot.handlers.commands import _get_or_create_user

logger = get_logger(__name__)


async def lobby_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /lobby command - show active tables."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Fetch active tables from API
        tables = await api_client.get_tables_list(status="waiting", limit=10)
        
        if tables is None:
            await update.message.reply_text(
                "⚠️ Unable to fetch tables. Please try again later.",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        title = "🎮 <b>Active Tables</b>\n\n"
        if not tables:
            title += get_text("no_tables", lang)
        else:
            title += f"Found {len(tables)} active table(s):"
        
        keyboard = get_lobby_keyboard(tables, lang)
        
        await update.message.reply_text(
            title,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error("Error in lobby command", error=str(e), exc_info=e)
        await update.message.reply_text("An error occurred. Please try again.")


async def show_lobby(update: Update, context: ContextTypes.DEFAULT_TYPE, query=None):
    """Show lobby - can be called from callback or command."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Fetch active tables from API
        tables = await api_client.get_tables_list(status="waiting", limit=10)
        
        if tables is None:
            text = "⚠️ Unable to fetch tables. Please try again later."
            keyboard = get_back_to_menu_keyboard(lang)
        else:
            title = "🎮 <b>Active Tables</b>\n\n"
            if not tables:
                title += get_text("no_tables", lang)
            else:
                title += f"Found {len(tables)} active table(s):"
            
            text = title
            keyboard = get_lobby_keyboard(tables, lang)
        
        if query:
            # Edit existing message
            await query.edit_message_text(
                text,
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML,
            )
        else:
            # Send new message
            await update.message.reply_text(
                text,
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML,
            )
        
    except Exception as e:
        logger.error("Error showing lobby", error=str(e), exc_info=e)


async def table_info_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /table <id> command - show table info."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Extract table ID from args
        if not context.args or not context.args[0].isdigit():
            await update.message.reply_text(
                "Usage: /table <table_id>",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        table_id = int(context.args[0])
        
        # Fetch table details
        table = await api_client.get_table_details(table_id)
        
        if not table:
            await update.message.reply_text(
                f"⚠️ Table #{table_id} not found.",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        # Format table info
        table_name = table.get("name", f"Table #{table_id}")
        players = table.get("player_count", 0)
        max_players = table.get("max_players", 9)
        status = table.get("status", "unknown")
        small_blind = table.get("small_blind", 0)
        big_blind = table.get("big_blind", 0)
        
        info_text = get_text(
            "table_info",
            lang,
            name=table_name,
            players=players,
            max_players=max_players,
            status=status,
        )
        
        info_text += f"\n\nBlinds: {small_blind}/{big_blind}"
        
        # Add join button if table is joinable
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton(
                "🎯 Join Table",
                callback_data=f"table_join_{table_id}"
            )],
            [InlineKeyboardButton(
                "🔙 " + get_text("back", lang),
                callback_data="menu_lobby"
            )],
        ])
        
        await update.message.reply_text(
            info_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error("Error in table info command", error=str(e), exc_info=e)
        await update.message.reply_text("An error occurred. Please try again.")
