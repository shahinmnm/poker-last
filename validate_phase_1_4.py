#!/usr/bin/env python3
"""
Validation script for Phase 1.4 Telegram Bot implementation.

This script validates that all components are properly installed and configured.
"""

import sys
import importlib

def test_import(module_name, description):
    """Test if a module can be imported."""
    try:
        importlib.import_module(module_name)
        print(f"✓ {description}")
        return True
    except Exception as e:
        print(f"✗ {description}: {e}")
        return False

def main():
    """Run validation checks."""
    print("=" * 70)
    print("Phase 1.4 Telegram Bot - Validation Script")
    print("=" * 70)
    print()
    
    checks = [
        # Core handlers
        ("telegram_poker_bot.bot.handlers.commands", "Command handlers"),
        ("telegram_poker_bot.bot.handlers.lobby", "Lobby handlers"),
        ("telegram_poker_bot.bot.handlers.profile", "Profile handlers"),
        ("telegram_poker_bot.bot.handlers.table", "Table/gameplay handlers"),
        ("telegram_poker_bot.bot.handlers.callbacks", "Callback query handler"),
        ("telegram_poker_bot.bot.handlers.registry", "Handler registry"),
        
        # Keyboards
        ("telegram_poker_bot.bot.keyboards.menu", "Menu keyboards"),
        
        # Services
        ("telegram_poker_bot.bot.services.table_sessions", "Session management"),
        
        # API & WebSocket
        ("telegram_poker_bot.bot.api.client", "API client"),
        ("telegram_poker_bot.bot.ws_client.table_client", "WebSocket client"),
        
        # Utils & Middleware
        ("telegram_poker_bot.bot.utils.helpers", "Utility helpers"),
        ("telegram_poker_bot.bot.middlewares.error", "Error middleware"),
        
        # Localization
        ("telegram_poker_bot.bot.locales", "Localization system"),
        ("telegram_poker_bot.bot.i18n", "Translation loader"),
    ]
    
    print("Module Import Tests:")
    print("-" * 70)
    results = []
    for module, desc in checks:
        results.append(test_import(module, desc))
    
    print()
    print("-" * 70)
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} checks passed")
    
    if passed == total:
        print("✓ All validation checks PASSED!")
        print()
        print("Next steps:")
        print("1. Configure environment variables in .env")
        print("2. Start the backend API service")
        print("3. Run: python -m telegram_poker_bot.bot.main")
        print("4. Test with Telegram: /start")
        return 0
    else:
        print("✗ Some checks FAILED. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
