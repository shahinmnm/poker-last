# Docker Setup

High-level overview of Docker Compose configuration.

## Service Definitions

### Backend Service
FastAPI application, connects to PostgreSQL and Redis, exposes API endpoints, health check endpoint.

### Bot Service
Telegram webhook handler, connects to backend API, WebSocket client, session management.

### Frontend Service
React app served statically, Vite build output, served via Nginx or preview server.

### PostgreSQL Service
Database persistence, data volume mounting, configuration via environment, backup capabilities.

### Redis Service
Caching and pub/sub, persistence enabled, configuration tuning, memory limits.

### Nginx Service
Reverse proxy for all services, SSL termination, static file serving, WebSocket proxying.

## Network Configuration

Services communicate via internal network, only reverse proxy exposed externally, database and Redis not accessible from host, secure inter-service communication.

## Volume Management

Persistent data in named volumes, database files, Redis snapshots, SSL certificates, application logs.

## Health Checks

Each service has health check endpoint, Docker monitors service health, automatic restart on failure, startup dependencies.

## Related Documentation

- [Deployment Overview](./overview.md) - Architecture
- [Migrations](./migrations.md) - Database setup
- [SSL](./ssl.md) - Certificate management
