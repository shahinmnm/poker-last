# Session Management

High-level overview of bot session management.

## Session Concept

### Purpose
Track user's active table connection, manage WebSocket for real-time updates, maintain state between messages, cleanup resources on disconnect.

### Lifecycle
Session created when user joins table, WebSocket established for updates, session active during gameplay, session destroyed on leave or disconnect.

## Session Tracking

### Session Storage
One session per user maximum, session contains table ID and WebSocket reference, stored in memory or Redis, accessed by user identifier.

### Session Operations
Create session on table join, retrieve session for routing actions, update session state as needed, destroy session on table leave.

## WebSocket Management

### Connection Handling
WebSocket established when session created, events routed to user via bot messages, reconnection logic on disconnect, connection closed on session end.

### Event Processing
Events received from WebSocket, formatted for bot message display, sent to user via Telegram, user actions submitted back via WebSocket.

## Cleanup

### Resource Release
WebSocket disconnected gracefully, session removed from storage, event listeners terminated, memory released.

### Error Recovery
Failed connections logged and retried, persistent failures fall back to polling, session cleanup on repeated failures, user notified of connection issues.

## Related Documentation

- [Bot Overview](./overview.md) - Bot architecture
- [Commands](./commands.md) - Command handling
- [Runtime](../runtime/overview.md) - Game state
