"""Test for new bot handlers and structure."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from telegram import Update, User as TgUser, Chat, Message, CallbackQuery
from telegram.ext import ContextTypes

# Test that modules can be imported
def test_imports():
    """Test that all new modules can be imported."""
    from telegram_poker_bot.bot.handlers.commands import start_command
    from telegram_poker_bot.bot.handlers.lobby import lobby_command
    from telegram_poker_bot.bot.handlers.profile import profile_command
    from telegram_poker_bot.bot.handlers.callbacks import callback_query_handler
    from telegram_poker_bot.bot.keyboards.menu import get_main_menu_keyboard
    from telegram_poker_bot.bot.api.client import api_client
    from telegram_poker_bot.bot.ws_client.table_client import TableWebSocketClient
    from telegram_poker_bot.bot.services.table_sessions import table_session_manager
    from telegram_poker_bot.bot.utils.helpers import format_chips, format_card
    from telegram_poker_bot.bot.middlewares.error import error_handler
    
    assert start_command is not None
    assert lobby_command is not None
    assert profile_command is not None
    assert callback_query_handler is not None
    assert get_main_menu_keyboard is not None
    assert api_client is not None
    assert TableWebSocketClient is not None
    assert table_session_manager is not None
    assert format_chips is not None
    assert format_card is not None
    assert error_handler is not None


def test_keyboard_generation():
    """Test that keyboards are generated correctly."""
    from telegram_poker_bot.bot.keyboards.menu import (
        get_main_menu_keyboard,
        get_language_keyboard,
        get_wallet_keyboard,
        get_profile_keyboard,
    )
    
    # Test main menu keyboard
    keyboard = get_main_menu_keyboard("en", True)
    assert keyboard is not None
    assert len(keyboard.inline_keyboard) > 0
    
    # Test language keyboard
    keyboard = get_language_keyboard()
    assert keyboard is not None
    assert len(keyboard.inline_keyboard) > 0
    
    # Test wallet keyboard
    keyboard = get_wallet_keyboard("en")
    assert keyboard is not None
    assert len(keyboard.inline_keyboard) > 0
    
    # Test profile keyboard
    keyboard = get_profile_keyboard("en")
    assert keyboard is not None
    assert len(keyboard.inline_keyboard) > 0


def test_locales():
    """Test locale functionality."""
    from telegram_poker_bot.bot.locales import get_text
    
    # Test English
    text = get_text("welcome_back", "en", name="John")
    assert "John" in text
    
    # Test Farsi
    text = get_text("welcome_back", "fa", name="علی")
    assert "علی" in text
    
    # Test default parameter
    text = get_text("nonexistent_key", "en", default="Default Text")
    assert text == "Default Text"


def test_format_helpers():
    """Test formatting helper functions."""
    from telegram_poker_bot.bot.utils.helpers import format_chips, format_card, format_cards
    
    # Test chip formatting
    assert format_chips(10000) == "100.00"
    assert format_chips(150) == "1.50"
    
    # Test card formatting
    card = format_card("Ah")
    assert "A" in card
    assert "♥" in card or "h" in card
    
    # Test multiple cards
    cards = format_cards(["Ah", "Kd"])
    assert "A" in cards
    assert "K" in cards


def test_anti_flood():
    """Test anti-flood middleware."""
    from telegram_poker_bot.bot.utils.helpers import AntiFloodMiddleware
    
    middleware = AntiFloodMiddleware(max_requests=5, window_seconds=60)
    
    user_id = 12345
    
    # Should allow first 5 requests
    for i in range(5):
        assert middleware.check_rate_limit(user_id) is True
    
    # Should block 6th request
    assert middleware.check_rate_limit(user_id) is False
    
    # Clear and test again
    middleware.clear_user(user_id)
    assert middleware.check_rate_limit(user_id) is True


def test_table_session_manager():
    """Test table session manager."""
    from telegram_poker_bot.bot.services.table_sessions import TableSessionManager
    
    manager = TableSessionManager()
    
    user_id = 12345
    chat_id = 67890
    table_id = 1
    
    # Create session
    session = manager.create_session(user_id, chat_id, table_id)
    assert session is not None
    assert session.user_id == user_id
    assert session.table_id == table_id
    
    # Get session
    retrieved = manager.get_session(user_id)
    assert retrieved is not None
    assert retrieved.user_id == user_id


if __name__ == "__main__":
    # Run tests
    test_imports()
    print("✓ Import test passed")
    
    test_keyboard_generation()
    print("✓ Keyboard generation test passed")
    
    test_locales()
    print("✓ Locales test passed")
    
    test_format_helpers()
    print("✓ Format helpers test passed")
    
    test_anti_flood()
    print("✓ Anti-flood test passed")
    
    test_table_session_manager()
    print("✓ Table session manager test passed")
    
    print("\n✓ All tests passed!")
