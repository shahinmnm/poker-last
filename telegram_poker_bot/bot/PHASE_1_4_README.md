# Telegram Bot Phase 1.4 - Architecture Documentation

## Overview

Phase 1.4 implements a complete rewrite of the Telegram bot interface with a focus on:
- Clean separation of concerns
- Real-time gameplay via WebSockets
- Multi-language support (EN/FA)
- Inline keyboard navigation
- User profile and statistics integration

## Directory Structure

```
telegram_poker_bot/bot/
├── handlers/           # Request handlers
│   ├── callbacks.py    # Inline keyboard callback handlers
│   ├── commands.py     # Command handlers (/start, /menu, etc.)
│   ├── lobby.py        # Lobby and table browsing
│   ├── profile.py      # User profile and stats
│   ├── table.py        # Real-time table gameplay
│   └── registry.py     # Handler registration
├── keyboards/          # Inline keyboard builders
│   └── menu.py         # Menu keyboard definitions
├── services/           # Business logic services
│   └── table_sessions.py  # Active table session management
├── api/                # Backend API communication
│   └── client.py       # HTTP client for backend API
├── ws_client/          # WebSocket client
│   └── table_client.py # Real-time table updates
├── utils/              # Utility functions
│   └── helpers.py      # Format helpers, anti-flood
├── middlewares/        # Middleware components
│   └── error.py        # Global error handler
├── locales.py          # Localization strings (EN/FA)
├── i18n.py             # Translation loader
└── main.py             # Bot entry point
```

## Key Features

### 1. Command System

New commands available:
- `/start` - Main menu
- `/menu` - Show main menu
- `/lobby` - Browse active tables
- `/table <id>` - View table info
- `/profile` - View profile
- `/stats` - View statistics
- `/history_deposits` - Deposit history
- `/history_withdrawals` - Withdrawal history
- `/invite` - Get invite link
- `/language` - Change language
- `/help` - Help information

### 2. Inline Menu System

Multi-layer menu navigation with:
- **Main Menu**: Games lobby, profile, wallet, stats, invite, language, support
- **Lobby**: Browse and join active tables
- **Profile**: Stats, deposit/withdrawal history, invite link
- **Wallet**: Deposit, withdraw, transaction history
- **Settings**: Language selection (EN/FA)

### 3. Real-Time Gameplay

**WebSocket Integration:**
- Primary: WebSocket connection for real-time updates
- Fallback: Polling every 2 seconds if WebSocket fails
- Auto-reconnection with exponential backoff

**Event Types:**
- `state_snapshot` - Full table state
- `action_required` - Player's turn to act
- `action_performed` - Another player acted
- `hand_finished` - Hand result
- `game_started` - Game start notification

**Actions:**
- Fold, Check, Call
- Bet/Raise with presets or custom amount
- Leave table

### 4. User Profile Panel

Integrated with backend endpoints:
- `GET /api/users/me` - User profile
- `GET /api/users/me/stats` - Statistics
- `GET /api/users/me/balance` - Balance info
- `GET /api/users/me/transactions` - Transaction history

Displays:
- Real and play chip balances
- Hands played, total won, win rate
- Deposit/withdrawal history
- Invite link and referral stats

### 5. Table Join Flow

1. User browses lobby via `/lobby` or menu
2. User selects table from list
3. Bot calls `POST /api/tables/{id}/sit`
4. Creates table session for user
5. Establishes WebSocket connection to `/api/ws/{table_id}`
6. Starts listening for real-time updates
7. Displays current game state
8. Prompts for actions when it's user's turn

### 6. Multilingual System

**Supported Languages:**
- English (en)
- Farsi/Persian (fa)

**Implementation:**
- `locales.py` contains message templates
- `get_text(key, lang, **kwargs)` function for translations
- User language preference stored in database
- Dynamic text formatting with parameters

### 7. Error Handling & Anti-Flood

**Error Handler:**
- Global error handler for all bot updates
- Logs errors with context
- Sends user-friendly error messages

**Anti-Flood Protection:**
- Rate limiting: 20 requests per 60 seconds per user
- Automatic tracking of user requests
- Graceful handling of rate limit violations

**WebSocket Reconnection:**
- Max 5 reconnection attempts
- Exponential backoff (2^attempt seconds, max 30s)
- Automatic fallback to polling

## API Client

The `APIClient` class provides async methods for:
- User operations (profile, stats, balance, transactions)
- Table operations (list, get, join, leave, state)
- Game actions (submit_action)

Configuration:
- Base URL from `settings.vite_api_url`
- Default timeout: 10 seconds
- Error handling with logging

## WebSocket Client

The `TableWebSocketClient` handles:
- WebSocket connection management
- Message parsing and routing
- Automatic reconnection
- Connection state tracking

The `PollingClient` provides fallback:
- Polls table state every 2 seconds
- Compares with last state
- Triggers updates on changes

## Session Management

`TableSessionManager` tracks active sessions:
- One session per user (latest table)
- Stores WebSocket/polling client
- Cleanup on disconnect or leave
- Resource management (tasks, connections)

## Integration Points

**With Backend API:**
- HTTP client for REST endpoints
- WebSocket for real-time updates
- Auth via Telegram init data (future)

**With Database:**
- User profile and preferences
- Language settings
- Transaction history (via API)

**With Existing Bot:**
- Registered alongside old handlers
- Gradual migration path
- Backwards compatible

## Usage Examples

### Starting the Bot

```bash
# With Docker
docker compose up bot

# Locally
python -m telegram_poker_bot.bot.main
```

### User Flow

1. User sends `/start`
2. Bot shows main menu with buttons
3. User clicks "🎮 Games Lobby"
4. Bot shows active tables
5. User clicks a table to join
6. Bot establishes WebSocket, shows game state
7. User receives action prompt when it's their turn
8. User clicks action button (fold/call/raise)
9. Bot submits action, continues game

### Developer Flow

1. Import handlers: `from telegram_poker_bot.bot.handlers.registry import register_new_handlers`
2. Register: `register_new_handlers(application)`
3. Handlers automatically route to appropriate functions
4. Callbacks handled by `callback_query_handler`
5. Errors caught by `error_handler`

## Testing

Run tests:
```bash
python telegram_poker_bot/tests/test_new_bot_handlers.py
```

Tests cover:
- Module imports
- Keyboard generation
- Localization
- Format helpers
- Anti-flood middleware
- Session management

## Configuration

Environment variables (`.env`):
- `TELEGRAM_BOT_TOKEN` - Bot token
- `VITE_API_URL` - Backend API URL
- `MINI_APP_URL` - Mini app URL
- `BOT_USERNAME_CLEAN` - Bot username for links
- `WEBHOOK_SECRET_TOKEN` - Webhook security

## Future Enhancements

Potential improvements:
- Custom bet amount input
- Table creation from bot
- Buy-in management
- Tournament support
- More detailed statistics
- Hand history viewing
- Friend challenges
- Achievements system

## Notes

- Bot runs as FastAPI webhook service
- Handlers are async for performance
- WebSocket preferred over polling
- Minimal changes to existing code
- Ready for production deployment
