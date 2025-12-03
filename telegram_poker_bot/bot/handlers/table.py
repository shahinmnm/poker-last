"""Table gameplay and real-time action handlers."""

import asyncio
from typing import Dict, Any
from telegram import Update, Bot
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.bot.locales import get_text
from telegram_poker_bot.bot.keyboards.menu import (
    get_table_actions_keyboard,
    get_back_to_menu_keyboard,
)
from telegram_poker_bot.bot.api.client import api_client
from telegram_poker_bot.bot.ws_client.table_client import TableWebSocketClient, PollingClient
from telegram_poker_bot.bot.services.table_sessions import table_session_manager
from telegram_poker_bot.bot.handlers.commands import _get_or_create_user

logger = get_logger(__name__)


async def join_table_handler(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    table_id: int,
    query=None
):
    """Handle joining a table."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Notify user
        joining_text = get_text("joining_table", lang)
        
        if query:
            await query.edit_message_text(joining_text)
        else:
            msg = await update.message.reply_text(joining_text)
            query = msg
        
        # Join table via API
        result = await api_client.join_table(table_id, user.tg_user_id)
        
        if not result:
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="⚠️ Failed to join table. It may be full or no longer available.",
                reply_markup=get_back_to_menu_keyboard(lang),
            )
            return
        
        # Create session
        chat_id = update.effective_chat.id
        session = table_session_manager.create_session(user.tg_user_id, chat_id, table_id)
        
        # Set up WebSocket or polling
        try:
            # Try WebSocket first
            ws_client = TableWebSocketClient(
                table_id,
                lambda data: handle_table_message(context.bot, session, data, lang)
            )
            await ws_client.connect()
            session.ws_client = ws_client
            session.listen_task = asyncio.create_task(ws_client.listen())
            
            logger.info("WebSocket connected for table", user_id=user.tg_user_id, table_id=table_id)
            
        except Exception as e:
            logger.warning(
                "WebSocket connection failed, falling back to polling",
                error=str(e),
                table_id=table_id,
            )
            
            # Fallback to polling
            polling_client = PollingClient(
                table_id,
                lambda data: handle_table_message(context.bot, session, data, lang),
                api_client
            )
            session.polling_client = polling_client
            session.listen_task = asyncio.create_task(polling_client.start())
        
        # Send success message
        success_text = get_text("table_joined", lang)
        await context.bot.send_message(
            chat_id=chat_id,
            text=success_text,
            parse_mode=ParseMode.HTML,
        )
        
        # Get initial state
        state = await api_client.get_table_state(table_id)
        if state:
            await send_table_state(context.bot, session, state, lang)
        
    except Exception as e:
        logger.error("Error joining table", error=str(e), exc_info=e)
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="An error occurred while joining the table.",
        )


async def handle_table_message(bot: Bot, session, data: Dict[str, Any], lang: str):
    """Handle WebSocket/polling message for a table."""
    try:
        message_type = data.get("type")
        
        if message_type == "state_snapshot" or message_type == "state_update":
            state_data = data.get("data", data)
            await send_table_state(bot, session, state_data, lang)
            
        elif message_type == "action_required":
            await send_action_prompt(bot, session, data, lang)
            
        elif message_type == "action_performed":
            await send_action_notification(bot, session, data, lang)
            
        elif message_type == "hand_finished":
            await send_hand_result(bot, session, data, lang)
            
        elif message_type == "game_started":
            text = get_text("game_started", lang)
            await bot.send_message(chat_id=session.chat_id, text=text)
            
        else:
            logger.debug("Unhandled table message type", type=message_type)
            
    except Exception as e:
        logger.error("Error handling table message", error=str(e), exc_info=e)


async def send_table_state(bot: Bot, session, state: Dict[str, Any], lang: str):
    """Send current table state to user."""
    try:
        # Extract state info
        table_name = state.get("table_name", f"Table #{session.table_id}")
        players = state.get("players", [])
        board = state.get("board", [])
        pot = state.get("pot", 0)
        current_player = state.get("current_player")
        
        # Find user's seat
        user_seat = None
        for player in players:
            if player.get("user_id") == session.user_id:
                user_seat = player
                break
        
        # Build state message
        state_text = f"🎴 <b>{table_name}</b>\n\n"
        
        if user_seat:
            cards = user_seat.get("hole_cards", [])
            stack = user_seat.get("stack", 0)
            
            if cards:
                state_text += get_text("hand_cards", lang, cards=" ".join(cards)) + "\n"
            state_text += get_text("your_stack", lang, amount=stack) + "\n\n"
        
        if board:
            state_text += get_text("board_cards", lang, cards=" ".join(board)) + "\n"
        
        state_text += get_text("pot_amount", lang, amount=pot) + "\n"
        
        if not current_player:
            state_text += "\n" + get_text("waiting_for_players", lang)
        
        await bot.send_message(
            chat_id=session.chat_id,
            text=state_text,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error("Error sending table state", error=str(e), exc_info=e)


async def send_action_prompt(bot: Bot, session, data: Dict[str, Any], lang: str):
    """Send action prompt to user."""
    try:
        action_data = data.get("data", {})
        can_check = action_data.get("can_check", False)
        can_call = action_data.get("can_call", False)
        call_amount = action_data.get("call_amount", 0)
        min_bet = action_data.get("min_bet", 0)
        
        text = get_text("action_required", lang)
        
        keyboard = get_table_actions_keyboard(
            can_fold=True,
            can_check=can_check,
            can_call=can_call,
            call_amount=call_amount,
            min_bet=min_bet,
            lang=lang,
        )
        
        await bot.send_message(
            chat_id=session.chat_id,
            text=text,
            reply_markup=keyboard,
        )
        
    except Exception as e:
        logger.error("Error sending action prompt", error=str(e), exc_info=e)


async def send_action_notification(bot: Bot, session, data: Dict[str, Any], lang: str):
    """Send notification about another player's action."""
    try:
        action_data = data.get("data", {})
        player_name = action_data.get("player_name", "Player")
        action = action_data.get("action", "unknown")
        amount = action_data.get("amount")
        
        text = f"🎯 {player_name}: {action}"
        if amount:
            text += f" ({amount})"
        
        await bot.send_message(chat_id=session.chat_id, text=text)
        
    except Exception as e:
        logger.error("Error sending action notification", error=str(e), exc_info=e)


async def send_hand_result(bot: Bot, session, data: Dict[str, Any], lang: str):
    """Send hand result notification."""
    try:
        result_data = data.get("data", {})
        winner = result_data.get("winner", "Unknown")
        amount = result_data.get("amount", 0)
        
        text = get_text("hand_finished", lang, winner=winner)
        text += f"\n💰 Won: {amount}"
        
        await bot.send_message(
            chat_id=session.chat_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
        
    except Exception as e:
        logger.error("Error sending hand result", error=str(e), exc_info=e)


async def leave_table_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle leaving a table."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Get active session
        session = table_session_manager.get_session(user.tg_user_id)
        
        if not session:
            await update.callback_query.answer("You're not at a table.")
            return
        
        table_id = session.table_id
        
        # Leave table via API
        await api_client.leave_table(table_id, user.tg_user_id)
        
        # Remove session
        await table_session_manager.remove_session(user.tg_user_id)
        
        await update.callback_query.answer("Left table.")
        
        # Show main menu
        from telegram_poker_bot.bot.keyboards.menu import get_main_menu_keyboard
        await update.callback_query.edit_message_text(
            get_text("menu_title", lang),
            reply_markup=get_main_menu_keyboard(lang, True),
        )
        
    except Exception as e:
        logger.error("Error leaving table", error=str(e), exc_info=e)
        await update.callback_query.answer("An error occurred.")


async def submit_action_handler(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    action: str,
    amount: int = None
):
    """Handle submitting a poker action."""
    try:
        user, lang = await _get_or_create_user(update)
        
        # Get active session
        session = table_session_manager.get_session(user.tg_user_id)
        
        if not session:
            await update.callback_query.answer("You're not at a table.")
            return
        
        # Submit action via API
        result = await api_client.submit_action(session.table_id, action, amount)
        
        if result:
            await update.callback_query.answer(f"Action: {action}")
        else:
            await update.callback_query.answer("Failed to submit action. Try again.")
        
    except Exception as e:
        logger.error("Error submitting action", error=str(e), exc_info=e)
        await update.callback_query.answer("An error occurred.")
