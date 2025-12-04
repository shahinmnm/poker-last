# WebSocket Events

High-level overview of real-time WebSocket communication.

## WebSocket Channels

### Table Channel
One connection per table, receives game state updates, action notifications, hand results, player join/leave events.

### Lobby Channel
Single connection for lobby, table creation notifications, table status updates, player count changes, table removal events.

## Event Types

### State Updates
Full table state snapshots, incremental state changes, current player indicators, pot and stack amounts, board cards.

### Action Events
Action required for current player, action performed by other players, allowed actions provided, timing information.

### Hand Events
Hand start notifications, hand completion with results, winner announcements, pot distribution.

## Connection Management

### Establishment
Connect on table join or lobby load, authentication validated, initial state sent, subscription confirmed.

### Maintenance
Periodic keepalive messages, reconnection on disconnect, exponential backoff for retries, fallback to polling.

### Cleanup
Disconnect on navigation away, unsubscribe from channels, connection closed gracefully, resources released.

## Related Documentation

- [Frontend Overview](./overview.md) - Architecture
- [API Integration](./api-integration.md) - REST calls
- [Backend API](../backend/api-overview.md) - WebSocket spec
