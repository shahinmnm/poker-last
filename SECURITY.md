# Security Configuration

## Database and Service Port Exposure

### Current Configuration (Recommended)

By default, the PostgreSQL and Redis services are **NOT exposed** to the public internet. They are only accessible via the internal Docker network. This is the recommended configuration for production deployments.

#### Benefits:
- ✅ Prevents external scanner traffic and brute-force attempts
- ✅ Reduces log noise from failed authentication attempts
- ✅ Improves security posture
- ✅ No unnecessary attack surface

### Understanding Authentication Failure Logs

If you previously exposed port `5432` publicly, you may have seen logs like:

```
pokerbot_postgres  | 2025-11-13 14:16:13.320 UTC [169] FATAL:  password authentication failed for user "postgres"
pokerbot_postgres  | 2025-11-13 14:16:13.320 UTC [169] DETAIL:  Role "postgres" does not exist.
```

**These are NOT bugs in your application.** They are external internet scanners trying default PostgreSQL credentials:
- Default usernames: `postgres`, `root`, `admin`, `test`, etc.
- Default passwords: Common weak passwords

Your application correctly uses the `pokerbot` user and these attempts are properly rejected.

### Database User Configuration

This application uses:
- **Database User:** `pokerbot` (NOT `postgres`)
- **Database Name:** `pokerbot`
- **Connection:** Via Docker internal network (`postgres:5432`)

All internal services (bot, api, migrations) are correctly configured to use these credentials.

### Exposing Ports for Development/Debugging

If you need to access PostgreSQL or Redis from your host machine (e.g., for using GUI tools like pgAdmin, DBeaver, or Redis Commander), you can temporarily expose the ports:

#### Option 1: Uncomment in docker-compose.yml

Edit `docker-compose.yml` and uncomment the port mappings:

```yaml
postgres:
  # Uncomment the lines below for local debugging
  ports:
    - "${POSTGRES_PORT:-5432}:5432"
```

```yaml
redis:
  # Uncomment the lines below for local debugging
  ports:
    - "${REDIS_PORT:-6379}:6379"
```

#### Option 2: Use docker exec (No port exposure needed)

Access PostgreSQL shell without exposing ports:
```bash
docker exec -it pokerbot_postgres psql -U pokerbot -d pokerbot
```

Access Redis CLI without exposing ports:
```bash
docker exec -it pokerbot_redis redis-cli
```

### Production Firewall Rules

If you choose to expose ports `5432` or `6379`, ensure your firewall only allows access from trusted IPs:

**For cloud providers (AWS, GCP, Azure, DigitalOcean, etc.):**
- Configure security groups to only allow port `5432` from your office IP or VPN
- Block all other inbound traffic to database ports

**For VPS with UFW (Ubuntu/Debian):**
```bash
# Allow SSH (always do this first!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# ONLY if you need external DB access, restrict to specific IP
# Replace YOUR_IP_ADDRESS with your actual IP
sudo ufw allow from YOUR_IP_ADDRESS to any port 5432 proto tcp

# Enable firewall
sudo ufw enable
```

**For VPS with firewalld (CentOS/RHEL/Fedora):**
```bash
# Allow HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# ONLY if you need external DB access, restrict to specific IP
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_IP_ADDRESS" port protocol="tcp" port="5432" accept'

# Reload firewall
sudo firewall-cmd --reload
```

### Best Practices

1. **Never expose database ports in production** unless absolutely necessary
2. **Use SSH tunneling** for remote database access instead of direct exposure:
   ```bash
   ssh -L 5432:localhost:5432 user@your-server
   # Now connect to localhost:5432 from your local tools
   ```
3. **Use strong passwords** for `POSTGRES_PASSWORD` and `REDIS_PASS`
4. **Keep `.env` out of version control** (already in `.gitignore`)
5. **Regularly review access logs** for suspicious activity
6. **Update Docker images** regularly for security patches

## Credentials Configuration

### Database Credentials
Set in root `.env` file:
```bash
POSTGRES_DB=pokerbot
POSTGRES_USER=pokerbot          # Default user (NOT "postgres")
POSTGRES_PASSWORD=your-secret-password-here
```

### Important Notes:
- The default PostgreSQL user `postgres` is **NOT created** in this setup
- All services use the `pokerbot` user consistently
- Changing the username requires updating it in ALL POSTGRES_* variables
- The DATABASE_URL is auto-constructed from individual variables

## Connection String Format

The application automatically builds the connection string:
```
postgresql+asyncpg://pokerbot:PASSWORD@postgres:5432/pokerbot
```

Components:
- `postgresql+asyncpg://` - SQLAlchemy async driver
- `pokerbot` - Database username
- `PASSWORD` - From POSTGRES_PASSWORD
- `postgres` - Docker service name (internal network)
- `5432` - PostgreSQL default port
- `pokerbot` - Database name
