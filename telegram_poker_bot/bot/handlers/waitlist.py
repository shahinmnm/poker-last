"""Telegram bot handlers for waitlist functionality."""

from telegram import Update
from telegram.ext import ContextTypes

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.keyboards.menu import get_waitlist_keyboard, get_back_to_menu_keyboard
from telegram_poker_bot.bot.api.client import api_client
from telegram_poker_bot.bot.handlers.commands import _get_or_create_user
from telegram_poker_bot.bot.utils.helpers import safe_answer_callback_query

logger = get_logger(__name__)


async def join_waitlist_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle joining a table waitlist."""
    query = update.callback_query
    await safe_answer_callback_query(query)
    
    # Extract table_id from callback_data (format: waitlist_join_<table_id>)
    callback_data = query.data
    table_id = int(callback_data.split("_")[-1])
    
    user, lang = await _get_or_create_user(update)
    
    try:
        # Join waitlist via API
        result = await api_client.join_waitlist(table_id, user.tg_user_id)
        
        if result.get("success"):
            position = result.get("position", "?")
            waitlist_count = result.get("waitlist_count", "?")
            
            message = get_text(
                "waitlist_joined",
                lang,
                default=f"✅ You've been added to the waitlist!\n\n"
                f"Your position: {position}\n"
                f"Total waiting: {waitlist_count}"
            )
            
            await query.edit_message_text(
                message,
                reply_markup=get_waitlist_keyboard(table_id, lang, joined=True)
            )
            
            logger.info(
                "User joined waitlist",
                user_id=user.tg_user_id,
                table_id=table_id,
                position=position
            )
        else:
            error_message = result.get("message", "Failed to join waitlist")
            await query.edit_message_text(
                f"❌ {error_message}",
                reply_markup=get_back_to_menu_keyboard(lang)
            )
            
    except Exception as e:
        logger.error(
            "Failed to join waitlist",
            user_id=user.tg_user_id,
            table_id=table_id,
            error=str(e)
        )
        await query.edit_message_text(
            get_text("error_generic", lang, default="❌ An error occurred. Please try again."),
            reply_markup=get_back_to_menu_keyboard(lang)
        )


async def leave_waitlist_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle leaving a table waitlist."""
    query = update.callback_query
    await safe_answer_callback_query(query)
    
    # Extract table_id from callback_data (format: waitlist_leave_<table_id>)
    callback_data = query.data
    table_id = int(callback_data.split("_")[-1])
    
    user, lang = await _get_or_create_user(update)
    
    try:
        # Leave waitlist via API
        result = await api_client.leave_waitlist(table_id, user.tg_user_id)
        
        if result.get("success"):
            message = get_text(
                "waitlist_left",
                lang,
                default="✅ You've been removed from the waitlist."
            )
            
            await query.edit_message_text(
                message,
                reply_markup=get_back_to_menu_keyboard(lang)
            )
            
            logger.info(
                "User left waitlist",
                user_id=user.tg_user_id,
                table_id=table_id
            )
        else:
            error_message = result.get("message", "Failed to leave waitlist")
            await query.edit_message_text(
                f"❌ {error_message}",
                reply_markup=get_back_to_menu_keyboard(lang)
            )
            
    except Exception as e:
        logger.error(
            "Failed to leave waitlist",
            user_id=user.tg_user_id,
            table_id=table_id,
            error=str(e)
        )
        await query.edit_message_text(
            get_text("error_generic", lang, default="❌ An error occurred. Please try again."),
            reply_markup=get_back_to_menu_keyboard(lang)
        )


async def check_waitlist_position_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle checking waitlist position."""
    query = update.callback_query
    await safe_answer_callback_query(query)
    
    # Extract table_id from callback_data (format: waitlist_position_<table_id>)
    callback_data = query.data
    table_id = int(callback_data.split("_")[-1])
    
    user, lang = await _get_or_create_user(update)
    
    try:
        # Get waitlist info via API
        result = await api_client.get_waitlist(table_id, user.tg_user_id)
        
        if result:
            user_position = result.get("user_position")
            total_count = result.get("count", 0)
            
            if user_position:
                message = get_text(
                    "waitlist_position",
                    lang,
                    default=f"📊 Waitlist Status\n\n"
                    f"Your position: {user_position}\n"
                    f"Total waiting: {total_count}\n\n"
                    f"You'll be notified when a seat becomes available!"
                )
            else:
                message = get_text(
                    "not_on_waitlist",
                    lang,
                    default="ℹ️ You're not currently on this table's waitlist."
                )
            
            await query.edit_message_text(
                message,
                reply_markup=get_waitlist_keyboard(table_id, lang, joined=(user_position is not None))
            )
            
        else:
            await query.edit_message_text(
                get_text("error_generic", lang, default="❌ Failed to get waitlist information."),
                reply_markup=get_back_to_menu_keyboard(lang)
            )
            
    except Exception as e:
        logger.error(
            "Failed to check waitlist position",
            user_id=user.tg_user_id,
            table_id=table_id,
            error=str(e)
        )
        await query.edit_message_text(
            get_text("error_generic", lang, default="❌ An error occurred. Please try again."),
            reply_markup=get_back_to_menu_keyboard(lang)
        )


async def waitlist_promotion_notification(
    bot,
    user_tg_id: int,
    table_id: int,
    lang: str = "en"
):
    """Send notification when user is promoted from waitlist to table."""
    try:
        message = get_text(
            "waitlist_promoted",
            lang,
            default=f"🎉 Great news! A seat just became available!\n\n"
            f"You've been automatically seated at table #{table_id}.\n\n"
            f"Good luck! 🃏"
        )
        
        await bot.send_message(
            chat_id=user_tg_id,
            text=message
        )
        
        logger.info(
            "Sent waitlist promotion notification",
            user_tg_id=user_tg_id,
            table_id=table_id
        )
        
    except Exception as e:
        logger.error(
            "Failed to send waitlist promotion notification",
            user_tg_id=user_tg_id,
            table_id=table_id,
            error=str(e)
        )
