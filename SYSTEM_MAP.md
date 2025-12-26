# Telegram Poker Bot - System Architecture Map

**Generated:** 2025-12-26  
**Purpose:** Senior Engineer Onboarding - Complete System Map based on real file paths and code references

---

## A) ARCHITECTURE MAP

### 1. PROCESSES & SERVICES

#### 1.1 Backend API (FastAPI)
**Entrypoint:** `telegram_poker_bot/api/main.py:api_app`  
**Port:** 8000  
**Command:** `uvicorn telegram_poker_bot.api.main:api_app --host 0.0.0.0 --port 8000`

**Responsibilities:**
- REST API endpoints for mini app
- WebSocket server for real-time table updates
- WebSocket server for lobby updates  
- WebSocket server for admin analytics
- Background tasks:
  - `auto_fold_expired_actions()` - Auto-fold players who timeout (every 2s)
  - `check_table_inactivity()` - Lifecycle management for tables (every 10s)
  - `monitor_table_autostart()` - Auto-start waiting tables when ready (every 1s)
  - `monitor_inter_hand_timeouts()` - Complete inter-hand phases after delay (every 5s)
  - Analytics scheduler via `get_analytics_scheduler()`

**Dependencies:**
- PostgreSQL (async via SQLAlchemy + asyncpg)
- Redis (async via redis.asyncio)
- PokerKit engine (via `telegram_poker_bot/game_core/pokerkit_runtime.py`)

#### 1.2 Telegram Bot (python-telegram-bot)
**Entrypoint:** `telegram_poker_bot/bot/main.py:app`  
**Port:** 8443 (webhook)  
**Command:** `python -m telegram_poker_bot.bot.main`

**Responsibilities:**
- Telegram webhook handler at `/telegram/webhook`
- Command routing (`/start`, `/menu`, `/lobby`, `/profile`, etc.)
- Inline keyboard navigation
- Group invite management
- Wallet operations via bot commands

**Handler Registration:**
- `telegram_poker_bot/bot/handlers/user_menu.py:register_user_handlers()`
- `telegram_poker_bot/bot/handlers/admin.py:register_admin_handlers()`
- `telegram_poker_bot/bot/handlers/registry.py:register_new_handlers()`
- Error handling: `telegram_poker_bot/bot/middlewares/error.py:error_handler()`

**Dependencies:**
- PostgreSQL (async)
- Redis (async)
- Backend API (HTTP client at `telegram_poker_bot/bot/api/client.py`)

#### 1.3 Frontend Mini App (React + Vite)
**Entrypoint:** `telegram_poker_bot/frontend/src/main.tsx`  
**Port:** 3000  
**Build:** `npm run build` → static files served by nginx

**Key Components:**
- `telegram_poker_bot/frontend/src/pages/Table.tsx` - Main table page
- `telegram_poker_bot/frontend/src/components/table-new/TableView.tsx` - Table rendering
- `telegram_poker_bot/frontend/src/components/table-new/ActionPanel.tsx` - Action buttons
- `telegram_poker_bot/frontend/src/components/table-new/Seat.tsx` - Player seat component

**State Management:**
- `telegram_poker_bot/frontend/src/hooks/useTableSync.ts` - WebSocket table state sync
- `telegram_poker_bot/frontend/src/hooks/useLobbySync.ts` - WebSocket lobby sync
- `telegram_poker_bot/frontend/src/hooks/useUserChannel.ts` - Per-user notifications
- `telegram_poker_bot/frontend/src/hooks/useTelegram.tsx` - Telegram WebApp SDK

**API Client:**
- `telegram_poker_bot/frontend/src/utils/apiClient.ts` - REST API wrapper
- `telegram_poker_bot/frontend/src/services/WebSocketManager.ts` - WebSocket manager with reconnect

**Types:**
- `telegram_poker_bot/frontend/src/types/game.ts` - Game state types

#### 1.4 PostgreSQL Database
**Port:** 5432  
**Database:** `pokerbot`  
**Schema:** `telegram_poker_bot/shared/models.py`

**Core Tables:**
- `users` - User profiles and balances
- `tables` - Table metadata and status
- `seats` - Player-to-table assignments
- `hands` - Hand-level game state
- `actions` - Player action history
- `hand_history` - Completed hand summaries
- `hand_history_events` - Detailed action timeline
- `table_templates` - Reusable table configurations
- `user_poker_stats` - Aggregated player statistics
- `transactions` - Wallet ledger (dual currency: REAL/PLAY)
- `waitlist_entries` - Table waitlist queue
- `group_game_invites` - Group invite links

**Migrations:**
- Alembic migrations in `telegram_poker_bot/migrations/versions/`
- Latest: `029_canonicalize_auto_create.py`

#### 1.5 Redis Cache
**Port:** 6379  
**Purpose:**
- Distributed locks for background tasks
- Public table caching (`lobby:public_tables:*`)
- Matchmaking pool (`matchmaking:pool`)
- Inter-hand phase tracking
- WebSocket connection state

**Lock Keys:**
- `lock:monitor_inter_hand` - Inter-hand monitor lock
- `background:check_table_inactivity` - Inactivity checker lock
- `background:auto_fold` - Auto-fold lock

#### 1.6 Nginx Reverse Proxy
**Ports:** 80 (HTTP), 443 (HTTPS)  
**Config:** `deploy/nginx/default.conf`

**Routing:**
- `/` → Frontend (React SPA)
- `/api/*` → Backend API (:8000)
- `/ws/*` → WebSocket endpoints (:8000)
- `/telegram/webhook` → Bot webhook (:8443)

---

### 2. REST API ROUTES

**Base:** `/api`

#### 2.1 Game Routes (`telegram_poker_bot/api/main.py:game_router`)

**Tables:**
- `GET /api/tables` - List available tables
  - Query params: `mode`, `limit`, `offset`, `lobby_persistent`
  - Uses Redis cache for public tables
- `GET /api/tables/{table_id}` - Get table details
- `POST /api/tables` - Create new table (with template_id)
- `DELETE /api/tables/{table_id}` - Delete table (host only)
- `GET /api/tables/{table_id}/state` - Get current game state
- `POST /api/tables/{table_id}/start` - Start game (host)
- `POST /api/tables/{table_id}/next-hand` - Start next hand
- `POST /api/tables/{table_id}/sng/force-start` - Force-start SNG (admin/creator)

**Table Actions:**
- `POST /api/tables/{table_id}/join` - Join table
- `POST /api/tables/{table_id}/leave` - Leave table
- `POST /api/tables/{table_id}/actions` - Submit player action (fold/check/call/bet/raise/ready)
- `POST /api/tables/{table_id}/sitout` - Toggle sit-out status
- `POST /api/tables/{table_id}/ready` - Mark ready for next hand

**Waitlist:**
- `POST /api/tables/{table_id}/waitlist/join` - Join waitlist
- `POST /api/tables/{table_id}/waitlist/leave` - Leave waitlist
- `GET /api/tables/{table_id}/waitlist` - Get waitlist status

**User:**
- `GET /api/users/me` - Get current user profile
- `GET /api/users/me/stats` - Get aggregated stats (from `user_poker_stats` table)
- `GET /api/users/me/balance` - Get chip balance (REAL + PLAY)
- `GET /api/users/me/transactions` - Get transaction history
- `GET /api/users/me/avatar` - Generate avatar image
- `GET /api/users/me/tables` - Get active tables
- `GET /api/users/me/history` - Get recent games
- `GET /api/users/me/hands` - Get recent hands

**Hand History:**
- `GET /api/tables/{table_id}/hands` - Get hand history summaries
- `GET /api/hands/{hand_id}/history` - Get detailed action timeline
- `GET /api/users/me/hands` - Get user's recent hands

**Analytics:**
- `GET /api/analytics/tables/{table_id}/snapshots` - Table snapshots
- `GET /api/analytics/tables/{table_id}/hourly-stats` - Hourly stats
- `GET /api/analytics/snapshots/recent` - Recent snapshots
- `GET /api/analytics/hourly-stats/recent` - Recent hourly stats

**Health:**
- `GET /api/health` - Health check
- `GET /api/health/auto-create` - Auto-create system status

#### 2.2 Auth Routes (`telegram_poker_bot/api/auth_routes.py:auth_router`)
- `POST /api/auth/login` - JWT login with Telegram initData
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke refresh token
- `POST /api/auth/ws-session-token` - Get WebSocket session token
- `GET /api/auth/me/roles` - Get user roles
- `POST /api/auth/revoke-all` - Revoke all tokens

#### 2.3 Admin Routes (`telegram_poker_bot/api/admin_routes.py:admin_router`)
- `GET /api/admin/analytics/realtime` - Realtime analytics
- `GET /api/admin/analytics/hourly` - Hourly analytics
- `GET /api/admin/analytics/historical` - Historical analytics
- `GET /api/admin/analytics/summary` - Analytics summary
- `GET /api/admin/insights/generate` - Generate insights
- `POST /api/admin/insights/deliver` - Deliver insights

#### 2.4 Analytics Admin Routes (`telegram_poker_bot/api/analytics_admin_routes.py`)
- `GET /api/admin/analytics/tables/{table_id}/live` - Live table data
- `GET /api/admin/analytics/tables/live` - All live tables
- `GET /api/admin/analytics/tables/{table_id}/hourly` - Table hourly stats
- `GET /api/admin/analytics/tables/{table_id}/analytics` - Table analytics
- `GET /api/admin/analytics/tables` - All tables
- `GET /api/admin/analytics/tables/{table_id}/stats` - Table stats
- `GET /api/admin/analytics/players/{user_id}/stats` - Player stats
- `GET /api/admin/analytics/anomalies` - Anomaly detection alerts
- `POST /api/admin/analytics/anomalies/{alert_id}/review` - Review anomaly
- `POST /api/admin/analytics/anomalies/scan` - Trigger anomaly scan
- `GET /api/admin/analytics/leaderboards` - Leaderboards
- `GET /api/admin/analytics/tables/{table_id}/hands` - Hand history
- `GET /api/admin/analytics/hands/{hand_id}` - Hand details
- `POST /api/admin/analytics/anomalies/{anomaly_id}/ack` - Acknowledge anomaly
- `POST /api/admin/analytics/anomalies/{anomaly_id}/resolve` - Resolve anomaly
- `POST /api/admin/analytics/export` - Export data
- `GET /api/admin/analytics/export/{job_id}` - Get export status

#### 2.5 Analytics User Routes (`telegram_poker_bot/api/analytics_user_routes.py`)
- `GET /api/analytics/users/stats` - User stats
- `GET /api/analytics/users/hands` - User hands
- `GET /api/analytics/users/sessions` - User sessions
- `GET /api/analytics/users/leaderboards` - Leaderboards
- `GET /api/analytics/users/leaderboards/my-rank` - My leaderboard rank

#### 2.6 Global Waitlist Routes (`telegram_poker_bot/api/global_waitlist_routes.py`)
- `POST /api/global-waitlist/join` - Join global waitlist
- `POST /api/global-waitlist/leave` - Leave global waitlist
- `GET /api/global-waitlist` - Get waitlist stats

#### 2.7 Table Templates Routes (`telegram_poker_bot/api/routes/table_templates.py`)
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/{template_id}` - Get template
- `PUT /api/templates/{template_id}` - Update template
- `DELETE /api/templates/{template_id}` - Delete template

---

### 3. WEBSOCKET ROUTES

**Base:** `/ws`

#### 3.1 Table WebSocket
**Path:** `/ws/{table_id}`  
**Implementation:** `telegram_poker_bot/api/main.py:websocket_endpoint()`

**Purpose:** Real-time table state updates

**Client → Server Messages:**
- `{"type": "ping"}` - Heartbeat
- `{"type": "pong"}` - Heartbeat response

**Server → Client Messages:**
- Initial snapshot on connect (full table state)
- `{"type": "state_update", ...}` - Game state change
- `{"type": "hand_ended", ...}` - Hand completion
- `{"type": "player_ready", ...}` - Player marked ready
- `{"type": "player_sitout_changed", ...}` - Sit-out status change
- `{"type": "waitlist_joined", ...}` - Waitlist entry
- `{"type": "waitlist_left", ...}` - Waitlist exit
- `{"type": "waitlist_promoted", ...}` - Waitlist promotion to seat
- `{"type": "table_ended", ...}` - Table closed
- `{"type": "table_paused", ...}` - Table paused
- `{"type": "table_removed", ...}` - Table removed
- `{"type": "ping"}` - Server heartbeat (every 30s)

**Connection Management:**
- `telegram_poker_bot/api/main.py:ConnectionManager`
- `active_connections: Dict[int, List[WebSocket]]` - table_id → websockets
- Ping/pong heartbeat every 30s
- Auto-reconnect on disconnect

#### 3.2 Lobby WebSocket
**Path:** `/ws/lobby`  
**Implementation:** `telegram_poker_bot/api/main.py:lobby_websocket_endpoint()`

**Purpose:** Lobby-wide table updates (public tables only)

**Server → Client Messages:**
- `{"type": "lobby_snapshot", "tables": [...]}` - Initial snapshot on connect
- `{"type": "TABLE_REMOVED", "table_id": ..., "status": ..., "reason": ...}` - Table removed
- `{"type": "table_created", "table": {...}}` - New table created
- `{"type": "table_updated", "table": {...}}` - Table updated
- `{"type": "ping"}` - Server heartbeat (every 30s)

**Connection Management:**
- `telegram_poker_bot/api/main.py:LobbyConnectionManager`
- `connections: List[WebSocket]` - all lobby subscribers
- Broadcasts only public tables (excludes private/invite-only)

#### 3.3 Admin Analytics WebSocket
**Path:** `/api/ws/admin`  
**Implementation:** `telegram_poker_bot/api/main.py:admin_analytics_websocket_endpoint()`

**Purpose:** Admin real-time analytics feed

**Authentication:**
- JWT token required (query param or first message)
- Admin role required

**Client → Server Messages:**
- `{"type": "auth", "token": "..."}` - Authenticate
- `{"type": "subscribe_table", "table_id": ...}` - Subscribe to table metrics
- `{"type": "unsubscribe_table", "table_id": ...}` - Unsubscribe from table
- `{"type": "subscribe_user", "user_id": ...}` - Subscribe to user activity
- `{"type": "unsubscribe_user", "user_id": ...}` - Unsubscribe from user
- `{"type": "ping"}` - Heartbeat

**Server → Client Messages:**
- `{"type": "authenticated", ...}` - Auth successful
- `{"type": "auth_error", ...}` - Auth failed
- `{"type": "subscribed", ...}` - Subscription confirmed
- `{"type": "unsubscribed", ...}` - Unsubscription confirmed
- `{"type": "table_metrics_update", ...}` - Live table metrics
- `{"type": "anomaly_alert", ...}` - Anomaly detected
- `{"type": "pot_spike_alert", ...}` - Big pot detected
- `{"type": "timeout_surge_alert", ...}` - Timeout surge detected
- `{"type": "player_activity", ...}` - Player activity indicator
- `{"type": "pong"}` - Heartbeat response

**Connection Management:**
- `telegram_poker_bot/shared/services/admin_analytics_ws.py:AdminAnalyticsWSManager`
- Per-connection subscriptions tracking

---

### 4. GAME RUNTIME ARCHITECTURE

#### 4.1 Game Engine
**Primary:** `telegram_poker_bot/game_core/pokerkit_runtime.py:PokerKitTableRuntime`

**Design:**
- ALL poker logic delegated to PokerKit library
- No custom dealing, betting, or pot calculation
- Engine state persisted to `Hand.engine_state_json` after each action
- Multi-worker safe: state loaded from DB on first access, persisted after mutations

**Key Methods:**
- `start_game(db, table_id)` - Initialize new game
- `handle_action(db, table_id, user_id, action, amount)` - Process player action
- `get_state(db, table_id, viewer_user_id)` - Get current state (viewer-specific)
- `mark_player_ready(db, table_id, user_id)` - Mark ready for next hand
- `complete_inter_hand_phase(db, table_id)` - Start next hand after inter-hand wait

**Engine Adapter:**
- `telegram_poker_bot/engine_adapter/adapter.py:PokerEngineAdapter`
- Wraps PokerKit `State` for NLH and Short Deck
- Handles card dealing, board progression, pot calculation
- Serializes state to/from JSON

**Manager:**
- `telegram_poker_bot/game_core/pokerkit_runtime.py:PokerKitTableRuntimeManager`
- Singleton manager for runtime instances
- Per-table runtime caching (in-memory, per-process)
- `get_pokerkit_runtime_manager()` - Get global manager

#### 4.2 Table Lifecycle
**Service:** `telegram_poker_bot/shared/services/table_lifecycle.py`

**Rules:**
- **Persistent tables** (lobby_persistent=True, is_auto_generated=True, or template type PERSISTENT/CASH_GAME):
  - NEVER auto-delete
  - Pause (WAITING) when empty, not end
  - No pre-start TTL
- **Regular tables** (SNGs, private games):
  - Pre-start TTL: 10min (public) / 60min (private)
  - Post-start inactivity: Mark EXPIRED after timeout
  - Self-destruct: Delete when < 2 active players

**Functions:**
- `is_persistent_table(table)` - Check if table is persistent
- `should_table_be_listed_publicly(table)` - Visibility rules
- `compute_prestart_expiry(db, table)` - Pre-start TTL check
- `check_and_enforce_lifecycle(db, table)` - Generic lifecycle check
- `mark_table_expired(db, table, reason)` - Mark table EXPIRED
- `mark_table_completed_and_cleanup(db, table, reason)` - End table and cleanup

**Listeners:**
- `register_table_status_listener(callback)` - Register status change callback
- Used to broadcast table removal to lobby WebSocket

#### 4.3 Table Service
**Service:** `telegram_poker_bot/shared/services/table_service.py`

**Key Functions:**
- `create_table(db, template_id, creator_user_id, ...)` - Create table from template
- `start_table(db, table_id, user_id)` - Start waiting table
- `join_table(db, table_id, user_id)` - Join table and assign seat
- `leave_table(db, table_id, user_id)` - Leave table and mark seat left
- `get_table_info(db, table_id, viewer_user_id)` - Get table details
- `list_available_tables(db, ...)` - List public tables (with Redis cache)
- `parse_template_rules(config)` - Parse template config into `TableRuleConfig`
- `get_template_config(table)` - Extract config from table's template
- `get_table_currency_type(table)` - Resolve currency type (REAL/PLAY)
- `get_table_game_variant(table)` - Resolve game variant

**Template Config Structure:**
```python
{
  "backend": {
    "small_blind": int,
    "big_blind": int,
    "starting_stack": int,
    "max_players": int,
    "ante": int,
    "rake_percentage": float,  # 0-1
    "rake_cap": int,
    "turn_timeout_seconds": int,
    "game_variant": str,  # "no_limit_texas_holdem", "no_limit_short_deck_holdem"
    "currency_type": str,  # "REAL", "PLAY"
    "sng_enabled": bool,
    "sng_min_players": int,
    "sng_join_window_seconds": int,
  },
  "ui_schema": {
    "layout": {...},
    "theme": {...},
    "timers": {...},
  },
  "auto_create": {
    "enabled": bool,
    "min_tables": int,
    "max_tables": int,
    "on_startup_repair": bool,
  }
}
```

#### 4.4 Stats Processor
**Service:** `telegram_poker_bot/game_core/stats_processor.py:StatsProcessor`

**Purpose:** Update aggregated player stats after each hand

**Key Methods:**
- `ensure_user_stats(db, user_id)` - Create/get UserPokerStats record
- `calculate_vpip(db, hand, user_id)` - Check if user voluntarily put $ in pot
- `calculate_pfr(db, hand, user_id)` - Check if user raised pre-flop
- `process_hand_completion(db, hand_id)` - Update stats for all players in hand

**Stats Tracked:**
- `total_hands` - Total hands played
- `wins` - Total hands won
- `vpip_count` - Voluntarily Put $ In Pot count
- `pfr_count` - Pre-Flop Raise count
- `total_winnings` - Total chips won
- `best_hand_rank` - Best hand achieved

#### 4.5 Buy-In Service
**Service:** `telegram_poker_bot/shared/services/table_buyin_service.py:TableBuyInService`

**Purpose:** Handle table buy-ins with dual currency support

**Key Methods:**
- `check_and_enforce_buyin(db, user, table, transaction_service)` - Validate and execute buy-in
- Supports REAL and PLAY currency
- Creates `BUY_IN` transaction in wallet ledger
- Validates min/max buy-in limits

---

### 5. DATABASE SCHEMA

**ORM:** SQLAlchemy (async)  
**Migrations:** Alembic (`telegram_poker_bot/migrations/`)

#### Core Models (`telegram_poker_bot/shared/models.py`)

**Users & Auth:**
- `User` - User profiles
  - `id` (PK), `tg_user_id` (unique), `username`, `balance_real`, `balance_play`
  - `language`, `referrer_id`, `referral_code`
- `UserPokerStats` - Aggregated player statistics
  - `user_id` (FK), `total_hands`, `wins`, `vpip_count`, `pfr_count`, `total_winnings`
- `RefreshToken` - JWT refresh tokens
- `WSSessionToken` - WebSocket session tokens

**Tables & Games:**
- `Table` - Table metadata
  - `id` (PK), `template_id` (FK), `creator_user_id` (FK), `status` (enum)
  - `is_public`, `lobby_persistent`, `is_auto_generated`
  - `invite_code`, `expires_at`, `last_action_at`
- `Seat` - Player-to-table assignments
  - `id` (PK), `table_id` (FK), `user_id` (FK), `position`, `chips`
  - `left_at`, `is_sitting_out_next_hand`
- `Hand` - Hand-level game state
  - `id` (PK), `table_id` (FK), `hand_no`, `status` (enum)
  - `engine_state_json` (JSONB), `timeout_tracking` (JSONB)
  - `started_at`, `ended_at`
- `Action` - Player action history
  - `id` (PK), `hand_id` (FK), `user_id` (FK), `type` (enum), `amount`
  - `created_at`

**Templates:**
- `TableTemplate` - Reusable table configurations
  - `id` (PK), `name`, `table_type` (enum), `config_json` (JSONB)
  - `has_waitlist`, `is_active`

**Hand History:**
- `HandHistory` - Completed hand summaries
  - `id` (PK), `table_id` (FK), `hand_no`, `payload_json` (JSONB)
  - `created_at`
- `HandHistoryEvent` - Detailed action timeline
  - `id` (PK), `hand_id` (FK), `sequence`, `street`, `action_type`
  - `actor_user_id`, `amount`, `pot_size`, `board_cards`

**Wallet:**
- `Transaction` - Wallet ledger (dual currency)
  - `id` (PK), `user_id` (FK), `type` (enum), `amount`, `balance_after`
  - `currency_type` (REAL/PLAY), `reference_id`, `metadata_json`

**Waitlist:**
- `WaitlistEntry` - Table waitlist queue
  - `id` (PK), `table_id` (FK), `user_id` (FK), `status` (enum)
  - `position`, `created_at`
- `GlobalWaitlistEntry` - Cross-table matchmaking queue
  - `id` (PK), `user_id` (FK), `preferences` (JSONB), `status` (enum)

**Invites:**
- `GroupGameInvite` - Group invite links
  - `id` (PK), `creator_id` (FK), `group_id` (FK), `game_id` (unique)
  - `status` (enum), `invite_token`, `expires_at`

**Analytics:**
- `TableSnapshot` - Periodic table state snapshots
  - `id` (PK), `table_id` (FK), `snapshot_time`, `player_count`, `is_active`
  - `metadata_json` (JSONB)
- `HourlyTableStats` - Hourly aggregated table stats
  - `id` (PK), `table_id` (FK), `hour_start`, `avg_players`, `max_players`
  - `total_hands`, `activity_minutes`
- `AnomalyAlert` - Detected anomalies
  - `id` (PK), `alert_type`, `severity`, `table_id`, `user_id`
  - `detected_at`, `acknowledged_at`, `resolved_at`

**Referrals:**
- `ReferralStats` - Referral program statistics
  - `user_id` (FK, PK), `total_referrals`, `active_referrals`
  - `lifetime_earnings`, `updated_at`

---

### 6. REDIS USAGE

**Client:** `redis.asyncio` (async)  
**Connection:** `telegram_poker_bot/game_core/manager.py:get_redis_client()`

#### 6.1 Distributed Locks
**Purpose:** Multi-worker coordination

**Keys:**
- `lock:monitor_inter_hand` - Inter-hand monitor (TTL: 30s)
- `background:check_table_inactivity` - Inactivity checker (TTL: 25s)
- `background:auto_fold` - Auto-fold (TTL: 5s)

**Pattern:**
```python
lock_acquired = await redis_client.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL)
if lock_acquired:
    try:
        # Critical section
        pass
    finally:
        await redis_client.delete(LOCK_KEY)
```

#### 6.2 Public Table Cache
**Purpose:** Fast lobby listing (avoid DB queries)

**Keys:**
- `lobby:public_tables:keys` - Set of cached table keys
- `lobby:public_tables:{table_id}` - Individual table data (JSON)

**Functions:**
- `telegram_poker_bot/shared/services/table_service.py:list_available_tables()` - Read cache
- `telegram_poker_bot/shared/services/table_service.py:invalidate_public_table_cache()` - Clear cache

**Cache Strategy:**
- Write-through on table creation/update
- Invalidate on any table mutation
- TTL: No expiry (explicit invalidation only)

#### 6.3 Matchmaking Pool
**Purpose:** Global waitlist for quick matches

**Key:** `matchmaking:pool` (sorted set)  
**Manager:** `telegram_poker_bot/game_core/manager.py:MatchmakingPool`

**Operations:**
- `add_player(user_id, prefs)` - Add to pool (score = timestamp)
- `remove_player(user_id)` - Remove from pool
- `get_waiting_players(min_players)` - Get N oldest entries
- `clear_expired()` - Remove entries older than TTL

**TTL:** `settings.matchmaking_pool_ttl` (default: 120s)

---

## B) EVENT FLOW DIAGRAMS

### Flow 1: Open Mini App → Authenticate → Load Profile

**Actors:** User, Frontend, Backend API, PostgreSQL

**Sequence:**

1. **User opens mini app** (Telegram WebApp)
   ```
   Telegram → Frontend
   Event: onTelegramAuth()
   File: telegram_poker_bot/frontend/src/hooks/useTelegram.tsx
   ```

2. **Frontend extracts initData**
   ```
   Frontend extracts initDataUnsafe from window.Telegram.WebApp
   Includes: user { id, username, first_name, last_name, language_code }
   Hook: useTelegram() -> initDataUnsafe
   ```

3. **Frontend calls /api/auth/login**
   ```
   POST /api/auth/login
   Headers: X-Telegram-Init-Data: <initData>
   File: telegram_poker_bot/frontend/src/utils/apiClient.ts
   Handler: telegram_poker_bot/api/auth_routes.py:login()
   ```

4. **Backend verifies initData signature**
   ```
   Function: verify_telegram_init_data(init_data)
   File: telegram_poker_bot/api/main.py:1562-1608
   Algorithm: HMAC-SHA256 with bot token
   Returns: UserAuth { user_id, username, first_name, last_name, language_code }
   ```

5. **Backend ensures user exists**
   ```
   Function: ensure_user(db, auth)
   File: telegram_poker_bot/api/main.py:1611-1640
   - Upserts User record (INSERT ON CONFLICT UPDATE)
   - Sets initial balance (PLAY currency)
   - Updates last_seen_at
   Returns: User object
   ```

6. **Backend generates JWT tokens**
   ```
   Service: jwt_auth_service.py:create_tokens(user_id)
   Returns: { access_token, refresh_token }
   File: telegram_poker_bot/shared/services/jwt_auth_service.py
   ```

7. **Frontend stores tokens**
   ```
   localStorage.setItem('access_token', token)
   localStorage.setItem('refresh_token', refreshToken)
   ```

8. **Frontend fetches user profile**
   ```
   GET /api/users/me
   Headers: Authorization: Bearer <access_token>
   Handler: telegram_poker_bot/api/main.py:get_user_profile()
   ```

9. **Backend returns profile**
   ```json
   {
     "registered": true,
     "user_id": 12345,
     "username": "johndoe",
     "language": "en",
     "balance_play": 100000,
     "balance_real": 0
   }
   ```

10. **Frontend updates UI**
    ```
    Component: src/pages/Lobby.tsx
    Displays: username, balance, navigation
    ```

---

### Flow 2: Join Table → Seat Assignment → Start Hand

**Actors:** User, Frontend, Backend API, WebSocket, PokerKit Engine, PostgreSQL

**Sequence:**

1. **User clicks "Join Table" button**
   ```
   Component: src/components/lobby/TableCard.tsx
   Event: onClick={() => joinTable(tableId)}
   ```

2. **Frontend calls /api/tables/{table_id}/join**
   ```
   POST /api/tables/5/join
   Headers: X-Telegram-Init-Data: <initData>
   Handler: telegram_poker_bot/api/main.py:join_table()
   File: Line 2353-2483
   ```

3. **Backend validates request**
   ```
   - Verify initData signature
   - Ensure user exists
   - Load table from DB (with template)
   Function: table_service.join_table(db, table_id, user_id)
   File: telegram_poker_bot/shared/services/table_service.py
   ```

4. **Backend assigns seat**
   ```
   - Find next available position
   - Create Seat record
     - table_id, user_id, position, chips (from buy-in)
     - left_at = NULL, is_sitting_out_next_hand = False
   - Execute buy-in (if required)
     Function: TableBuyInService.check_and_enforce_buyin()
     File: telegram_poker_bot/shared/services/table_buyin_service.py
   ```

5. **Backend checks auto-start conditions**
   ```
   Function: sng_manager.check_auto_start_conditions(db, table)
   File: telegram_poker_bot/shared/services/sng_manager.py
   Rules:
     - Persistent tables: Start when >= 2 seated players
     - SNG tables: Start when >= sng_min_players
   ```

6. **[If auto-start triggered] Backend starts game**
   ```
   Function: table_service.start_table(db, table_id, user_id=None)
   - Updates table.status = ACTIVE
   
   Function: runtime_mgr.start_game(db, table_id)
   File: telegram_poker_bot/game_core/pokerkit_runtime.py:start_game()
   Steps:
     a. Load active seats from DB
     b. Create PokerEngineAdapter with PokerKit
        - Initialize NoLimitTexasHoldem state
        - Set blinds, stacks, button position
     c. Deal hole cards to all players
     d. Create Hand record
        - hand_no = 1, status = PREFLOP
        - engine_state_json = serialized PokerKit state
     e. Return public state
   ```

7. **Backend broadcasts game start via WebSocket**
   ```
   WebSocket broadcast to /ws/{table_id}
   Function: manager.broadcast(table_id, state)
   File: telegram_poker_bot/api/main.py:ConnectionManager.broadcast()
   
   Message:
   {
     "type": "state_update",
     "status": "active",
     "hand_no": 1,
     "current_actor": 67890,  // user_id of first to act
     "allowed_actions": [
       {"action_type": "fold"},
       {"action_type": "call", "amount": 20},
       {"action_type": "raise", "min_amount": 40, "max_amount": 1000}
     ],
     "seats": [
       {"user_id": 12345, "position": 0, "chips": 1000, "hole_cards": null},
       {"user_id": 67890, "position": 1, "chips": 980, "hole_cards": null}
     ],
     "pots": [{"amount": 30}],
     "board": [],
     "street": "preflop",
     "action_deadline": "2025-12-26T14:00:00Z"
   }
   ```

8. **Frontend receives WebSocket message**
   ```
   Hook: useTableSync({ tableId })
   File: telegram_poker_bot/frontend/src/hooks/useTableSync.ts
   Handler: onSnapshot(snapshot) -> setState(snapshot)
   ```

9. **Frontend updates UI**
   ```
   Component: src/components/table-new/TableView.tsx
   Renders:
     - Player seats (Seat.tsx)
     - Community cards
     - Pot size
     - Action panel (if current actor)
   
   Component: src/components/table-new/ActionPanel.tsx
   Shows: Fold, Call $20, Raise buttons (if user is current actor)
   ```

---

### Flow 3: Player Action → Backend Validation → Broadcast → UI Update

**Actors:** User, Frontend, Backend API, PokerKit Engine, WebSocket, PostgreSQL

**Sequence:**

1. **User clicks "Call" button**
   ```
   Component: src/components/table-new/ActionPanel.tsx
   Event: onClick={() => handleAction('call', 20)}
   ```

2. **Frontend calls /api/tables/{table_id}/actions**
   ```
   POST /api/tables/5/actions
   Headers: X-Telegram-Init-Data: <initData>
   Body: { "action_type": "call", "amount": 20 }
   Handler: telegram_poker_bot/api/main.py:submit_action()
   File: Line 3308-3426
   ```

3. **Backend validates request**
   ```
   - Verify initData signature
   - Ensure user exists
   - Parse action type (fold/check/call/bet/raise)
   - Load table and hand from DB
   ```

4. **Backend validates action via PokerKit**
   ```
   Function: runtime_mgr.handle_action(db, table_id, user_id, action, amount)
   File: telegram_poker_bot/game_core/pokerkit_runtime.py:handle_action()
   
   Steps:
     a. Load runtime from cache or DB
     b. Verify user is current actor
        - Check engine.state.actor_indices
        - If not, raise NotYourTurnError
     c. Verify action is legal
        - Check engine.state.can_call() / can_fold() / can_bet_or_raise()
        - If not, raise ValueError
     d. Execute action on PokerKit engine
        - engine.state.fold() / call() / complete_bet_or_raise_to(amount)
     e. Record action in DB
        - Create Action record (hand_id, user_id, type, amount)
        - Create HandHistoryEvent record (sequence, street, action_type, ...)
     f. Update table.last_action_at = now
     g. Check if hand completed
        - If all-in or showdown: compute winners, update balances
        - If not: advance to next street if needed (deal flop/turn/river)
   ```

5. **Backend persists state**
   ```
   - Update Hand.engine_state_json = serialized PokerKit state
   - Update Seat.chips for all players
   - If hand completed:
     - Update Hand.status = ENDED
     - Create HandHistory record
     - Trigger StatsProcessor.process_hand_completion()
   - Commit DB transaction
   ```

6. **Backend broadcasts state via WebSocket**
   ```
   WebSocket broadcast to /ws/{table_id}
   Function: manager.broadcast(table_id, public_state)
   
   Message (mid-hand):
   {
     "type": "state_update",
     "hand_no": 1,
     "current_actor": 12345,  // next player to act
     "allowed_actions": [
       {"action_type": "fold"},
       {"action_type": "check"}
     ],
     "seats": [
       {"user_id": 12345, "position": 0, "chips": 980, "hole_cards": null},
       {"user_id": 67890, "position": 1, "chips": 960, "hole_cards": null}
     ],
     "pots": [{"amount": 70}],
     "board": ["As", "Kh", "7d"],  // flop dealt
     "street": "flop",
     "action_deadline": "2025-12-26T14:00:10Z"
   }
   
   Message (hand completed):
   {
     "type": "hand_ended",
     "hand_no": 1,
     "winners": [
       {"user_id": 12345, "amount": 150, "hand_rank": "pair"}
     ],
     "pot_total": 150,
     "rake_amount": 8,
     "board": ["As", "Kh", "7d", "2c", "9s"],
     "showdown": [
       {"user_id": 12345, "hole_cards": ["Ad", "Ah"]}
     ],
     "allowed_actions": [
       {"action_type": "ready"}  // for next hand
     ],
     "inter_hand_wait": true
   }
   ```

7. **Frontend receives WebSocket message**
   ```
   Hook: useTableSync({ tableId })
   Handler: onDelta(delta) -> setState(deepMerge(prev, delta.payload))
   File: telegram_poker_bot/frontend/src/hooks/useTableSync.ts
   ```

8. **Frontend updates UI**
   ```
   Component: src/components/table-new/TableView.tsx
   Updates:
     - Player chips (animated chip movement)
     - Pot size (animated chip collection)
     - Community cards (reveal animation)
     - Action panel (show "Ready" button if hand ended)
   
   Component: src/components/table-new/Seat.tsx
   Updates:
     - Player hole cards (if showdown)
     - Winner badge (if won)
     - Chips (fade in/out animation)
   ```

9. **[If hand ended] Inter-hand wait phase**
   ```
   Duration: settings.post_hand_delay_seconds (default: 5s)
   Background task: monitor_inter_hand_timeouts()
   File: telegram_poker_bot/api/main.py:596-706
   
   When all players ready OR timeout expires:
     - Call runtime_mgr.complete_inter_hand_phase(db, table_id)
     - Start next hand
     - Broadcast new hand state
   ```

---

## C) TOP 10 HIGH-RISK BUG AREAS

### 1. **Race Condition: Concurrent Action Submissions**

**Risk:** Multiple players submitting actions simultaneously, causing inconsistent state

**Files:**
- `telegram_poker_bot/api/main.py:submit_action()` (Line 3308-3426)
- `telegram_poker_bot/game_core/pokerkit_runtime.py:handle_action()` (Line 800-1100)

**Scenario:**
- Player A and Player B both current actor (due to race)
- Both submit actions at same time
- First action succeeds, second gets NotYourTurnError
- But DB transaction not isolated properly

**Mitigation:**
- Add optimistic locking on `Hand` table (version column)
- Use `SELECT FOR UPDATE` when loading hand
- Wrap action in atomic DB transaction

**Evidence:**
```python
# Line 3378-3384 in api/main.py
public_state = await runtime_mgr.handle_action(
    db,
    table_id=table_id,
    user_id=user.id,
    action=action_type,
    amount=action.amount,
)
# NO explicit transaction isolation here!
```

---

### 2. **WebSocket State Desync: Missed Broadcasts**

**Risk:** Client misses critical state update due to network blip or reconnect

**Files:**
- `telegram_poker_bot/frontend/src/services/WebSocketManager.ts` (Line 1-200)
- `telegram_poker_bot/frontend/src/hooks/useTableSync.ts` (Line 1-100)

**Scenario:**
- Client connected to /ws/{table_id}
- Server broadcasts hand_ended event
- Network blip causes disconnect
- Client reconnects, but missed the hand_ended
- Client shows stale state (hand still active)

**Mitigation:**
- Implement sequence numbers for messages (partially done)
- On reconnect, request full snapshot
- Use `requestSnapshot()` on connection restore

**Evidence:**
```typescript
// WebSocketManager.ts Line 85-92
this.socket.onopen = () => this.handleOpen()
// handleOpen() does NOT request snapshot on reconnect!
// Should call: this.requestSnapshot()
```

---

### 3. **Inter-Hand Phase Timeout Desync**

**Risk:** Multiple workers processing same inter-hand timeout

**Files:**
- `telegram_poker_bot/api/main.py:monitor_inter_hand_timeouts()` (Line 596-706)

**Scenario:**
- Table in INTER_HAND_WAIT status
- Worker A acquires lock, processes timeout
- Lock expires (30s TTL)
- Worker B acquires lock, processes again
- Duplicate hand start

**Mitigation:**
- Check hand status AFTER acquiring lock
- Use DB-level optimistic locking
- Reduce lock TTL to match operation time

**Evidence:**
```python
# Line 623-628 in api/main.py
lock_acquired = await redis_client.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL)
if not lock_acquired:
    logger.debug("Inter-hand monitor lock held by another worker, skipping")
    continue
# But LOCK_TTL=30s is too long for quick operations!
```

---

### 4. **Auto-Fold Race with Manual Action**

**Risk:** Player submits action while auto-fold executes, causing duplicate action

**Files:**
- `telegram_poker_bot/api/main.py:auto_fold_expired_actions()` (Line 863-1223)
- `telegram_poker_bot/api/main.py:submit_action()` (Line 3308-3426)

**Scenario:**
- Player A's action deadline expires
- Auto-fold task starts processing
- Player A submits action at exact moment
- Both try to execute action on same hand state
- PokerKit throws error or processes duplicate

**Mitigation:**
- Use optimistic locking on Hand table
- Re-check actor after acquiring lock
- Validate action_deadline hasn't changed

**Evidence:**
```python
# Line 1021-1036 in api/main.py (auto_fold)
fresh_state = await runtime_mgr.get_state(db, table.id, viewer_user_id=None)
if fresh_state.get("current_actor") != current_actor_user_id:
    logger.debug("Actor changed before auto-fold, skipping")
    continue
# This check is AFTER deadline check, but action could have been submitted between!
```

---

### 5. **Buy-In Balance Check Race**

**Risk:** Player joins two tables simultaneously, both succeed, balance goes negative

**Files:**
- `telegram_poker_bot/shared/services/table_buyin_service.py:check_and_enforce_buyin()` (Line 50-150)
- `telegram_poker_bot/api/main.py:join_table()` (Line 2353-2483)

**Scenario:**
- Player has 1000 chips balance
- Player joins Table A (buy-in 800)
- Player joins Table B (buy-in 800) at same time
- Both check balance (1000 >= 800), both succeed
- Final balance: -600 (invalid!)

**Mitigation:**
- Use SELECT FOR UPDATE on User record
- Atomic balance deduction with check constraint
- Add DB constraint: balance_play >= 0

**Evidence:**
```python
# table_buyin_service.py - No visible SELECT FOR UPDATE
# User table has NO check constraint on balance_play
```

---

### 6. **Waitlist Promotion Race**

**Risk:** Multiple players promoted to same seat position

**Files:**
- `telegram_poker_bot/api/main.py:leave_table()` (Line 2485-2600)
- `telegram_poker_bot/shared/services/waitlist_service.py:promote_next_from_waitlist()`

**Scenario:**
- Player leaves Table A, seat position 3 freed
- Waitlist has Player X and Player Y
- Both get promoted to position 3
- Conflict in Seat table

**Mitigation:**
- Use database-level unique constraint on (table_id, position, left_at IS NULL)
- Catch IntegrityError and retry with next waitlist entry
- Lock waitlist entry during promotion

**Evidence:**
```python
# Line 2539-2559 in api/main.py
waitlist_seat = await waitlist_service.promote_next_from_waitlist(db, table_id)
# No transaction isolation or retry logic on IntegrityError
```

---

### 7. **Template Auto-Create Duplicate Tables**

**Risk:** Multiple workers create tables for same template, exceeding min_tables

**Files:**
- `telegram_poker_bot/api/main.py:startup_auto_create_tables()` (Line 1309-1497)
- `telegram_poker_bot/services/table_auto_creator.py:ensure_tables_for_template()`

**Scenario:**
- Template configured for min_tables=2
- Worker A starts up, counts 0 tables, creates 2
- Worker B starts up at same time, counts 0 tables, creates 2
- Result: 4 tables (2 extra)

**Mitigation:**
- Use distributed lock per template_id during creation
- Recount tables after acquiring lock
- Use database-level check on template creation

**Evidence:**
```python
# startup_auto_create_tables() - No lock per template
# Only runs once on startup, but multiple workers can start simultaneously
```

---

### 8. **Public Table Cache Invalidation Gaps**

**Risk:** Stale table data shown in lobby after table mutation

**Files:**
- `telegram_poker_bot/shared/services/table_service.py:list_available_tables()` (Line 500-700)
- `telegram_poker_bot/shared/services/table_service.py:invalidate_public_table_cache()` (Line 800-850)

**Scenario:**
- Table A status changes from WAITING to ACTIVE
- Backend updates DB
- Cache invalidation fails (Redis error)
- Lobby shows Table A as WAITING (stale)

**Mitigation:**
- Always invalidate cache in same transaction
- Use cache-aside pattern (check DB on cache miss)
- Add TTL to cached entries

**Evidence:**
```python
# Line 2909-2913 in api/main.py
try:
    matchmaking_pool = await get_matchmaking_pool()
    await table_service.invalidate_public_table_cache(matchmaking_pool.redis)
except Exception as exc:  # pragma: no cover
    logger.warning("Failed to invalidate public table cache after start", error=str(exc))
# Cache invalidation failure is IGNORED!
```

---

### 9. **Frontend State Merge Bugs**

**Risk:** Incomplete or incorrect state merge on delta updates

**Files:**
- `telegram_poker_bot/frontend/src/hooks/useTableSync.ts:deepMerge()` (Line 36-61)

**Scenario:**
- Server sends delta: { "pots": [{"amount": 100}] }
- Client state has: { "pots": [{"amount": 50}, {"amount": 30}] }
- Deep merge replaces entire array: { "pots": [{"amount": 100}] }
- Side pot lost!

**Mitigation:**
- Use more sophisticated merge logic (lodash.merge)
- Or server sends full state on critical updates
- Add state version numbers

**Evidence:**
```typescript
// Line 48-49 in useTableSync.ts
} else if (Array.isArray(sourceValue)) {
  // Replace arrays completely (no partial array merge)
  result[key] = sourceValue as T[Extract<keyof T, string>]
}
// This is correct for most cases but dangerous for nested arrays
```

---

### 10. **Persistent Table Auto-Cleanup**

**Risk:** Persistent tables incorrectly marked EXPIRED or ENDED

**Files:**
- `telegram_poker_bot/api/main.py:check_table_inactivity()` (Line 708-861)
- `telegram_poker_bot/shared/services/table_lifecycle.py:is_persistent_table()` (Line 67-91)

**Scenario:**
- Table has lobby_persistent=True
- Table becomes empty (all players leave)
- Inactivity checker runs
- Logic checks template type, but template relation not loaded
- table.template is None, so is_persistent_table() returns False
- Table marked EXPIRED (should stay WAITING)

**Mitigation:**
- Always joinedload template relation
- Add defensive checks for None template
- Log when persistent table is about to be deleted

**Evidence:**
```python
# Line 742-755 in api/main.py
result = await db.execute(
    select(Table)
    .options(joinedload(Table.template))  # GOOD: template loaded
    .where(Table.status.in_([TableStatus.ACTIVE, TableStatus.WAITING]))
)
# But other queries may not load template, causing AttributeError
```

---

## SUMMARY

This system map documents the **exact file paths, function names, and line numbers** for all critical components of the Telegram Poker Bot. The architecture follows a clean separation:

1. **Backend API (FastAPI)** - REST + WebSocket server with background tasks
2. **Telegram Bot (python-telegram-bot)** - Command handler and webhook receiver
3. **Frontend (React + Vite)** - Mini app with real-time WebSocket sync
4. **PostgreSQL** - Primary data store with 30+ tables
5. **Redis** - Distributed locks, cache, and matchmaking queue
6. **PokerKit Engine** - Poker game logic (delegated to library)

The top 10 high-risk areas identified are:
1. Concurrent action race conditions
2. WebSocket state desync
3. Inter-hand timeout races
4. Auto-fold vs manual action race
5. Buy-in balance check race
6. Waitlist promotion conflicts
7. Template auto-create duplication
8. Public table cache staleness
9. Frontend delta merge errors
10. Persistent table misclassification

**Next Steps for Bug Fixes:**
- Add optimistic locking on Hand and User tables
- Implement WebSocket sequence numbers and snapshot requests
- Use SELECT FOR UPDATE for critical balance operations
- Add database constraints for seat uniqueness and balance positivity
- Implement per-template locks for auto-create
- Always invalidate cache synchronously or use TTL
- Improve frontend merge logic or switch to full state broadcasts
- Add defensive null checks for template relations
