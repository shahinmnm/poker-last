# Secrets and Environment Management

High-level strategy for managing secrets and environment configuration.

## Overview

The system uses environment-based configuration to separate code from deployment-specific settings. All secrets and configuration flow through environment variables, providing consistency and security.

## Configuration Philosophy

### Single Source of Truth

All configuration originates from one location:

- **Primary .env file** contains all settings
- **Shared across services** ensures consistency
- **Version controlled example** guides setup
- **Actual secrets excluded** from repository

### Environment Separation

Different deployments use different configurations:

- **Production environment** uses secure credentials
- **Staging environment** mimics production safely
- **Development environment** uses test credentials
- **CI environment** uses minimal test setup

### Configuration Validation

Settings validated before deployment:

- **Required variables** checked at startup
- **Format validation** prevents errors
- **Cross-reference checks** ensure consistency
- **Default values** provided where safe

## Secret Categories

### Bot Credentials

Telegram bot authentication requires:

**Bot Token**
- Issued by BotFather
- Authenticates bot to Telegram API
- Required for all bot operations
- Rotated via BotFather interface

**Webhook Secret**
- Verifies webhook requests from Telegram
- Prevents unauthorized update injection
- Generated as random string
- Included in webhook configuration

**Admin Identifiers**
- Telegram chat IDs for administrators
- Enable privileged operations
- Control access to admin features
- Updated when admin team changes

### Database Credentials

PostgreSQL access requires:

**Database Password**
- Protects database access
- Used by all services connecting to database
- Should be strong and unique
- Rotated periodically with coordinated restart

**Connection Parameters**
- Database host and port
- Database name and user
- Connection pool settings
- SSL/TLS requirements

### Service Secrets

Application-level secrets include:

**Webapp Secret**
- Signs mini-app authentication tokens
- Validates user sessions
- Generated as random string
- Rotated requires session invalidation

**API Keys**
- External service authentication
- Rate limiting and quota tracking
- Service-specific credentials
- Provider-specific rotation procedures

### TLS Credentials

HTTPS encryption requires:

**SSL Certificates**
- Domain validation certificates
- Issued by certificate authority
- Public certificates shareable
- Private keys strictly protected

**Private Keys**
- Decrypt TLS traffic
- Must remain confidential
- Restricted file permissions
- Never committed to repository

**Certificate Chains**
- Intermediate CA certificates
- Establish trust path
- Provided by certificate authority
- Updated with certificate renewal

### Cache Credentials

Redis access configuration:

**Connection String**
- Redis host and port
- Database number selection
- Authentication if enabled
- Connection timeout settings

**Access Control**
- Password protection optional
- Network isolation primary security
- ACL configuration if needed
- Command restrictions if configured

## Secret Storage

### Environment Files

Secrets stored in .env files:

**File Location**
- Repository root directory
- Loaded by Docker Compose
- Read by all services
- Excluded from version control

**File Format**
- Key-value pairs
- One setting per line
- Comments for documentation
- Consistent naming convention

**File Security**
- Restricted file permissions
- Not committed to repository
- Backed up separately
- Access logging enabled

### Environment Variables

Runtime configuration through environment:

**Variable Scope**
- Service-specific variables
- Shared configuration values
- Override mechanisms
- Default value handling

**Variable Naming**
- Descriptive and consistent
- Uppercase convention
- Underscore separators
- Prefix for grouping

**Variable Documentation**
- Purpose and usage explained
- Valid values described
- Default values noted
- Required vs optional marked

## Secret Rotation

### Rotation Strategy

Regular credential updates maintain security:

**Rotation Schedule**
- Critical secrets rotated frequently
- Non-critical secrets rotated periodically
- Compromise triggers immediate rotation
- Scheduled during maintenance windows

**Rotation Planning**
- Service impact assessment
- Downtime estimation
- Rollback procedures
- Communication planning

**Rotation Execution**
- Generate new credentials
- Update configuration files
- Deploy configuration changes
- Verify service operation
- Deactivate old credentials

### Bot Token Rotation

Telegram bot token updates:

1. Request new token from BotFather
2. Update TELEGRAM_BOT_TOKEN in .env
3. Deploy configuration update
4. Verify webhook configuration
5. Delete old token in BotFather

Service restart required for token update.

### Database Password Rotation

PostgreSQL password updates:

1. Generate new secure password
2. Update password in database
3. Update POSTGRES_PASSWORD in .env
4. Restart all services using database
5. Verify database connectivity

Brief service interruption expected.

### Webapp Secret Rotation

Session signing secret updates:

1. Generate new random secret
2. Update WEBAPP_SECRET in .env
3. Deploy configuration update
4. Restart affected services
5. Users re-authenticate as needed

Existing sessions invalidated on rotation.

### TLS Certificate Rotation

SSL certificate renewal:

1. Request new certificate
2. Validate domain ownership
3. Install new certificate
4. Reload web server configuration
5. Verify HTTPS functionality

Automated by certbot for Let's Encrypt.

## Security Best Practices

### Generation Guidelines

Creating secure credentials:

**Randomness Requirements**
- Cryptographically secure random generation
- Sufficient length for purpose
- Character variety for complexity
- Avoid predictable patterns

**Strength Recommendations**
- Passwords minimum length enforced
- Token length appropriate for use
- Complexity requirements met
- Dictionary words avoided

### Access Control

Limiting credential access:

**File Permissions**
- Environment files readable only by owner
- Private keys even more restricted
- Certificate files appropriately protected
- Backup files equally secured

**User Access**
- Minimal users with access
- Principle of least privilege
- Access logging enabled
- Regular access review

### Transmission Security

Protecting secrets in transit:

**Configuration Deployment**
- Encrypted channels for transmission
- Secure copy mechanisms
- Verification of delivery
- No secrets in command line

**Service Communication**
- TLS for database connections
- Encrypted Redis connections if exposed
- Internal network isolation
- Credential rotation on breach

## Configuration Management

### Environment File Structure

Organized configuration layout:

**Logical Grouping**
- Related settings together
- Clear section headers
- Consistent ordering
- Documentation comments

**Required vs Optional**
- Required settings marked
- Optional settings documented
- Default values noted
- Validation at startup

**Example Provision**
- .env.example in repository
- Contains all possible settings
- Placeholder values shown
- Setup instructions included

### Variable Validation

Configuration checking:

**Startup Validation**
- Required variables present
- Format correctness verified
- Value ranges checked
- Cross-references validated

**Runtime Validation**
- Type checking enforced
- Range validation applied
- Consistency maintained
- Errors reported clearly

### Default Values

Safe defaults where appropriate:

**Safe Defaults**
- Non-security settings defaulted
- Development-friendly values
- Production override required
- Clearly documented

**Required Settings**
- No defaults for secrets
- Explicit configuration required
- Validation enforces presence
- Startup fails if missing

## Backup and Recovery

### Configuration Backup

Protecting configuration:

**Backup Strategy**
- Environment files backed up regularly
- Separate from code backups
- Encrypted at rest
- Offsite storage

**Backup Security**
- Encrypted backups only
- Access restricted
- Audit trail maintained
- Retention policy applied

### Recovery Procedures

Restoring configuration:

**Configuration Loss**
- Restore from backup
- Verify completeness
- Update if secrets rotated
- Test before deployment

**Secret Compromise**
- Immediate rotation
- Impact assessment
- Forensic analysis
- Prevention measures

## Compliance and Auditing

### Audit Logging

Configuration access tracking:

**Access Events**
- File access logged
- Changes recorded
- Who accessed what
- Timestamp captured

**Change Tracking**
- Configuration modifications logged
- Previous values preserved
- Reason documented
- Approval tracked

### Compliance Requirements

Meeting regulatory needs:

**Data Protection**
- Encryption at rest
- Encryption in transit
- Access controls
- Audit trails

**Retention Policies**
- How long secrets stored
- When secrets deleted
- Backup retention
- Archive requirements

## Troubleshooting

### Common Issues

Configuration problem diagnosis:

**Missing Variables**
- Check .env file completeness
- Compare with .env.example
- Verify required settings present
- Check for typos in names

**Invalid Values**
- Validate format correctness
- Check value ranges
- Verify consistency
- Review documentation

**Permission Problems**
- Verify file permissions
- Check user access rights
- Confirm ownership
- Review SELinux/AppArmor

### Validation Tools

Configuration verification:

**Pre-deployment Checks**
- Syntax validation
- Required variable presence
- Format verification
- Consistency checking

**Runtime Validation**
- Connection testing
- Service startup verification
- Health check confirmation
- Error message review

## Related Documentation

- [Deployment Strategy](./strategy.md) - Overall deployment approach
- [Deployment Overview](./overview.md) - Architecture details
- [SSL Configuration](./ssl.md) - Certificate management
- [Monitoring](./monitoring.md) - Security monitoring
