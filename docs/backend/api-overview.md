# API Overview

This document provides a high-level overview of the backend REST and WebSocket APIs.

## REST API Structure

The REST API is organized into logical domains:

### User Endpoints
User registration, profile management, authentication, statistics, and balance queries.

**Operations**
- User registration and login
- Profile retrieval and updates
- Statistics and game history
- Balance and transaction queries
- Language preference management

**Authentication**
Telegram-based authentication using init data validation. Session tokens issued for subsequent requests.

### Table Endpoints
Table listing, creation, joining, game actions, and state queries.

**Operations**
- List active and waiting tables
- Create new tables from templates
- Join tables or waitlist
- Submit game actions
- Query current table state
- Leave tables
- Retrieve table history

**Access Control**
Public tables visible to all, private tables require invitation, admin operations require elevated permissions.

### Template Endpoints
Table template management for game configuration.

**Operations**
- List available templates
- Retrieve template details
- Create custom templates (admin)
- Update template configurations (admin)
- Delete templates (admin)

**Template Structure**
Templates define game variant, blind schedule, starting stacks, player limits, and table expiry rules.

### Analytics Endpoints (Admin)
Administrative access to analytics data and insights.

**Operations**
- Real-time table snapshots
- Hourly aggregate statistics
- Historical data queries
- System-wide analytics summary
- Insight generation
- Insight delivery

**Access Control**
Restricted to admin users with appropriate permissions. Read-only access to analytics data.

### Waitlist Endpoints
Waitlist management and position queries.

**Operations**
- View waitlist for table
- Add to waitlist
- Remove from waitlist
- Query position in queue
- Waitlist notifications

**Ordering**
Strict FIFO ordering maintained. Position cannot be changed except by admin intervention.

## WebSocket API Structure

Real-time bidirectional communication for game updates and lobby feeds.

### Table Channels
Individual WebSocket connections per table for game-specific updates.

**Connection**
Client connects to table-specific WebSocket endpoint, authentication validated on connect, initial state sent immediately.

**Events Sent to Client**
- State snapshot: Full table state update
- Action required: Player turn notification with allowed actions
- Action performed: Another player's action result
- Hand finished: Hand completion with results
- Game started: New hand initialization
- Player joined: New player seated
- Player left: Player departure notification

**Events from Client**
- Action submission: Player action with parameters
- State request: Request current state
- Keepalive: Connection maintenance ping

### Lobby Channel
Global WebSocket connection for lobby updates and table list changes.

**Connection**
Client connects to lobby WebSocket endpoint, current table list sent on connect, updates streamed as tables change.

**Events**
- Table created: New table available
- Table updated: Status or player count changed
- Table removed: Table closed or ended
- Waitlist updated: Waitlist size changed

### Admin Channels (Future)
Real-time admin monitoring and insight delivery.

**Planned Features**
- Real-time analytics stream
- Live table monitoring
- Instant insight notifications
- System health updates

## API Versioning

**Current Approach**
All endpoints under `/api` prefix, version included in path if needed in future, backward compatibility maintained.

**Future Versioning**
If breaking changes needed, new version path introduced, old version maintained for transition period, deprecation warnings provided.

## Request/Response Patterns

### Standard Response Format
Consistent JSON structure across all endpoints with status, data payload, and optional metadata.

**Success Response**
Contains requested data, HTTP status in 200 range, optional pagination info, optional metadata fields.

**Error Response**
Contains error message, appropriate HTTP status code, optional error details, optional validation errors.

### Pagination
List endpoints support pagination with page number and size parameters, response includes total count and page info.

### Filtering
Table and analytics endpoints support query parameters for filtering by status, date range, or other criteria.

### Sorting
List endpoints allow sorting by relevant fields in ascending or descending order.

## Authentication Flow

### Telegram Authentication
User provides Telegram init data, backend validates signature and expiry, user session created or retrieved, session token returned.

### Session Management
Token included in subsequent requests, WebSocket connections authenticated via token, sessions expire after inactivity, refresh mechanism for long-lived sessions.

### Admin Authentication
Separate admin credentials or elevated Telegram permissions, admin endpoints check authorization, audit logging for admin actions.

## Error Handling

### Validation Errors
Input validated with Pydantic models, detailed field-level error messages, appropriate HTTP status codes, user-friendly error text.

### Business Logic Errors
Game state validation failures, insufficient funds or permissions, invalid table states, clear error messages with recovery hints.

### System Errors
Database connection failures, external service timeouts, unexpected exceptions, generic error messages to users, detailed logging for debugging.

## Rate Limiting

### User Rate Limits
Requests per time window per user, separate limits for different endpoint types, 429 status code when exceeded, retry-after header provided.

### WebSocket Rate Limits
Message rate limiting per connection, disconnect on excessive messages, reconnection backoff required.

## WebSocket Event Format

### Event Structure
All events have type field, payload with event-specific data, optional timestamp, optional metadata.

### Event Types
Predefined event type strings, documented event schemas, versioned if structure changes, backward compatible when possible.

### State Synchronization
Full state snapshots for initial load, incremental updates for changes, client responsible for state management, resync mechanism if desync detected.

## API Security

### Input Validation
All inputs validated before processing, SQL injection prevention via ORM, XSS prevention in responses, CSRF protection for state changes.

### Output Sanitization
Sensitive data filtered from responses, private cards hidden from other players, wallet balances protected, admin data restricted.

### Connection Security
HTTPS required for all connections, WebSocket over secure protocol, certificate validation enforced, no mixed content allowed.

## Related Documentation

- [Database Models](./models.md) - Data structures
- [Services](./services.md) - Business logic
- [Templates](./templates.md) - Configuration system
- [Architecture](../architecture/overview.md) - System design
