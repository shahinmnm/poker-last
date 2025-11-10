# Telegram Poker Bot with Mini App

A production-grade Telegram Poker Bot with a Mini App (WebApp) frontend, built with Python and React.

## Features

- 🎮 **Two Game Modes**: Anonymous Matchmaking and Group Games
- 🃏 **PokerKit Engine**: Uses the authoritative PokerKit library for game logic
- 🌐 **Mini App Frontend**: Modern React-based WebApp with dark/light mode
- 🌍 **i18n Support**: Internationalization from day zero
- 📊 **Stats Tracking**: Comprehensive player statistics and session history
- 🔒 **Security**: Full validation, rate limiting, and anti-spam measures
- 🚀 **Production Ready**: Docker deployment with Nginx webhook termination

## Architecture

```
telegram_poker_bot/
├── bot/              # Telegram bot service (webhook handler, commands)
├── engine_adapter/   # PokerKit integration layer
├── game_core/        # Table orchestration, matchmaking, timers
├── api/              # FastAPI service (REST + WebSocket for Mini App)
├── frontend/         # React Mini App (Vite + TypeScript + Tailwind)
├── worker/           # Async jobs (matchmaking, expiry, stats)
├── shared/           # Shared utilities and types
├── migrations/       # Database migrations
├── config/           # Configuration files
└── deploy/           # (legacy) see repository root /deploy for tooling
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker Engine 24+ with Compose plugin (for containerised workflow)

### Environment Setup

1. Copy the repository root `.env.example` to `.env` and customise the values:

   ```bash
   cp ../.env.example ../.env
   ```

2. (Optional) Copy this service-specific example for local-only overrides:

   ```bash
   cp .env.example .env.local
   ```

### Development

#### Local Python/Node toolchain

```bash
# From repository root
pip install -e .
pip install -r telegram_poker_bot/requirements.txt
# For runtime-only installs (no tests or code quality tooling):
# pip install -r telegram_poker_bot/requirements.runtime.txt

# Set up database
createdb pokerbot
alembic upgrade head

# Run services
python -m telegram_poker_bot.bot.main
uvicorn telegram_poker_bot.api.main:app --reload
```

Frontend development:

```bash
cd telegram_poker_bot/frontend
npm install
npm run dev
```

### Frontend configuration

- Copy `telegram_poker_bot/frontend/.env.example` to `.env` when you need to override defaults.  
  - `VITE_ALLOWED_HOSTS` controls which domains may load the Vite dev/preview server (comma separated).  
  - `VITE_SUPPORTED_LANGS` and `VITE_DEFAULT_LANGUAGE` define the active locale set for the mini app.  
- Translation resources live in `telegram_poker_bot/frontend/src/locales/<lang>/translation.json`. Add a folder per language and list the language code in `VITE_SUPPORTED_LANGS`.  
- The full navigation map, with English and Persian labels, is documented in `telegram_poker_bot/frontend/docs/menu-structure.md`.

#### Docker-based workflow

```bash
# Hot-reload stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Stop
docker compose down
```

### Production Deployment

```bash
# First time
./deploy/first-deploy.sh --with-nginx

# Subsequent updates (pulls from ${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH})
./deploy/update.sh --with-nginx --prune-images
```

Both scripts live at the repository root under `deploy/` and orchestrate Docker Compose builds, migrations, and restarts.

## Configuration

### Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Set webhook URL (handled automatically by the bot)

### Nginx Configuration

The bot expects Nginx to handle TLS termination and route webhooks. See the root-level `deploy/nginx/default.conf` for a production-ready template.

## Game Modes

### Anonymous Matchmaking

- Players join a private matchmaking pool
- Matched automatically when criteria met
- Private table messages sent to each player
- Mini App session shared between players

### Group Games

- Games run inside Telegram groups
- Single anchor message per table (edited for state changes)
- Private cards via Mini App or selective keyboard
- Supports 2-8 players

## Development Guidelines

- **Type Safety**: All Python code uses type hints, React uses TypeScript
- **i18n**: All user-facing strings in locale files, no inline literals
- **Logging**: Structured logging with configurable levels via `.env`
- **Testing**: Unit tests for engine adapter, integration tests for flows
- **Security**: Server-side validation for all actions, never trust client

## License

MIT License
