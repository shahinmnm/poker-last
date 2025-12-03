# Quick Production Deployment Reference

## First-Time Setup

```bash
# 1. Configure environment
cp .env.example .env
nano .env  # Update TELEGRAM_BOT_TOKEN, POSTGRES_PASSWORD, PUBLIC_BASE_URL, etc.

# 2. Deploy with nginx
./deploy/first-deploy.sh --with-nginx

# 3. Request SSL certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/html \
  --email ${CERTBOT_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN_NAME}

# 4. Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

## Common Commands

```bash
# View logs (all services)
./deploy/logs.sh -f

# View specific service logs
./deploy/logs.sh backend -f

# Backup database and volumes
./deploy/backup.sh

# Update deployment (pull code, rebuild, restart)
./deploy/update.sh --with-nginx

# Quick update (code only, no rebuild)
./deploy/lightupdate.sh --with-nginx

# Check service status
docker compose -f docker-compose.prod.yml ps

# Restart a service
docker compose -f docker-compose.prod.yml restart backend
```

## SSL Certificate Management

```bash
# Enable auto-renewal
docker compose -f docker-compose.prod.yml --profile certbot up -d

# Manual renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx

# Test renewal (dry run)
docker compose -f docker-compose.prod.yml run --rm certbot renew --dry-run
```

## Troubleshooting

```bash
# View all logs
./deploy/logs.sh

# View backend logs
./deploy/logs.sh backend --tail=100

# Database shell
docker compose -f docker-compose.prod.yml exec postgres psql -U pokerbot -d pokerbot

# Redis CLI
docker compose -f docker-compose.prod.yml exec redis redis-cli

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Stop all services
docker compose -f docker-compose.prod.yml down

# Full restart (rebuild)
docker compose -f docker-compose.prod.yml up -d --build
```

## File Locations

- Main config: `.env`
- SSL certificates: `deploy/nginx/ssl/`
- Nginx config: `deploy/nginx/default.conf`
- Backups: `backups/backup_YYYYMMDD_HHMMSS/`
- Logs: `./deploy/logs.sh`

## Security Checklist

- [ ] Strong `POSTGRES_PASSWORD` set
- [ ] `TELEGRAM_BOT_TOKEN` configured
- [ ] `WEBAPP_SECRET` set to random value
- [ ] `WEBHOOK_SECRET_TOKEN` set to random value
- [ ] `PUBLIC_BASE_URL` points to your domain
- [ ] SSL certificate installed
- [ ] Firewall allows ports 80 and 443
- [ ] Database not exposed (internal network only)
- [ ] Regular backups scheduled

## Resources

- Full Guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Environment Variables: [.env.example](./.env.example)
