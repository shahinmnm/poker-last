"""Profile and statistics handlers."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.keyboards.menu import (
    get_profile_keyboard,
    get_back_to_menu_keyboard,
)
from telegram_poker_bot.bot.api.client import api_client
from telegram_poker_bot.bot.handlers.commands import _get_or_create_user

logger = get_logger(__name__)


async def profile_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /profile command."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Fetch profile data
        balance = await api_client.get_user_balance(user.tg_user_id)
        
        if not balance:
            await update.message.reply_text(
                "⚠️ Unable to fetch profile. Please try again later.",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        real_balance = balance.get("real_chips", 0) / 100  # Convert from cents
        play_balance = balance.get("play_chips", 0) / 100
        
        profile_text = f"""
👤 <b>{get_text("profile_title", lang)}</b>

<b>Name:</b> {user.first_name or 'Player'}
<b>Username:</b> @{user.username or 'N/A'}

{get_text("balance_line", lang, real_chips=f"{real_balance:.2f}", play_chips=f"{play_balance:.2f}")}
"""
        
        keyboard = get_profile_keyboard(lang)
        
        await update.message.reply_text(
            profile_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error("Error in profile command", error=str(e), exc_info=e)
        await update.message.reply_text("An error occurred. Please try again.")


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stats command."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Fetch stats
        stats = await api_client.get_user_stats(user.tg_user_id)
        
        if not stats:
            await update.message.reply_text(
                "⚠️ Unable to fetch stats. Please try again later.",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        hands_played = stats.get("hands_played", 0)
        total_won = stats.get("total_won", 0) / 100  # Convert from cents
        win_rate = stats.get("win_rate", 0)
        
        stats_text = f"""
📊 <b>{get_text("stats", lang)}</b>

{get_text("stats_hands_played", lang, count=hands_played)}
{get_text("stats_total_won", lang, amount=f"{total_won:.2f}")}
{get_text("stats_win_rate", lang, rate=f"{win_rate:.1f}")}
"""
        
        keyboard = get_back_to_menu_keyboard(lang)
        
        await update.message.reply_text(
            stats_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error("Error in stats command", error=str(e), exc_info=e)
        await update.message.reply_text("An error occurred. Please try again.")


async def _show_transaction_history(
    update: Update,
    transaction_type: str,
    title_key: str,
    icon: str,
    error_context: str
):
    """
    Helper function to display transaction history.
    
    Args:
        update: The Telegram update object
        transaction_type: Type of transaction to filter ("deposit" or "withdrawal")
        title_key: Localization key for the title text
        icon: Emoji icon to display in the title
        error_context: Context string for error logging
    """
    try:
        user, lang = await _get_or_create_user(update)
        
        # Fetch transaction history
        transactions = await api_client.get_user_transactions(user.tg_user_id, limit=10)
        
        if transactions is None:
            await update.message.reply_text(
                f"⚠️ Unable to fetch {transaction_type} history. Please try again later.",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        # Filter transactions by type
        filtered_txs = [t for t in transactions if t.get("type") == transaction_type]
        
        history_text = f"{icon} <b>{get_text(title_key, lang)}</b>\n\n"
        
        if not filtered_txs:
            history_text += get_text("history_empty", lang)
        else:
            for tx in filtered_txs:
                amount = tx.get("amount", 0) / 100
                date = tx.get("created_at", "N/A")
                status = tx.get("status", "unknown")
                history_text += f"• {date}: ${amount:.2f} ({status})\n"
        
        keyboard = get_back_to_menu_keyboard(lang)
        
        await update.message.reply_text(
            history_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error(f"Error in {error_context}", error=str(e), exc_info=e)
        await update.message.reply_text("An error occurred. Please try again.")


async def history_deposits_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /history_deposits command."""
    await _show_transaction_history(
        update, "deposit", "deposit_history", "📥", "deposit history command"
    )


async def history_withdrawals_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /history_withdrawals command."""
    await _show_transaction_history(
        update, "withdrawal", "withdraw_history", "📤", "withdrawal history command"
    )


async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /invite command."""
    try:
        user, lang = await _get_or_create_user(update)
        
        from telegram_poker_bot.shared.config import get_settings
        settings = get_settings()
        
        bot_username = settings.bot_username_clean or "YourPokerBot"
        invite_link = f"https://t.me/{bot_username}?start=ref_{user.tg_user_id}"
        
        invite_text = f"""
{get_text("invite_header", lang)}

{get_text("invite_link", lang)} {invite_link}

{get_text("invite_stats", lang, count=0)}
"""
        
        keyboard = get_back_to_menu_keyboard(lang)
        
        await update.message.reply_text(
            invite_text,
            reply_markup=keyboard,
        )
        
    except Exception as e:
        logger.error("Error in invite command", error=str(e), exc_info=e)
        await update.message.reply_text("An error occurred. Please try again.")
