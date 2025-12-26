# System Map - Quick Reference Guide

**Full Documentation:** See `SYSTEM_MAP.md`

---

## Process Overview

| Process | Port | Entrypoint | Purpose |
|---------|------|------------|---------|
| API Server | 8000 | `telegram_poker_bot/api/main.py:api_app` | REST + WebSocket server |
| Bot Server | 8443 | `telegram_poker_bot/bot/main.py:app` | Telegram webhook handler |
| Frontend | 3000 | `telegram_poker_bot/frontend/src/main.tsx` | React mini app |
| PostgreSQL | 5432 | - | Primary database |
| Redis | 6379 | - | Cache + locks + queue |
| Nginx | 80/443 | `deploy/nginx/default.conf` | Reverse proxy |

---

## Key REST Endpoints

**Tables:**
- `GET /api/tables` - List tables
- `POST /api/tables` - Create table
- `POST /api/tables/{id}/join` - Join table
- `POST /api/tables/{id}/actions` - Submit action
- `GET /api/tables/{id}/state` - Get state

**User:**
- `GET /api/users/me` - Get profile
- `GET /api/users/me/stats` - Get stats
- `GET /api/users/me/balance` - Get balance

**Auth:**
- `POST /api/auth/login` - JWT login
- `POST /api/auth/refresh` - Refresh token

---

## WebSocket Endpoints

| Path | Purpose | Auth |
|------|---------|------|
| `/ws/{table_id}` | Real-time table updates | Optional |
| `/ws/lobby` | Lobby-wide updates | None |
| `/api/ws/admin` | Admin analytics feed | JWT Required |

---

## Database Tables (Core)

**Game:**
- `tables` - Table metadata
- `seats` - Player-to-table assignments
- `hands` - Hand-level state
- `actions` - Player action history

**Users:**
- `users` - User profiles + balances
- `user_poker_stats` - Aggregated statistics

**Templates:**
- `table_templates` - Reusable table configs

**Wallet:**
- `transactions` - Ledger (REAL/PLAY)

---

## Redis Keys

**Locks:**
- `lock:monitor_inter_hand` - Inter-hand monitor
- `background:check_table_inactivity` - Inactivity checker
- `background:auto_fold` - Auto-fold

**Cache:**
- `lobby:public_tables:*` - Public table cache

**Queue:**
- `matchmaking:pool` - Matchmaking queue

---

## Background Tasks

| Task | Interval | Purpose | File |
|------|----------|---------|------|
| auto_fold_expired_actions | 2s | Auto-fold timeout players | api/main.py:863 |
| check_table_inactivity | 10s | Lifecycle management | api/main.py:708 |
| monitor_table_autostart | 1s | Auto-start waiting tables | api/main.py:1225 |
| monitor_inter_hand_timeouts | 5s | Complete inter-hand phases | api/main.py:596 |

---

## Critical Code Paths

**Game Engine:**
- `telegram_poker_bot/game_core/pokerkit_runtime.py:PokerKitTableRuntime`
- ALL poker logic delegated to PokerKit library

**Table Lifecycle:**
- `telegram_poker_bot/shared/services/table_lifecycle.py`
- ONLY place for lifecycle decisions

**Table Service:**
- `telegram_poker_bot/shared/services/table_service.py`
- Create, join, leave, start tables

**Frontend WebSocket:**
- `telegram_poker_bot/frontend/src/services/WebSocketManager.ts`
- Auto-reconnect + heartbeat + delta merging

**Frontend Hooks:**
- `useTableSync.ts` - Table state sync
- `useLobbySync.ts` - Lobby sync
- `useUserChannel.ts` - User notifications

---

## Top 5 Bug Risks

1. **Concurrent Action Race** - No optimistic locking on Hand table
2. **WebSocket Desync** - No sequence numbers on reconnect
3. **Buy-In Balance Race** - No SELECT FOR UPDATE on User
4. **Waitlist Promotion Conflict** - No unique constraint enforcement
5. **Cache Invalidation Gaps** - Redis errors ignored

**Full List:** See `SYSTEM_MAP.md` Section C

---

## Event Flow Examples

**Authentication:**
1. Frontend extracts initData
2. POST /api/auth/login with X-Telegram-Init-Data header
3. Backend verifies HMAC-SHA256 signature
4. Backend upserts User record
5. Backend returns JWT tokens
6. Frontend stores tokens + fetches profile

**Join Table:**
1. POST /api/tables/{id}/join
2. Backend assigns seat + executes buy-in
3. Backend checks auto-start conditions
4. [If ready] Backend starts game via PokerKit
5. Backend broadcasts state via WebSocket
6. Frontend receives + renders table

**Submit Action:**
1. POST /api/tables/{id}/actions
2. Backend validates via PokerKit
3. Backend persists state + records action
4. Backend broadcasts state via WebSocket
5. Frontend merges delta + updates UI

---

## Configuration Sources

**Backend:**
- Environment: `.env` file
- Config: `telegram_poker_bot/shared/config.py:Settings`
- DB: `DATABASE_URL`, `POSTGRES_*`
- Redis: `REDIS_URL`, `REDIS_HOST`
- JWT: `JWT_SECRET_KEY`
- Telegram: `TELEGRAM_BOT_TOKEN`

**Frontend:**
- Build-time: `.env` → `import.meta.env`
- `VITE_API_URL` - Backend API URL
- `VITE_BOT_USERNAME` - Telegram bot username

**Docker Compose:**
- `docker-compose.yml` - Base config
- `docker-compose.dev.yml` - Dev overrides
- `docker-compose.prod.yml` - Production config

---

## Useful Commands

**Development:**
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f bot

# Run migrations
docker compose run migrations

# Shell into container
docker compose exec api bash
```

**Production:**
```bash
# Deploy
docker compose -f docker-compose.prod.yml up -d --build

# Check health
curl http://localhost:8000/api/health
```

**Database:**
```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U pokerbot -d pokerbot

# Run SQL
SELECT COUNT(*) FROM tables WHERE status = 'active';
```

**Redis:**
```bash
# Connect to Redis
docker compose exec redis redis-cli

# Check locks
KEYS lock:*

# Check cache
KEYS lobby:*
```

---

## Architecture Diagram (ASCII)

```
┌─────────────┐
│   Telegram  │
│   Bot User  │
└──────┬──────┘
       │ initData
       ▼
┌─────────────────────────────────────────────┐
│           Frontend (React SPA)              │
│  - apiClient.ts (REST)                      │
│  - WebSocketManager.ts (WS)                 │
│  - useTableSync, useLobbySync hooks         │
└───┬─────────────────────────┬───────────────┘
    │ HTTP/WS                 │ WS
    ▼                         ▼
┌─────────────────┐   ┌──────────────────┐
│  Backend API    │   │   Telegram Bot   │
│  (FastAPI)      │◄──┤   (Webhook)      │
│  - REST routes  │   │  - Command router│
│  - WebSockets   │   │  - Inline KB     │
│  - Background   │   └──────────────────┘
│    tasks        │
└─┬───────┬───────┘
  │       │
  │       └──────────────┐
  │                      │
  ▼                      ▼
┌─────────────┐    ┌─────────────┐
│ PostgreSQL  │    │    Redis    │
│ - tables    │    │ - locks     │
│ - users     │    │ - cache     │
│ - hands     │    │ - queue     │
└─────────────┘    └─────────────┘
```

---

## Learn More

- **Full System Map:** `SYSTEM_MAP.md`
- **Implementation Details:** See phase summary docs (PHASE_*_SUMMARY.md)
- **Table Templates:** `TABLE_TEMPLATE_SYSTEM_GUIDE.md`
- **Auto-Create:** `CANONICAL_AUTO_CREATE_IMPLEMENTATION.md`
- **Deployment:** `DEPLOYMENT.md`, `QUICK_DEPLOY.md`
