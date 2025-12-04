# Analytics Overview

High-level overview of the analytics system.

## System Architecture

### Collection Layer
Scheduler triggers periodic collection, queries active table states, creates snapshot records, stores in database.

### Aggregation Layer
Hourly scheduler processes snapshots, calculates aggregate metrics, stores hourly statistics, maintains historical data.

### Analysis Layer
Insights engine analyzes patterns, detects anomalies, assigns severity, generates structured insights.

### Delivery Layer
Insights delivered via channels, logging for all insights, Telegram for critical alerts, webhooks for integrations.

## Data Flow

Snapshots collected every few minutes, hourly stats computed at hour boundaries, insights generated periodically or on demand, admin dashboard queries both layers.

## Design Principles

Analytics runs independently from gameplay, no modifications to game state, read-only database access, failures don't affect users, background processing only.

## Related Documentation

- [Snapshots](./snapshots.md) - Collection details
- [Hourly Stats](./hourly-stats.md) - Aggregation
- [Insights](./insights.md) - Pattern detection
