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
    - Handles deep link payloads for table invites
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

    # Check for deep link payload (game_id from invite link)
    args = getattr(context, "args", None) or []

    # Handle special payloads
    if args and args[0].lower() == "register":
        # Registration confirmation
        await message.reply_text(t("group_invite_register_confirm"))
    elif args and args[0] not in ["register", "1"]:
        # This might be a game_id from an invite link
        game_id = args[0]

        async with AsyncSessionLocal() as session:
            try:
                from telegram_poker_bot.shared.services.group_invites import (
                    fetch_invite_by_game_id,
                )
                from telegram_poker_bot.shared.services import table_service

                invite = await fetch_invite_by_game_id(session, game_id)

                if invite and invite.status not in [
                    GroupGameInviteStatus.EXPIRED,
                    GroupGameInviteStatus.CONSUMED,
                ]:
                    # Get table info
                    table_id = invite.metadata_json.get("table_id")
                    if table_id:
                        table_info = await table_service.get_table_info(
                            session, table_id
                        )

                        table_name = table_info.get("table_name", f"Table #{table_id}")
                        players = table_info.get("player_count", 0)
                        max_players = table_info.get("max_players", 8)
                        stakes = f"{table_info.get('small_blind', 25)}/{table_info.get('big_blind', 50)}"

                        # Show table info and sit button
                        welcome_text = f"""
🎴 **{t('welcome_title')}**

You've been invited to join a poker table:

**{table_name}**
👥 Players: {players}/{max_players}
💰 Stakes (SB/BB): {stakes}
🎰 Starting stack: {table_info.get('starting_stack', 10000)} chips

Tap "Sit at Table" below to join!
"""

                        keyboard = [
                            [
                                InlineKeyboardButton(
                                    f"{t('group_invite_group_button')} 🪑",
                                    url=build_startapp_link(game_id),
                                ),
                            ],
                            [
                                InlineKeyboardButton(
                                    f"{t('open_mini_app')} 🎮",
                                    web_app=(
                                        WebAppInfo(
                                            url=f"{settings.mini_app_url}?startapp={game_id}"
                                        )
                                        if is_private_chat
                                        else None
                                    ),
                                    url=(
                                        f"{settings.mini_app_url}?startapp={game_id}"
                                        if not is_private_chat
                                        else None
                                    ),
                                ),
                            ],
                        ]

                        reply_markup = InlineKeyboardMarkup(keyboard)
                        await message.reply_text(
                            welcome_text,
                            reply_markup=reply_markup,
                            parse_mode="Markdown",
                        )
                        return
            except Exception as e:
                logger.error(
                    "Error fetching invite in start handler",
                    error=str(e),
                    game_id=game_id,
                )

    # Default welcome flow
    # Create Mini App URL
    webapp_url = f"{settings.mini_app_url}?start=1"

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
                                t("group_invite_register_button"),
                                url=build_register_link(),
                            )
                        ]
                    ]
                )
                await message.reply_text(
                    t("group_invite_registration_required"),
                    reply_markup=register_keyboard,
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
        [
            [
                InlineKeyboardButton(
                    t("group_invite_group_button"), url=build_startapp_link(game_id)
                )
            ]
        ]
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
/profile - {t('profile_description')}
/stats - {t('stats_description')}
/tables - {t('tables_description')}
/wallet - {t('wallet_description')}
/language - {t('language_description')}
/settings - {t('settings_description')}
/help - {t('help_description')}

{t('help_support')}
"""

    await message.reply_text(help_text, parse_mode="Markdown")


async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stats command - shows real user statistics."""
    message = update.effective_message
    if message is None:
        logger.warning("/stats invoked without an effective message")
        return

    user = update.effective_user
    language = sanitize_language(user.language_code)
    t = get_translation(language)

    async with AsyncSessionLocal() as session:
        try:
            from telegram_poker_bot.shared.services import user_service

            db_user = await find_user_by_tg_id(session, user.id)
            if not db_user:
                await message.reply_text(t("group_invite_registration_required"))
                return

            stats = await user_service.get_user_stats(session, db_user.id)

            if stats["hands_played"] == 0:
                stats_text = f"{t('stats_title')} 📊\n\n{t('profile_no_stats')}"
            else:
                stats_text = f"""
{t('stats_title')} 📊

{t('stats_hands_played', count=stats['hands_played'])}
{t('stats_tables_played', count=stats['tables_played'])}
{t('stats_total_profit', amount=stats['total_profit'])}
{t('stats_win_rate', rate=stats['win_rate'])}
{t('stats_biggest_pot', amount=stats['biggest_pot'])}
"""

            await message.reply_text(stats_text, parse_mode="Markdown")
        except Exception as e:
            logger.error("Error fetching stats", error=str(e), user_id=user.id)
            await message.reply_text(t("group_invite_error"))


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
            InlineKeyboardButton(
                f"{t('language')} 🌍", callback_data="settings_language"
            ),
        ],
        [
            InlineKeyboardButton(
                f"{t('notifications')} 🔔", callback_data="settings_notifications"
            ),
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


async def profile_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /profile command - shows user profile and stats."""
    message = update.effective_message
    if message is None:
        logger.warning("/profile invoked without an effective message")
        return

    user = update.effective_user
    language = sanitize_language(user.language_code)
    t = get_translation(language)

    async with AsyncSessionLocal() as session:
        try:
            from telegram_poker_bot.shared.services import user_service

            db_user = await find_user_by_tg_id(session, user.id)
            if not db_user:
                await message.reply_text(t("group_invite_registration_required"))
                return

            from telegram_poker_bot.shared.services import wallet_service

            stats = await user_service.get_user_stats(session, db_user.id)
            balance = await wallet_service.get_wallet_balance(session, db_user.id)
            active_tables = await user_service.get_active_tables(session, db_user.id)

            profile_text = f"""
{t('profile_title')}

👤 {user.first_name or user.username}
{t('profile_balance', balance=balance)}
{t('profile_active_tables', count=len(active_tables))}

📊 **Stats:**
{t('stats_hands_played', count=stats['hands_played'])}
{t('stats_tables_played', count=stats['tables_played'])}
{t('stats_total_profit', amount=stats['total_profit'])}
"""

            await message.reply_text(profile_text, parse_mode="Markdown")
        except Exception as e:
            logger.error("Error fetching profile", error=str(e), user_id=user.id)
            await message.reply_text(t("group_invite_error"))


async def tables_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /tables command - shows user's active tables."""
    message = update.effective_message
    if message is None:
        logger.warning("/tables invoked without an effective message")
        return

    user = update.effective_user
    language = sanitize_language(user.language_code)
    t = get_translation(language)

    async with AsyncSessionLocal() as session:
        try:
            from telegram_poker_bot.shared.services import user_service

            db_user = await find_user_by_tg_id(session, user.id)
            if not db_user:
                await message.reply_text(t("group_invite_registration_required"))
                return

            active_tables = await user_service.get_active_tables(session, db_user.id)

            if not active_tables:
                await message.reply_text(
                    f"{t('table_list_title')}\n\n{t('table_list_empty')}"
                )
                return

            tables_text = f"{t('table_list_title')}\n\n"
            for table in active_tables:
                tables_text += (
                    t(
                        "table_info",
                        id=table["table_id"],
                        mode=table["mode"],
                        players=table["player_count"],
                        max_players=table["max_players"],
                        sb=table["small_blind"],
                        bb=table["big_blind"],
                    )
                    + "\n"
                )

            await message.reply_text(tables_text, parse_mode="Markdown")
        except Exception as e:
            logger.error("Error fetching tables", error=str(e), user_id=user.id)
            await message.reply_text(t("group_invite_error"))


async def wallet_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /wallet command - shows user's chip balance."""
    message = update.effective_message
    if message is None:
        logger.warning("/wallet invoked without an effective message")
        return

    user = update.effective_user
    language = sanitize_language(user.language_code)
    t = get_translation(language)

    async with AsyncSessionLocal() as session:
        try:
            from telegram_poker_bot.shared.services import wallet_service

            db_user = await find_user_by_tg_id(session, user.id)
            if not db_user:
                await message.reply_text(t("group_invite_registration_required"))
                return

            # Ensure wallet exists
            await wallet_service.ensure_wallet(session, db_user.id)
            await session.commit()

            balance = await wallet_service.get_wallet_balance(session, db_user.id)

            wallet_text = f"""
{t('wallet_title')}

{t('wallet_balance', balance=balance)}

{t('wallet_no_transactions')}
"""

            await message.reply_text(wallet_text, parse_mode="Markdown")
        except Exception as e:
            logger.error("Error fetching wallet", error=str(e), user_id=user.id)
            await message.reply_text(t("group_invite_error"))
