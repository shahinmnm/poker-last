# Docker Setup

High-level overview of Docker Compose configuration and service orchestration.

## Docker Architecture

### Container Philosophy

The system uses containers for consistency and isolation:

- **Reproducible environments** across deployment stages
- **Service isolation** prevents interference
- **Resource management** controls utilization
- **Simplified deployment** through orchestration

### Compose Orchestration

Docker Compose manages the multi-service stack:

- **Service definitions** specify all components
- **Dependency management** ensures startup order
- **Network creation** enables service communication
- **Volume management** provides persistence

### Configuration Files

Multiple compose files support different scenarios:

**docker-compose.yml**
- Base service definitions
- Development and production common elements
- Network and volume declarations
- Default configuration values

**docker-compose.prod.yml**
- Production-specific overrides
- Performance optimizations
- Security hardening
- Monitoring integration

**docker-compose.dev.yml**
- Development conveniences
- Hot reload enablement
- Debug tooling
- Simplified networking

## Service Definitions

### Backend Service

FastAPI application service:

**Purpose and Responsibilities**
- REST API endpoint handling
- WebSocket connection management
- Business logic execution
- Database interaction

**Dependencies**
- Requires PostgreSQL for data persistence
- Uses Redis for caching and real-time features
- Waits for migration completion
- Connects to external services

**Connectivity**
- Exposes API endpoints internally
- WebSocket endpoints for real-time updates
- Health check endpoint for monitoring
- Metrics endpoint for observability

**Configuration**
- Worker count for concurrent requests
- Database connection pool sizing
- Cache connection settings
- Logging level and format

### Bot Service

Telegram webhook handler service:

**Purpose and Responsibilities**
- Telegram update reception
- User command processing
- Session state management
- Backend API client

**Dependencies**
- Requires backend API availability
- Uses Redis for session storage
- Connects to Telegram API
- Waits for database readiness

**Connectivity**
- Webhook endpoint for Telegram
- WebSocket client to backend
- Health check endpoint
- Internal API communication

**Configuration**
- Bot token authentication
- Webhook secret verification
- Session timeout settings
- Rate limiting parameters

### Frontend Service

React mini-app service:

**Purpose and Responsibilities**
- Static asset serving
- Client-side application
- API integration layer
- User interface rendering

**Build Process**
- Vite compilation of React app
- Asset optimization and bundling
- Environment variable injection
- Production-ready output

**Serving Options**
- Nginx for production serving
- Vite preview server for development
- Static file optimization
- Efficient caching headers

**Configuration**
- API endpoint configuration
- Build-time environment variables
- Asset path settings
- Feature flag compilation

### PostgreSQL Service

Database persistence service:

**Purpose and Responsibilities**
- Relational data storage
- Transaction management
- Query execution
- Data integrity enforcement

**Data Storage**
- Named volume for persistence
- Data directory mounting
- Backup accessibility
- Recovery capability

**Configuration**
- Database name and credentials
- Connection limits
- Memory allocation
- Logging verbosity

**Performance Tuning**
- Shared buffer sizing
- Work memory allocation
- Checkpoint configuration
- Query planning parameters

### Redis Service

Caching and pub/sub service:

**Purpose and Responsibilities**
- Session data caching
- Matchmaking queue management
- Real-time event distribution
- Temporary data storage

**Persistence Options**
- RDB snapshots for durability
- AOF for maximum durability
- No persistence for pure cache
- Hybrid approach for flexibility

**Configuration**
- Memory limit setting
- Eviction policy selection
- Persistence strategy
- Replication if clustered

**Performance Tuning**
- Memory allocation
- Persistence frequency
- Command timing
- Client connection limits

### Nginx Service

Reverse proxy and static file server:

**Purpose and Responsibilities**
- External request routing
- SSL/TLS termination
- Static asset serving
- WebSocket proxying

**Routing Configuration**
- Backend API proxying
- Frontend static serving
- WebSocket upgrade handling
- Health check routing

**SSL Termination**
- Certificate mounting
- HTTPS configuration
- HTTP to HTTPS redirect
- Secure protocol enforcement

**Static Asset Serving**
- Frontend build output
- Efficient caching headers
- Compression enablement
- Access logging

### Migrations Service

Database schema management:

**Purpose and Responsibilities**
- Alembic migration execution
- Schema version tracking
- Migration validation
- Startup blocking until complete

**Execution Model**
- Runs once on startup
- Blocks dependent services
- Exits after completion
- Logs migration progress

**Dependency Chain**
- Requires database availability
- Blocks application services
- Verifies schema correctness
- Enables version tracking

## Network Configuration

### Internal Networking

Services communicate via Docker network:

**Network Isolation**
- Services on private network
- No external exposure by default
- Controlled communication paths
- Secure inter-service traffic

**Service Discovery**
- DNS-based service names
- Automatic hostname resolution
- Stable service addressing
- Container restart resilience

**Communication Patterns**
- Backend to database
- Bot to backend API
- Redis pub/sub for events
- Health check probes

### External Access

Only designated services exposed:

**Reverse Proxy Exposure**
- Nginx on ports 80 and 443
- All external traffic routed through proxy
- Internal services isolated
- Controlled access points

**Port Mapping**
- Development mode exposes services directly
- Production mode uses proxy only
- Explicit port publication
- Host network isolation

### Network Security

Network configuration ensures security:

- **Database not accessible** from host in production
- **Redis isolated** to internal network
- **Service-to-service encryption** where needed
- **Firewall rules** complement network isolation

## Volume Management

### Persistent Volumes

Named volumes provide data durability:

**Database Volume**
- PostgreSQL data directory
- Survives container recreation
- Backup and restore capability
- Performance considerations

**Redis Volume**
- Optional persistence
- RDB and AOF storage
- Faster startup with data
- Backup for durability

**Certificate Volume**
- SSL certificate storage
- Shared with Nginx
- Renewal persistence
- Recovery capability

**Log Volume**
- Application log storage
- Aggregation and analysis
- Rotation and cleanup
- Troubleshooting access

### Volume Lifecycle

Volume management throughout deployment:

**Creation**
- Automatic on first use
- Named for identification
- Driver selection
- Initial configuration

**Backup**
- Regular snapshot creation
- Export for offsite storage
- Verification of integrity
- Retention policy enforcement

**Restoration**
- Volume recreation
- Data import
- Permission verification
- Service restart

**Cleanup**
- Unused volume removal
- Space reclamation
- Backup archival
- Audit trail maintenance

### Volume Security

Data protection in volumes:

- **Access control** via container permissions
- **Encryption at rest** if required
- **Backup encryption** for confidentiality
- **Audit logging** for access tracking

## Health Checks

### Health Check Strategy

All services implement health monitoring:

**Health Endpoints**
- HTTP endpoint for checking
- Database connectivity verification
- Dependency availability confirmation
- Ready vs live distinction

**Check Configuration**
- Interval between checks
- Timeout for response
- Retries before failure
- Start period before checking

**Failure Handling**
- Restart on repeated failure
- Backoff between restarts
- Maximum restart attempts
- Alert generation

### Service-Specific Checks

Each service has appropriate health verification:

**Backend Health**
- API endpoint responsiveness
- Database connection active
- Redis connectivity confirmed
- Ready to handle requests

**Bot Health**
- Webhook handler responsive
- Backend API reachable
- Session storage accessible
- Update processing functional

**Database Health**
- PostgreSQL accepting connections
- Query execution working
- Transaction processing functional
- Replication synchronized if applicable

**Redis Health**
- Command execution working
- Memory usage acceptable
- Persistence functioning
- Pub/sub operational

**Frontend Health**
- Static files accessible
- Asset serving functional
- Correct content delivery
- Routing working

### Health Dependencies

Services check upstream dependencies:

**Dependency Verification**
- Database connectivity tested
- Cache availability confirmed
- External service reachability checked
- API endpoint accessibility verified

**Startup Dependencies**
- Wait for required services
- Verify connectivity before starting
- Retry connection attempts
- Fail startup if dependencies unavailable

**Runtime Dependencies**
- Continuous dependency monitoring
- Graceful degradation on loss
- Automatic recovery on restoration
- Circuit breaker patterns

## Resource Management

### Resource Limits

Container resources controlled:

**Memory Limits**
- Maximum memory per container
- Reservation for guaranteed minimum
- OOM behavior configuration
- Swap usage control

**CPU Limits**
- CPU share allocation
- Core count restrictions
- Priority assignment
- Throttling prevention

**Disk Limits**
- Volume size constraints
- I/O bandwidth limits
- IOPS restrictions
- Space monitoring

### Resource Monitoring

Track resource utilization:

- **Memory usage** per container
- **CPU utilization** over time
- **Network throughput** measurement
- **Disk I/O** monitoring

### Resource Optimization

Efficient resource usage:

**Right-sizing**
- Appropriate limits for workload
- Avoid over-provisioning
- Prevent resource starvation
- Performance vs cost balance

**Scaling Decisions**
- Horizontal vs vertical scaling
- Load-based scaling triggers
- Performance monitoring data
- Cost optimization

## Container Lifecycle

### Startup Sequence

Containers start in order:

1. **Network creation** establishes connectivity
2. **Volume mounting** provides persistence
3. **Data services start** (database, cache)
4. **Migrations execute** prepare schema
5. **Application services start** handle traffic
6. **Reverse proxy starts** enables access

### Restart Policies

Automatic restart configuration:

**Always Restart**
- Production services restart on failure
- Crash recovery automatic
- Maximizes availability
- May mask persistent issues

**On Failure Only**
- Development services
- Manual intervention preferred
- Issue investigation enabled
- Clean exit allows shutdown

**No Restart**
- One-time tasks like migrations
- Manual restart required
- Completion is final state
- No automatic retry

### Update Procedures

Container updates follow process:

1. **Pull new images** from registry
2. **Stop old containers** gracefully
3. **Remove old containers** clean state
4. **Start new containers** with updates
5. **Verify health checks** confirm success

### Cleanup Operations

Maintain clean Docker environment:

**Container Cleanup**
- Remove stopped containers
- Free disk space
- Clean up orphaned containers
- Remove old versions

**Image Cleanup**
- Remove unused images
- Prune dangling layers
- Keep tagged releases
- Reclaim storage

**Volume Cleanup**
- Identify orphaned volumes
- Backup before removal
- Remove unused volumes carefully
- Maintain data integrity

## Configuration Management

### Environment Variables

Services configured via environment:

**Variable Sources**
- .env file primary source
- Docker Compose interpolation
- Override mechanisms
- Default value fallbacks

**Variable Scope**
- Service-specific variables
- Global shared values
- Secret variables
- Feature flags

**Variable Validation**
- Required variables checked
- Format validation
- Range checking
- Consistency verification

### Configuration Updates

Changing configuration:

1. **Update .env file** with changes
2. **Validate new configuration** before deployment
3. **Restart affected services** apply changes
4. **Verify health checks** confirm success
5. **Monitor for issues** after change

### Secrets Handling

Sensitive configuration protection:

- **Environment variables** for secrets
- **File permissions** restrict access
- **No hardcoded secrets** in images
- **Rotation procedures** defined

## Development vs Production

### Development Configuration

Developer-friendly settings:

- **Port exposure** for direct access
- **Volume mounts** enable hot reload
- **Debug logging** for troubleshooting
- **Simplified networking** ease testing

### Production Configuration

Production-optimized settings:

- **Reverse proxy only** external access
- **No volume mounts** for code
- **Performance tuning** resource allocation
- **Security hardening** minimal exposure

### Configuration Differences

Key variations between environments:

- **Worker counts** lower in development
- **Health checks** more lenient in development
- **Restart policies** stricter in production
- **Resource limits** enforced in production

## Troubleshooting

### Container Issues

Diagnosing container problems:

**Container Won't Start**
- Check logs for errors
- Verify configuration
- Confirm dependencies available
- Review resource availability

**Container Keeps Restarting**
- Examine application logs
- Check health check failures
- Verify database connectivity
- Review resource limits

**Container Performance Issues**
- Monitor resource usage
- Check for resource constraints
- Review application metrics
- Analyze logs for bottlenecks

### Network Issues

Network connectivity problems:

**Service Communication Failures**
- Verify network configuration
- Check service name resolution
- Confirm firewall rules
- Test connectivity manually

**External Access Problems**
- Check port mappings
- Verify reverse proxy configuration
- Confirm DNS resolution
- Review SSL configuration

### Volume Issues

Data persistence problems:

**Volume Mount Failures**
- Check volume exists
- Verify permissions
- Confirm path correctness
- Review driver compatibility

**Data Persistence Issues**
- Verify volume binding
- Check data directory
- Confirm write permissions
- Review storage capacity

## Related Documentation

- [Deployment Strategy](./strategy.md) - Overall deployment approach
- [Deployment Overview](./overview.md) - Architecture details
- [Monitoring](./monitoring.md) - Health tracking
- [Secrets Management](./secrets.md) - Configuration security
