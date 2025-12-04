# Deployment Documentation

This section covers deployment and operations for production environments.

## Contents

- [Deployment Strategy](./strategy.md) - Comprehensive deployment strategy
- [Deployment Overview](./overview.md) - Deployment architecture
- [Operational Excellence](./operations.md) - Best practices and guidelines
- [Docker Setup](./docker.md) - Container orchestration
- [Database Migrations](./migrations.md) - Schema management
- [Secrets Management](./secrets.md) - Environment and credentials
- [SSL Configuration](./ssl.md) - Security setup
- [Monitoring](./monitoring.md) - Operations and monitoring
- [Release Process](./releases.md) - Versioning and release workflow

## Deployment Stack

### Container Orchestration
Docker Compose for service management, automated startup and restart, health checks, service dependencies.

### Infrastructure
PostgreSQL for data persistence, Redis for caching and queues, Nginx for reverse proxy and SSL, automated SSL certificates.

### Services
Backend API service, Telegram bot service, Frontend static assets, Database migrations, Background analytics scheduler.

## Deployment Methods

Production deployment with SSL and domain, development environment with hot reload, local testing without containers, CI/CD pipeline integration.

## Related Documentation

- [Architecture](../architecture/overview.md) - System design
- [Backend](../backend/overview.md) - Service details
- [Developer Guide](../developer/getting-started.md) - Local setup
