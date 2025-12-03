"""Wallet menu flows."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.states.user_states import UserState
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import AsyncSessionLocal
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import CurrencyType, Transaction
from telegram_poker_bot.shared.services import wallet_service

logger = get_logger(__name__)
settings = get_settings()


def wallet_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    get_text("deposit_button", lang), callback_data="wallet_deposit"
                ),
                InlineKeyboardButton(
                    get_text("withdraw_button", lang), callback_data="wallet_withdraw"
                ),
            ],
            [
                InlineKeyboardButton(
                    get_text("history_button", lang),
                    callback_data="wallet_history",
                )
            ],
            [
                InlineKeyboardButton(
                    get_text("back", lang), callback_data="main_menu"
                )
            ],
        ]
    )


async def send_wallet_menu(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    lang: str,
    balances: Dict[str, int],
) -> int:
    target = update.callback_query.message if update.callback_query else update.effective_message
    if not target:
        return UserState.MAIN_MENU
    await target.reply_text(
        f"{get_text('wallet_menu', lang)}\n{get_text('balance_line', lang, real_chips=balances.get('balance_real', 0), play_chips=balances.get('balance_play', 0))}",
        reply_markup=wallet_keyboard(lang),
    )
    return UserState.WALLET_MENU


async def handle_wallet_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE, lang: str, user_id: int
) -> int:
    query = update.callback_query
    if query:
        await query.answer()
    data = query.data if query else ""

    async with AsyncSessionLocal() as session:
        balances = await wallet_service.get_balances(session, user_id)
        await session.commit()

    if data == "wallet_deposit":
        await _send_deposit_info(update, lang)
        return UserState.WALLET_MENU

    if data == "wallet_withdraw":
        if balances.get("balance_real", 0) <= 0:
            await _reply(update, get_text("withdraw_insufficient", lang), lang)
            return UserState.WALLET_MENU
        context.user_data["withdraw_context"] = {
            "balance": balances.get("balance_real", 0),
            "user_id": user_id,
            "lang": lang,
        }
        await _reply(update, get_text("withdraw_amount", lang), lang)
        return UserState.WITHDRAW_AMOUNT

    if data == "wallet_history":
        await _send_history(update, lang, user_id)
        return UserState.WALLET_MENU

    return UserState.WALLET_MENU


async def handle_withdraw_amount(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    message = update.effective_message
    data = context.user_data.get("withdraw_context") or {}
    lang = data.get("lang", "en")
    if not message or not message.text or not data:
        return UserState.WALLET_MENU
    try:
        amount = int(message.text.strip())
    except ValueError:
        await message.reply_text(get_text("withdraw_amount", lang))
        return UserState.WITHDRAW_AMOUNT
    if amount <= 0 or amount > data.get("balance", 0):
        await message.reply_text(get_text("withdraw_amount", lang))
        return UserState.WITHDRAW_AMOUNT
    data["amount"] = amount
    context.user_data["withdraw_context"] = data
    await message.reply_text(get_text("withdraw_destination", lang))
    return UserState.WITHDRAW_DESTINATION


async def handle_withdraw_destination(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    message = update.effective_message
    data = context.user_data.get("withdraw_context") or {}
    lang = data.get("lang", "en")
    if not message or not message.text or not data:
        return UserState.MAIN_MENU
    destination = message.text.strip()
    amount = data.get("amount")
    user_id = data.get("user_id")
    context.user_data.pop("withdraw_context", None)
    admin_chat = os.getenv("ADMIN_CHAT_ID") or settings.admin_chat_id
    if admin_chat:
        try:
            await context.bot.send_message(
                chat_id=int(admin_chat),
                text=(
                    f"Withdraw Request\nUser ID: {user_id}\nAmount: {amount}\n"
                    f"Destination: {destination}"
                ),
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to notify admin of withdraw", error=str(exc))

    await message.reply_text(get_text("withdraw_submitted", lang))
    return UserState.MAIN_MENU


async def _send_history(update: Update, lang: str, user_id: int) -> None:
    async with AsyncSessionLocal() as session:
        txs = await wallet_service.get_transaction_history(session, user_id, limit=5)
        await session.commit()

    if not txs:
        await _reply(update, f"{get_text('history_title', lang)}\n{get_text('history_empty', lang)}", lang)
        return

    lines = [get_text("history_title", lang)]
    for tx in txs:
        currency_label = "chips" if tx.currency_type == CurrencyType.REAL else "play"
        direction = "+" if tx.amount >= 0 else "-"
        timestamp = tx.created_at.strftime("%Y-%m-%d") if getattr(tx, "created_at", None) else ""
        lines.append(
            f"{timestamp}: {direction}{abs(tx.amount):,} {currency_label} ({tx.type.value})"
        )
    await _reply(update, "\n".join(lines), lang)


async def _send_deposit_info(update: Update, lang: str) -> None:
    admin_chat = os.getenv("ADMIN_CHAT_ID") or settings.admin_chat_id
    if admin_chat:
        url = f"https://t.me/{settings.bot_username_clean}"
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton(get_text("contact_admin", lang), url=url)]]
        )
    else:
        keyboard = None
    await _reply(
        update,
        get_text("deposit_info", lang),
        lang,
        reply_markup=keyboard,
    )


async def _reply(
    update: Update,
    text: str,
    lang: str,
    reply_markup: Optional[InlineKeyboardMarkup] = None,
) -> None:
    target = update.callback_query.message if update.callback_query else update.effective_message
    if target:
        await target.reply_text(text, reply_markup=reply_markup)
