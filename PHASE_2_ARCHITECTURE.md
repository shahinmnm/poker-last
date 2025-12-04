# Phase 2: Persistent SNG Engine + Global Waitlist System

## Architecture Summary

This document describes the comprehensive architecture for Phase 2, which introduces:
1. **Persistent SNG Engine** - Template-driven Sit-n-Go tournaments with auto-start logic
2. **Global Waitlist Router** - Intelligent player routing across multiple tables
3. **Join Window Controller** - Countdown timers for SNG registration
4. **Enhanced Lifecycle Management** - Persistent table immunity and SNG state machine
5. **Real-time Aggregation** - Lobby updates with SNG state and player counts

---

## 1. Persistent Table Engine

### 1.1 Core Concept
Tables based on `PERSISTENT` templates never expire or auto-delete. They remain available indefinitely until manually deleted by an administrator.

### 1.2 Template Configuration
The `TableTemplate.config_json` now supports:
```json
{
  "sng_enabled": true,
  "sng_min_players": 2,
  "sng_max_players": 8,
  "sng_auto_start": true,
  "sng_join_window_seconds": 120,
  "sng_force_start_on_full": true,
  "sng_unregister_allowed": true,
  "starting_stack": 10000,
  "small_blind": 25,
  "big_blind": 50,
  ...
}
```

### 1.3 Implementation Files
- **Modified**: `shared/models.py` - Add SNG state enum and table fields
- **Modified**: `shared/services/table_service.py` - Template validation and table creation
- **Modified**: `shared/services/table_lifecycle.py` - Skip lifecycle checks for persistent tables

---

## 2. SNG Auto-Start Manager

### 2.1 State Machine
```
WAITING → JOIN_WINDOW → READY → ACTIVE → COMPLETED
```

**States:**
- `WAITING`: Initial state, waiting for first player
- `JOIN_WINDOW`: Countdown active, accepting registrations
- `READY`: Min players met, ready to start
- `ACTIVE`: Game in progress
- `COMPLETED`: Game finished

**Triggers:**
- Player joins → Start join window (if first player)
- Player count >= min_players → Transition to READY
- Join window expires → Auto-start if min players met
- Table full → Auto-start if `sng_force_start_on_full=true`
- Admin action → Force start

### 2.2 Implementation Files
- **New**: `shared/services/sng_manager.py` - SNG state machine and auto-start logic
- **Modified**: `shared/services/table_service.py` - Integrate SNG checks on seat assignment
- **Modified**: `api/main.py` - Background task for join window countdown

---

## 3. Global Waitlist System

### 3.1 Architecture
Players join a global queue (optionally filtered by variant). The system routes them to the best available table using scoring:

**Routing Priority:**
1. Persistent SNG tables in JOIN_WINDOW state
2. Partially filled tables (50-75% capacity)
3. Tables with active players
4. Tables matching player's preferred variant
5. Avoid nearly-dead tables (1 player remaining)

### 3.2 Data Model
**New Table**: `global_waitlist_entries`
```sql
CREATE TABLE global_waitlist_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_variant VARCHAR(50),  -- NULL = any variant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'WAITING',
    routed_table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL
);
```

### 3.3 Integration with Table Waitlist
When a seat opens:
1. Check global waitlist first (highest priority)
2. Then check table-specific waitlist
3. Auto-seat and notify via WebSocket

### 3.4 Implementation Files
- **New**: `shared/models.py` - GlobalWaitlistEntry model
- **New**: `shared/services/global_waitlist.py` - Routing logic
- **New Migration**: Add global_waitlist_entries table
- **Modified**: `shared/services/waitlist_service.py` - Integration hooks

---

## 4. Join Window Controller

### 4.1 Background Task
A dedicated asyncio task monitors all SNG tables in JOIN_WINDOW state:
- Emits WebSocket events every second: `sng_join_window_tick`
- On expiration: Auto-starts game if min_players met
- Broadcasts: `sng_join_window_ended`, `sng_auto_start_triggered`

### 4.2 Implementation Files
- **Modified**: `api/main.py` - New background task `_join_window_monitor()`
- **New**: `shared/services/sng_manager.py` - Join window state management

---

## 5. Seat Assignment Rewrite

### 5.1 Race Condition Protection
```python
async def seat_user_at_table(db: AsyncSession, table_id: int, user_id: int) -> Seat:
    # Use row-level locking to prevent race conditions
    table = await db.execute(
        select(Table).where(Table.id == table_id).with_for_update()
    )
    # ... rest of logic
```

### 5.2 Unified Entry Points
All seat assignments go through `seat_user_at_table`:
- Manual join
- Host auto-seat
- Waitlist promotion
- Global waitlist routing

### 5.3 Implementation Files
- **Modified**: `shared/services/table_service.py` - Add SELECT FOR UPDATE
- **New WebSocket Events**: `TABLE_SEAT_ASSIGNED`, `TABLE_READY_STATUS`

---

## 6. Lifecycle Rewrite

### 6.1 Persistent Table Immunity
```python
async def should_cleanup_table(table: Table) -> bool:
    if table.template.table_type == TableTemplateType.PERSISTENT:
        return False  # Never auto-delete persistent tables
    # ... existing expiry/inactivity logic
```

### 6.2 Background Job Changes
**Modified**: `api/main.py::_check_table_inactivity()`
- Skip persistent tables entirely
- No min-player cleanup for PERSISTENT type
- SNG tables handle their own lifecycle via state machine

### 6.3 Implementation Files
- **Modified**: `shared/services/table_lifecycle.py`
- **Modified**: `api/main.py` - Background cleanup task

---

## 7. API Changes

### 7.1 New Endpoints
```
POST /api/global-waitlist/join
  Body: { game_variant?: string }
  Response: { position: int, estimated_wait_time: int }

POST /api/global-waitlist/leave
  Response: { success: bool }

GET /api/global-waitlist
  Response: { entries: [...], total_waiting: int }

POST /api/tables/{table_id}/sng/force-start
  Response: { success: bool, table: {...} }
```

### 7.2 Modified Endpoints
```
GET /api/tables/{id}
  New fields: sng_state, sng_join_window_remaining, seat_count, waitlist_count

GET /api/lobby
  Enhanced with: seat_count, waitlist_count, sng_state per table
```

### 7.3 Implementation Files
- **New**: `api/routes/global_waitlist.py`
- **Modified**: `api/main.py` - Mount new routes
- **Modified**: `api/routes/tables.py` - Add SNG endpoints

---

## 8. WebSocket Layer

### 8.1 Table WebSocket Events
**New Events:**
```javascript
{
  type: "sng_join_window_started",
  table_id: 123,
  duration_seconds: 120,
  started_at: "2024-12-04T10:00:00Z"
}

{
  type: "sng_join_window_tick",
  table_id: 123,
  remaining_seconds: 45
}

{
  type: "sng_join_window_ended",
  table_id: 123,
  auto_starting: true
}

{
  type: "sng_auto_start_triggered",
  table_id: 123,
  reason: "min_players_met"
}
```

### 8.2 Lobby WebSocket Events
**New Events:**
```javascript
{
  type: "lobby_table_updated",
  table: {
    id: 123,
    seat_count: 5,
    waitlist_count: 2,
    sng_state: "JOIN_WINDOW",
    join_window_remaining: 30
  }
}

{
  type: "global_waitlist_updated",
  total_waiting: 15,
  by_variant: { "no_limit_texas_holdem": 10, ... }
}

{
  type: "player_routed_to_table",
  table_id: 123,
  user_id: 456
}
```

### 8.3 Implementation Files
- **Modified**: `api/main.py` - ConnectionManager broadcast logic
- **New**: Helper functions for SNG event emission

---

## 9. Tests Rewrite

### 9.1 Remove Legacy Patterns
**Files to Update:**
- `tests/integration/test_table_visibility.py`
- `tests/api/test_table_status_endpoint.py`
- `tests/api/test_my_tables_endpoint.py`

Replace `create_table_with_config()` with template-based flow.

### 9.2 New Test Coverage
**New Test Files:**
```
tests/sng/test_join_window.py
tests/sng/test_auto_start.py
tests/sng/test_state_machine.py
tests/waitlist/test_global_routing.py
tests/waitlist/test_race_conditions.py
tests/lifecycle/test_persistent_immunity.py
```

### 9.3 Test Scenarios
- [ ] Join window starts on first player
- [ ] Auto-start when min players reached
- [ ] Auto-start on full table
- [ ] Global waitlist routing priority
- [ ] Concurrent seat assignments (race protection)
- [ ] Persistent tables never deleted in background job
- [ ] SNG state transitions via API
- [ ] WebSocket event emissions

---

## 10. Migration Plan

### 10.1 Database Migrations
**New Migration**: `024_add_sng_and_global_waitlist.py`
```sql
-- Add SNG state to tables
ALTER TABLE tables ADD COLUMN sng_state VARCHAR(20) DEFAULT 'WAITING';
ALTER TABLE tables ADD COLUMN sng_join_window_started_at TIMESTAMP WITH TIME ZONE;

-- Create global waitlist table
CREATE TABLE global_waitlist_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_variant VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    routed_table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL
);

CREATE INDEX idx_global_waitlist_user_status ON global_waitlist_entries(user_id, status);
CREATE INDEX idx_global_waitlist_variant_status ON global_waitlist_entries(game_variant, status);
```

### 10.2 Data Migration
No existing data needs migration. All new features are opt-in via template configuration.

---

## 11. Backward Compatibility

### 11.1 Preserved Behavior
- Existing EXPIRING tables continue to work unchanged
- PRIVATE tables still use invite codes
- Legacy `create_table_with_config()` function deprecated but functional (creates ephemeral template)
- Table-specific waitlists remain functional

### 11.2 Template Defaults
If SNG fields are missing from template config, defaults apply:
```python
sng_enabled = config.get("sng_enabled", False)
sng_auto_start = config.get("sng_auto_start", False)
sng_join_window_seconds = config.get("sng_join_window_seconds", 60)
```

---

## 12. Deployment Checklist

- [ ] Run database migration
- [ ] Seed new persistent SNG templates via `scripts/seed_persistent_tables.py`
- [ ] Restart API service to enable background tasks
- [ ] Verify WebSocket events in frontend
- [ ] Monitor global waitlist routing in production
- [ ] Check persistent table immunity in cleanup logs

---

## 13. Security Considerations

### 13.1 Race Conditions
- Use `SELECT FOR UPDATE` in seat assignment
- Atomic operations for waitlist routing

### 13.2 Input Validation
- Validate SNG config fields in template schema
- Prevent negative or zero join window durations
- Enforce min/max player bounds

### 13.3 Access Control
- Force-start endpoint requires admin/creator privileges
- Global waitlist visibility respects user privacy

---

## 14. Performance Optimizations

### 14.1 Indexing
- Index on `tables.sng_state` for background task queries
- Index on `global_waitlist_entries(status, created_at)`

### 14.2 Caching
- Cache SNG templates in Redis
- Lobby aggregation uses denormalized counts

### 14.3 WebSocket Throttling
- Join window ticks throttled to 1/second
- Lobby updates debounced to prevent spam

---

## 15. Monitoring and Observability

### 15.1 Metrics
- SNG games started per hour
- Average join window duration before start
- Global waitlist routing success rate
- Persistent table uptime

### 15.2 Logging
- Log SNG state transitions
- Log global waitlist routing decisions
- Log persistent table cleanup skips

---

## Conclusion

Phase 2 transforms the poker bot into a production-ready SNG platform with intelligent player routing, persistent tables, and template-driven configuration. All changes maintain backward compatibility while providing powerful new features for scalable tournament management.
