# Snapshot System

High-level overview of analytics snapshot collection.

## Snapshot Purpose

Captures lightweight table state at regular intervals for historical analysis without impacting gameplay.

## Collection Process

### Trigger
Background scheduler runs every few minutes, identifies active and waiting tables, initiates snapshot capture for each table.

### Data Capture
Query current table state from database, extract player count and status, capture waitlist size if present, record metadata, assign timestamp.

### Storage
Create snapshot record in database, indexed by table and time, no modification to game state, collection logged for monitoring.

## Snapshot Content

Minimal data to reduce storage, table identifier and status, player count at capture time, active/waiting flag, timestamp for ordering, optional metadata JSON.

## Retention Policy

Snapshots retained for configured period (typically one week), old snapshots automatically cleaned up, cleanup runs daily, historical data preserved in aggregates.

## Related Documentation

- [Analytics Overview](./overview.md) - System architecture
- [Hourly Stats](./hourly-stats.md) - Aggregation
- [Backend Models](../backend/models.md) - Data structure
