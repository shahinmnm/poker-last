# SSL/TLS Configuration

High-level overview of SSL/TLS certificate management and HTTPS security.

## SSL/TLS Purpose

Transport Layer Security provides:

- **Encryption** protects data in transit
- **Authentication** verifies server identity
- **Integrity** detects tampering
- **Trust** builds user confidence

## Certificate Management

### Acquisition Strategy

Obtaining SSL certificates:

**Let's Encrypt Certificates**
- Free automated certificates
- Domain validation required
- 90-day validity period
- Automatic renewal supported

**Certificate Authority**
- Validates domain ownership
- Issues trusted certificates
- Signs with CA private key
- Enables browser trust

**Domain Validation**
- HTTP challenge via webroot
- DNS challenge for wildcards
- Temporary validation file
- Domain control verification

### Certificate Types

Different certificate options:

**Single Domain**
- Covers one domain name
- Most common type
- Simplest validation
- Lowest cost

**Wildcard Certificate**
- Covers all subdomains
- Single certificate for multiple hosts
- DNS validation required
- More complex setup

**Multi-Domain (SAN)**
- Multiple specific domains
- Alternative names listed
- Flexible coverage
- Organizational use

### Installation Process

Installing certificates in production:

**Certificate Acquisition**
1. Request certificate from CA
2. Complete domain validation
3. Receive certificate files
4. Verify certificate details

**Nginx Configuration**
1. Mount certificates to container
2. Configure SSL directive
3. Specify certificate paths
4. Set private key location

**HTTPS Enablement**
1. Enable HTTPS listener
2. Configure SSL protocols
3. Set cipher suites
4. Enable HTTP to HTTPS redirect

**Verification**
1. Test HTTPS connectivity
2. Verify certificate chain
3. Check security headers
4. Confirm redirect works

## Renewal Strategy

### Automatic Renewal

Certificates renewed before expiration:

**Renewal Timing**
- Renewal attempted before expiration
- Typically 30 days before expiry
- Multiple retry attempts
- Notification on failure

**Renewal Process**
1. Certbot checks expiration
2. Requests new certificate
3. Validates domain ownership
4. Installs renewed certificate
5. Reloads web server

**Renewal Automation**
- Certbot service runs periodically
- Scheduled via Docker profile
- Checks certificates twice daily
- Renews when threshold reached

### Manual Renewal

Manual renewal when needed:

**Renewal Triggers**
- Automatic renewal failure
- Configuration changes
- Testing renewal process
- Certificate replacement

**Renewal Steps**
1. Stop certbot scheduled tasks
2. Execute renewal command
3. Verify new certificate
4. Reload Nginx configuration
5. Resume automatic renewal

**Verification After Renewal**
- Certificate expiration extended
- Chain validation works
- HTTPS functional
- No browser warnings

## Security Configuration

### Protocol Configuration

Secure protocol selection:

**TLS Versions**
- TLS 1.3 preferred
- TLS 1.2 minimum accepted
- Older protocols disabled
- Forward secrecy enabled

**Cipher Suites**
- Strong encryption required
- Modern cipher preference
- Weak ciphers disabled
- Perfect forward secrecy

**Security Headers**
- HSTS for HTTPS enforcement
- Content Security Policy
- X-Frame-Options protection
- X-Content-Type-Options

### Connection Security

All connections secured:

**HTTPS Enforcement**
- HTTP redirects to HTTPS
- All traffic encrypted
- No plain HTTP allowed
- Secure cookie flags

**WebSocket Security**
- WSS protocol required
- Upgrade from HTTPS
- Same security level
- Authentication maintained

**Certificate Validation**
- Valid certificate chain
- Trusted CA signature
- Domain name matches
- Not expired

## Certificate Storage

### Storage Location

Certificate file organization:

**Volume Storage**
- Persistent volume for certificates
- Shared with Nginx container
- Survives container recreation
- Backup included

**File Organization**
- Live directory for active certs
- Archive for old versions
- Renewal directory for new certs
- Accounts directory for credentials

**File Permissions**
- Private keys restricted
- Certificates readable
- Directory permissions controlled
- Owner verification

### Storage Security

Protecting certificate files:

**Access Control**
- Limited user access
- Container isolation
- Volume permissions
- Audit logging

**Backup Strategy**
- Regular certificate backup
- Backup encryption
- Offsite storage
- Recovery testing

**Recovery Procedures**
- Certificate restoration
- Key recovery
- Re-installation process
- Verification steps

## Certificate Monitoring

### Expiration Monitoring

Track certificate validity:

**Expiration Checking**
- Automated expiration monitoring
- Alert before expiration
- Renewal trigger
- Notification on failure

**Monitoring Points**
- Days until expiration
- Renewal success/failure
- Certificate changes
- Validation status

**Alert Thresholds**
- Warning at 30 days
- Critical at 14 days
- Daily reminders approaching expiry
- Immediate on renewal failure

### Validation Monitoring

Ongoing certificate validation:

**Chain Validation**
- Complete chain present
- All intermediates included
- Root CA trusted
- No missing certificates

**Domain Validation**
- Certificate matches domain
- Common name correct
- Subject Alternative Names valid
- Wildcard coverage if applicable

**Revocation Checking**
- OCSP stapling configured
- CRL checking enabled
- Revocation status verified
- Response caching

## Troubleshooting

### Common Issues

Certificate problems and solutions:

**Certificate Not Found**
- Verify file paths
- Check volume mounts
- Confirm certificate files exist
- Review permissions

**Certificate Expired**
- Check renewal process
- Manual renewal if needed
- Verify certbot running
- Review renewal logs

**Certificate Invalid**
- Verify domain matches
- Check certificate chain
- Confirm CA trust
- Validate dates

**Renewal Failures**
- Check domain reachability
- Verify webroot path
- Review rate limits
- Check DNS resolution

### Validation Failures

Domain validation problems:

**HTTP Challenge Issues**
- Webroot path incorrect
- Firewall blocking port 80
- Nginx configuration wrong
- DNS not resolving

**DNS Challenge Issues**
- DNS provider API access
- Record creation failure
- Propagation delay
- Configuration error

### Browser Warnings

SSL warning resolution:

**Certificate Warnings**
- Self-signed certificate
- Expired certificate
- Domain mismatch
- Incomplete chain

**Security Warnings**
- Weak cipher suites
- Protocol version issues
- Mixed content
- HSTS not set

## Integration Points

### Nginx Integration

Web server certificate usage:

**SSL Configuration**
- Certificate path specification
- Private key location
- Chain file inclusion
- Protocol and cipher settings

**Virtual Host Configuration**
- Server name matching
- SSL-specific directives
- Redirect configuration
- Header settings

**Reload Process**
- Graceful configuration reload
- No connection dropping
- Certificate update pickup
- Minimal disruption

### Application Integration

Application-level considerations:

**HTTPS URLs**
- All URLs use HTTPS
- Absolute URLs in redirects
- Canonical URL setting
- Link generation

**Secure Cookies**
- Secure flag on cookies
- SameSite attribute
- HttpOnly where appropriate
- Domain specification

**Mixed Content**
- No HTTP resources
- All assets over HTTPS
- API calls secure
- WebSocket secure

## Best Practices

### Certificate Lifecycle

Managing certificate lifecycle:

**Planning**
- Certificate type selection
- Renewal planning
- Monitoring setup
- Documentation

**Acquisition**
- Authority selection
- Validation method
- Installation procedure
- Testing protocol

**Renewal**
- Automated renewal
- Monitoring expiration
- Testing renewals
- Failure handling

**Replacement**
- Planned replacement
- Emergency replacement
- Installation verification
- Rollback capability

### Security Hardening

Enhanced security measures:

**Configuration Hardening**
- Disable weak protocols
- Strong cipher selection
- Security headers
- OCSP stapling

**Access Control**
- Private key protection
- Certificate file permissions
- Admin access control
- Audit logging

**Monitoring**
- Certificate expiration
- Security warnings
- Protocol usage
- Cipher suite usage

### Documentation

Certificate documentation:

**Configuration Documentation**
- Certificate locations
- Renewal procedures
- Contact information
- Troubleshooting steps

**Change Documentation**
- Certificate replacements
- Configuration changes
- Renewal events
- Incident responses

## Disaster Recovery

### Certificate Loss

Recovering from certificate loss:

**Detection**
- Service unavailable
- Certificate errors
- File system issues
- Backup verification

**Recovery**
- Restore from backup
- Re-request certificate
- Re-install and configure
- Verify operation

**Prevention**
- Regular backups
- Multiple backup locations
- Backup verification
- Recovery testing

### Emergency Renewal

Urgent certificate replacement:

**Scenarios**
- Expired certificate
- Compromised private key
- Domain change
- CA revocation

**Process**
1. Stop affected services
2. Request emergency certificate
3. Install new certificate
4. Verify configuration
5. Restart services
6. Monitor operation

## Compliance Considerations

### Regulatory Requirements

Meeting compliance needs:

**Encryption Standards**
- Required protocol versions
- Minimum key lengths
- Approved cipher suites
- Security controls

**Certificate Requirements**
- CA trust requirements
- Validation procedures
- Renewal frequency
- Audit trails

**Documentation Requirements**
- Configuration documentation
- Change tracking
- Incident response
- Compliance reporting

## Related Documentation

- [Deployment Strategy](./strategy.md) - Security in deployment
- [Deployment Overview](./overview.md) - Architecture context
- [Docker Setup](./docker.md) - Nginx container
- [Secrets Management](./secrets.md) - Credential handling
- [Monitoring](./monitoring.md) - Certificate monitoring
