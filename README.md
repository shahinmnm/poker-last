# PokerKit + Telegram Poker Bot

A combined codebase containing the PokerKit Python library (multi-variant poker engine and analysis toolkit) and a production-ready Telegram poker experience (bot, FastAPI backend with WebSockets, and a React/Vite mini app). Everything ships with Docker Compose, automatic database migrations, and deployment scripts.

## Highlights
- PokerKit engine with typed APIs for Texas Hold'em, Short Deck, draw/stud variants, equity/ICM calculators, and hand-history parsing.
- Telegram bot + FastAPI service for user registration, table lifecycle, invites, and real-time play via WebSockets.
- React/Vite mini app with i18n support; backend persists tables, seats, hands, and stats in PostgreSQL with Redis-backed matchmaking.
- Docker images for backend/api, frontend, Postgres, and Redis plus optional nginx reverse proxy; migrations run automatically.
- Makefile helpers and deploy scripts (`deploy/first-deploy.sh`, `deploy/update.sh`) for repeatable operations.

## Repository Map
- `pokerkit/`: Core poker engine, game/state definitions, analysis utilities, and notation parsers.
- `telegram_poker_bot/api/`: FastAPI REST + WebSocket service for the mini app.
- `telegram_poker_bot/bot/`: Telegram webhook service and command handlers.
- `telegram_poker_bot/game_core/`: PokerKit-backed runtime manager and Redis matchmaking pool.
- `telegram_poker_bot/frontend/`: React/Vite mini app (builds to static assets served via `npm run preview` in Docker).
- `docker-compose*.yml`, `docker/`: Container definitions; `deploy/` holds bootstrap/update scripts; `Makefile` wraps common tasks.

## Prerequisites
- Docker Engine 24+ with the Compose plugin (recommended path).
- Python 3.11+ and Node.js 18+ if running locally without Docker.
- PostgreSQL 15+ and Redis 7+ reachable from the services (Compose provisions them by default).

## Configure Environment
1. Copy the template and set values:
   ```bash
   cp .env.example .env
   ```
2. Fill required keys:
   - `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN`/`WEBHOOK_SECRET_TOKEN` for webhook validation.
   - `PUBLIC_BASE_URL` and optional `WEBHOOK_PATH` (defaults to `/telegram/webhook`); the bot service will set the Telegram webhook to `PUBLIC_BASE_URL + WEBHOOK_PATH`.
   - Database/Redis overrides (`POSTGRES_*`, `DATABASE_URL`, `REDIS_URL`) if not using Compose defaults.
   - Frontend build vars (`VITE_API_URL`, `VITE_BOT_USERNAME`, `CORS_ORIGINS`) so the mini app can talk to your API origin.
   - Gameplay tuning (`SMALL_BLIND`, `BIG_BLIND`, `DEFAULT_STARTING_STACK`, `turn_timeout_seconds`, rake settings, etc.) if you need different table rules.

## Run with Docker (recommended)
1. Start the stack (runs migrations before API/bot start):
   ```bash
   make compose-up
   # or: docker compose up -d
   ```
   Services: Postgres, Redis, migrations, bot (webhook on 8443), API (8000), frontend (3000), optional nginx profile (80/443).
2. Verify migrations:
   ```bash
   docker compose logs migrations
   ```
3. Access the services:
   - API: `http://localhost:8000` (OpenAPI at `/docs`), WebSocket table events at `/api/ws/{table_id}`, lobby feed at `/api/ws/lobby`.
   - Frontend: `http://localhost:3000` (served by `npm run preview` in the frontend container).
   - Telegram webhook: `PUBLIC_BASE_URL + WEBHOOK_PATH` using the secret you configured; set `PUBLIC_BASE_URL` to a publicly reachable domain/IP.
4. Development hot reload: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`.
5. Production helper scripts:
   - First install: `./deploy/first-deploy.sh --with-nginx`
   - Updates: `./deploy/update.sh --with-nginx --prune-images`

## Local Development (without Docker)
1. Python setup:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .
   pip install -r telegram_poker_bot/requirements.txt
   ```
2. Databases: run PostgreSQL and Redis locally (or via Docker) and ensure `DATABASE_URL`/`REDIS_URL` in `.env` point to them.
3. Migrations:
   ```bash
   cd telegram_poker_bot
   alembic upgrade head
   ```
4. Run services:
   ```bash
   # FastAPI backend
   uvicorn telegram_poker_bot.api.main:app --reload --port 8000
   # Telegram webhook service
   python -m telegram_poker_bot.bot.main
   ```
   Configure your Telegram bot webhook to `PUBLIC_BASE_URL + WEBHOOK_PATH` (the bot process will attempt to set it on startup).
5. Frontend:
   ```bash
   cd telegram_poker_bot/frontend
   npm install
   npm run dev -- --host --port 3000
   ```
   Ensure `VITE_API_URL` and `VITE_BOT_USERNAME` are set for local dev.

## PokerKit Quickstart
```python
from pokerkit import Automation, Mode, NoLimitTexasHoldem

state = NoLimitTexasHoldem.create_state(
    automations=(
        Automation.ANTE_POSTING,
        Automation.BET_COLLECTION,
        Automation.BLIND_OR_STRADDLE_POSTING,
        Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
        Automation.HAND_KILLING,
        Automation.CHIPS_PUSHING,
        Automation.CHIPS_PULLING,
    ),
    ante_trimming_status=True,
    raw_antes=0,
    raw_blinds_or_straddles=(50, 100),
    min_bet=100,
    raw_starting_stacks=(10_000, 10_000),
    player_count=2,
    mode=Mode.CASH_GAME,
)

state.deal_hole("AhKh")
state.deal_hole("QsJh")
state.complete_bet_or_raise_to(300)
state.check_or_call()
state.burn_card("??")
state.deal_board("Tc9c2d")
```
Core modules expose hand evaluation, range parsing (`parse_range`), equity/ICM calculators (`calculate_equities`, `calculate_icm`), and parsers for common poker-site hand histories.

## API and Runtime Basics
- Authentication is based on Telegram init data; `/api/users/register` and `/api/users/me` handle profile bootstrap.
- Table lifecycle endpoints cover listing/joining/creating (`/api/tables`), invite codes (`/api/tables/join-by-invite`), seating/sitout/ready, starting the hand loop, and posting actions (`/api/tables/{table_id}/actions`).
- Real-time updates are delivered over WebSockets for both the lobby (`/api/ws/lobby`) and individual tables (`/api/ws/{table_id}`), backed by `PokerKitTableRuntime`.
- Persistence lives in PostgreSQL models under `telegram_poker_bot/shared/models.py`; matchmaking uses Redis via `MatchmakingPool`.

## Testing and Tooling
- Run tests: `pytest pokerkit telegram_poker_bot/tests`
- Lint/format: `ruff check pokerkit telegram_poker_bot` and `black --check pokerkit telegram_poker_bot`
- Make targets: `make compose-up`, `make compose-dev`, `make compose-down`, `make migrate`, `make test`, `make lint`

## Data and Operations Notes
- PostgreSQL data is stored in `./pgdata` when using Compose; Redis uses the named volume `redis_data`.
- Rake, blinds, and stack defaults are configurable through `.env` (see `telegram_poker_bot/shared/config.py` for all options).
- Webhook, API, and frontend ports are configurable via `.env`; defaults are 8443 (bot), 8000 (API), and 3000 (frontend).
