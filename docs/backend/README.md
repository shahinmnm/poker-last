# Backend Documentation

This section covers the FastAPI backend service that powers the poker bot.

## Contents

- [API Overview](./api-overview.md) - REST and WebSocket endpoints
- [Database Models](./models.md) - Data structures and relationships
- [Services](./services.md) - Business logic and operations
- [Templates](./templates.md) - Table configuration system

## Backend Architecture

The backend service provides:

### REST API
HTTP endpoints for user management, table operations, game actions, and admin analytics.

### WebSocket Server
Real-time bidirectional communication for game updates, lobby feeds, and admin monitoring.

### Database Layer
PostgreSQL persistence with SQLAlchemy ORM for all application data.

### Business Logic
Service layer implementing game rules, waitlist management, analytics collection, and insights generation.

### Background Tasks
Scheduled jobs for analytics snapshots, hourly aggregation, data cleanup, and insights delivery.

## Technology Stack

- **FastAPI**: Modern async web framework
- **SQLAlchemy**: ORM for database operations
- **Alembic**: Database migration management
- **Pydantic**: Data validation and serialization
- **asyncpg**: Async PostgreSQL driver
- **Redis**: Caching and pub/sub
- **APScheduler**: Background task scheduling

## Key Concepts

### Template-Driven Tables
All tables reference a template that defines game parameters. Templates specify variant, blinds, stacks, limits, and expiry rules.

### Persistent State
Game state persists across sessions. Tables maintain state in the database and restore on server restart.

### Async Throughout
All endpoints and services use async/await for non-blocking IO and better concurrency.

### Separation of Concerns
Clear boundaries between API layer, business logic, data access, and game runtime.

## Service Boundaries

### API Layer
Request validation, response formatting, authentication, WebSocket management, error handling.

### Service Layer
User management, table lifecycle, waitlist operations, analytics collection, insights generation.

### Data Layer
Database models, migrations, query optimization, connection pooling, transaction management.

### Runtime Layer
Game state management, PokerKit integration, action execution, hand processing, state persistence.

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - System-wide architecture
- [Runtime Documentation](../runtime/README.md) - Game engine integration
- [Analytics Documentation](../analytics/README.md) - Analytics system
