# Docker Compose Deployment Guide

This directory contains Docker Compose files for deploying the Telegram Poker Bot.

## Files

- `docker-compose.yml` - Main deployment file with all services
- `docker-compose.clone.yml` - Optional file for cloning the repository
- `Dockerfile.api` - API service Dockerfile
- `Dockerfile.bot` - Bot service Dockerfile
- `Dockerfile.frontend` - Frontend service Dockerfile
- `Dockerfile.migrations` - Database migrations Dockerfile
- `nginx.conf.example` - Example Nginx configuration

## Quick Start

### 1. Clone Repository (Optional)

If you need to clone the repository first:

```bash
cd telegram_poker_bot/deploy
export GIT_REPO_URL=https://github.com/your-org/your-repo.git
export GIT_BRANCH=main
# Optional: for private repos
export GIT_TOKEN=your_github_token

docker-compose -f docker-compose.clone.yml --profile clone up
```

### 2. Set Environment Variables

Create a `.env` file in the `deploy` directory:

```bash
cd telegram_poker_bot/deploy
cp ../.env.example .env
# Edit .env with your values
```

Required variables:
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `PUBLIC_BASE_URL` - Public URL for webhooks (e.g., https://your-domain.com)
- `WEBAPP_SECRET` - Secret for Telegram Mini App
- `POSTGRES_PASSWORD` - Database password
- `CORS_ORIGINS` - Allowed CORS origins
- `VITE_API_URL` - API URL for frontend
- `VITE_BOT_USERNAME` - Bot username (e.g., @yourbot)

### 3. Run Database Migrations

```bash
docker-compose --profile migrations up migrations
```

### 4. Start Services

Start all services:

```bash
docker-compose up -d
```

Or start specific services:

```bash
# Start only database and cache
docker-compose up -d postgres redis

# Start bot and API
docker-compose up -d bot api

# Start frontend
docker-compose up -d frontend
```

### 5. Start with Nginx (Production)

For production deployment with Nginx reverse proxy:

1. Copy and configure nginx.conf:
```bash
cp nginx.conf.example nginx.conf
# Edit nginx.conf with your domain and SSL paths
```

2. Start with nginx profile:
```bash
docker-compose --profile nginx up -d
```

## Service Ports

- **PostgreSQL**: 5432 (default)
- **Redis**: 6380 (default)
- **API**: 8000 (default)
- **Frontend**: 3000 (default)
- **Nginx HTTP**: 80 (default)
- **Nginx HTTPS**: 443 (default)

You can override these in your `.env` file:
- `POSTGRES_PORT`
- `REDIS_PORT`
- `API_PORT`
- `FRONTEND_PORT`
- `NGINX_HTTP_PORT`
- `NGINX_HTTPS_PORT`

> **Note:** The Redis service maps to host port `6380` by default to avoid clashing with a locally running Redis instance on `6379`. Adjust `REDIS_PORT` in your `.env` file if you prefer a different host port.

## Building from Source

The docker-compose.yml expects the build context to be the workspace root (parent of `telegram_poker_bot`). 

If you're running from the `deploy` directory:
```bash
docker-compose build
```

If you're running from the workspace root:
```bash
cd telegram_poker_bot/deploy
docker-compose build
```

## Service Details

### PostgreSQL
- Persistent data stored in `postgres_data` volume
- Health checks enabled
- Default database: `pokerbot`
- Default user: `pokerbot`

### Redis
- Persistent data stored in `redis_data` volume
- AOF (Append Only File) enabled for durability
- Health checks enabled

### Bot Service
- Handles Telegram webhooks
- Connects to PostgreSQL and Redis
- Exposes webhook endpoint on port 8443 (internal)

### API Service
- FastAPI REST and WebSocket API
- Serves Mini App backend
- Exposes port 8000

### Frontend Service
- React/Vite application
- Pre-built and served via preview server
- Exposes port 3000

### Migrations Service
- Runs Alembic migrations
- One-time execution (restart: "no")
- Use `--profile migrations` to run

## Monitoring

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f bot
docker-compose logs -f api
```

Check service status:
```bash
docker-compose ps
```

## Stopping Services

Stop all services:
```bash
docker-compose down
```

Stop and remove volumes (⚠️ deletes data):
```bash
docker-compose down -v
```

## Troubleshooting

### Docker ContainerConfig Error
If you encounter `KeyError: 'ContainerConfig'` when running `docker-compose up`:

```bash
./fix-docker-error.sh
```

This script will automatically fix corrupted Docker images and restart services.

See [README-FIX-DOCKER-ERROR.md](./README-FIX-DOCKER-ERROR.md) for detailed information.

### Database Connection Issues
- Ensure PostgreSQL is healthy: `docker-compose ps postgres`
- Check database URL format in `.env`
- Verify network connectivity: `docker-compose exec api ping postgres`

### Bot Not Receiving Updates
- Verify `PUBLIC_BASE_URL` is accessible from internet
- Check webhook secret token matches
- Review bot logs: `docker-compose logs -f bot`

### Frontend Build Issues
- Ensure Node.js dependencies are installed
- Check `VITE_API_URL` matches your API endpoint
- Review frontend logs: `docker-compose logs -f frontend`

## Production Considerations

1. **Security**:
   - Use strong passwords for PostgreSQL
   - Enable SSL/TLS for all connections
   - Use secrets management (Docker secrets, Vault, etc.)
   - Restrict network access

2. **Performance**:
   - Adjust database pool sizes
   - Configure Redis memory limits
   - Use CDN for frontend assets
   - Enable Nginx caching

3. **Backup**:
   - Regular PostgreSQL backups
   - Redis persistence configuration
   - Volume backups

4. **Monitoring**:
   - Set up health checks
   - Configure logging aggregation
   - Monitor resource usage
   - Set up alerts

## Development

For development, you may want to:
- Mount source code as volumes for hot-reload
- Use development dependencies
- Enable debug logging
- Expose additional ports

Create a `docker-compose.dev.yml` override file for development-specific settings.
