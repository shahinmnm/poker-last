"""Command handlers for the new Telegram bot interface."""

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
    get_back_to_menu_keyboard,
)
from telegram_poker_bot.bot.utils.helpers import handle_handler_errors

logger = get_logger(__name__)


async def _get_or_create_user(update: Update) -> tuple[User, str]:
    """Get or create user from update."""
    tg_user = update.effective_user
    if not tg_user:
        raise ValueError("No Telegram user in update")
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.tg_user_id == tg_user.id)
        )
        user = result.scalar_one_or_none()
        
        lang = "en"
        if user:
            lang = user.language or "en"
        else:
            # Create new user
            lang = (tg_user.language_code or "en").split("-")[0].lower()
            if lang not in ["en", "fa"]:
                lang = "en"
                
            user = User(
                tg_user_id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                last_name=tg_user.last_name,
                language=lang,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
            logger.info(
                "Created new user",
                tg_user_id=tg_user.id,
                username=tg_user.username,
                language=lang,
            )
        
        return user, lang


@handle_handler_errors()
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    user, lang = await _get_or_create_user(update)
    
    chat = update.effective_chat
    is_private = chat.type == "private" if chat else False
    
    welcome_text = get_text("welcome_back", lang, name=user.first_name or "Player")
    menu_text = get_text("menu_title", lang)
    
    message = f"{welcome_text}\n\n{menu_text}"
    
    keyboard = get_main_menu_keyboard(lang, is_private)
    
    await update.message.reply_text(
        message,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


@handle_handler_errors()
async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /menu command - show main menu."""
    user, lang = await _get_or_create_user(update)
    
    chat = update.effective_chat
    is_private = chat.type == "private" if chat else False
    
    menu_text = get_text("menu_title", lang)
    keyboard = get_main_menu_keyboard(lang, is_private)
    
    await update.message.reply_text(
        menu_text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


@handle_handler_errors()
async def language_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /language command."""
    user, lang = await _get_or_create_user(update)
    
    text = get_text("choose_language", lang)
    keyboard = get_language_keyboard()
    
    await update.message.reply_text(
        text,
        reply_markup=keyboard,
    )


@handle_handler_errors()
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    user, lang = await _get_or_create_user(update)
    
    help_text = """
📖 <b>Available Commands</b>

/start - Show main menu
/menu - Show main menu
/lobby - Browse active tables
/profile - View your profile
/language - Change language
/help - Show this help message

<b>How to Play:</b>
1. Use /lobby to browse tables
2. Join a table
3. Wait for the game to start
4. Make your moves when it's your turn

Good luck! 🍀
"""
    
    keyboard = get_back_to_menu_keyboard(lang)
    
    await update.message.reply_text(
        help_text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )
