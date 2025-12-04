# System Overview

This document provides a high-level overview of the poker bot system architecture.

## System Architecture

The poker bot is a multi-component system consisting of:

### Core Components

**Backend API Service**
- FastAPI-based REST and WebSocket server
- Manages user accounts, tables, and game state
- Provides real-time updates via WebSocket connections
- Exposes admin analytics and insights endpoints
- Handles database persistence and migrations

**Telegram Bot Service**
- Webhook-based message handler
- Command and callback routing
- Session management for active games
- Multilingual interface support
- Real-time game interaction through bot messages

**Frontend Mini App**
- React-based web application
- Variant-aware table display
- Real-time WebSocket integration
- Admin dashboard for analytics and insights
- Responsive design for mobile and desktop

**Game Runtime**
- PokerKit engine integration
- Table and hand lifecycle management
- State persistence and restoration
- Concurrent game processing
- Action validation and execution

**Analytics Engine**
- Periodic snapshot collection
- Hourly statistics aggregation
- Insights generation and pattern detection
- Non-intrusive background processing
- Admin delivery channels

### Data Layer

**PostgreSQL Database**
- User profiles and authentication
- Table templates and configurations
- Active and historical table states
- Analytics snapshots and aggregates
- Transaction and wallet data

**Redis Cache**
- Matchmaking pool management
- Session state caching
- Real-time event broadcasting
- Temporary data storage

## Design Philosophy

### Template-Driven Configuration

Tables are created from templates that define all game parameters. This approach:
- Eliminates hardcoded game rules
- Enables easy variant support
- Simplifies configuration management
- Supports future customization

Templates specify:
- Game variant
- Blind structure
- Starting stacks
- Player limits
- Table expiry rules

### Persistent Table Model

Tables persist across sessions rather than being recreated for each game:
- PERSISTENT tables run indefinitely until manually closed
- EXPIRING tables have configurable time-to-live
- Waitlist system manages player queuing
- Seating logic integrates with waitlist
- Tables maintain state between hands

### Real-Time Architecture

WebSocket connections provide instant updates:
- Lobby feed broadcasts table changes
- Table-specific channels send game updates
- Action notifications delivered immediately
- State synchronization across clients
- Fallback polling for connection issues

### Analytics Independence

Analytics runs separately from gameplay:
- Snapshots collected on schedule, not triggered by game events
- Read-only database queries
- Background processing doesn't block gameplay
- Hourly aggregation reduces query load
- Insights generated asynchronously

## Component Interactions

### User Registration Flow
Users authenticate through Telegram, backend creates or retrieves profile, session established for mini app access.

### Table Creation Flow
Admin or system creates table from template, configuration stored in database, table appears in lobby, waitlist initialized if enabled.

### Game Join Flow
User requests to join table, waitlist position assigned, seating occurs when space available, WebSocket connection established, game state synchronized.

### Hand Processing Flow
Runtime initiates new hand, PokerKit engine manages game logic, player actions collected and validated, state updates broadcast via WebSocket, hand completion triggers stat updates.

### Analytics Collection Flow
Scheduler triggers snapshot collection, current table states captured, data stored in database, hourly aggregation processes snapshots, insights generated from patterns, admin notifications delivered.

## Deployment Architecture

### Production Environment

**Container Stack**
- Docker Compose orchestrates all services
- Nginx reverse proxy for SSL termination
- PostgreSQL and Redis in dedicated containers
- Automated database migrations on startup
- Health checks and restart policies

**Network Configuration**
- Internal network for service communication
- External ports only on reverse proxy
- WebSocket connections proxied through Nginx
- Database and Redis not exposed to host

**Data Persistence**
- Named volumes for PostgreSQL data
- Redis persistence enabled
- SSL certificate storage
- Log aggregation

### Scaling Considerations

**Horizontal Scaling**
Backend API supports multiple workers, bot service runs single instance per bot token, frontend serves static assets via CDN, analytics scheduler runs single instance.

**Performance Optimization**
Database connection pooling, Redis caching for frequent queries, WebSocket connection management, async processing throughout, background task queues.

## Security Model

### Authentication
Telegram-based user authentication, webhook secret validation, admin endpoint authorization, WebSocket connection validation.

### Data Protection
Environment-based secrets, encrypted database connections, SSL/TLS for all external traffic, secure WebSocket protocol, rate limiting and anti-flood protection.

### Isolation
Service-level network isolation, read-only analytics access, admin endpoint separation, sandbox game execution, input validation throughout.

## Integration Points

### Telegram Platform
Webhook receiver for bot updates, command and callback handling, inline keyboard navigation, real-time message updates, mini app launching.

### PokerKit Engine
State creation and initialization, action validation and execution, hand progression logic, equity and showdown calculation, variant-specific rules.

### External Services
PostgreSQL for persistence, Redis for caching and queues, Nginx for proxying and SSL, certbot for certificate management, logging and monitoring systems.

## Future Architecture Considerations

### Extensibility Points
Plugin system for custom variants, configurable insights rules, webhook delivery channels, payment gateway integration, tournament management system.

### Scalability Plans
Multi-region deployment, database read replicas, CDN for frontend assets, message queue for background tasks, microservices decomposition.

### Monitoring Enhancements
Real-time health dashboards, performance metrics collection, error tracking and alerting, audit logging system, user analytics platform.

## Related Documentation

- [Component Interactions](./components.md) - Detailed interaction flows
- [Data Flow](./data-flow.md) - Lifecycle documentation
- [Backend Documentation](../backend/README.md) - API and service details
- [Runtime Documentation](../runtime/README.md) - Game engine integration
