# Deployment Overview

High-level overview of production deployment.

## Deployment Architecture

### Container Stack
All services run in Docker containers, orchestrated by Docker Compose, internal network for service communication, external ports only on reverse proxy.

### Data Persistence
Named volumes for PostgreSQL data, Redis persistence enabled, SSL certificate storage, application logs.

### Service Configuration
Environment variables for configuration, secrets management, feature flags, runtime parameters.

## Deployment Process

### Initial Setup
Clone repository, configure environment variables, run first deployment script, request SSL certificates, verify services running.

### Updates
Pull latest code changes, rebuild containers with updates, run database migrations, restart services, verify health checks.

### Rollback
Revert to previous Git commit, rebuild containers, restore database backup if needed, restart services.

## Environment Types

### Production
Full stack with SSL, automated restarts, health monitoring, backup scheduling, performance tuning.

### Staging
Production-like environment, test deployments, integration testing, performance testing.

### Development
Hot reload for rapid iteration, debug logging enabled, test data, local databases.

## Related Documentation

- [Docker Setup](./docker.md) - Container details
- [Migrations](./migrations.md) - Database changes
- [SSL](./ssl.md) - Security configuration
