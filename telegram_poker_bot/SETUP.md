# Telegram Poker Bot - Setup Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (for production)

## Quick Start

### 1. Clone and Setup

```bash
cd telegram_poker_bot
cp .env.example .env
# Edit .env with your configuration
```

### 2. Install Dependencies

**Backend:**
```bash
pip install -r requirements.txt
pip install -e ../pokerkit  # Install PokerKit locally
```

**Frontend:**
```bash
cd frontend
npm install
```

### 3. Database Setup

```bash
# Create database
createdb pokerbot

# Run migrations
alembic upgrade head
```

### 4. Run Services

**Development:**

```bash
# Terminal 1: Bot service
python -m telegram_poker_bot.bot.main

# Terminal 2: API service
uvicorn telegram_poker_bot.api.main:app --reload

# Terminal 3: Frontend
cd frontend && npm run dev
```

**Production (Docker):**

```bash
docker-compose -f deploy/docker-compose.yml up -d
```

## Configuration

### Environment Variables

Key variables in `.env`:

- `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `PUBLIC_BASE_URL`: Your public domain (e.g., https://poker.shahin8n.sbs)
- `WEBHOOK_SECRET_TOKEN`: Secret for webhook verification

### Nginx Setup

1. Copy `deploy/nginx.conf.example` to your Nginx config
2. Update `server_name` and SSL certificate paths
3. Reload Nginx: `sudo nginx -s reload`

### Webhook Setup

The bot automatically sets the webhook on startup. Ensure:
- Nginx is configured correctly
- SSL certificate is valid
- Webhook path matches `/telegram/webhook`

## Project Structure

```
telegram_poker_bot/
├── bot/              # Telegram bot service
├── engine_adapter/   # PokerKit wrapper
├── game_core/        # Game orchestration
├── api/              # FastAPI REST + WebSocket
├── frontend/         # React Mini App
├── shared/           # Shared utilities
├── migrations/       # Database migrations
└── deploy/           # Deployment configs
```

## Features

### Game Modes

1. **Anonymous Matchmaking**: Players matched automatically
2. **Group Games**: Games in Telegram groups

### Mini App Features

- Real-time table updates via WebSocket
- Dark/light mode support
- Internationalization (i18n)
- Private card viewing
- Statistics tracking

## Development

### Running Tests

```bash
pytest tests/
```

### Code Quality

```bash
# Format code
black telegram_poker_bot/

# Lint
ruff check telegram_poker_bot/

# Type check
mypy telegram_poker_bot/
```

## Deployment

See `deploy/` directory for:
- Dockerfiles
- docker-compose.yml
- Nginx configuration example

## Troubleshooting

### Webhook Issues

- Check Nginx logs: `tail -f /var/log/nginx/poker_bot_error.log`
- Verify webhook secret token matches
- Ensure bot token is correct

### Database Issues

- Check connection string format
- Ensure PostgreSQL is running
- Run migrations: `alembic upgrade head`

## Support

For issues or questions, please open an issue on GitHub.
