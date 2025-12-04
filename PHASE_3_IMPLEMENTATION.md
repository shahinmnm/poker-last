# Phase 3: Advanced Analytics Engine - Implementation Summary

## Overview

Phase 3 implements a comprehensive analytics subsystem for the Telegram Poker Bot using a Hybrid Model that combines real-time Redis counters, hand-level Postgres persistence, and hourly batch aggregations. This document describes the complete implementation with integration points and usage examples.

---

## Architecture Components

### 1. Database Models (Postgres)

**New Tables:**

- `hand_analytics` - Compact hand-level summaries
- `player_sessions` - Session tracking with buy-in/cash-out
- `hourly_player_stats` - Player hourly aggregates  
- `hourly_table_stats` - Table hourly aggregates (existing, extended)
- `leaderboard_snapshots` - Historical leaderboard data
- `analytics_jobs` - Job queue for batch processing
- `anomaly_alerts` - Outlier detection alerts

**Migration:** `025_phase3_analytics.py`

### 2. Redis Analytics Service

**Key Patterns:**
```
table:{id}:analytics:hand_count_live
table:{id}:analytics:pot_sum_rolling
table:{id}:analytics:active_seats
table:{id}:analytics:timeouts
table:{id}:analytics:autofolds
table:{id}:analytics:waitlist_count
table:{id}:analytics:rolling:300s:{metric}
table:{id}:analytics:rolling:30min:{metric}
table:{id}:analytics:actions_histogram
table:{id}:analytics:pot_sizes
table:{id}:analytics:showdown_flags
table:{id}:analytics:turn_times_p95
```

**Service:** `shared/services/redis_analytics.py`

**Features:**
- Non-blocking atomic increments
- Rolling windows (300s and 30min)
- Aggression metrics (AF, AFq)
- P95 turn time tracking
- Automatic expiration

---

## Core Services

### 3. Hand Analytics Processor

**File:** `shared/services/hand_analytics_processor.py`

**Functions:**
- `process_hand(db, hand_id)` - Process completed hand
- `create_player_session(db, user_id, table_id, template_id, buy_in)` - Start session
- `end_player_session(db, user_id, table_id, cash_out)` - End session
- `update_player_session(db, user_id, table_id, hand_analytics)` - Update stats

**Called:** After each hand completion via event hooks

### 4. Hourly Aggregator

**File:** `shared/services/hourly_aggregator.py`

**Features:**
- Idempotent operations (safe to re-run)
- Uses `AnalyticsJob` queue for at-least-once delivery
- Aggregates table and player metrics
- Creates leaderboard snapshots

**Jobs:**
- `hourly_table` - Aggregate table metrics
- `hourly_player` - Aggregate player metrics
- `leaderboard_snapshot` - Create leaderboard

**Scheduler:** Run `run_hourly_aggregation()` at the start of each hour

### 5. Outlier Detector (PLUS Feature)

**File:** `shared/services/outlier_detector.py`

**Detection Types:**
- Big pot spikes (>X std dev)
- Timeout surges
- VPIP/PFR mismatches (collusion indicators)
- Rapid action patterns (bot detection)

**Methods:**
- `detect_pot_spike(table_id, hand_id, pot_size)`
- `detect_timeout_surge(table_id, user_id)`
- `detect_vpip_pfr_mismatch(user_id, table_id)`
- `detect_rapid_actions(table_id, user_id)`
- `scan_table_for_anomalies(table_id)`
- `scan_all_active_tables()`

### 6. Cleanup Service

**File:** `shared/services/cleanup_service.py`

**Retention Policies:**
- Raw hands: 90 days
- Raw events: 30 days
- Aggregates: 18 months
- Snapshots: 60 days
- Alerts: 90 days (reviewed/dismissed only)

**Methods:**
- `run_full_cleanup()` - Run all cleanup tasks
- `get_storage_stats()` - Get storage statistics

**Scheduler:** Run daily via cron

### 7. Admin WebSocket Feed (PLUS Feature)

**File:** `shared/services/admin_analytics_ws.py`

**Endpoint:** `/ws/admin-analytics`

**Features:**
- Real-time table metrics updates
- Anomaly alert broadcasts
- Player activity indicators
- Table/user subscriptions

**Message Types (Client → Server):**
```json
{"type": "subscribe_table", "table_id": 5}
{"type": "unsubscribe_table", "table_id": 5}
{"type": "subscribe_user", "user_id": 123}
{"type": "unsubscribe_user", "user_id": 123}
{"type": "ping"}
```

**Message Types (Server → Client):**
```json
{"type": "table_metrics_update", "table_id": 5, "metrics": {...}}
{"type": "anomaly_alert", "alert": {...}}
{"type": "pot_spike_alert", "table_id": 5, "pot_size": 5000}
{"type": "timeout_surge_alert", "table_id": 5, "user_id": 123}
{"type": "player_activity", "user_id": 123, "activity_type": "..."}
```

### 8. Event Hooks Integration

**File:** `shared/services/analytics_event_hooks.py`

**Mandatory Events:**
- `on_table_started(table_id, metadata)`
- `on_table_ended(table_id, metadata)`
- `on_hand_started(table_id, hand_id, metadata)`
- `on_hand_finished(table_id, hand_id, metadata)`
- `on_street_changed(table_id, hand_id, street, metadata)`
- `on_player_action(table_id, hand_id, user_id, action_type, metadata)`
- `on_timeout(table_id, hand_id, user_id, metadata)`
- `on_autofold(table_id, hand_id, user_id, metadata)`
- `on_seat_join(table_id, user_id, seat_position, metadata)`
- `on_seat_leave(table_id, user_id, seat_position, metadata)`
- `on_waitlist_join(table_id, user_id, metadata)`
- `on_waitlist_leave(table_id, user_id, metadata)`

**Usage Example:**
```python
from telegram_poker_bot.game_core.manager import get_redis_client
from telegram_poker_bot.shared.services.redis_analytics import get_redis_analytics
from telegram_poker_bot.shared.services.outlier_detector import OutlierDetector
from telegram_poker_bot.shared.services.analytics_event_hooks import create_analytics_event_hooks

# In PokerKit runtime or game manager:
redis_client = await get_redis_client()
redis_analytics = await get_redis_analytics(redis_client)
outlier_detector = OutlierDetector(db, redis_analytics)
event_hooks = await create_analytics_event_hooks(db, redis_analytics, outlier_detector)

# Hook into game events:
await event_hooks.on_hand_finished(table_id, hand_id, {
    "pot_size": 1000,
    "winners": [user_id1, user_id2],
    ...
})
```

---

## API Endpoints

### Admin Endpoints

**File:** `api/analytics_admin_routes.py`

**Prefix:** `/admin/analytics`

**Endpoints:**

1. **GET /admin/analytics/tables/{table_id}/live**
   - Real-time metrics from Redis
   - Returns: hand count, pot sum, active seats, aggression metrics, etc.

2. **GET /admin/analytics/tables/live**
   - Real-time metrics for all active tables

3. **GET /admin/analytics/tables/{table_id}/stats**
   - Historical statistics (hourly aggregates)
   - Query params: `hours` (default: 24, max: 168)

4. **GET /admin/analytics/players/{user_id}/stats**
   - Player statistics and session history
   - Query params: `hours` (default: 168, max: 720)

5. **GET /admin/analytics/anomalies**
   - List anomaly alerts
   - Query params: `alert_type`, `severity`, `status`, `limit`

6. **POST /admin/analytics/anomalies/{alert_id}/review**
   - Mark alert as reviewed/dismissed
   - Body: `new_status` (reviewed or dismissed)

7. **POST /admin/analytics/anomalies/scan**
   - Manually trigger anomaly scan
   - Query params: `table_id` (optional)

8. **GET /admin/analytics/leaderboards**
   - Get leaderboard snapshots
   - Query params: `leaderboard_type`, `variant`

### User Endpoints

**File:** `api/analytics_user_routes.py`

**Prefix:** `/profile`

**Endpoints:**

1. **GET /profile/stats**
   - User's personal statistics
   - Query params: `hours` (default: 168, max: 720)
   - Returns: VPIP, PFR, AF, profit/loss, variant breakdown

2. **GET /profile/hands**
   - User's hand history
   - Query params: `limit`, `offset`, `variant`
   - Privacy-safe: only user's perspective

3. **GET /profile/sessions**
   - User's session history
   - Query params: `limit`, `offset`

4. **GET /profile/leaderboards**
   - Public leaderboards (anonymized)
   - Query params: `leaderboard_type`, `variant`

5. **GET /profile/leaderboards/my-rank**
   - User's leaderboard rank and nearby players
   - Query params: `leaderboard_type`, `variant`

---

## Frontend Integration

### TypeScript Interfaces

**File:** `frontend/src/types/analytics.ts`

**Key Types:**
- `TableLiveMetrics` - Real-time table metrics
- `PlayerStatsResponse` - Player statistics
- `UserStatsResponse` - User profile stats
- `AnomalyAlert` - Anomaly alert
- `LeaderboardResponse` - Leaderboard data
- `WSAnalyticsEvent` - WebSocket event types

### React Query Hooks (Recommended)

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import type { TableLiveMetricsResponse, UserStatsResponse } from '@/types/analytics';

// Real-time table metrics (refetch every 5s)
const useTableLiveMetrics = (tableId: number) => {
  return useQuery({
    queryKey: ['analytics', 'table', tableId, 'live'],
    queryFn: () => fetch(`/api/admin/analytics/tables/${tableId}/live`).then(r => r.json()),
    refetchInterval: 5000,
  });
};

// User stats
const useMyStats = (hours: number = 168) => {
  return useQuery({
    queryKey: ['analytics', 'my-stats', hours],
    queryFn: () => fetch(`/api/profile/stats?hours=${hours}`).then(r => r.json()),
  });
};

// Anomaly scan mutation
const useScanAnomalies = () => {
  return useMutation({
    mutationFn: (tableId?: number) => 
      fetch('/api/admin/analytics/anomalies/scan', {
        method: 'POST',
        body: JSON.stringify({ table_id: tableId }),
      }).then(r => r.json()),
  });
};
```

### WebSocket Integration

```typescript
import { useEffect, useState } from 'react';
import type { WSAnalyticsEvent } from '@/types/analytics';

const useAdminAnalyticsWS = () => {
  const [events, setEvents] = useState<WSAnalyticsEvent[]>([]);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/admin-analytics');
    
    ws.onopen = () => {
      // Subscribe to table
      ws.send(JSON.stringify({ type: 'subscribe_table', table_id: 5 }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [...prev, data]);
    };
    
    return () => ws.close();
  }, []);
  
  return events;
};
```

---

## Scheduler Integration

### Hourly Aggregation

**Setup:**

1. **APScheduler (Python):**
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from telegram_poker_bot.shared.services.hourly_aggregator import HourlyAggregator

scheduler = AsyncIOScheduler()

async def run_hourly_job():
    async with get_db_session() as db:
        redis_client = await get_redis_client()
        redis_analytics = await get_redis_analytics(redis_client)
        aggregator = HourlyAggregator(db, redis_analytics)
        await aggregator.run_hourly_aggregation()

# Run at minute 5 of every hour
scheduler.add_job(run_hourly_job, 'cron', minute=5)
scheduler.start()
```

2. **Cron (System):**
```bash
# Run at 5 minutes past every hour
5 * * * * python -m telegram_poker_bot.scripts.run_hourly_aggregation
```

### Daily Cleanup

```python
async def run_daily_cleanup():
    async with get_db_session() as db:
        cleanup = CleanupService(db)
        results = await cleanup.run_full_cleanup()
        logger.info("Daily cleanup completed", results=results)

# Run at 3 AM daily
scheduler.add_job(run_daily_cleanup, 'cron', hour=3, minute=0)
```

---

## Privacy and Security

### Privacy Rules

1. **DO NOT** expose hole cards of other players
2. **Public leaderboards** must be anonymized (usernames only)
3. **Admin** can access full data
4. **Player** can access only their own stats
5. **Heatmaps and KPIs** must use aggregate-only data

### Security

- Admin endpoints use `verify_admin_access()` dependency (TODO: implement proper auth)
- User endpoints use `get_current_user_id()` dependency (TODO: implement from JWT)
- WebSocket connections should verify admin status
- Rate limiting recommended for anomaly scan endpoint

---

## Testing

### Unit Tests (Recommended Structure)

```python
# tests/analytics/test_redis_analytics.py
async def test_increment_hand_count():
    redis_analytics = RedisAnalytics(redis_client)
    count = await redis_analytics.increment_hand_count(1)
    assert count == 1

# tests/analytics/test_hand_processor.py
async def test_process_hand():
    hand_analytics = await HandAnalyticsProcessor.process_hand(db, hand_id)
    assert hand_analytics.total_pot > 0

# tests/analytics/test_outlier_detector.py
async def test_detect_pot_spike():
    alert = await detector.detect_pot_spike(table_id, hand_id, 10000)
    assert alert is not None
```

### Integration Tests

```python
# tests/integration/test_analytics_api.py
async def test_get_table_live_metrics(client):
    response = await client.get("/api/admin/analytics/tables/1/live")
    assert response.status_code == 200
    assert "metrics" in response.json()
```

---

## Monitoring and Observability

### Metrics to Track

1. **Redis:**
   - Key count per table
   - Memory usage
   - Command latency

2. **Postgres:**
   - Table sizes (hand_analytics, hourly_*_stats)
   - Query performance
   - Index usage

3. **Jobs:**
   - Job queue depth
   - Job success/failure rate
   - Job execution time

4. **WebSocket:**
   - Active connections
   - Message throughput
   - Disconnection rate

### Logging

All services use structured logging via `get_logger(__name__)`:

```python
logger.info("Hand analytics processed", hand_id=hand_id, table_id=table_id, pot=total_pot)
logger.warning("Pot spike detected", table_id=table_id, pot_size=pot_size)
logger.error("Job failed", job_id=job.id, error=str(e))
```

---

## Deployment Checklist

- [ ] Run migration `025_phase3_analytics.py`
- [ ] Configure Redis connection (ensure `redis_url_computed` is set)
- [ ] Set up hourly aggregation scheduler
- [ ] Set up daily cleanup cron
- [ ] Configure admin authentication for admin endpoints
- [ ] Set up monitoring for job queue
- [ ] Test WebSocket connections
- [ ] Verify retention policies match requirements
- [ ] Load test analytics endpoints
- [ ] Document any custom heatmap implementations

---

## Future Enhancements

1. **Advanced Heatmaps:**
   - Position-based steal frequency
   - C-bet by position and street
   - Positional winrate analysis

2. **Multi-Process Batch Engine:**
   - Implement worker pool for parallel job processing
   - Advisory locks for concurrent execution
   - Distributed job queue (Redis-based)

3. **Machine Learning:**
   - Player clustering (fish/reg classification)
   - Anomaly detection using ML models
   - Predictive analytics (churn risk, whale identification)

4. **Real-Time Dashboards:**
   - Live charts for admin dashboard
   - Table health indicators
   - System-wide analytics

---

## Support and Troubleshooting

### Common Issues

1. **High Redis Memory Usage:**
   - Check rolling window expiration
   - Verify cleanup is running
   - Adjust window sizes if needed

2. **Slow Hourly Aggregation:**
   - Check table snapshot count
   - Optimize queries with indexes
   - Consider archiving old data

3. **WebSocket Disconnections:**
   - Check ping/pong heartbeat
   - Verify network stability
   - Review connection timeout settings

4. **Missing Analytics Data:**
   - Verify event hooks are called
   - Check database migrations applied
   - Review error logs

---

## Contact

For questions or issues related to Phase 3 Analytics:
- Check logs in `telegram_poker_bot.shared.services.*`
- Review migration status
- Test with example data
