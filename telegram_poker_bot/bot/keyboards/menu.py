"""Menu keyboards for Telegram bot."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.bot.locales import get_text

settings = get_settings()


def get_main_menu_keyboard(lang: str = "en", is_private: bool = True) -> InlineKeyboardMarkup:
    """
    Build main menu keyboard.
    
    Main Menu:
    - Games Lobby
    - Profile
    - Deposit
    - Withdraw
    - Stats
    - Invite
    - Language 🌐 (FA/EN)
    """
    webapp_url = f"{settings.mini_app_url}?start=1"
    
    # Play button with WebApp
    play_button = InlineKeyboardButton(
        get_text("play_poker", lang),
        web_app=WebAppInfo(url=webapp_url) if is_private else None,
        url=webapp_url if not is_private else None,
    )
    
    return InlineKeyboardMarkup([
        [play_button],
        [
            InlineKeyboardButton(
                "🎮 " + get_text("games_lobby", lang, default="Games Lobby"),
                callback_data="menu_lobby"
            )
        ],
        [
            InlineKeyboardButton(
                "👤 " + get_text("profile", lang),
                callback_data="menu_profile"
            ),
            InlineKeyboardButton(
                "📊 " + get_text("stats", lang, default="Stats"),
                callback_data="menu_stats"
            ),
        ],
        [
            InlineKeyboardButton(
                "💰 " + get_text("wallet", lang),
                callback_data="menu_wallet"
            ),
            InlineKeyboardButton(
                "🤝 " + get_text("invite", lang),
                callback_data="menu_invite"
            ),
        ],
        [
            InlineKeyboardButton(
                "🌐 " + get_text("language", lang, default="Language"),
                callback_data="menu_language"
            ),
            InlineKeyboardButton(
                "🆘 " + get_text("support", lang),
                callback_data="menu_support"
            ),
        ],
    ])


def get_language_keyboard() -> InlineKeyboardMarkup:
    """Build language selection keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🇬🇧 English", callback_data="lang_en"),
            InlineKeyboardButton("🇮🇷 فارسی", callback_data="lang_fa"),
        ],
        [InlineKeyboardButton("🔙 Back", callback_data="menu_main")],
    ])


def get_back_to_menu_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    """Build keyboard with just a back to menu button."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(
            "🔙 " + get_text("back", lang),
            callback_data="menu_main"
        )],
    ])


def get_wallet_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    """Build wallet menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "📥 " + get_text("deposit_button", lang),
                callback_data="wallet_deposit"
            ),
            InlineKeyboardButton(
                "📤 " + get_text("withdraw_button", lang),
                callback_data="wallet_withdraw"
            ),
        ],
        [
            InlineKeyboardButton(
                "📝 " + get_text("history_button", lang),
                callback_data="wallet_history"
            ),
        ],
        [InlineKeyboardButton("🔙 " + get_text("back", lang), callback_data="menu_main")],
    ])


def get_lobby_keyboard(tables: list, lang: str = "en") -> InlineKeyboardMarkup:
    """Build lobby keyboard with table list."""
    buttons = []
    
    for table in tables[:10]:  # Show max 10 tables
        table_id = table.get("id")
        table_name = table.get("name", f"Table #{table_id}")
        players = table.get("player_count", 0)
        max_players = table.get("max_players", 9)
        status = table.get("status", "waiting")
        
        button_text = f"{table_name} ({players}/{max_players}) - {status}"
        buttons.append([
            InlineKeyboardButton(
                button_text,
                callback_data=f"table_join_{table_id}"
            )
        ])
    
    if not buttons:
        buttons.append([InlineKeyboardButton(
            get_text("no_tables", lang, default="No active tables"),
            callback_data="noop"
        )])
    
    buttons.append([InlineKeyboardButton("🔄 Refresh", callback_data="menu_lobby")])
    buttons.append([InlineKeyboardButton("🔙 " + get_text("back", lang), callback_data="menu_main")])
    
    return InlineKeyboardMarkup(buttons)


def get_table_actions_keyboard(
    can_fold: bool = True,
    can_check: bool = False,
    can_call: bool = False,
    call_amount: int = 0,
    min_bet: int = 0,
    lang: str = "en"
) -> InlineKeyboardMarkup:
    """Build in-game action keyboard."""
    buttons = []
    
    row = []
    if can_fold:
        row.append(InlineKeyboardButton("❌ Fold", callback_data="action_fold"))
    
    if can_check:
        row.append(InlineKeyboardButton("✓ Check", callback_data="action_check"))
    elif can_call:
        row.append(InlineKeyboardButton(f"📞 Call {call_amount}", callback_data="action_call"))
    
    if row:
        buttons.append(row)
    
    # Bet/Raise buttons
    if min_bet > 0:
        bet_row = []
        # Preset bet amounts
        presets = [min_bet, min_bet * 2, min_bet * 3]
        for amount in presets[:2]:  # Show 2 presets per row
            bet_row.append(InlineKeyboardButton(
                f"💰 Bet {amount}",
                callback_data=f"action_bet_{amount}"
            ))
        if bet_row:
            buttons.append(bet_row)
        
        # Custom bet button
        buttons.append([InlineKeyboardButton(
            "💵 Custom Bet",
            callback_data="action_bet_custom"
        )])
    
    buttons.append([InlineKeyboardButton("🔙 Leave Table", callback_data="table_leave")])
    
    return InlineKeyboardMarkup(buttons)


def get_profile_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    """Build profile menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "📊 " + get_text("stats", lang, default="Statistics"),
                callback_data="profile_stats"
            ),
        ],
        [
            InlineKeyboardButton(
                "📥 " + get_text("deposit_history", lang, default="Deposit History"),
                callback_data="profile_deposits"
            ),
            InlineKeyboardButton(
                "📤 " + get_text("withdraw_history", lang, default="Withdraw History"),
                callback_data="profile_withdrawals"
            ),
        ],
        [
            InlineKeyboardButton(
                "🤝 " + get_text("invite_link", lang, default="Invite Link"),
                callback_data="profile_invite"
            ),
        ],
        [InlineKeyboardButton("🔙 " + get_text("back", lang), callback_data="menu_main")],
    ])
