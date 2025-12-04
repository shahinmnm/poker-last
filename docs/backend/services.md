# Backend Services

This document describes the service layer that implements business logic.

## Service Architecture

Services provide reusable business logic separated from API endpoints and database models.

### Design Principles
- Single responsibility per service
- Dependency injection for testability
- Async operations throughout
- Transaction management
- Error handling and logging

## Core Services

### User Service
Manages user accounts, profiles, and authentication.

**Responsibilities**
- User registration and creation
- Profile retrieval and updates
- Statistics aggregation
- Balance queries
- Language preference management
- Session management

**Key Operations**
Create or retrieve user from Telegram data, update user profile information, calculate user statistics, check permissions and access control.

### Table Service
Handles table lifecycle and operations.

**Responsibilities**
- Table creation from templates
- Table listing and filtering
- Join and leave operations
- State queries and updates
- Table closure and cleanup

**Key Operations**
Create table from template configuration, list tables with filters, validate join conditions, process leave requests, end table and cleanup.

### Waitlist Service
Manages player queuing and seating.

**Responsibilities**
- Waitlist position assignment
- FIFO ordering enforcement
- Seating logic when space available
- Position queries and notifications
- Waitlist cleanup

**Key Operations**
Add user to waitlist in order, calculate position in queue, seat players when threshold reached, remove from waitlist, notify position changes.

### Template Service
Manages table templates and configurations.

**Responsibilities**
- Template creation and validation
- Template retrieval and listing
- Configuration parsing
- Template updates and deletion

**Key Operations**
Create template with validated configuration, retrieve template by identifier, list available templates, parse configuration JSON, validate template parameters.

### Analytics Service
Collects and aggregates analytics data.

**Responsibilities**
- Periodic snapshot collection
- Hourly statistics aggregation
- Data retention and cleanup
- Historical queries
- Non-intrusive data access

**Key Operations**
Capture table state snapshots, aggregate snapshots into hourly stats, cleanup old snapshots, query analytics data, generate metrics.

### Insights Service
Generates insights from analytics data.

**Responsibilities**
- Pattern detection in table data
- Anomaly identification
- Severity assignment
- Insight generation
- Structured output

**Key Operations**
Analyze snapshots for patterns, detect high and low traffic, identify rapid changes, flag unusual activity, create insight records.

### Wallet Service
Manages player balances and transactions.

**Responsibilities**
- Balance queries and updates
- Transaction creation and processing
- Balance validation
- Transaction history
- Currency conversion

**Key Operations**
Query wallet balance, create transaction records, update balances atomically, validate sufficient funds, retrieve transaction history.

### Runtime Service
Interfaces with the game runtime.

**Responsibilities**
- Game state initialization
- Action forwarding to runtime
- State persistence
- Hand progression
- Result extraction

**Key Operations**
Initialize new hand, submit player actions, query current state, persist state changes, extract hand results.

## Service Interactions

### User Registration Flow
API receives registration request, User Service validates Telegram data, User Service creates or retrieves user, Wallet Service initializes wallet if enabled, session token generated and returned.

### Table Join Flow
API receives join request, Table Service validates table exists and is joinable, Waitlist Service adds to queue or seats immediately, Runtime Service initializes player if seated, WebSocket connection established.

### Action Submission Flow
API receives action request, Table Service validates table and user, Runtime Service validates and executes action, Table Service persists state update, WebSocket Service broadcasts update.

### Analytics Collection Flow
Scheduler triggers collection, Analytics Service queries active tables, snapshots created for each table, data persisted to database, no game state modified.

### Insight Generation Flow
Scheduler or manual trigger, Insights Service queries recent analytics, patterns analyzed and categorized, insights created with severity, delivery channels invoked.

## Transaction Management

### Database Transactions
Services use database transactions for consistency, atomic operations for critical updates, rollback on errors, commit only on success.

### Distributed Transactions
Game state and database kept in sync, compensating transactions if needed, eventual consistency acceptable for analytics, strong consistency for game state.

## Error Handling

### Validation Errors
Input validated before processing, descriptive error messages, appropriate status codes, user-friendly error text.

### Business Logic Errors
State validation failures, permission denied, resource conflicts, clear error messages.

### System Errors
Database errors, external service failures, unexpected exceptions, logging and alerting, graceful degradation.

## Caching Strategy

### Redis Caching
User sessions cached, active table states cached, matchmaking pools in Redis, template configurations cached, cache invalidation on updates.

### In-Memory Caching
Template configurations in memory, user permissions cached briefly, statistics cached with TTL, frequent queries cached.

## Background Tasks

### Scheduled Jobs
Analytics snapshot collection every few minutes, hourly aggregation at hour boundaries, daily cleanup of old data, insight generation periodically.

### Async Tasks
Email and notification sending, report generation, data exports, non-critical updates.

## Related Documentation

- [API Overview](./api-overview.md) - Endpoint details
- [Database Models](./models.md) - Data structures
- [Runtime](../runtime/overview.md) - Game engine
- [Analytics](../analytics/overview.md) - Analytics system
