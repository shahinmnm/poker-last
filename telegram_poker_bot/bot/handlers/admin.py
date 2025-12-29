"""Admin control room handlers for treasury and live ops."""

from __future__ import annotations

import os
import aiohttp
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from telegram_poker_bot.bot.utils.helpers import safe_answer_callback_query
from telegram_poker_bot.bot.states.admin_states import AdminState
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import AsyncSessionLocal
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    CurrencyType,
    GameVariant,
    Hand,
    Seat,
    Table,
    TableStatus,
    TransactionType,
    User,
)
from telegram_poker_bot.shared.auth_models import UserRole
from telegram_poker_bot.shared.services.jwt_auth_service import get_jwt_auth_service
from telegram_poker_bot.shared.services.table_service import (
    get_table_game_variant,
    get_template_config,
)
from telegram_poker_bot.shared.services import (
    promo_service,
    user_service,
    wallet_service,
)

logger = get_logger(__name__)
settings = get_settings()


def _admin_chat_id() -> Optional[int]:
    """Resolve admin chat id from environment or settings."""
    raw = os.getenv("ADMIN_CHAT_ID") or settings.admin_chat_id
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid ADMIN_CHAT_ID value", raw_value=raw)
        return None


def _is_admin(update: Update) -> bool:
    """Check whether the update is from the configured admin."""
    admin_id = _admin_chat_id()
    user = update.effective_user
    return bool(admin_id and user and user.id == admin_id)


async def _ensure_admin_role(tg_user_id: int) -> None:
    """Ensure the admin user has ADMIN role in the database for web access."""
    async with AsyncSessionLocal() as session:
        try:
            # Find user by Telegram user ID
            result = await session.execute(
                select(User).where(User.tg_user_id == tg_user_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                logger.warning(
                    "Admin user not found in database",
                    tg_user_id=tg_user_id,
                )
                return

            # Check if user already has ADMIN role
            jwt_service = get_jwt_auth_service()
            has_admin = await jwt_service.has_role(session, user.id, UserRole.ADMIN)

            if not has_admin:
                # Assign ADMIN role
                await jwt_service.assign_role(
                    session,
                    user.id,
                    UserRole.ADMIN,
                    granted_by=None,  # System-granted
                )
                logger.info(
                    "Admin role assigned to user",
                    user_id=user.id,
                    tg_user_id=tg_user_id,
                )

            # Commit only if we made changes
            if not has_admin:
                await session.commit()

        except Exception as exc:
            await session.rollback()
            logger.error(
                "Failed to ensure admin role",
                tg_user_id=tg_user_id,
                error=str(exc),
            )


async def _generate_admin_link(admin_chat_id: int) -> Optional[Dict[str, Any]]:
    """Generate a one-time admin panel link via the API.
    
    Args:
        admin_chat_id: Telegram chat ID of the admin
        
    Returns:
        Dict with token info if successful, None if failed
    """
    api_base = settings.vite_api_url or f"{settings.public_base_url}/api"
    url = f"{api_base}/admin/session-token"
    
    headers = {}
    if settings.internal_api_key:
        headers["X-Internal-API-Key"] = settings.internal_api_key
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"admin_chat_id": admin_chat_id},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    logger.error(
                        "Failed to generate admin token",
                        status=response.status,
                        error=error_text,
                    )
                    return None
    except Exception as exc:
        logger.error(
            "Error calling admin session-token API",
            error=str(exc),
        )
        return None


def _admin_menu_keyboard(one_time_url: Optional[str] = None) -> InlineKeyboardMarkup:
    """Build admin menu keyboard with web access button.
    
    Args:
        one_time_url: Optional one-time URL for secure web access.
                     If None, web panel button is replaced with "Generate new link" button.
    
    SECURITY: Never falls back to a static admin URL. Only generated one-time links are used.
    """
    rows = []
    
    if one_time_url:
        # Web panel button with secure one-time URL
        rows.append([
            InlineKeyboardButton("🌐 Web Admin Panel", url=one_time_url),
        ])
    
    # Always include "Generate new link" button for refreshing the secure link
    rows.append([
        InlineKeyboardButton("🔄 Generate New Link", callback_data="admin_generate_link"),
    ])
    
    rows.extend([
        [
            InlineKeyboardButton("🏦 Treasury", callback_data="admin_treasury"),
            InlineKeyboardButton("🛠 User Desk", callback_data="admin_intel"),
        ],
        [
            InlineKeyboardButton(
                "👀 Active Tables", callback_data="admin_live_ops"
            ),
            InlineKeyboardButton("📊 Snapshot", callback_data="admin_intel_stats"),
        ],
        [
            InlineKeyboardButton("👥 Users", callback_data="admin_crm"),
            InlineKeyboardButton("📢 Marketing", callback_data="admin_marketing"),
        ],
        [InlineKeyboardButton("❌ Close", callback_data="admin_close")],
    ])

    return InlineKeyboardMarkup(rows)


def _admin_home_button() -> List[InlineKeyboardButton]:
    """Create a standard Admin Menu button."""
    return [InlineKeyboardButton("🏠 Admin Menu", callback_data="admin_home")]


def _back_button(callback_data: str) -> List[InlineKeyboardButton]:
    """Create a standard Back button."""
    return [InlineKeyboardButton("🔙 Back", callback_data=callback_data)]


def _intel_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "🪪 Lookup ID ↔ Username", callback_data="admin_intel_lookup"
                )
            ],
            [
                InlineKeyboardButton(
                    "💰 Check Balances", callback_data="admin_intel_balance"
                )
            ],
            [
                InlineKeyboardButton(
                    "📈 User Snapshot", callback_data="admin_intel_stats"
                )
            ],
            _admin_home_button(),
        ]
    )


def _treasury_operation_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "📥 Deposit", callback_data="admin_operation_deposit"
                )
            ],
            [
                InlineKeyboardButton(
                    "📤 Withdraw", callback_data="admin_operation_withdraw"
                )
            ],
            _back_button("admin_operation_back"),
        ]
    )


def _treasury_currency_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "💵 Real Money (Chips)", callback_data="admin_currency_real"
                )
            ],
            [
                InlineKeyboardButton(
                    "🪙 Play Money", callback_data="admin_currency_play"
                )
            ],
            _back_button("admin_currency_back"),
        ]
    )


def _confirmation_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("✅ Yes", callback_data="admin_confirm_yes"),
                InlineKeyboardButton("❌ No", callback_data="admin_confirm_no"),
            ]
        ]
    )


def _live_ops_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔄 Refresh", callback_data="admin_live_ops")],
            _admin_home_button(),
        ]
    )


def _intel_result_keyboard(
    *, repeat_action: str, include_stats: bool = True
) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton("🔁 Again", callback_data=repeat_action)],
        [InlineKeyboardButton("🛠 User Desk", callback_data="admin_intel_menu")],
    ]
    if include_stats:
        buttons.insert(
            0,
            [InlineKeyboardButton("📈 Snapshot", callback_data="admin_intel_stats")],
        )
    buttons.append(_admin_home_button())
    return InlineKeyboardMarkup(buttons)


def _crm_keyboard(user_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "🚫 Ban/Unban", callback_data=f"admin_crm_ban:{user_id}"
                ),
                InlineKeyboardButton(
                    "✉️ Send Message", callback_data=f"admin_crm_message:{user_id}"
                ),
            ],
            [
                InlineKeyboardButton(
                    "✏️ Edit Balance", callback_data=f"admin_crm_balance:{user_id}"
                ),
            ],
            [InlineKeyboardButton("🛠 User Desk", callback_data="admin_intel_menu")],
            _admin_home_button(),
        ]
    )


def _marketing_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "➕ Create Promo Code", callback_data="admin_marketing_promo"
                ),
            ],
            [
                InlineKeyboardButton(
                    "📣 Broadcast", callback_data="admin_marketing_broadcast"
                ),
            ],
            _admin_home_button(),
        ]
    )


def _currency_selection_keyboard() -> InlineKeyboardMarkup:
    """Create a keyboard for selecting currency (Real or Play)."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "💵 Real", callback_data="admin_balance_currency:REAL"
                ),
                InlineKeyboardButton(
                    "🪙 Play", callback_data="admin_balance_currency:PLAY"
                ),
            ],
            _back_button("admin_home"),
        ]
    )


def _promo_currency_keyboard() -> InlineKeyboardMarkup:
    """Create a keyboard for selecting promo currency (Real or Play)."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("💵 Real", callback_data="promo_currency:REAL"),
                InlineKeyboardButton("🪙 Play", callback_data="promo_currency:PLAY"),
            ]
        ]
    )


def _reset_admin_context(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Clear admin session data."""
    context.user_data.pop("admin_context", None)


def _get_admin_context(context: ContextTypes.DEFAULT_TYPE) -> Dict[str, Any]:
    ctx = context.user_data.get("admin_context")
    if ctx is None:
        ctx = {}
        context.user_data["admin_context"] = ctx
    return ctx


async def _send_admin_menu_with_link(
    update: Update,
    *,
    is_new_link: bool = False,
    reset_context: bool = False,
    context: Optional[ContextTypes.DEFAULT_TYPE] = None,
) -> int:
    """Generate admin link and send menu with proper messaging.
    
    Args:
        update: Telegram update
        is_new_link: If True, show "New link generated!" message
        reset_context: If True, reset admin conversation context
        context: Required if reset_context is True
        
    Returns:
        AdminState.MENU
    """
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
        target = query.message
    else:
        target = update.effective_message
    
    if reset_context and context:
        _reset_admin_context(context)
    
    # Generate a fresh one-time link
    user = update.effective_user
    one_time_url = None
    token_info = None
    if user:
        token_info = await _generate_admin_link(user.id)
        if token_info:
            one_time_url = token_info.get("enter_url")
    
    # Build message with link info
    if one_time_url and token_info:
        ttl = token_info.get("ttl_seconds", 120)
        if is_new_link:
            panel_message = (
                "♠️ Poker Admin Control Room\n\n"
                f"✅ New link generated!\n"
                f"🔐 Single-use link. Expires in {ttl // 60} minute(s).\n\n"
                "Pick a console below."
            )
        else:
            panel_message = (
                "♠️ Poker Admin Control Room\n\n"
                f"🔐 Single-use link. Expires in {ttl // 60} minute(s).\n\n"
                "Pick a console below."
            )
    else:
        if is_new_link:
            panel_message = (
                "♠️ Poker Admin Control Room\n\n"
                "❌ Failed to generate admin link.\n"
                "Please try again or check backend logs.\n\n"
                "Pick a console below."
            )
        else:
            panel_message = (
                "♠️ Poker Admin Control Room\n\n"
                "⚠️ Link generation failed. Click 'Generate New Link' to try again.\n\n"
                "Pick a console below."
            )
        logger.warning(
            "Admin link generation failed for user",
            user_id=user.id if user else None,
        )
    
    if target:
        await target.reply_text(
            panel_message, reply_markup=_admin_menu_keyboard(one_time_url)
        )
    return AdminState.MENU


async def go_home(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Return to the main admin menu."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    return await _send_admin_menu_with_link(
        update, is_new_link=False, reset_context=True, context=context
    )


async def handle_generate_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the 'Generate new link' button - generates a fresh one-time admin URL."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    return await _send_admin_menu_with_link(
        update, is_new_link=True, reset_context=False, context=context
    )


async def _handle_unauthorized(update: Update) -> int:
    """Reply with Unauthorized for non-admin users."""
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
        target = query.message
    else:
        target = update.effective_message

    if target:
        await target.reply_text("Unauthorized")
    return ConversationHandler.END


async def show_intel_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Show user intelligence tools menu."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
        target = query.message
    else:
        target = update.effective_message
    if target:
        await target.reply_text(
            "🛠 User Intelligence Desk", reply_markup=_intel_menu_keyboard()
        )
    return AdminState.INTEL_MENU


async def _resolve_user(session, identifier: str) -> Optional[User]:
    """Find user by id, tg_user_id, or username."""
    raw = (identifier or "").strip()
    if not raw:
        return None

    numeric_value: Optional[int] = None
    try:
        numeric_value = int(raw)
    except ValueError:
        numeric_value = None

    if numeric_value is not None:
        result = await session.execute(
            select(User).where(
                or_(User.id == numeric_value, User.tg_user_id == numeric_value)
            )
        )
        user = result.scalar_one_or_none()
        if user:
            return user

    username = raw.lstrip("@")
    if not username:
        return None

    result = await session.execute(
        select(User).where(func.lower(User.username) == username.lower())
    )
    return result.scalar_one_or_none()


async def _ensure_balances(session, user_id: int) -> Dict[str, int]:
    """Ensure wallet exists and return balances."""
    await wallet_service.ensure_wallet(session, user_id)
    balances = await wallet_service.get_balances(session, user_id)
    await session.commit()
    return balances


def _format_user_card(user: User, balances: Optional[Dict[str, int]] = None) -> str:
    """Pretty print user snapshot."""
    lines = [
        "🪪 **User Card**",
        f"ID: {user.id}",
        f"TG: {user.tg_user_id or '-'}",
        (
            f"Username: {_escape_md('@' + user.username)}"
            if user.username
            else "Username: -"
        ),
    ]
    if balances:
        lines.extend(
            [
                f"Real: {balances.get('balance_real', 0):,} chips",
                f"Play: {balances.get('balance_play', 0):,} play",
            ]
        )
    if getattr(user, "last_seen_at", None):
        lines.append(f"Last seen: {user.last_seen_at}")
    if getattr(user, "first_seen_at", None):
        lines.append(f"Joined: {user.first_seen_at}")
    return "\n".join(lines)


def _format_stats(stats: Dict[str, Any]) -> str:
    """Format compact stats for admins."""
    parts = [
        "📈 **User Snapshot**",
        f"Hands: {stats.get('hands_played', 0):,}",
        f"Tables: {stats.get('tables_played', 0):,}",
        f"Win Rate: {stats.get('win_rate', 0)}%",
        f"Total Profit: {stats.get('total_profit', 0):,}",
        f"Biggest Pot: {stats.get('biggest_pot', 0):,}",
    ]
    vpip = stats.get("vpip")
    pfr = stats.get("pfr")
    if vpip is not None:
        parts.append(f"VPIP: {vpip}%")
    if pfr is not None:
        parts.append(f"PFR: {pfr}%")
    return "\n".join(parts)


async def start_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point for /admin."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    _reset_admin_context(context)
    message = update.effective_message
    if not message:
        return ConversationHandler.END

    # Ensure admin user has ADMIN role in database for web access
    user = update.effective_user
    if user:
        await _ensure_admin_role(user.id)

    # Generate a one-time admin panel link
    one_time_url = None
    token_info = None
    if user:
        token_info = await _generate_admin_link(user.id)
        if token_info:
            one_time_url = token_info.get("enter_url")

    # Build the message with link expiry info
    # SECURITY: Never fallback to static URL if token generation fails
    if one_time_url and token_info:
        ttl = token_info.get("ttl_seconds", 120)
        panel_message = (
            "♠️ Poker Admin Control Room\n\n"
            f"🔐 Single-use link. Expires in {ttl // 60} minute(s).\n"
            "⚠️ Use 'Generate New Link' for a fresh link.\n\n"
            "Pick a console below."
        )
    else:
        # Token generation failed - show error without fallback to static URL
        panel_message = (
            "♠️ Poker Admin Control Room\n\n"
            "⚠️ Admin link generation failed.\n"
            "Click 'Generate New Link' to try again.\n"
            "If the problem persists, check backend logs.\n\n"
            "Pick a console below."
        )
        logger.warning(
            "Admin link generation failed for user",
            user_id=user.id if user else None,
        )

    await message.reply_text(
        panel_message,
        reply_markup=_admin_menu_keyboard(one_time_url),
    )
    return AdminState.MENU


async def handle_menu_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Handle top-level admin menu buttons."""
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    data = query.data if query else ""
    if data == "admin_home":
        return await go_home(update, context)

    if data == "admin_generate_link":
        return await handle_generate_link(update, context)

    if data == "admin_treasury":
        _reset_admin_context(context)
        await query.edit_message_text(
            "Select Operation:", reply_markup=_treasury_operation_keyboard()
        )
        return AdminState.TREASURY_OPERATION

    if data == "admin_live_ops":
        await show_live_ops(update, context)
        return AdminState.MENU

    if data in {"admin_intel", "admin_intel_menu", "admin_intel_stats"}:
        return await show_intel_menu(update, context)

    if data == "admin_crm":
        return await handle_crm_entry(update, context)

    if data == "admin_marketing":
        return await handle_marketing_menu(update, context)

    if data == "admin_close":
        _reset_admin_context(context)
        if query and query.message:
            await query.edit_message_text("Admin panel closed.")
        return ConversationHandler.END

    return AdminState.MENU


async def handle_operation_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Handle selecting deposit or withdraw."""
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    data = query.data if query else ""
    if data == "admin_operation_back":
        await query.edit_message_text(
            "♠️ Poker Admin Control Room", reply_markup=_admin_menu_keyboard()
        )
        return AdminState.MENU

    if data not in {"admin_operation_deposit", "admin_operation_withdraw"}:
        return AdminState.TREASURY_OPERATION

    admin_ctx = _get_admin_context(context)
    admin_ctx["operation"] = "deposit" if data.endswith("deposit") else "withdraw"
    admin_ctx.pop("currency", None)
    admin_ctx.pop("user", None)
    admin_ctx.pop("amount", None)

    await query.edit_message_text(
        "Select Currency:", reply_markup=_treasury_currency_keyboard()
    )
    return AdminState.TREASURY_CURRENCY


async def handle_currency_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Handle choosing currency for treasury action."""
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    data = query.data if query else ""
    if data == "admin_currency_back":
        await query.edit_message_text(
            "Select Operation:", reply_markup=_treasury_operation_keyboard()
        )
        return AdminState.TREASURY_OPERATION

    currency_map = {
        "admin_currency_real": CurrencyType.REAL,
        "admin_currency_play": CurrencyType.PLAY,
    }
    currency = currency_map.get(data)
    if currency is None:
        return AdminState.TREASURY_CURRENCY

    admin_ctx = _get_admin_context(context)
    admin_ctx["currency"] = currency
    admin_ctx.pop("user", None)
    admin_ctx.pop("amount", None)

    target = query.message or update.effective_message
    if target:
        await target.reply_text("Enter User ID:")
    return AdminState.WAITING_FOR_USER_ID


async def handle_user_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Capture and validate target user id."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    message = update.effective_message
    if not message:
        return AdminState.WAITING_FOR_USER_ID

    try:
        user_id = int(message.text.strip())
    except (TypeError, ValueError):
        await message.reply_text("Invalid user id. Please enter a numeric user id.")
        return AdminState.WAITING_FOR_USER_ID

    async with AsyncSessionLocal() as session:
        db_user = await session.get(User, user_id)
        if not db_user:
            await message.reply_text("User not found. Please enter a valid user id.")
            return AdminState.WAITING_FOR_USER_ID

    admin_ctx = _get_admin_context(context)
    admin_ctx["user"] = {
        "id": user_id,
        "username": db_user.username,
    }

    await message.reply_text("Enter Amount:")
    return AdminState.WAITING_FOR_AMOUNT


async def handle_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Capture and validate amount."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    message = update.effective_message
    if not message:
        return AdminState.WAITING_FOR_AMOUNT

    try:
        amount = int(message.text.strip())
    except (TypeError, ValueError):
        await message.reply_text("Invalid amount. Please enter a positive integer.")
        return AdminState.WAITING_FOR_AMOUNT

    if amount <= 0:
        await message.reply_text("Amount must be greater than zero.")
        return AdminState.WAITING_FOR_AMOUNT

    admin_ctx = _get_admin_context(context)
    if (
        "user" not in admin_ctx
        or "currency" not in admin_ctx
        or "operation" not in admin_ctx
    ):
        await message.reply_text("Session expired. Returning to admin menu.")
        _reset_admin_context(context)
        await message.reply_text(
            "♠️ Poker Admin Control Room", reply_markup=_admin_menu_keyboard()
        )
        return AdminState.MENU

    admin_ctx["amount"] = amount
    user_id = admin_ctx["user"]["id"]
    currency_label = (
        "chips" if admin_ctx["currency"] == CurrencyType.REAL else "play money"
    )
    operation_label = "Deposit" if admin_ctx["operation"] == "deposit" else "Withdraw"
    confirmation_text = (
        f"Confirm {operation_label} of {amount:,} {currency_label} to User {user_id}?"
    )

    await message.reply_text(
        confirmation_text,
        reply_markup=_confirmation_keyboard(),
    )
    return AdminState.CONFIRMATION


async def handle_confirmation(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Execute the treasury operation upon confirmation."""
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    data = query.data if query else ""
    if data == "admin_confirm_no":
        _reset_admin_context(context)
        if query and query.message:
            await query.edit_message_text(
                "Operation cancelled.", reply_markup=_admin_menu_keyboard()
            )
        else:
            await update.effective_message.reply_text(
                "Operation cancelled.", reply_markup=_admin_menu_keyboard()
            )
        return AdminState.MENU

    if data != "admin_confirm_yes":
        return AdminState.CONFIRMATION

    admin_ctx = context.user_data.get("admin_context") or {}
    operation = admin_ctx.get("operation")
    currency: Optional[CurrencyType] = admin_ctx.get("currency")
    user_info = admin_ctx.get("user") or {}
    amount: Optional[int] = admin_ctx.get("amount")

    if not (operation and currency and user_info and amount):
        if query and query.message:
            await query.edit_message_text(
                "Missing details for this operation. Please start again.",
                reply_markup=_admin_menu_keyboard(),
            )
        _reset_admin_context(context)
        return AdminState.MENU

    user_id = user_info["id"]
    signed_amount = amount if operation == "deposit" else -amount
    result_message = query.message or update.effective_message

    async with AsyncSessionLocal() as session:
        try:
            await wallet_service.ensure_wallet(session, user_id)
            new_balance = await wallet_service.adjust_balance(
                session,
                user_id=user_id,
                amount=signed_amount,
                currency_type=currency,
                transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                metadata={"admin_reason": "manual_adjustment"},
            )
            await session.commit()
        except ValueError as exc:
            await session.rollback()
            if result_message:
                await result_message.reply_text(f"Error: {exc}")
            return AdminState.MENU
        except Exception as exc:  # pragma: no cover - defensive
            await session.rollback()
            logger.error("Admin treasury operation failed", error=str(exc))
            if result_message:
                await result_message.reply_text(
                    "Operation failed due to an internal error."
                )
            return AdminState.MENU

    currency_label = "chips" if currency == CurrencyType.REAL else "play money"
    action_label = "Deposited" if operation == "deposit" else "Withdrawn"
    if result_message:
        await result_message.reply_text(
            f"✅ {action_label} {abs(signed_amount):,} {currency_label} for user {user_id}.\n"
            f"New balance: {new_balance:,} {currency_label}.",
            reply_markup=_admin_menu_keyboard(),
        )

    _reset_admin_context(context)
    return AdminState.MENU


async def show_live_ops(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Display active tables snapshot."""
    if not _is_admin(update):
        await _handle_unauthorized(update)
        return

    target = (
        update.callback_query.message
        if update.callback_query
        else update.effective_message
    )

    async with AsyncSessionLocal() as session:
        tables_info = await _fetch_active_tables(session)

    if not target:
        return

    if not tables_info:
        await target.reply_text(
            "No active games running.", reply_markup=_live_ops_keyboard()
        )
        return

    lines = ["🃏 **Active Tables**", "------------------"]
    for entry in tables_info:
        lines.append(
            f"ID: {entry['id']} | {entry['variant']} | "
            f"{entry['players']}/{entry['max_players']} Players | "
            f"Pot: {entry['pot']:,}"
        )
    lines.append("------------------")
    lines.append(f"Total Active Games: {len(tables_info)}")

    await target.reply_text(
        "\n".join(lines), parse_mode="Markdown", reply_markup=_live_ops_keyboard()
    )


async def _fetch_active_tables(session) -> List[Dict[str, Any]]:
    """Gather active/waiting tables with seat counts and latest pot."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(Table)
        .options(joinedload(Table.template))
        .where(
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE]),
            or_(Table.expires_at.is_(None), Table.expires_at > now),
        )
    )
    tables = result.scalars().unique().all()
    if not tables:
        return []

    table_ids = [table.id for table in tables]

    seat_counts_result = await session.execute(
        select(Seat.table_id, func.count(Seat.id))
        .where(Seat.table_id.in_(table_ids), Seat.left_at.is_(None))
        .group_by(Seat.table_id)
    )
    seat_counts = {table_id: count for table_id, count in seat_counts_result.all()}

    pot_subquery = (
        select(Hand.table_id, func.max(Hand.hand_no).label("max_hand"))
        .where(Hand.table_id.in_(table_ids))
        .group_by(Hand.table_id)
        .subquery()
    )

    pot_result = await session.execute(
        select(Hand.table_id, Hand.pot_size).join(
            pot_subquery,
            (Hand.table_id == pot_subquery.c.table_id)
            & (Hand.hand_no == pot_subquery.c.max_hand),
        )
    )
    pot_map = {table_id: pot for table_id, pot in pot_result.all()}

    payload: List[Dict[str, Any]] = []
    for table in tables:
        config = get_template_config(table)
        variant_raw = get_table_game_variant(table)
        variant_label = _variant_label(variant_raw)

        payload.append(
            {
                "id": table.id,
                "variant": variant_label,
                "players": seat_counts.get(table.id, 0),
                "max_players": config.get("max_players", 8),
                "pot": pot_map.get(table.id, 0),
            }
        )
    return payload


def _variant_label(variant_value: str) -> str:
    """Human readable variant label."""
    try:
        variant = GameVariant(variant_value)
    except Exception:
        return variant_value

    if variant == GameVariant.NO_LIMIT_SHORT_DECK_HOLDEM:
        return "NLH Short Deck"
    return "NLH Texas Hold'em"


async def handle_crm_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Prompt for a user lookup in CRM."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    target = query.message if query else update.effective_message
    if target:
        await target.reply_text(
            "Enter User ID or @username:", reply_markup=_intel_menu_keyboard()
        )
    return AdminState.USER_CRM


async def handle_crm_lookup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Resolve user and present CRM actions."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    message = update.effective_message
    if not message or not message.text:
        return AdminState.USER_CRM

    async with AsyncSessionLocal() as session:
        user = await _resolve_user(session, message.text)
        if not user:
            await message.reply_text(
                "User not found.",
                reply_markup=_intel_result_keyboard(repeat_action="admin_lookup_again"),
            )
            return AdminState.USER_CRM
        balances = await _ensure_balances(session, user.id)
        stats = await user_service.get_user_stats_from_aggregated(session, user.id)
        referrer = None
        if user.referrer_id:
            referrer = await session.get(User, user.referrer_id)
        await session.commit()

    lines = [
        "👥 **User CRM**",
        f"ID: {user.id}",
        f"TG: {user.tg_user_id}",
        f"Username: @{user.username}" if user.username else "Username: -",
        f"Language: {user.language}",
        (
            f"Referrer: @{referrer.username}"
            if referrer and referrer.username
            else f"Referrer ID: {referrer.id}" if referrer else "Referrer: -"
        ),
        f"Real: {balances.get('balance_real',0):,} | Play: {balances.get('balance_play',0):,}",
        f"Hands: {stats.get('hands_played',0):,}",
    ]
    context.user_data["crm_user_id"] = user.id
    await message.reply_text(
        "\n".join(lines), reply_markup=_crm_keyboard(user.id), parse_mode="Markdown"
    )
    return AdminState.USER_CRM_ACTION


async def _toggle_ban(session, user: User) -> bool:
    """Toggle ban flag stored in stats_blob."""
    stats = user.stats_blob or {}
    banned = bool(stats.get("banned"))
    stats["banned"] = not banned
    user.stats_blob = stats
    await session.flush()
    return not banned


async def handle_crm_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle CRM action buttons."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    data = query.data if query else ""
    if data == "admin_home":
        return await go_home(update, context)
    if not data or ":" not in data:
        return AdminState.USER_CRM_ACTION
    action, raw_id = data.split(":", 1)
    target_id = int(raw_id)
    context.user_data["crm_user_id"] = target_id

    if action == "admin_crm_ban":
        async with AsyncSessionLocal() as session:
            user = await session.get(User, target_id)
            if not user:
                await query.message.reply_text("User not found.")
                return AdminState.USER_CRM_ACTION
            banned = await _toggle_ban(session, user)
            await session.commit()
        await query.message.reply_text(
            "User banned." if banned else "User unbanned.",
            reply_markup=_crm_keyboard(target_id),
        )
        return AdminState.USER_CRM_ACTION

    if action == "admin_crm_message":
        await query.message.reply_text("Send the message to deliver to user.")
        return AdminState.USER_MESSAGE

    if action == "admin_crm_balance":
        await query.message.reply_text(
            "Select currency to adjust:", reply_markup=_currency_selection_keyboard()
        )
        return AdminState.USER_BALANCE_CURRENCY

    return AdminState.USER_CRM_ACTION


async def handle_crm_message_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    target_id = context.user_data.get("crm_user_id")
    if not target_id:
        return AdminState.USER_CRM
    text = update.effective_message.text
    async with AsyncSessionLocal() as session:
        user = await session.get(User, target_id)
    if user and user.tg_user_id:
        try:
            await update.get_bot().send_message(chat_id=user.tg_user_id, text=text)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to message user", error=str(exc))
    await update.effective_message.reply_text(
        "Message dispatched.", reply_markup=_crm_keyboard(target_id)
    )
    return AdminState.USER_CRM_ACTION


async def handle_crm_balance_currency(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    data = query.data if query else ""
    if ":" in data:
        _, currency_code = data.split(":", 1)
        context.user_data["crm_balance_currency"] = (
            CurrencyType.REAL if currency_code == "REAL" else CurrencyType.PLAY
        )
        await query.message.reply_text(
            "Enter amount (positive to credit, negative to debit):"
        )
        return AdminState.USER_BALANCE_ADJUST
    return AdminState.USER_CRM_ACTION


async def handle_crm_balance_adjust(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    target_id = context.user_data.get("crm_user_id")
    currency = context.user_data.get("crm_balance_currency", CurrencyType.REAL)
    if not target_id:
        return AdminState.USER_CRM
    try:
        amount = int(update.effective_message.text.strip())
    except Exception:
        await update.effective_message.reply_text("Please enter a numeric amount.")
        return AdminState.USER_BALANCE_ADJUST
    async with AsyncSessionLocal() as session:
        try:
            await wallet_service.adjust_balance(
                session,
                user_id=target_id,
                amount=amount,
                currency_type=currency,
                transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                metadata={"admin_reason": "manual_edit_balance"},
            )
            await session.commit()
        except Exception as exc:
            await session.rollback()
            await update.effective_message.reply_text(f"Failed: {exc}")
            return AdminState.USER_CRM_ACTION
    await update.effective_message.reply_text(
        "Balance updated.", reply_markup=_crm_keyboard(target_id)
    )
    return AdminState.USER_CRM_ACTION


async def handle_marketing_menu(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    target = query.message if query else update.effective_message
    if target:
        await target.reply_text(
            "Marketing console:", reply_markup=_marketing_keyboard()
        )
    return AdminState.MARKETING_MENU


async def handle_marketing_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    data = query.data if query else ""
    if data == "admin_marketing_promo":
        await query.message.reply_text("Enter promo code string (e.g., WELCOME100):")
        context.user_data["promo_ctx"] = {}
        return AdminState.MARKETING_PROMO_CODE
    if data == "admin_marketing_broadcast":
        await query.message.reply_text("Send the broadcast message (text only):")
        return AdminState.MARKETING_BROADCAST
    if data == "admin_home":
        return await go_home(update, context)
    return AdminState.MARKETING_MENU


async def handle_promo_code_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    ctx = context.user_data.setdefault("promo_ctx", {})
    ctx["code"] = update.effective_message.text.strip()
    await update.effective_message.reply_text("Enter amount to credit:")
    return AdminState.MARKETING_PROMO_AMOUNT


async def handle_promo_amount_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    ctx = context.user_data.setdefault("promo_ctx", {})
    try:
        amount = int(update.effective_message.text.strip())
    except Exception:
        await update.effective_message.reply_text("Enter a numeric amount:")
        return AdminState.MARKETING_PROMO_AMOUNT
    ctx["amount"] = amount
    await update.effective_message.reply_text(
        "Select currency:", reply_markup=_promo_currency_keyboard()
    )
    return AdminState.MARKETING_PROMO_CURRENCY


async def handle_promo_currency(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
    data = query.data if query else ""
    if ":" in data:
        _, code = data.split(":", 1)
        ctx = context.user_data.setdefault("promo_ctx", {})
        ctx["currency"] = CurrencyType.REAL if code == "REAL" else CurrencyType.PLAY
        await query.message.reply_text("Enter max uses (integer):")
        return AdminState.MARKETING_PROMO_LIMIT
    return AdminState.MARKETING_PROMO_CURRENCY


async def handle_promo_limit_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    ctx = context.user_data.setdefault("promo_ctx", {})
    try:
        max_uses = int(update.effective_message.text.strip())
    except Exception:
        await update.effective_message.reply_text("Enter an integer for max uses:")
        return AdminState.MARKETING_PROMO_LIMIT
    ctx["max_uses"] = max_uses
    await update.effective_message.reply_text(
        "Enter expiry datetime (YYYY-MM-DD or leave blank for none):"
    )
    return AdminState.MARKETING_PROMO_EXPIRY


async def handle_promo_expiry_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    text = update.effective_message.text.strip()
    ctx = context.user_data.get("promo_ctx", {})
    expiry = None
    if text:
        from datetime import datetime

        try:
            expiry = datetime.fromisoformat(text)
        except Exception:
            await update.effective_message.reply_text(
                "Invalid date format. Use YYYY-MM-DD or leave empty."
            )
            return AdminState.MARKETING_PROMO_EXPIRY
    async with AsyncSessionLocal() as session:
        try:
            await promo_service.create_promo_code(
                session,
                code=ctx.get("code"),
                amount=ctx.get("amount"),
                currency_type=ctx.get("currency", CurrencyType.REAL),
                max_uses=ctx.get("max_uses", 1),
                expiry_date=expiry,
            )
            await session.commit()
        except Exception as exc:
            await session.rollback()
            await update.effective_message.reply_text(f"Failed to create promo: {exc}")
            return AdminState.MARKETING_MENU
    context.user_data.pop("promo_ctx", None)
    await update.effective_message.reply_text(
        "Promo code created.", reply_markup=_marketing_keyboard()
    )
    return AdminState.MARKETING_MENU


async def handle_broadcast_message(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    text = update.effective_message.text
    sent = 0
    failed = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User.tg_user_id))
        ids = [row[0] for row in result.fetchall()]
    for chat_id in ids:
        if not chat_id:
            continue
        try:
            await context.bot.send_message(chat_id=chat_id, text=text)
            sent += 1
        except Exception:
            failed += 1
    await update.effective_message.reply_text(
        f"Broadcast complete. Sent: {sent}, Failed: {failed}",
        reply_markup=_marketing_keyboard(),
    )
    return AdminState.MARKETING_MENU


async def handle_intel_menu_selection(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Dispatch actions inside the user intel desk."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)

    query = update.callback_query
    if query:
        await safe_answer_callback_query(query)
        target = query.message
    else:
        target = update.effective_message

    data = query.data if query else ""
    if data == "admin_home":
        return await go_home(update, context)

    if data == "admin_intel_menu":
        return await show_intel_menu(update, context)

    prompt = "Send @username or numeric User ID:"
    if data == "admin_intel_lookup":
        if target:
            await target.reply_text(prompt, reply_markup=_intel_menu_keyboard())
        return AdminState.USER_LOOKUP

    if data in {"admin_intel_balance", "admin_balance_again"}:
        if target:
            await target.reply_text(
                "Balance check\nSend @username or user id.",
                reply_markup=_intel_menu_keyboard(),
            )
        return AdminState.USER_BALANCE

    if data in {"admin_intel_stats", "admin_stats_again"}:
        if target:
            await target.reply_text(
                "User snapshot\nSend @username or user id.",
                reply_markup=_intel_menu_keyboard(),
            )
        return AdminState.USER_STATS

    if data == "admin_lookup_again":
        if target:
            await target.reply_text(prompt, reply_markup=_intel_menu_keyboard())
        return AdminState.USER_LOOKUP

    return AdminState.INTEL_MENU


def _escape_md(value: str) -> str:
    """Escape minimal Markdown characters."""
    return (
        value.replace("\\", "\\\\")
        .replace("_", "\\_")
        .replace("*", "\\*")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


async def handle_lookup_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Resolve user by id/username and show card."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    message = update.effective_message
    if not message or not message.text:
        return AdminState.USER_LOOKUP

    async with AsyncSessionLocal() as session:
        user = await _resolve_user(session, message.text)
        if not user:
            await message.reply_text(
                "No user found. Try again or jump back.",
                reply_markup=_intel_result_keyboard(
                    repeat_action="admin_lookup_again", include_stats=False
                ),
            )
            return AdminState.USER_LOOKUP

        balances = await _ensure_balances(session, user.id)

    card = _format_user_card(user, balances)
    await message.reply_text(
        card,
        reply_markup=_intel_result_keyboard(
            repeat_action="admin_lookup_again", include_stats=True
        ),
        parse_mode="Markdown",
    )
    return AdminState.USER_LOOKUP


async def handle_balance_input(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Show balances for a user."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    message = update.effective_message
    if not message or not message.text:
        return AdminState.USER_BALANCE

    async with AsyncSessionLocal() as session:
        user = await _resolve_user(session, message.text)
        if not user:
            await message.reply_text(
                "No user found for that handle/id.",
                reply_markup=_intel_result_keyboard(
                    repeat_action="admin_balance_again", include_stats=False
                ),
            )
            return AdminState.USER_BALANCE

        balances = await _ensure_balances(session, user.id)

    body = [
        "💰 **Balances**",
        f"User: {_escape_md('@' + user.username) if user.username else str(user.id)}",
        f"Real: {balances.get('balance_real', 0):,} chips",
        f"Play: {balances.get('balance_play', 0):,} play",
    ]
    await message.reply_text(
        "\n".join(body),
        parse_mode="Markdown",
        reply_markup=_intel_result_keyboard(
            repeat_action="admin_balance_again", include_stats=True
        ),
    )
    return AdminState.USER_BALANCE


async def handle_stats_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Show stats + balances for a user."""
    if not _is_admin(update):
        return await _handle_unauthorized(update)
    message = update.effective_message
    if not message or not message.text:
        return AdminState.USER_STATS

    async with AsyncSessionLocal() as session:
        user = await _resolve_user(session, message.text)
        if not user:
            await message.reply_text(
                "No user found. Try another.",
                reply_markup=_intel_result_keyboard(
                    repeat_action="admin_stats_again", include_stats=False
                ),
            )
            return AdminState.USER_STATS

        balances = await _ensure_balances(session, user.id)
        stats = await user_service.get_user_stats_from_aggregated(session, user.id)

    card = _format_user_card(user, balances)
    stats_block = _format_stats(stats)
    await message.reply_text(
        f"{card}\n\n{stats_block}",
        parse_mode="Markdown",
        reply_markup=_intel_result_keyboard(
            repeat_action="admin_stats_again", include_stats=False
        ),
    )
    return AdminState.USER_STATS


def build_admin_handler() -> ConversationHandler:
    """Create the admin conversation handler for registration in the bot."""
    return ConversationHandler(
        entry_points=[CommandHandler("admin", start_admin)],
        states={
            AdminState.MENU: [
                CallbackQueryHandler(
                    handle_menu_selection,
                    pattern="^admin_(treasury|live_ops|close|intel|intel_stats|home|intel_menu|crm|marketing|generate_link)$",
                ),
            ],
            AdminState.INTEL_MENU: [
                CallbackQueryHandler(
                    go_home,
                    pattern="^admin_home$",
                ),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_intel_menu_selection,
                    pattern="^admin_(intel_lookup|intel_balance|intel_stats|lookup_again|balance_again|stats_again|intel_menu)$",
                ),
            ],
            AdminState.TREASURY_OPERATION: [
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_operation_selection,
                    pattern="^admin_operation_(deposit|withdraw|back)$",
                ),
            ],
            AdminState.TREASURY_CURRENCY: [
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_currency_selection,
                    pattern="^admin_currency_(real|play|back)$",
                ),
            ],
            AdminState.WAITING_FOR_USER_ID: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_user_id),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_currency_selection, pattern="^admin_currency_back$"
                ),
            ],
            AdminState.WAITING_FOR_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_amount),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.CONFIRMATION: [
                CallbackQueryHandler(
                    handle_confirmation, pattern="^admin_confirm_(yes|no)$"
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.USER_LOOKUP: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_lookup_input),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_intel_menu_selection,
                    pattern="^admin_(lookup_again|intel_menu|home|intel_stats)$",
                ),
            ],
            AdminState.USER_BALANCE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_balance_input),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_intel_menu_selection,
                    pattern="^admin_(balance_again|intel_menu|home|intel_stats)$",
                ),
            ],
            AdminState.USER_STATS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_stats_input),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
                CallbackQueryHandler(
                    handle_intel_menu_selection,
                    pattern="^admin_(stats_again|intel_menu|home|intel_stats)$",
                ),
            ],
            AdminState.USER_CRM: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_crm_lookup),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.USER_CRM_ACTION: [
                CallbackQueryHandler(
                    handle_crm_action, pattern="^admin_crm_(ban|message|balance):"
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.USER_MESSAGE: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_crm_message_input
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.USER_BALANCE_CURRENCY: [
                CallbackQueryHandler(
                    handle_crm_balance_currency,
                    pattern="^admin_balance_currency:(REAL|PLAY)$",
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.USER_BALANCE_ADJUST: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_crm_balance_adjust
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_MENU: [
                CallbackQueryHandler(
                    handle_marketing_selection,
                    pattern="^admin_marketing_(promo|broadcast)$",
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_PROMO_CODE: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_promo_code_input
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_PROMO_AMOUNT: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_promo_amount_input
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_PROMO_CURRENCY: [
                CallbackQueryHandler(
                    handle_promo_currency, pattern="^promo_currency:(REAL|PLAY)$"
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_PROMO_LIMIT: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_promo_limit_input
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_PROMO_EXPIRY: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_promo_expiry_input
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
            AdminState.MARKETING_BROADCAST: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND, handle_broadcast_message
                ),
                CallbackQueryHandler(go_home, pattern="^admin_home$"),
                CallbackQueryHandler(
                    handle_generate_link, pattern="^admin_generate_link$"
                ),
            ],
        },
        fallbacks=[CommandHandler("cancel", start_admin)],
        per_chat=False,
        allow_reentry=True,
    )


def register_admin_handlers(application: Application) -> None:
    """Register admin handlers on the provided application."""
    # Register in a higher-priority group to avoid user menu handlers swallowing /admin
    application.add_handler(build_admin_handler(), group=-2)
