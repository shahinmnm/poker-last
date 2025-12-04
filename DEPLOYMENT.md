# Production Deployment Guide

This guide covers deploying the Poker Bot application in production using Docker Compose.

> **Note**: This is a quick reference guide. For comprehensive deployment strategy, architecture details, and operational procedures, see the [Deployment Documentation](./docs/deployment/README.md).

## Prerequisites

- Docker Engine 20.10+ and Docker Compose V2
- Domain name pointed to your server
- Port 80 and 443 open on your firewall
- Sufficient disk space (recommended: 20GB+)

## Quick Start (Production Deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/shahinmnm/poker-last.git
cd poker-last
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration (REQUIRED - update all values marked with "changeme" or "your_*")
nano .env
```

**Critical settings to configure:**

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from @BotFather
- `POSTGRES_PASSWORD` - Strong database password
- `PUBLIC_BASE_URL` - Your domain (e.g., https://poker.example.com)
- `DOMAIN_NAME` - Your domain (e.g., poker.example.com)
- `CERTBOT_EMAIL` - Email for SSL certificate notifications
- `WEBAPP_SECRET` - Random secret for webapp authentication
- `WEBHOOK_SECRET_TOKEN` - Random secret for webhook verification

### 3. Deploy with SSL (Recommended)

For production deployment with automatic SSL certificates:

```bash
# First deployment with SSL certificate generation
./deploy/first-deploy.sh --with-nginx

# Request SSL certificate (run after nginx is up)
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/html \
  --email ${CERTBOT_EMAIL} \
  --agree-tos \
  --no-eff-email \
  -d ${DOMAIN_NAME}

# Restart nginx to load certificates
docker compose -f docker-compose.prod.yml restart nginx
```

### 4. Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# View logs
./deploy/logs.sh

# Check specific service
./deploy/logs.sh backend -f
```

## Production Docker Compose Commands

The production environment uses `docker-compose.prod.yml`:

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Build and start (after code changes)
docker compose -f docker-compose.prod.yml up -d --build

# Stop all services
docker compose -f docker-compose.prod.yml down

# View service status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a specific service
docker compose -f docker-compose.prod.yml restart backend
```

## Deployment Scripts

### `first-deploy.sh` - Initial Deployment

Bootstraps the application on a fresh server:

```bash
# Deploy without nginx (services only)
./deploy/first-deploy.sh

# Deploy with nginx reverse proxy
./deploy/first-deploy.sh --with-nginx

# Skip pulling base images
./deploy/first-deploy.sh --skip-pull
```

### `update.sh` - Full Update

Complete update with git pull, rebuild, and restart:

```bash
# Standard update
./deploy/update.sh

# Update with nginx
./deploy/update.sh --with-nginx

# Skip migrations (faster)
./deploy/update.sh --skip-migrations

# Clean up old Docker images
./deploy/update.sh --prune-images
```

**Options:**
- `--with-nginx` - Include nginx service
- `--skip-pull` - Skip docker compose pull
- `--skip-build` - Skip rebuilding images
- `--skip-migrations` - Skip database migrations
- `--prune-images` - Remove unused Docker images
- `--skip-cleanup` - Skip Docker cleanup
- `--prune-volumes` - Remove unused volumes (DANGEROUS)

### `lightupdate.sh` - Quick Update

Fast update for code-only changes (no dependencies):

```bash
# Quick update
./deploy/lightupdate.sh

# With migrations
./deploy/lightupdate.sh --migrations

# With nginx
./deploy/lightupdate.sh --with-nginx
```

### `logs.sh` - View Logs

View and follow container logs:

```bash
# All logs
./deploy/logs.sh

# Specific service
./deploy/logs.sh backend

# Follow logs (live)
./deploy/logs.sh -f
./deploy/logs.sh backend -f

# Last 100 lines
./deploy/logs.sh --tail=100

# Logs from last hour
./deploy/logs.sh --since=1h
```

### `backup.sh` - Backup Data

Backup database and volumes:

```bash
# Full backup
./deploy/backup.sh

# Database only
./deploy/backup.sh --db-only

# Volumes only
./deploy/backup.sh --volumes-only
```

Backups are stored in `./backups/backup_YYYYMMDD_HHMMSS/`

## SSL Certificate Management

### Initial Certificate

```bash
# Start nginx first
docker compose -f docker-compose.prod.yml up -d nginx

# Request certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/html \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com

# Restart nginx to load certificate
docker compose -f docker-compose.prod.yml restart nginx
```

### Auto-Renewal

Enable automatic certificate renewal:

```bash
# Start certbot service for auto-renewal
docker compose -f docker-compose.prod.yml --profile certbot up -d
```

The certbot service will automatically renew certificates every 12 hours.

### Manual Renewal

```bash
# Renew certificates manually
docker compose -f docker-compose.prod.yml run --rm certbot renew

# Restart nginx after renewal
docker compose -f docker-compose.prod.yml restart nginx
```

## Service Architecture

### Production Services

- **nginx** - Reverse proxy, SSL termination, static file serving
- **backend** - FastAPI backend API (port 8000 internally)
- **telegram-bot** - Telegram bot webhook handler (port 8443 internally)
- **frontend** - React SPA built with Vite (port 3000 internally)
- **postgres** - PostgreSQL database with persistent storage
- **redis** - Redis cache with persistent storage
- **certbot** - SSL certificate management (optional profile)

### Internal Network

All services communicate via `pokerbot_network` Docker network:
- External access only through nginx (ports 80, 443)
- Database and Redis are not exposed to host
- WebSocket connections proxied through nginx

### Persistent Volumes

- `postgres_data` - PostgreSQL database files
- `redis_data` - Redis persistence
- `certbot_webroot` - Let's Encrypt challenge files

## Health Checks

All services include health checks:

```bash
# Check service health
docker compose -f docker-compose.prod.yml ps

# View health check logs
docker inspect pokerbot_backend_prod --format='{{json .State.Health}}' | jq
```

Health check endpoints:
- Backend API: `GET /health`
- Bot: `GET /health`
- Frontend: `GET /` (index.html)

## Monitoring

### View Service Status

```bash
# All services
docker compose -f docker-compose.prod.yml ps

# Detailed stats
docker stats
```

### Database Access

```bash
# PostgreSQL shell
docker compose -f docker-compose.prod.yml exec postgres psql -U pokerbot -d pokerbot

# Redis CLI
docker compose -f docker-compose.prod.yml exec redis redis-cli
```

### Logs

```bash
# Follow all logs
./deploy/logs.sh -f

# Service-specific
./deploy/logs.sh backend -f
./deploy/logs.sh telegram-bot -f
./deploy/logs.sh nginx -f
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
./deploy/logs.sh

# Check specific service
docker compose -f docker-compose.prod.yml logs backend

# Restart service
docker compose -f docker-compose.prod.yml restart backend
```

### Database Issues

```bash
# Reset database (CAUTION: destroys data)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d

# Backup before reset
./deploy/backup.sh --db-only
```

### SSL Certificate Issues

```bash
# Check certificate
docker compose -f docker-compose.prod.yml exec nginx ls -la /etc/nginx/ssl/

# Test certificate renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew --dry-run

# Force renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
```

### Port Conflicts

```bash
# Check what's using port 80/443
sudo lsof -i :80
sudo lsof -i :443

# Change ports in .env
nano .env
# Edit: NGINX_HTTP_PORT=8080, NGINX_HTTPS_PORT=8443
```

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` to git
   - Use strong passwords for `POSTGRES_PASSWORD`
   - Rotate secrets regularly

2. **SSL/TLS**
   - Always use HTTPS in production
   - Enable HTTP to HTTPS redirect (already configured)
   - Keep certificates up to date

3. **Database**
   - Database is not exposed to host by default
   - Use strong passwords
   - Regular backups

4. **Updates**
   - Keep Docker images updated
   - Regular security updates: `./deploy/update.sh`
   - Monitor logs for suspicious activity

## Backup and Restore

### Backup

```bash
# Full backup
./deploy/backup.sh

# Automated backups (cron)
# Add to crontab:
0 2 * * * cd /path/to/poker-last && ./deploy/backup.sh > /dev/null 2>&1
```

### Restore

```bash
# Stop services
docker compose -f docker-compose.prod.yml down

# Restore database
gunzip < backups/backup_YYYYMMDD_HHMMSS/postgres_pokerbot_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U pokerbot -d pokerbot

# Restore Redis (optional)
docker compose -f docker-compose.prod.yml exec redis redis-cli SHUTDOWN
docker cp backups/backup_YYYYMMDD_HHMMSS/redis_dump_YYYYMMDD_HHMMSS.rdb \
  pokerbot_redis_prod:/data/dump.rdb

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

## Performance Tuning

### Backend Workers

Adjust `UVICORN_WORKERS` in `.env` based on CPU cores:

```bash
# 2 workers (default)
UVICORN_WORKERS=2

# More workers for high traffic
UVICORN_WORKERS=4
```

### Database Connections

PostgreSQL connection pooling is handled by SQLAlchemy. Monitor with:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U pokerbot -d pokerbot -c "SELECT * FROM pg_stat_activity;"
```

## Upgrade Workflow

1. **Backup current deployment**
   ```bash
   ./deploy/backup.sh
   ```

2. **Update code**
   ```bash
   ./deploy/update.sh --with-nginx
   ```

3. **Verify services**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ./deploy/logs.sh
   ```

4. **Rollback if needed**
   ```bash
   git checkout <previous-version>
   ./deploy/update.sh --with-nginx
   ```

## Support

For issues and questions:
- Check logs: `./deploy/logs.sh`
- Review Docker status: `docker compose -f docker-compose.prod.yml ps`
- Check GitHub issues: https://github.com/shahinmnm/poker-last/issues
