"""Telegram bot command handlers."""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.constants import ChatType
from telegram.ext import ContextTypes

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.bot.i18n import get_translation

settings = get_settings()
logger = get_logger(__name__)


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /start command.
    
    Design Note:
    - Sends welcome message with game overview
    - Provides buttons for different game modes
    - Detects user language from Telegram profile
    """
    message = update.effective_message
    if message is None:
        logger.warning("/start received without an effective message")
        return

    chat = update.effective_chat
    is_private_chat = chat.type == ChatType.PRIVATE if chat is not None else False

    user = update.effective_user
    language = user.language_code or "en"
    
    # Get translations
    t = get_translation(language)
    
    # Create Mini App URL
    webapp_url = f"{settings.vite_api_url.replace('/api', '')}?start=1"
    
    keyboard = [
        [
            InlineKeyboardButton(
                f"{t('play_anonymous')} ♣️",
                callback_data="play_anonymous",
            ),
        ],
        [
            InlineKeyboardButton(
                f"{t('play_group')} ♠️",
                callback_data="play_group",
            ),
        ],
        [
            InlineKeyboardButton(
                f"{t('how_to_play')} 📘",
                callback_data="how_to_play",
            ),
            InlineKeyboardButton(
                f"{t('settings')} ⚙️",
                callback_data="settings",
            ),
        ],
        [
            InlineKeyboardButton(
                f"{t('open_mini_app')} 🎮",
                web_app=WebAppInfo(url=webapp_url) if is_private_chat else None,
                url=webapp_url if not is_private_chat else None,
            ),
        ],
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_text = f"""
{t('welcome_title')} 🎰

{t('welcome_description')}

**{t('game_modes')}:**
• **{t('anonymous_mode')}** ♣️: {t('anonymous_mode_desc')}
• **{t('group_mode')}** ♠️: {t('group_mode_desc')}

{t('get_started')}
"""
    await message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode="Markdown",
    )


async def language_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /language command."""
    message = update.effective_message
    if message is None:
        logger.warning("/language invoked without an effective message")
        return

    user = update.effective_user
    language = user.language_code or "en"
    t = get_translation(language)

    keyboard = [
        [
            InlineKeyboardButton("English 🇬🇧", callback_data="lang_en"),
            InlineKeyboardButton("فارسی 🇮🇷", callback_data="lang_fa"),
        ],
        [
            InlineKeyboardButton("Español 🇪🇸", callback_data="lang_es"),
            InlineKeyboardButton("Français 🇫🇷", callback_data="lang_fr"),
        ],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    await message.reply_text(
        t("select_language"),
        reply_markup=reply_markup,
    )


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    message = update.effective_message
    if message is None:
        logger.warning("/help invoked without an effective message")
        return

    user = update.effective_user
    language = user.language_code or "en"
    t = get_translation(language)
    
    help_text = f"""
{t('help_title')}

{t('help_commands')}
/start - {t('start_description')}
/language - {t('language_description')}
/stats - {t('stats_description')}
/settings - {t('settings_description')}
/help - {t('help_description')}

{t('help_support')}
"""

    await message.reply_text(help_text, parse_mode="Markdown")


async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stats command."""
    message = update.effective_message
    if message is None:
        logger.warning("/stats invoked without an effective message")
        return

    user = update.effective_user
    language = user.language_code or "en"
    t = get_translation(language)
    
    # TODO: Fetch user stats from database
    stats_text = f"""
{t('stats_title')} 📊

{t('stats_coming_soon')}
"""

    await message.reply_text(stats_text, parse_mode="Markdown")


async def settings_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /settings command."""
    message = update.effective_message
    if message is None:
        logger.warning("/settings invoked without an effective message")
        return

    user = update.effective_user
    language = user.language_code or "en"
    t = get_translation(language)
    
    keyboard = [
        [
            InlineKeyboardButton(f"{t('language')} 🌍", callback_data="settings_language"),
        ],
        [
            InlineKeyboardButton(f"{t('notifications')} 🔔", callback_data="settings_notifications"),
        ],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await message.reply_text(
        t("settings_title"),
        reply_markup=reply_markup,
    )


async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle callback queries from inline buttons."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user = update.effective_user
    language = user.language_code or "en"
    t = get_translation(language)
    
    if data == "play_anonymous":
        # TODO: Add to matchmaking pool
        await query.edit_message_text(t("joining_matchmaking"))
        
    elif data == "play_group":
        # TODO: Show group selection
        await query.edit_message_text(t("select_group"))
        
    elif data.startswith("lang_"):
        lang_code = data.split("_")[1]
        # TODO: Update user language in database
        await query.edit_message_text(t("language_updated", lang=lang_code))
        
    elif data == "how_to_play":
        await query.edit_message_text(t("how_to_play_text"))
        
    elif data == "settings":
        await settings_handler(update, context)
