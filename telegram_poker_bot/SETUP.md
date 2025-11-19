# Telegram Poker Bot – Setup Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker Engine 24+ with the Compose plugin (for container workflows)

## Quick Start

### 1. Clone and Configure Environment

```bash
# From repository root
cp .env.example .env
# Edit .env with production credentials and secrets

# ℹ️ For detailed information about .env file structure, see: ../ENV_FILES.md

# Optional: local overrides for this package only (for local development without Docker)
cd telegram_poker_bot
cp .env.example .env.local
```

### 2. Install Dependencies (bare-metal workflow)

```bash
# Back-end deps
pip install -e .
pip install -r telegram_poker_bot/requirements.txt
# Runtime-only (omit tests/code quality tools):
# pip install -r telegram_poker_bot/requirements.runtime.txt

# Front-end deps
cd telegram_poker_bot/frontend
npm install
```

### 3. Database & Migrations

```bash
createdb pokerbot
alembic upgrade head
```

### 4. Run Services

**Manual processes**

```bash
python -m telegram_poker_bot.bot.main
uvicorn telegram_poker_bot.api.main:app --reload
cd telegram_poker_bot/frontend && npm run dev
```

**Docker (hot reload)**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Docker (production-style)**

```bash
./deploy/first-deploy.sh        # initial bootstrap
./deploy/update.sh              # subsequent redeploys
```

## Configuration

### Environment Variables

Key variables in `.env`:

- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
- `DATABASE_URL`: PostgreSQL connection string (the default points to the compose network)
- `REDIS_URL`: Redis connection string
- `PUBLIC_BASE_URL`: Public domain (e.g. `https://poker.example.com`)
- `WEBHOOK_SECRET_TOKEN`: Secret for webhook verification
- `DEPLOY_GIT_REMOTE` / `DEPLOY_GIT_BRANCH`: Git source for automated updates

### Nginx Setup

1. Copy `deploy/nginx/default.conf` to your host and adjust `server_name` & TLS paths  
2. Place certificates under `deploy/nginx/ssl/` (or edit `NGINX_SSL_CERT_PATH`)  
3. Bring the proxy online: `docker compose --profile nginx up -d`

### Webhook Setup

The bot sets the webhook automatically during startup. Ensure:
- Nginx is routing `PUBLIC_BASE_URL` to the bot service
- TLS certificates are valid
- `WEBHOOK_PATH` remains `/telegram/webhook`

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
└── deploy/           # (legacy) see repository root /deploy for tooling
```

## Development

### Tests

```bash
pytest telegram_poker_bot/tests
```

### Code Quality

```bash
black telegram_poker_bot/
ruff check telegram_poker_bot/
mypy telegram_poker_bot/
```

## Deployment Assets

Production automation, compose files, and Nginx templates now live in the repository root:

- `/docker-compose.yml`
- `/docker-compose.dev.yml`
- `/deploy/`

Refer to `deploy/README.md` for a full deployment playbook.

## Troubleshooting

- **Webhook issues**: check Nginx logs (`/var/log/nginx/poker_bot_error.log`) and confirm webhook secrets match  
- **Database issues**: verify credentials, ensure PostgreSQL is reachable, rerun migrations (`./deploy/update.sh --skip-pull --skip-build`)  
- **Frontend issues**: confirm `VITE_API_URL` in `.env` exposes a reachable API endpoint

## Support

For issues or questions, please open an issue on GitHub.
