"""User-facing menus and flows."""

from __future__ import annotations

import os
from typing import Optional

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from telegram_poker_bot.bot.handlers import referral as referral_helpers
from telegram_poker_bot.bot.handlers.wallet import (
    handle_wallet_selection,
    handle_withdraw_amount,
    handle_withdraw_destination,
    send_wallet_menu,
    wallet_keyboard,
)
from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.states.user_states import UserState
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import AsyncSessionLocal
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import CurrencyType, User
from telegram_poker_bot.shared.services import promo_service, referral_service, user_service, wallet_service

logger = get_logger(__name__)
settings = get_settings()


async def _find_user_by_tg(session, tg_user_id: int) -> Optional[User]:
    result = await session.execute(select(User).where(User.tg_user_id == tg_user_id))
    return result.scalar_one_or_none()


def _language_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("🇬🇧 English", callback_data="user_lang_en"),
                InlineKeyboardButton("🇮🇷 فارسی", callback_data="user_lang_fa"),
            ]
        ]
    )


def _main_keyboard(lang: str, is_private: bool) -> InlineKeyboardMarkup:
    webapp_url = f"{settings.mini_app_url}?start=1"
    play_button = InlineKeyboardButton(
        get_text("play_poker", lang),
        web_app=WebAppInfo(url=webapp_url) if is_private else None,
        url=webapp_url if not is_private else None,
    )
    return InlineKeyboardMarkup(
        [
            [play_button],
            [
                InlineKeyboardButton(
                    get_text("wallet", lang), callback_data="menu_wallet"
                ),
                InlineKeyboardButton(
                    get_text("profile", lang), callback_data="menu_profile"
                ),
            ],
            [
                InlineKeyboardButton(
                    get_text("promotions", lang), callback_data="menu_promotions"
                ),
                InlineKeyboardButton(
                    get_text("invite", lang), callback_data="menu_invite"
                ),
            ],
            [
                InlineKeyboardButton(
                    get_text("settings", lang), callback_data="menu_settings"
                ),
                InlineKeyboardButton(
                    get_text("support", lang), callback_data="menu_support"
                ),
            ],
        ]
    )


async def _get_or_create_user(
    session, update: Update, lang: str, ref_code: Optional[str]
) -> User:
    tg_user = update.effective_user
    if not tg_user:
        raise ValueError("No Telegram user found")
    result = await session.execute(select(User).where(User.tg_user_id == tg_user.id))
    user = result.scalar_one_or_none()
    if user:
        if not user.language:
            user.language = lang
        return user

    referrer = None
    if ref_code:
        referrer = await referral_service.find_user_by_referral_code(session, ref_code)

    user = User(
        tg_user_id=tg_user.id,
        username=tg_user.username,
        language=lang or "en",
        referrer_id=referrer.id if referrer else None,
    )
    session.add(user)
    await session.flush()
    await referral_service.ensure_referral_code(session, user)
    if referrer:
        await referral_service.record_referral(session, referrer.id)
    return user


async def _ensure_code_and_balances(session, user: User):
    db_user = user
    if not getattr(user, "_sa_instance_state", None) or user not in session:
        db_user = await session.get(User, user.id)
    await referral_service.ensure_referral_code(session, db_user)
    balances = await wallet_service.get_balances(session, db_user.id)
    await session.commit()
    return balances


async def start_command(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Entry point for /start."""
    if not update.effective_user:
        return ConversationHandler.END
    args = getattr(context, "args", []) or []
    ref_code = args[0] if args else None
    if ref_code and ref_code.lower().startswith("ref_"):
        ref_code = ref_code[4:]
    context.user_data["pending_ref"] = ref_code

    tg_user = update.effective_user
    lang = (tg_user.language_code or "en").split("-")[0].lower() if tg_user else "en"

    async with AsyncSessionLocal() as session:
        db_user = await _find_user_by_tg(session, tg_user.id) if tg_user else None
        if db_user:
            if not db_user.language:
                db_user.language = lang
            balances = await _ensure_code_and_balances(session, db_user)
            return await _send_main_menu(update, db_user, balances, db_user.language)

    message = update.effective_message
    if message:
        await message.reply_text(
            get_text("welcome_new", lang),
            reply_markup=_language_keyboard(),
        )
    return UserState.CHOOSE_LANGUAGE


async def _send_main_menu(
    update: Update, user: User, balances: dict, lang: str
) -> int:
    chat = update.effective_chat
    is_private = chat and chat.type == "private"
    text = "\n".join(
        [
            get_text("welcome_back", lang, name=referral_helpers.display_name(user)),
            get_text(
                "balance_line",
                lang,
                real_chips=balances.get("balance_real", 0),
                play_chips=balances.get("balance_play", 0),
            ),
            get_text("status_ready", lang),
        ]
    )
    target = update.callback_query.message if update.callback_query else update.effective_message
    if target:
        await target.reply_text(text, reply_markup=_main_keyboard(lang, bool(is_private)))
    return UserState.MAIN_MENU


async def handle_language_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Handle language choice and user creation."""
    query = update.callback_query
    if query:
        await query.answer()
    data = query.data if query else ""
    lang = "en" if data.endswith("en") else "fa"
    tg_user = update.effective_user
    if not tg_user:
        return ConversationHandler.END

    ref_code = context.user_data.get("pending_ref")

    async with AsyncSessionLocal() as session:
        user = await _get_or_create_user(session, update, lang, ref_code)
        await session.commit()

    context.user_data.pop("pending_ref", None)
    async with AsyncSessionLocal() as session:
        balances = await _ensure_code_and_balances(session, user)
    await query.edit_message_text(get_text("language_set", lang))
    return await _send_main_menu(update, user, balances, lang)


async def handle_menu_callbacks(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Dispatch main menu callbacks."""
    query = update.callback_query
    if query:
        await query.answer()
    data = query.data if query else ""
    async with AsyncSessionLocal() as session:
        user = await _find_user_by_tg(session, update.effective_user.id)  # type: ignore[arg-type]
        if not user:
            return ConversationHandler.END
        lang = user.language or "en"

        if data == "menu_wallet":
            balances = await wallet_service.get_balances(session, user.id)
            await session.commit()
            return await send_wallet_menu(update, context, lang=lang, balances=balances)

        if data == "menu_profile":
            await _send_profile(update, session, user, lang)
            await session.commit()
            return UserState.MAIN_MENU

        if data == "menu_promotions":
            await _prompt_promo(update, lang)
            return UserState.PROMO_CODE

        if data == "menu_invite":
            await _send_invite(update, session, user, lang)
            await session.commit()
            return UserState.MAIN_MENU

        if data == "menu_settings":
            target = query.message
            if target:
                await target.reply_text(
                    get_text("choose_language", lang), reply_markup=_language_keyboard()
                )
            return UserState.CHOOSE_LANGUAGE

        if data == "menu_support":
            await _send_support(update, lang)
            await session.commit()
            return UserState.MAIN_MENU

        if data == "main_menu":
            balances = await wallet_service.get_balances(session, user.id)
            await session.commit()
            return await _send_main_menu(update, user, balances, lang)

        # Wallet callbacks forwarded
        if data.startswith("wallet_"):
            state = await handle_wallet_selection(update, context, lang, user.id)
            await session.commit()
            return state

    return UserState.MAIN_MENU


async def _send_profile(update: Update, session, user: User, lang: str) -> None:
    stats = await user_service.get_user_stats_from_aggregated(session, user.id)
    balances = await wallet_service.get_balances(session, user.id)
    lines = [
        get_text("profile_title", lang),
        referral_helpers.display_name(user),
        get_text(
            "balance_line",
            lang,
            real_chips=balances.get("balance_real", 0),
            play_chips=balances.get("balance_play", 0),
        ),
        f"Hands: {stats.get('hands_played', 0):,}",
        f"Win Rate: {stats.get('win_rate', 0)}%",
    ]
    target = update.callback_query.message if update.callback_query else update.effective_message
    if target:
        await target.reply_text("\n".join(lines))


async def _prompt_promo(update: Update, lang: str) -> None:
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(get_text("back", lang), callback_data="main_menu")]]
    )
    target = update.callback_query.message if update.callback_query else update.effective_message
    if target:
        await target.reply_text(get_text("promo_prompt", lang), reply_markup=keyboard)


async def handle_promo_submission(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    message = update.effective_message
    if not message or not message.text:
        return UserState.MAIN_MENU
    async with AsyncSessionLocal() as session:
        user = await _find_user_by_tg(session, message.from_user.id)  # type: ignore[arg-type]
        if not user:
            return ConversationHandler.END
        lang = user.language or "en"
        success, reason, credited = await promo_service.redeem_promo_code(
            session, user_id=user.id, code=message.text.strip()
        )
        if success:
            await session.commit()
            balances = await wallet_service.get_balances(session, user.id)
            await message.reply_text(
                get_text("promo_success", lang, amount=credited),
            )
            return await _send_main_menu(update, user, balances, lang)
        await session.rollback()
        await message.reply_text(get_text("promo_invalid", lang))
        return UserState.MAIN_MENU


async def _send_invite(update: Update, session, user: User, lang: str) -> None:
    await referral_service.ensure_referral_code(session, user)
    stats = await referral_service.get_referral_stats(session, user.id)
    link = referral_helpers.build_referral_link(user.referral_code)
    lines = [
        get_text("invite_header", lang),
        f"{get_text('invite_link', lang)} {link}",
        get_text("invite_stats", lang, count=stats.get("invited_count", 0)),
    ]
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton(get_text("back", lang), callback_data="main_menu")],
        ]
    )
    target = update.callback_query.message if update.callback_query else update.effective_message
    if target:
        await target.reply_text("\n".join(lines), reply_markup=keyboard)


async def _send_support(update: Update, lang: str) -> None:
    admin_chat = os.getenv("ADMIN_CHAT_ID") or settings.admin_chat_id
    if admin_chat:
        url = f"https://t.me/{settings.bot_username_clean}"
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton(get_text("contact_admin", lang), url=url)]]
        )
    else:
        keyboard = None
    await _reply(update, get_text("support_text", lang), keyboard)


async def _reply(
    update: Update, text: str, reply_markup: Optional[InlineKeyboardMarkup] = None
) -> None:
    target = update.callback_query.message if update.callback_query else update.effective_message
    if target:
        await target.reply_text(text, reply_markup=reply_markup)


def build_user_menu_handler() -> ConversationHandler:
    """Conversation covering /start and menu interactions."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("start", start_command),
            CommandHandler("wallet", start_command),
            CommandHandler("support", start_command),
        ],
        states={
            UserState.CHOOSE_LANGUAGE: [
                CallbackQueryHandler(handle_language_selection, pattern="^user_lang_(en|fa)$"),
                CallbackQueryHandler(handle_menu_callbacks, pattern="^main_menu$"),
            ],
            UserState.MAIN_MENU: [
                CallbackQueryHandler(handle_menu_callbacks, pattern="^(menu_|wallet_|main_menu)"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_promo_submission),
            ],
            UserState.WALLET_MENU: [
                CallbackQueryHandler(handle_menu_callbacks, pattern="^(wallet_|main_menu|menu_)"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_promo_submission),
            ],
            UserState.WITHDRAW_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_withdraw_amount),
                CallbackQueryHandler(handle_menu_callbacks, pattern="^main_menu$"),
            ],
            UserState.WITHDRAW_DESTINATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_withdraw_destination),
                CallbackQueryHandler(handle_menu_callbacks, pattern="^main_menu$"),
            ],
            UserState.PROMO_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_promo_submission),
                CallbackQueryHandler(handle_menu_callbacks, pattern="^main_menu$"),
            ],
        },
        fallbacks=[CommandHandler("start", start_command)],
        per_chat=True,
    )


def register_user_handlers(application: Application) -> None:
    application.add_handler(build_user_menu_handler())
