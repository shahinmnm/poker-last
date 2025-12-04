# Telegram Poker Bot

A production-ready poker system combining the PokerKit engine with a Telegram bot interface, FastAPI backend, and React mini app. Features template-driven table configuration, persistent SNG tables, real-time WebSocket updates, analytics engine, and admin dashboard.

## Quick Start

```bash
# Configure environment
cp .env.example .env
# Edit .env with your settings (TELEGRAM_BOT_TOKEN, DATABASE_URL, etc.)

# Start with Docker Compose
make compose-up

# Or for production deployment
./deploy/first-deploy.sh --with-nginx
```

See [Deployment Guide](./docs/deployment/overview.md) for detailed deployment instructions.

## Architecture Overview

The system consists of:

- **Backend API**: FastAPI service with REST and WebSocket endpoints
- **Telegram Bot**: Webhook-based bot for text interface
- **Frontend Mini App**: React/Vite web application
- **Game Runtime**: PokerKit engine integration with persistence
- **Analytics Engine**: Periodic data collection and insights generation
- **Data Layer**: PostgreSQL for persistence, Redis for caching

All components are template-driven, supporting multiple poker variants and flexible table configurations.

See [Architecture Documentation](./docs/architecture/overview.md) for complete details.

## Key Features

### Template-Driven Tables
All game configuration managed through templates - no hardcoded blinds, stacks, or rules. Supports Texas Hold'em, Short Deck, Omaha, Draw poker, and custom variants.

### Persistent SNG Model
Tables persist across sessions with PERSISTENT and EXPIRING types. Integrated waitlist system with FIFO ordering and automatic seating.

### Real-Time Gameplay
WebSocket connections for instant updates to lobby and table states. Fallback polling for connection resilience.

### Analytics & Insights
Non-intrusive periodic snapshots, hourly statistics aggregation, pattern detection, admin insights delivery via multiple channels.

### Multilingual Support
English and Farsi interfaces in both bot and mini app. User preference persistence.

### Variant-Aware Frontend
Adaptive UI for different poker variants. Supports 2-5 hole cards, community cards, draw poker interface.

## Repository Structure

```
poker-last/
├── docs/                          # Complete documentation
│   ├── architecture/              # System design and flows
│   ├── backend/                   # API, models, services
│   ├── bot/                       # Telegram bot
│   ├── frontend/                  # React mini app
│   ├── runtime/                   # Game engine
│   ├── analytics/                 # Analytics system
│   ├── deployment/                # Deployment guides
│   └── developer/                 # Development guides
├── pokerkit/                      # PokerKit engine
├── telegram_poker_bot/
│   ├── api/                       # FastAPI backend
│   ├── bot/                       # Telegram bot service
│   ├── frontend/                  # React/Vite mini app
│   ├── game_core/                 # Runtime manager
│   ├── shared/                    # Models and config
│   └── tests/                     # Test suite
├── deploy/                        # Deployment scripts
├── docker/                        # Docker configurations
└── docker-compose*.yml            # Service orchestration
```

## Documentation

### For Users
- [Quick Deploy Guide](./QUICK_DEPLOY.md) - Fast production deployment
- [Deployment Guide](./DEPLOYMENT.md) - Comprehensive deployment guide
- [Deployment Documentation](./docs/deployment/README.md) - Full deployment strategy and operations

### For Developers
- [Getting Started](./docs/developer/getting-started.md) - Environment setup
- [Development Workflow](./docs/developer/workflow.md) - Daily practices
- [Testing Guide](./docs/developer/testing.md) - Test suite
- [Contributing Guide](./docs/developer/contributing.md) - Contribution process

### System Documentation
- [Architecture Overview](./docs/architecture/overview.md) - System design
- [Component Interactions](./docs/architecture/components.md) - Integration details
- [Data Flow](./docs/architecture/data-flow.md) - Lifecycle documentation

### Component Documentation
- [Backend Documentation](./docs/backend/README.md) - API and services
- [Bot Documentation](./docs/bot/README.md) - Telegram bot
- [Frontend Documentation](./docs/frontend/README.md) - React mini app
- [Runtime Documentation](./docs/runtime/README.md) - Game engine
- [Analytics Documentation](./docs/analytics/README.md) - Analytics system

### Deployment & Operations
- [Deployment Strategy](./docs/deployment/strategy.md) - Comprehensive deployment approach
- [Monitoring & Operations](./docs/deployment/monitoring.md) - Production operations
- [Release Process](./docs/deployment/releases.md) - Versioning and releases
- [Secrets Management](./docs/deployment/secrets.md) - Environment and credentials

## Prerequisites

- **Docker Engine 24+** with Compose plugin (recommended)
- **Python 3.11+** and **Node.js 18+** for local development
- **PostgreSQL 15+** and **Redis 7+** (provided by Docker Compose)

## Quick Commands

```bash
# Docker Compose
make compose-up          # Start all services
make compose-dev         # Start with hot reload
make compose-down        # Stop all services

# Development
make test               # Run test suite
make lint               # Run linters
make migrate            # Run database migrations

# Deployment
./deploy/first-deploy.sh --with-nginx      # Initial deployment
./deploy/update.sh --with-nginx            # Update deployment
./deploy/backup.sh                         # Backup database
./deploy/logs.sh                           # View logs
```

## Configuration

Environment variables control all behavior. Copy `.env.example` to `.env` and configure:

**Required:**
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `PUBLIC_BASE_URL` - Your domain for webhooks
- `POSTGRES_PASSWORD` - Database password

**Optional:**
- Game parameters (blinds, stacks) - all template-driven
- Service ports and URLs
- Feature flags (wallet, waitlist)
- Analytics and insights settings

See `.env.example` for complete list and [Backend Configuration](./docs/backend/README.md) for details.

## Development Setup

```bash
# Clone and configure
git clone https://github.com/shahinmnm/poker-last.git
cd poker-last
cp .env.example .env

# Python environment
python -m venv .venv
source .venv/bin/activate
pip install -e .
pip install -r telegram_poker_bot/requirements.txt

# Database setup
cd telegram_poker_bot
alembic upgrade head

# Run backend
uvicorn telegram_poker_bot.api.main:app --reload

# Run frontend (separate terminal)
cd telegram_poker_bot/frontend
npm install
npm run dev
```

See [Getting Started Guide](./docs/developer/getting-started.md) for complete setup instructions.

## Testing

```bash
# Run all tests
pytest telegram_poker_bot/tests

# Run specific test category
pytest telegram_poker_bot/tests/backend
pytest telegram_poker_bot/tests/runtime

# With coverage
pytest --cov=telegram_poker_bot --cov-report=html
```

See [Testing Guide](./docs/developer/testing.md) for test organization and best practices.

## Production Deployment

```bash
# Initial deployment with SSL
./deploy/first-deploy.sh --with-nginx

# Request SSL certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/html \
  --email ${CERTBOT_EMAIL} --agree-tos -d ${DOMAIN_NAME}

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

See [Deployment Guide](./docs/deployment/overview.md) for complete instructions.

## API Endpoints

**User Management**
- `POST /api/users/register` - Register or login
- `GET /api/users/me` - Get profile
- `GET /api/users/me/stats` - Get statistics

**Table Operations**
- `GET /api/tables` - List tables
- `POST /api/tables` - Create table
- `POST /api/tables/{id}/sit` - Join table
- `POST /api/tables/{id}/actions` - Submit action

**WebSocket**
- `WS /api/ws/lobby` - Lobby updates
- `WS /api/ws/{table_id}` - Table updates

**Admin Analytics**
- `GET /admin/analytics/realtime` - Real-time snapshots
- `GET /admin/analytics/hourly` - Hourly statistics
- `GET /admin/insights/generate` - Generate insights

See [API Documentation](./docs/backend/api-overview.md) for complete API reference.

## Project Phases

This project was developed across multiple phases:

- **Phases 1-2**: Template-driven tables, persistent SNG, waitlist system
- **Phase 3**: Analytics engine with periodic snapshots and hourly aggregation
- **Phase 4**: Admin insights with pattern detection and delivery channels
- **Phase 5**: Variant-aware frontend and admin dashboard
- **Phase 6**: Test suite reorganization and alignment
- **Phase 7**: Documentation system rebuild and alignment
- **Phase 8**: Deployment optimization, monitoring strategy, and release pipeline

## PokerKit Integration

The system uses PokerKit as the poker engine without modification. Template configurations are translated to PokerKit parameters at runtime.

```python
from pokerkit import NoLimitTexasHoldem

# Example: Creating a game state from template
state = NoLimitTexasHoldem.create_state(
    automations=(...),
    raw_blinds_or_straddles=(small_blind, big_blind),
    raw_starting_stacks=starting_stacks,
    player_count=num_players,
    mode=Mode.CASH_GAME,
)
```

See [Runtime Documentation](./docs/runtime/pokerkit.md) for integration details.

## License

See [LICENSE](./LICENSE) file for details.

## Support

- **Documentation**: [docs/README.md](./docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/shahinmnm/poker-last/issues)
- **Deployment Help**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
