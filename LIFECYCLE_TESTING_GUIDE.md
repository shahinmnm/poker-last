# Table Lifecycle Implementation - Testing Guide

## Overview

This document provides a comprehensive testing guide for the table lifecycle optimization implementation.

## Changes Summary

### Core Implementation
1. **TableLifecycle Service** - Centralized lifecycle decision engine
2. **Pre-start TTL** - 10-minute window to start game
3. **Post-start Expiry Removal** - No wall-clock timeout for active games
4. **Consecutive Timeout Tracking** - Auto-check then auto-fold
5. **Self-Destruct** - Auto-end tables with insufficient players
6. **History Filtering** - Only show completed/expired tables
7. **Real-time Seating Bug Fix** - Broadcast full state on sit/leave

## Test Scenarios

### 1. Pre-start TTL (Rule A)

**Test 1.1: Table expires after 10 minutes if not started**
```
1. Create a new table
2. Note the expires_at timestamp (should be created_at + 10 minutes)
3. Do NOT start the game
4. Wait 10 minutes (or mock the clock)
5. Verify table status becomes EXPIRED
6. Verify table does not appear in /tables?scope=public
7. Verify table cannot be started or joined
```

**Expected:**
- Table.expires_at = created_at + 10 minutes
- After expiry: status = EXPIRED
- Excluded from public lists
- Join/start requests return error

**Test 1.2: Started table does not expire by time**
```
1. Create a new table
2. Add 2+ players
3. Start the game
4. Verify expires_at is NULL or ignored
5. Wait 10+ minutes
6. Verify table is still ACTIVE
7. Verify table still appears in public lists
```

**Expected:**
- After start: expires_at = NULL
- Table remains ACTIVE indefinitely (until self-destruct conditions)

### 2. Consecutive Timeout (Rule C)

**Test 2.1: First timeout - auto-check when legal**
```
1. Create and start a game with 2 players
2. Post blinds (player has no outstanding bet to call)
3. Let player's turn timeout (wait turn_timeout_seconds + 2)
4. Verify player auto-checks (not folds)
5. Verify hand.timeout_tracking[user_id].count = 1
```

**Expected:**
- First timeout when CHECK is legal → auto-check
- Timeout count incremented to 1

**Test 2.2: First timeout - auto-fold when check not legal**
```
1. Create and start a game
2. Player 1 bets
3. Player 2's turn (must call or fold)
4. Let player 2 timeout
5. Verify player 2 auto-folds (cannot check)
6. Verify timeout_tracking[player2].count = 1
```

**Expected:**
- First timeout when CHECK not legal → auto-fold
- Timeout count incremented

**Test 2.3: Consecutive timeout - always auto-fold**
```
1. Create and start a game
2. Player times out once (count = 1)
3. Same player gets another turn
4. Let player timeout again
5. Verify player auto-folds (even if check was legal)
6. Verify timeout_tracking[user_id].count = 2
```

**Expected:**
- Second consecutive timeout → always fold
- Works regardless of legal actions

**Test 2.4: Timeout tracking resets between hands**
```
1. Player times out in hand #1
2. Hand completes
3. Start hand #2 (new Hand record created)
4. Verify hand #2 has fresh timeout_tracking = {}
5. Player has clean slate for new hand
```

**Expected:**
- Each hand starts with empty timeout_tracking
- Timeouts don't carry across hands

### 3. Self-Destruct (Rule D)

**Test 3.1: Table self-destructs when < 2 active players**
```
1. Create game with 3 players
2. Start hand
3. Player 1 and 2 fold
4. Player 3 wins
5. Hand completes
6. Verify only 1 active player remains
7. Verify table status = ENDED
8. Verify table not in /tables?scope=public
9. Verify WebSocket broadcast includes table_ended: true
```

**Expected:**
- Hand completion triggers self-destruct check
- Table marked ENDED
- All seats marked as left
- Removed from public lists
- Clients notified

**Test 3.2: Table continues when 2+ active players**
```
1. Create game with 3 players
2. Play a hand to completion
3. Verify 2+ players still active
4. Verify table status = ACTIVE
5. Verify new hand can be started
```

**Expected:**
- No self-destruct
- Table remains playable

**Test 3.3: Sitting out players don't count as active**
```
1. Create game with 3 players
2. Player 3 sits out (is_sitting_out_next_hand = true)
3. Hand completes with only players 1 and 2 active
4. Verify table continues (2 active players)
5. Player 2 also sits out
6. Only 1 active player (player 1)
7. Hand completes
8. Verify table self-destructs
```

**Expected:**
- Sit-out players excluded from active count
- Self-destruct when active < 2

### 4. History Visibility (Rule E)

**Test 4.1: Only completed tables in history**
```
1. Create user with 3 tables:
   - Table A: WAITING (not started)
   - Table B: ACTIVE (game in progress)
   - Table C: ENDED (completed)
2. Call GET /users/me/history
3. Verify response only includes Table C
4. Verify Tables A and B excluded
```

**Expected:**
- Only ENDED/EXPIRED tables in history
- WAITING/ACTIVE excluded

**Test 4.2: History includes completion details**
```
1. Complete a table
2. Call GET /users/me/history
3. Verify response includes:
   - table_id
   - status = "ended"
   - joined_at, left_at
   - profit/loss
   - table_name
   - blinds
```

**Expected:**
- All required fields present
- Accurate profit calculation

### 5. Real-time Seating Visibility

**Test 5.1: New player visible immediately to all clients**
```
1. Create table with Player A (host)
2. Player A opens table in browser/client
3. Connect WebSocket for Player A
4. Player B calls POST /tables/{id}/sit
5. Verify Player A receives WebSocket broadcast
6. Verify broadcast includes full player list with Player B
7. Verify Player B appears in Player A's UI instantly
```

**Expected:**
- WebSocket broadcast on /sit
- Full state included in broadcast
- All connected clients updated

**Test 5.2: Player leaving visible immediately**
```
1. Create table with Players A and B
2. Both connected via WebSocket
3. Player B calls POST /tables/{id}/leave
4. Verify Player A receives broadcast
5. Verify Player B removed from player list
6. Verify start button disabled if < 2 players
```

**Expected:**
- WebSocket broadcast on /leave
- UI updates instantly

### 6. Background Tasks

**Test 6.1: Inactivity check runs periodically**
```
1. Create table and let it expire
2. Wait 30+ seconds
3. Verify check_table_inactivity ran (check logs)
4. Verify expired table marked as EXPIRED
5. Verify WebSocket connections closed
```

**Expected:**
- Task runs every 30s
- Expired tables processed
- Connections cleaned up

**Test 6.2: Auto-fold task runs periodically**
```
1. Start game, player's turn
2. Wait for timeout
3. Verify auto_fold_expired_actions ran
4. Verify player folded/checked
5. Verify WebSocket broadcast sent
```

**Expected:**
- Task runs every 2s
- Timeouts handled
- State updated

### 7. Multi-Worker Safety

**Test 7.1: Distributed locks prevent duplicate processing**
```
1. Run 2+ API workers
2. Create table and let it expire
3. Verify only one worker processes expiry
4. Check logs for "lock held by another worker"
```

**Expected:**
- Redis locks prevent race conditions
- No duplicate processing

## API Endpoint Tests

### GET /tables?scope=public
```bash
# Should exclude expired/ended tables
curl -H "X-Telegram-Init-Data: $INIT_DATA" \
  http://localhost:8000/api/tables?scope=public

# Verify no EXPIRED or ENDED tables in response
```

### GET /users/me/history
```bash
# Should only return ENDED/EXPIRED tables
curl -H "X-Telegram-Init-Data: $INIT_DATA" \
  http://localhost:8000/api/users/me/history

# Verify all entries have status "ended" or "expired"
```

### POST /tables/{id}/sit
```bash
# Should broadcast full state to all clients
# Monitor WebSocket messages while calling this endpoint
curl -X POST \
  -H "X-Telegram-Init-Data: $INIT_DATA" \
  http://localhost:8000/api/tables/123/sit

# Verify WebSocket receives full state update
```

## Database Verification

### Check timeout tracking
```sql
SELECT id, hand_no, timeout_tracking 
FROM hands 
WHERE table_id = 123 
ORDER BY hand_no DESC 
LIMIT 5;

-- Should see JSON like:
-- {"456": {"count": 1, "last_timeout_at": "2025-01-22T10:00:00+00:00"}}
```

### Check table lifecycle
```sql
SELECT id, status, expires_at, created_at, updated_at 
FROM tables 
WHERE id = 123;

-- Active tables should have expires_at = NULL
-- Waiting tables should have expires_at = created_at + 10 minutes
```

### Check history filtering
```sql
SELECT t.id, t.status, s.user_id, s.left_at 
FROM tables t 
JOIN seats s ON s.table_id = t.id 
WHERE s.user_id = 456 
ORDER BY s.left_at DESC;

-- Only ENDED/EXPIRED tables should appear in history API
```

## Regression Tests

### Existing Features Still Work
- [x] Table creation (public and private)
- [x] Joining tables via invite code
- [x] Starting games
- [x] Playing hands (bet, raise, fold, check, call)
- [x] Hand completion and showdown
- [x] Wallet balance updates
- [x] Statistics tracking
- [x] Group game invites
- [x] Sit-out functionality

## Performance Tests

### Background Task Performance
```bash
# Create 100 tables
# Wait for inactivity check cycle
# Verify task completes in < 5 seconds
# Check CPU/memory usage
```

### WebSocket Broadcast Performance
```bash
# Connect 50 clients to same table
# Have player sit/leave
# Verify all clients receive broadcast in < 100ms
```

## Error Handling Tests

### Graceful Degradation
1. Redis down → background tasks log error but don't crash
2. Database slow → timeouts logged but system recovers
3. WebSocket broadcast fails → logged but doesn't block API

## Monitoring

### Key Metrics to Track
- Table expiry rate (pre-start)
- Self-destruct rate (post-start)
- Timeout frequency (first vs consecutive)
- Background task execution time
- WebSocket broadcast latency

### Log Messages to Monitor
- "Table marked as EXPIRED"
- "Table marked as ENDED (self-destruct)"
- "Auto-folding player due to timeout"
- "Auto-checking player (first timeout, check is legal)"
- "Table lifecycle action taken"

## Success Criteria

✅ All 7 test categories pass
✅ No linting errors
✅ No regression in existing features
✅ Background tasks run reliably
✅ Real-time seating visibility confirmed
✅ History shows only completed tables
✅ Timeout enforcement works correctly
✅ Self-destruct triggers appropriately
✅ Multi-worker safety verified

## Notes

- Most tests can be automated with pytest fixtures
- WebSocket tests require async test framework
- Time-based tests may need clock mocking
- Multi-worker tests require Docker Compose setup
