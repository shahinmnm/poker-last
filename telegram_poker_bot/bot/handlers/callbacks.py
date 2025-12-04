"""Callback query handler for inline keyboard interactions."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from sqlalchemy import select

from telegram_poker_bot.shared.database import AsyncSessionLocal
from telegram_poker_bot.shared.models import User
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.keyboards.menu import (
    get_main_menu_keyboard,
    get_language_keyboard,
    get_wallet_keyboard,
    get_profile_keyboard,
    get_back_to_menu_keyboard,
)
from telegram_poker_bot.bot.handlers.commands import _get_or_create_user
from telegram_poker_bot.bot.handlers.lobby import show_lobby
from telegram_poker_bot.bot.handlers.table import (
    join_table_handler,
    leave_table_handler,
    submit_action_handler,
)
from telegram_poker_bot.bot.api.client import api_client
from telegram_poker_bot.bot.utils.helpers import safe_answer_callback_query

logger = get_logger(__name__)


async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle all callback queries from inline keyboards."""
    query = update.callback_query
    await safe_answer_callback_query(query)
    
    data = query.data
    
    try:
        user, lang = await _get_or_create_user(update)
        
        # Main menu
        if data == "menu_main":
            await show_main_menu(update, context, query, lang)
            
        # Language selection
        elif data == "menu_language":
            await show_language_menu(update, context, query, lang)
        elif data.startswith("lang_"):
            new_lang = data.split("_")[1]
            await set_language(update, context, query, user, new_lang)
            
        # Lobby
        elif data == "menu_lobby":
            await show_lobby(update, context, query)
            
        # Profile
        elif data == "menu_profile":
            await show_profile(update, context, query, lang)
        elif data == "profile_stats":
            await show_stats(update, context, query, lang)
        elif data == "profile_deposits":
            await show_deposit_history(update, context, query, lang)
        elif data == "profile_withdrawals":
            await show_withdrawal_history(update, context, query, lang)
        elif data == "profile_invite":
            await show_invite(update, context, query, lang)
            
        # Wallet
        elif data == "menu_wallet":
            await show_wallet(update, context, query, lang)
        elif data == "wallet_deposit":
            await show_deposit_info(update, context, query, lang)
        elif data == "wallet_withdraw":
            await show_withdraw_info(update, context, query, lang)
        elif data == "wallet_history":
            await show_wallet_history(update, context, query, lang)
            
        # Stats
        elif data == "menu_stats":
            await show_stats(update, context, query, lang)
            
        # Support
        elif data == "menu_support":
            await show_support(update, context, query, lang)
            
        # Invite
        elif data == "menu_invite":
            await show_invite(update, context, query, lang)
            
        # Table actions
        elif data.startswith("table_join_"):
            table_id = int(data.split("_")[-1])
            await join_table_handler(update, context, table_id, query)
        elif data == "table_leave":
            await leave_table_handler(update, context)
            
        # Waitlist actions
        elif data.startswith("waitlist_join_"):
            from telegram_poker_bot.bot.handlers.waitlist import join_waitlist_handler
            await join_waitlist_handler(update, context)
        elif data.startswith("waitlist_leave_"):
            from telegram_poker_bot.bot.handlers.waitlist import leave_waitlist_handler
            await leave_waitlist_handler(update, context)
        elif data.startswith("waitlist_position_"):
            from telegram_poker_bot.bot.handlers.waitlist import check_waitlist_position_handler
            await check_waitlist_position_handler(update, context)
            
        # Game actions
        elif data == "action_fold":
            await submit_action_handler(update, context, "fold")
        elif data == "action_check":
            await submit_action_handler(update, context, "check")
        elif data == "action_call":
            await submit_action_handler(update, context, "call")
        elif data.startswith("action_bet_"):
            amount_str = data.split("_")[-1]
            if amount_str.isdigit():
                await submit_action_handler(update, context, "bet", int(amount_str))
            else:
                await safe_answer_callback_query(
                    query, text="Custom bet not yet implemented"
                )
                
        # No-op
        elif data == "noop":
            await safe_answer_callback_query(query)
            
        else:
            logger.warning("Unhandled callback data", data=data)
            await safe_answer_callback_query(query, text="Not implemented yet")
            
    except Exception as e:
        logger.error("Error handling callback query", data=data, error=str(e), exc_info=e)
        await safe_answer_callback_query(query, text="An error occurred")


async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show main menu."""
    chat = update.effective_chat
    is_private = chat.type == "private" if chat else False
    
    text = get_text("menu_title", lang)
    keyboard = get_main_menu_keyboard(lang, is_private)
    
    await query.edit_message_text(text, reply_markup=keyboard)


async def show_language_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show language selection menu."""
    text = get_text("choose_language", lang)
    keyboard = get_language_keyboard()
    
    await query.edit_message_text(text, reply_markup=keyboard)


async def set_language(update: Update, context: ContextTypes.DEFAULT_TYPE, query, user: User, new_lang: str):
    """Set user language."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.tg_user_id == user.tg_user_id)
        )
        db_user = result.scalar_one_or_none()
        
        if db_user:
            db_user.language = new_lang
            await session.commit()
            
            text = get_text("language_set", new_lang)
            keyboard = get_back_to_menu_keyboard(new_lang)
            
            await query.edit_message_text(text, reply_markup=keyboard)


async def show_profile(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show profile."""
    user, lang = await _get_or_create_user(update)
    
    balance = await api_client.get_user_balance(user.tg_user_id)
    
    if not balance:
        await query.edit_message_text(
            "⚠️ Unable to fetch profile.",
            reply_markup=get_back_to_menu_keyboard(lang),
        )
        return
    
    real_balance = balance.get("real_chips", 0) / 100
    play_balance = balance.get("play_chips", 0) / 100
    
    profile_text = f"""
👤 <b>{get_text("profile_title", lang)}</b>

<b>Name:</b> {user.first_name or 'Player'}
<b>Username:</b> @{user.username or 'N/A'}

{get_text("balance_line", lang, real_chips=f"{real_balance:.2f}", play_chips=f"{play_balance:.2f}")}
"""
    
    keyboard = get_profile_keyboard(lang)
    
    await query.edit_message_text(
        profile_text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


async def show_stats(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show user stats."""
    user, lang = await _get_or_create_user(update)
    
    stats = await api_client.get_user_stats(user.tg_user_id)
    
    if not stats:
        await query.edit_message_text(
            "⚠️ Unable to fetch stats.",
            reply_markup=get_back_to_menu_keyboard(lang),
        )
        return
    
    hands_played = stats.get("hands_played", 0)
    total_won = stats.get("total_won", 0) / 100
    win_rate = stats.get("win_rate", 0)
    
    stats_text = f"""
📊 <b>{get_text("stats", lang)}</b>

{get_text("stats_hands_played", lang, count=hands_played)}
{get_text("stats_total_won", lang, amount=f"{total_won:.2f}")}
{get_text("stats_win_rate", lang, rate=f"{win_rate:.1f}")}
"""
    
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(
        stats_text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


async def show_wallet(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show wallet menu."""
    user, lang = await _get_or_create_user(update)
    
    balance = await api_client.get_user_balance(user.tg_user_id)
    
    if not balance:
        text = "⚠️ Unable to fetch wallet."
    else:
        real_balance = balance.get("real_chips", 0) / 100
        play_balance = balance.get("play_chips", 0) / 100
        
        text = f"""
💰 <b>{get_text("wallet_menu", lang)}</b>

{get_text("balance_line", lang, real_chips=f"{real_balance:.2f}", play_chips=f"{play_balance:.2f}")}
"""
    
    keyboard = get_wallet_keyboard(lang)
    
    await query.edit_message_text(
        text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


async def show_deposit_info(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show deposit info."""
    text = get_text("deposit_info", lang)
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(text, reply_markup=keyboard)


async def show_withdraw_info(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show withdraw info."""
    text = get_text("withdraw_insufficient", lang, default="Contact admin to withdraw.")
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(text, reply_markup=keyboard)


async def show_wallet_history(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show transaction history."""
    user, lang = await _get_or_create_user(update)
    
    transactions = await api_client.get_user_transactions(user.tg_user_id, limit=10)
    
    if transactions is None:
        text = "⚠️ Unable to fetch history."
    else:
        text = f"📝 <b>{get_text('history_title', lang)}</b>\n\n"
        
        if not transactions:
            text += get_text("history_empty", lang)
        else:
            for tx in transactions[:10]:
                tx_type = tx.get("type", "unknown")
                amount = tx.get("amount", 0) / 100
                date = tx.get("created_at", "N/A")
                text += f"• {date}: {tx_type} ${amount:.2f}\n"
    
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(
        text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


async def show_deposit_history(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show deposit history."""
    user, lang = await _get_or_create_user(update)
    
    transactions = await api_client.get_user_transactions(user.tg_user_id, limit=10)
    
    if transactions is None:
        text = "⚠️ Unable to fetch deposit history."
    else:
        deposits = [t for t in transactions if t.get("type") == "deposit"]
        
        text = f"📥 <b>{get_text('deposit_history', lang)}</b>\n\n"
        
        if not deposits:
            text += get_text("history_empty", lang)
        else:
            for tx in deposits:
                amount = tx.get("amount", 0) / 100
                date = tx.get("created_at", "N/A")
                text += f"• {date}: ${amount:.2f}\n"
    
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)


async def show_withdrawal_history(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show withdrawal history."""
    user, lang = await _get_or_create_user(update)
    
    transactions = await api_client.get_user_transactions(user.tg_user_id, limit=10)
    
    if transactions is None:
        text = "⚠️ Unable to fetch withdrawal history."
    else:
        withdrawals = [t for t in transactions if t.get("type") == "withdrawal"]
        
        text = f"📤 <b>{get_text('withdraw_history', lang)}</b>\n\n"
        
        if not withdrawals:
            text += get_text("history_empty", lang)
        else:
            for tx in withdrawals:
                amount = tx.get("amount", 0) / 100
                date = tx.get("created_at", "N/A")
                text += f"• {date}: ${amount:.2f}\n"
    
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)


async def show_invite(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show invite link."""
    user, lang = await _get_or_create_user(update)
    
    from telegram_poker_bot.shared.config import get_settings
    settings = get_settings()
    
    bot_username = settings.bot_username_clean or "YourPokerBot"
    invite_link = f"https://t.me/{bot_username}?start=ref_{user.tg_user_id}"
    
    text = f"""
{get_text("invite_header", lang)}

{get_text("invite_link", lang)} {invite_link}

{get_text("invite_stats", lang, count=0)}
"""
    
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(text, reply_markup=keyboard)


async def show_support(update: Update, context: ContextTypes.DEFAULT_TYPE, query, lang: str):
    """Show support info."""
    text = get_text("support_text", lang)
    keyboard = get_back_to_menu_keyboard(lang)
    
    await query.edit_message_text(text, reply_markup=keyboard)
