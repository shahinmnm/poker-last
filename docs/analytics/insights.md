# Insights Engine

High-level overview of the insights generation system.

## Insight Purpose

Automatically detects patterns and anomalies in table data, provides actionable information to administrators, assigns severity for prioritization.

## Insight Types

### Traffic Patterns
High traffic detection (many players), low traffic flagging (few players), player count trends, capacity warnings.

### Activity Patterns
Rapid player changes (volatility), prolonged inactivity periods, waitlist surges, unusual patterns.

### System Health
Table performance issues, resource utilization, error patterns, availability metrics.

## Generation Process

### Analysis
Query recent snapshots and hourly stats, apply detection algorithms, compare against thresholds, identify anomalies and patterns.

### Classification
Categorize by insight type, assign severity (info, warning, critical), add context and metadata, timestamp generation.

### Delivery
Route to configured channels, logging for all insights, Telegram for critical items, webhook delivery for integrations.

## Severity Levels

Info for general observations, warning for potential issues, critical for urgent situations, configurable thresholds.

## Related Documentation

- [Analytics Overview](./overview.md) - System architecture
- [Admin Dashboard](./admin-dashboard.md) - Consumption
- [Deployment](../deployment/monitoring.md) - Operations
