# Analytics Documentation

This section covers the analytics and insights system.

## Contents

- [Analytics Overview](./overview.md) - System architecture
- [Snapshot System](./snapshots.md) - Data collection
- [Hourly Aggregates](./hourly-stats.md) - Statistics aggregation
- [Insights Engine](./insights.md) - Pattern detection
- [Admin Dashboard](./admin-dashboard.md) - Data consumption

## Analytics Purpose

Collects table data periodically, aggregates into hourly statistics, detects patterns and anomalies, delivers insights to administrators.

## Key Features

### Non-Intrusive Collection
Snapshots collected on schedule, read-only database queries, no gameplay impact, background processing.

### Aggregation Pipeline
Snapshots aggregated hourly, metrics calculated efficiently, historical data queryable, old data cleaned up.

### Pattern Detection
Analyzes recent data for anomalies, detects traffic patterns, identifies unusual activity, assigns severity levels.

### Insight Delivery
Multiple delivery channels, real-time notifications, admin dashboard display, configurable alerting.

## Technology Stack

- **APScheduler**: Periodic job execution
- **PostgreSQL**: Data storage
- **Background Tasks**: Non-blocking processing
- **Delivery Channels**: Logging, Telegram, webhooks

## Related Documentation

- [Architecture](../architecture/overview.md) - System design
- [Backend](../backend/overview.md) - Data models
- [Deployment](../deployment/monitoring.md) - Monitoring
