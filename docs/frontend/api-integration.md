# API Integration

High-level overview of frontend-backend API integration.

## REST API Communication

### User Operations
Registration and login, profile retrieval, statistics queries, balance checks, preference updates.

### Table Operations
List available tables, create new tables, join tables or waitlist, submit game actions, leave tables, query table state.

### Admin Operations
Analytics queries, insights retrieval, table inspection, system monitoring.

## Request Patterns

### Authentication
Telegram init data sent with requests, session tokens for authenticated requests, token refresh when expired, logout and session cleanup.

### Error Handling
Network errors with retry logic, validation errors displayed to user, authorization errors redirect to login, server errors logged and reported.

### Loading States
Loading indicators during requests, optimistic updates where appropriate, error boundaries for failures, graceful degradation.

## Data Transformation

### Request Formatting
Frontend data serialized to API format, TypeScript types ensure correctness, validation before sending, proper HTTP methods and headers.

### Response Processing
API responses deserialized, transformed to frontend types, error responses parsed, data cached where appropriate.

## Related Documentation

- [Frontend Overview](./overview.md) - Architecture
- [Backend API](../backend/api-overview.md) - Endpoint details
- [WebSockets](./websockets.md) - Real-time events
