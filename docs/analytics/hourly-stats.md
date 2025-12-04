# Hourly Statistics

High-level overview of hourly statistics aggregation.

## Aggregation Purpose

Reduces data volume, provides queryable historical metrics, enables trend analysis, supports insights generation.

## Aggregation Process

### Trigger
Scheduler runs at each hour boundary, identifies tables with snapshot activity, retrieves snapshots from past hour, processes each table.

### Calculation
Average player count computed, maximum players determined, activity duration calculated, total hands counted if available, metadata extracted.

### Storage
Hourly stats record created or updated, unique per table and hour, previous data overwritten if regenerated, indexed for queries.

## Aggregate Metrics

Average players over hour, peak player count, minutes of activity, hand count if tracked, additional metadata.

## Usage

Admin queries for historical analysis, trend visualization, insight generation input, capacity planning, performance monitoring.

## Related Documentation

- [Analytics Overview](./overview.md) - System architecture
- [Snapshots](./snapshots.md) - Source data
- [Insights](./insights.md) - Consumers
