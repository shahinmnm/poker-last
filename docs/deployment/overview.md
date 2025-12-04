# Deployment Overview

High-level overview of production deployment architecture and processes.

## Deployment Philosophy

The deployment system prioritizes:

- **Stability** through predictable deployment sequences
- **Predictability** via deterministic configuration management
- **Security** using environment-based secrets and TLS
- **Observability** through comprehensive monitoring
- **Alignment** with multi-service architecture

## Deployment Architecture

### Container Stack

All services run in Docker containers:

- Orchestrated by Docker Compose for lifecycle management
- Internal network for secure service communication
- External ports only on reverse proxy
- Isolated environments for different stages

### Service Organization

**Core Application Services**
- Backend API handles REST and WebSocket endpoints
- Bot service processes Telegram webhooks
- Frontend serves the mini-app interface
- Runtime manages game state via PokerKit

**Data Services**
- PostgreSQL provides persistent storage
- Redis enables caching and real-time features
- Migrations ensure schema alignment

**Supporting Services**
- Analytics collects snapshots and generates insights
- Nginx provides reverse proxy and SSL termination

### Data Persistence

Persistent state maintained through:

- Named volumes for PostgreSQL data
- Redis persistence enabled for cache recovery
- SSL certificate storage in volumes
- Application logs with rotation

### Service Configuration

Configuration managed through environment variables:

- Single .env file for all services
- Secrets management for credentials
- Feature flags for optional capabilities
- Runtime parameters for tuning

## Deployment Process

### Initial Setup

First deployment follows structured sequence:

1. Repository cloning to deployment server
2. Environment configuration via .env file
3. First deployment script execution
4. SSL certificate acquisition and installation
5. Service health verification
6. Monitoring activation

### Regular Updates

Updates maintain service availability:

1. Code synchronization from repository
2. Container rebuild with latest changes
3. Database migration execution
4. Service restart with health checks
5. Deployment verification and validation

### Emergency Rollback

Rollback procedures provide safety:

1. Revert to previous Git commit
2. Rebuild containers from stable version
3. Restore database backup if schema changed
4. Restart services with verified configuration
5. Verify system health and stability

## Environment Types

### Production Environment

Full production stack includes:

- SSL/TLS encryption for all connections
- Automated restart policies for resilience
- Comprehensive health monitoring
- Scheduled backup operations
- Performance tuning and optimization

### Staging Environment

Production-like environment for validation:

- Similar architecture to production
- Test deployment procedures
- Integration testing capabilities
- Performance testing under load
- Migration validation

### Development Environment

Local development setup enables:

- Hot reload for rapid iteration
- Debug logging for troubleshooting
- Test data for development
- Local databases without containers
- Simplified configuration

## Operational Workflows

### Deployment Sequence

Services start in dependency order:

1. **Data layer** (PostgreSQL, Redis)
2. **Schema preparation** (migrations)
3. **Application services** (API, bot, runtime)
4. **Frontend** (mini-app)
5. **Reverse proxy** (Nginx)
6. **Analytics** (scheduled tasks)

### Update Workflow

Updates follow consistent pattern:

1. **Pre-deployment** validation and testing
2. **Deployment** execution with scripts
3. **Migration** application if needed
4. **Health check** verification
5. **Monitoring** for issues

### Backup Workflow

Regular backups protect data:

1. **Scheduled execution** at defined intervals
2. **Database dump** with verification
3. **Volume snapshot** for configurations
4. **Offsite transfer** for disaster recovery
5. **Retention management** per policy

## Security Architecture

### Network Security

Network isolation provides protection:

- Services communicate via internal network
- External access only through reverse proxy
- Database and Redis not exposed to host
- Firewall rules limit access

### Credential Management

Sensitive data handled carefully:

- Environment variables for configuration
- Separate secrets for different purposes
- Regular rotation procedures
- Access logging and auditing

### TLS Configuration

Encrypted connections required:

- HTTPS for all web traffic
- Secure WebSocket connections
- Certificate auto-renewal
- Modern cipher suites

## Scalability Considerations

### Vertical Scaling

Resource increases per service:

- Worker count adjustment
- Memory limit increases
- CPU allocation tuning
- Connection pool sizing

### Horizontal Scaling

Multiple instances where beneficial:

- Load balancing configuration
- Session affinity where needed
- Shared state via Redis
- Database connection pooling

## Service Dependencies

### Dependency Chain

Services depend on others:

- **Application services** require data layer
- **Frontend** requires backend API
- **Bot** requires backend and Telegram
- **Analytics** requires database access
- **All services** benefit from Redis

### Health Propagation

Health checks cascade:

- Downstream services check upstream dependencies
- Failed dependencies trigger degraded mode
- Automatic recovery when dependencies restore
- Circuit breakers prevent cascade failures

## Deployment Artifacts

### Configuration Files

Deployment uses several configurations:

- **docker-compose.yml** for base services
- **docker-compose.prod.yml** for production
- **.env** file for environment variables
- **Nginx configuration** for reverse proxy

### Deployment Scripts

Automation scripts simplify operations:

- **first-deploy.sh** for initial setup
- **update.sh** for comprehensive updates
- **lightupdate.sh** for quick code updates
- **backup.sh** for data protection
- **logs.sh** for log viewing

## Monitoring Integration

### Health Monitoring

Continuous health tracking:

- Docker health checks for containers
- Application endpoint monitoring
- Database connection verification
- Cache availability checking

### Performance Monitoring

Resource and performance tracking:

- Response time measurement
- Error rate monitoring
- Resource utilization tracking
- Throughput measurement

### Operational Visibility

Dashboards and logs provide insight:

- Real-time system status
- Historical performance data
- Error rate visualization
- Resource usage graphs

## Related Documentation

- [Deployment Strategy](./strategy.md) - Comprehensive deployment strategy
- [Release Process](./releases.md) - Versioning and release workflow
- [Docker Setup](./docker.md) - Container details
- [Migrations](./migrations.md) - Database management
- [SSL](./ssl.md) - Security configuration
- [Monitoring](./monitoring.md) - Observability details
