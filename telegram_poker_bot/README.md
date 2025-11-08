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
└── deploy/           # Deployment configs (Docker, Nginx)
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional)

### Environment Setup

1. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

2. Set required environment variables (see `.env.example` for details)

### Development

#### Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start bot service
python -m telegram_poker_bot.bot.main

# Start API service
uvicorn telegram_poker_bot.api.main:app --reload

# Start worker
python -m telegram_poker_bot.worker.main
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Production Deployment

```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## Configuration

### Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Set webhook URL (handled automatically by the bot)

### Nginx Configuration

The bot expects Nginx to handle TLS termination and route webhooks. See `deploy/nginx.conf` for reference.

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
