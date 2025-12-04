# Architecture Documentation

This section provides high-level architecture documentation for the poker bot system.

## Contents

- [System Overview](./overview.md) - Complete system architecture and design
- [Component Interactions](./components.md) - How system components work together
- [Data Flow](./data-flow.md) - Data flow patterns and lifecycle management

## Architecture Principles

The system follows these architectural principles:

### Template-Driven Design
All game configuration is managed through templates rather than hardcoded values. This enables flexible table configurations and variant support.

### Persistent Table Model
Tables persist across game sessions, supporting both long-running and expiring table types with integrated waitlist management.

### Real-Time Communication
WebSocket connections provide real-time updates for game state, lobby changes, and admin insights.

### Analytics-First
Non-intrusive analytics collection runs independently from gameplay, providing insights without affecting performance.

### Variant-Aware
The frontend and backend support multiple poker variants through configuration rather than variant-specific code.

### Modular Services
Clear separation between backend API, bot service, frontend, runtime engine, and analytics systems.

## Technology Stack

### Backend
- FastAPI for REST API and WebSocket endpoints
- PostgreSQL for persistent data storage
- Redis for matchmaking and caching
- SQLAlchemy for database ORM
- Alembic for database migrations

### Bot Service
- python-telegram-bot for Telegram integration
- Webhook-based message handling
- Session management for active table connections

### Frontend
- React with TypeScript
- Vite for build tooling
- WebSocket client for real-time updates
- i18n support for multilingual interface

### Runtime
- PokerKit engine for poker game logic
- Async task management for hand processing
- State persistence and restoration

### Analytics
- Background scheduler for periodic data collection
- Snapshot-based metrics gathering
- Hourly aggregation system
- Insights generation and delivery

## System Boundaries

### In Scope
- Table management and lifecycle
- User authentication and profiles
- Real-time gameplay with WebSocket updates
- Analytics and admin insights
- Multi-variant poker support
- Waitlist and seating management
- Persistent table storage

### Out of Scope
- PokerKit engine modifications (use as-is)
- Custom poker rule implementations
- Payment processing (placeholder only)
- Advanced tournament structures
- Third-party integrations beyond Telegram

## Next Steps

- Review [System Overview](./overview.md) for complete architecture
- See [Component Interactions](./components.md) for integration details
- Check [Data Flow](./data-flow.md) for lifecycle documentation
