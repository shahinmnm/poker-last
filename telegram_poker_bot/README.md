# Telegram Poker Bot with Mini App

A production-grade Telegram Poker Bot with a Mini App (WebApp) frontend, built with Python and React.

## Features

- 🎮 **Two Game Modes**: Anonymous Matchmaking and Group Games (with shareable link + QR invite flow)
- 🃏 **PokerKit Engine**: Uses the authoritative PokerKit library for game logic
- 🌐 **Mini App Frontend**: Modern React-based WebApp with day/night theming
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
  - Set `VITE_BOT_USERNAME` (defaults to `@pokerbazabot`) so deep-links point at the correct bot username.  
  - Override `VITE_API_BASE_URL` when serving the API from a non-default origin (defaults to `/api`).  
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

#### “Play in Group” deep-link flow

1. **Generate invite** – from the mini app tap *Play in Group*. The frontend calls `POST /group-games/invites`, which creates a `group_game_invites` record (`game_id`, `creator_user_id`, `group_id`, `status`, `expires_at`, JSON metadata) and returns both `startgroup` and `startapp` deep links.  
2. **Share link** – the UI displays a modal-style card with copy-to-clipboard support (`navigator.clipboard` with textarea fallback) and forwards instructions. The backend also DM’s the initiator with the same link so it can be forwarded inside Telegram.  
3. **Bot handshake** – group admins add the bot using the generated `startgroup` parameter. `start_group_handler` persists/upserts the Telegram group, attaches it to the invite, and replies with a launch button. Users who are not yet registered receive a `Register with bot` inline button (`start=register`).  
4. **Join & register** – the mini app listens to `start_param` and routes to `/group/join/<GAME_ID>`. It checks `/users/me`, offers one-tap registration, and then calls `POST /group-games/invites/{game_id}/attend` which returns localized progress messaging.  
5. **Launch** – once the invite status is `READY` (bot linked inside the group), players open the mini app via `startapp` and land at the table screen.  

  The full technical breakdown with schema diagrams and UI call-outs lives in [`docs/group-game-link.md`](docs/group-game-link.md) (Group Play Integration Spec).

#### API quick reference

- `POST /group-games/invites` → create invite, deep links, QR payload.
- `GET /group-games/invites/{game_id}` → fetch public status & metadata.
- `POST /group-games/invites/{game_id}/attend` → join intent.
- `GET /users/me` / `POST /users/register` → lightweight registration flow.
- Bot handlers: `/start`, `/startgroup <GAME_ID>`, inline `Register with bot` button.

#### Verification checklist

1. Generate an invite link in the mini app → link displays and copy toast appears.  
2. Open the copied `https://t.me/<bot>?startgroup=<GAME_ID>` link, add the bot to a group → bot replies with localized guidance.  
3. Join from the mini app without a user profile → registration prompt appears; after registering the `/group/join/<GAME_ID>` view shows joining progress.  
4. Switch the language toggle → invite/join screens re-render in English & Persian.  
5. Toggle the day/night theme in Settings → modals, buttons, and toast adapt to the dark palette (#121212 / #1E88E5).  
6. Forward the Telegram share message to another group and tap the inline button → the existing invite is reused and status remains `pending/ready`.  
7. Run `pytest -k "group_invite or startgroup"` → API flow and bot startgroup handler scenarios are covered by automated tests.

## Development Guidelines

- **Type Safety**: All Python code uses type hints, React uses TypeScript
- **i18n**: All user-facing strings in locale files, no inline literals
- **Logging**: Structured logging with configurable levels via `.env`
- **Testing**: Unit tests for engine adapter, integration tests for flows
- **Security**: Server-side validation for all actions, never trust client

## License

MIT License
