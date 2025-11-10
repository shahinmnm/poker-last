"""Telegram bot command handlers."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.constants import ChatType
from telegram.ext import ContextTypes

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import AsyncSessionLocal
from telegram_poker_bot.shared.models import User, Group, GroupGameInviteStatus
from telegram_poker_bot.shared.services.group_invites import (
    fetch_invite_by_game_id,
    attach_group_to_invite,
)
from telegram_poker_bot.bot.i18n import get_translation

settings = get_settings()
logger = get_logger(__name__)


def sanitize_language(code: str | None) -> str:
    """Normalize Telegram language codes."""
    if not code:
        return "en"
    return code.split("-")[0].lower()


def build_startapp_link(game_id: str) -> str:
    """Build mini-app deep link with start parameter."""
    return f"https://t.me/{settings.bot_username_clean}?startapp={game_id}"


def build_register_link() -> str:
    """Deep link prompting the user to register via private chat."""
    return f"https://t.me/{settings.bot_username_clean}?start=register"


async def find_user_by_tg_id(session: AsyncSession, tg_user_id: int) -> User | None:
    """Fetch user entity by Telegram id."""
    result = await session.execute(select(User).where(User.tg_user_id == tg_user_id))
    return result.scalar_one_or_none()


async def ensure_group_record(session: AsyncSession, chat) -> Group:
    """Ensure a database record exists for the Telegram group."""
    result = await session.execute(select(Group).where(Group.tg_chat_id == chat.id))
    group = result.scalar_one_or_none()
    title = getattr(chat, "title", None)
    chat_type = getattr(chat, "type", "group")

    if group:
        updated = False
        if title and group.title != title:
            group.title = title
            updated = True
        if chat_type and group.type != chat_type:
            group.type = chat_type
            updated = True
        if updated:
            await session.flush()
        return group

    group = Group(
        tg_chat_id=chat.id,
        title=title,
        type=chat_type,
    )
    session.add(group)
    await session.flush()
    return group


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
    language = sanitize_language(user.language_code)
    
    # Get translations
    t = get_translation(language)

    args = getattr(context, "args", None) or []
    if args and args[0].lower() == "register":
        await message.reply_text(t("group_invite_register_confirm"))
    
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


async def start_group_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /startgroup deep links for group games."""
    message = update.effective_message
    chat = update.effective_chat
    user = update.effective_user

    if message is None or chat is None or user is None:
        logger.warning("/startgroup invoked without full context")
        return

    language = sanitize_language(user.language_code)
    t = get_translation(language)

    args = getattr(context, "args", None) or []
    game_id = args[0] if args else None
    if not game_id and message.text:
        parts = message.text.split()
        if len(parts) > 1:
            game_id = parts[1].strip()

    if not game_id:
        await message.reply_text(t("group_invite_missing_id"))
        return

    if chat.type == ChatType.PRIVATE:
        await message.reply_text(t("group_invite_use_in_group"))
        return

    async with AsyncSessionLocal() as session:
        try:
            invite = await fetch_invite_by_game_id(session, game_id)
            if not invite:
                await message.reply_text(t("group_invite_not_found"))
                await session.rollback()
                return

            if invite.status == GroupGameInviteStatus.EXPIRED:
                await message.reply_text(t("group_invite_expired"))
                await session.rollback()
                return

            if invite.status == GroupGameInviteStatus.CONSUMED:
                await message.reply_text(t("group_invite_consumed"))
                await session.rollback()
                return

            db_user = await find_user_by_tg_id(session, user.id)
            if not db_user:
                register_keyboard = InlineKeyboardMarkup(
                    [
                        [
                            InlineKeyboardButton(
                                t("group_invite_register_button"), url=build_register_link()
                            )
                        ]
                    ]
                )
                await message.reply_text(
                    t("group_invite_registration_required"), reply_markup=register_keyboard
                )
                await session.rollback()
                return

            group_record = await ensure_group_record(session, chat)
            if invite.group_id and invite.group_id != group_record.id:
                await message.reply_text(t("group_invite_already_linked"))
                await session.rollback()
                return

            await attach_group_to_invite(session, invite=invite, group=group_record)
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error(
                "Failed to handle startgroup command",
                error=str(exc),
                chat_id=chat.id,
                game_id=game_id,
            )
            await message.reply_text(t("group_invite_error"))
            return

    group_title = chat.title or t("group_invite_unknown_group")
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(t("group_invite_group_button"), url=build_startapp_link(game_id))]]
    )
    await message.reply_text(
        t("group_invite_group_ready", title=group_title),
        reply_markup=keyboard,
    )


async def language_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /language command."""
    message = update.effective_message
    if message is None:
        logger.warning("/language invoked without an effective message")
        return

    user = update.effective_user
    language = sanitize_language(user.language_code)
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
    language = sanitize_language(user.language_code)
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
    language = sanitize_language(user.language_code)
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
    language = sanitize_language(user.language_code)
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
