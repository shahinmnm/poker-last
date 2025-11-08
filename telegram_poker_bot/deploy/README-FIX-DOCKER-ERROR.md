# Docker ContainerConfig Error Fix

## Problem Description

When running `./update.sh` or `docker-compose up`, you encounter this error:

```
ERROR: for pokerbot_bot  'ContainerConfig'
KeyError: 'ContainerConfig'
```

This error occurs when Docker Compose tries to recreate a container but the image metadata is corrupted or missing the expected structure.

## Root Cause

This typically happens when:
1. A Docker image was partially built or corrupted during a previous build
2. Docker daemon was interrupted during image creation
3. There's a version incompatibility between Docker and docker-compose
4. The container references an image that has been corrupted
5. Docker Compose still references a deleted image in its internal state

### Specific Issue with the Original Fix Script

The original fix script had a race condition issue:
1. It manually stopped and removed the container
2. It deleted the old image
3. It rebuilt a new image
4. When trying to start with `docker-compose up -d`, Docker Compose tried to recreate the container
5. **Problem**: Docker Compose still had metadata referencing the OLD deleted image
6. This caused the 'ContainerConfig' KeyError when it tried to inspect the non-existent image

### How the Updated Script Fixes This

The updated script uses `docker-compose down` BEFORE removing images, which:
- Properly cleans up Docker Compose's internal state
- Removes all container metadata
- Then uses `--force-recreate` flag to ensure completely fresh containers
- This prevents Docker Compose from trying to reference deleted images

## Quick Fix

### Option 1: Use the Automated Fix Script (Recommended)

```bash
cd /Poker-Bot/telegram_poker_bot/deploy
./fix-docker-error.sh
```

This script will:
1. Stop all services and remove containers using `docker-compose down`
2. Remove any orphaned bot containers
3. Remove the corrupted bot image
4. Prune dangling images
5. Rebuild the bot image from scratch with `--no-cache`
6. Start all services with `--force-recreate` to ensure clean state

### Option 2: Manual Fix

If you prefer to fix it manually or need more control:

```bash
cd /Poker-Bot/telegram_poker_bot/deploy

# 1. Stop all services and remove containers
docker-compose down

# 2. Remove any orphaned containers
docker ps -a | grep pokerbot_bot && docker rm -f $(docker ps -a --filter "name=pokerbot_bot" --format "{{.ID}}")

# 3. Remove the bot image
docker images | grep bot
docker rmi -f <IMAGE_ID_OR_NAME>

# 4. Clean up dangling images
docker image prune -f

# 5. Rebuild the bot image
docker-compose build --no-cache bot

# 6. Start services with force recreate
docker-compose up -d --force-recreate

# 7. Check status
docker-compose ps
```

### Option 3: Nuclear Option (Complete Reset)

If the above doesn't work, you can do a complete reset:

```bash
cd /Poker-Bot/telegram_poker_bot/deploy

# Stop all services
docker-compose down

# Remove all project containers
docker-compose rm -f

# Remove all project images
docker-compose down --rmi all

# Clean up everything
docker system prune -a -f

# Rebuild from scratch
docker-compose build --no-cache

# Start services
docker-compose up -d
```

**⚠️ Warning**: Option 3 will remove ALL Docker images and containers, not just this project's. Use with caution if you have other Docker projects running.

## Prevention

To prevent this issue in the future:

1. **Always stop services properly** before rebuilding:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

2. **Monitor disk space**: Docker images can consume significant space. Run `docker system df` to check usage.

3. **Regular cleanup**: Periodically run `docker system prune` to remove unused images and containers.

4. **Update docker-compose**: The version in use (1.29.2) is relatively old. Consider upgrading to Docker Compose v2:
   ```bash
   # Install Docker Compose v2
   apt-get update
   apt-get install docker-compose-plugin
   
   # Use 'docker compose' (with space) instead of 'docker-compose' (with hyphen)
   docker compose version
   ```

## Verification

After applying the fix, verify everything is working:

```bash
# Check all services are running
docker-compose ps

# Check bot logs
docker-compose logs -f bot

# Test bot connectivity (if webhook is set up)
curl -X POST https://your-domain.com/telegram/webhook
```

## Additional Notes

- The `pokerbot_bot` service depends on `postgres` and `redis` being healthy
- Make sure your `.env` file is properly configured
- Check that `TELEGRAM_BOT_TOKEN` and other required environment variables are set
- If you continue to have issues, check Docker daemon logs: `journalctl -u docker.service`

## Support

If this fix doesn't resolve your issue:

1. Check Docker and docker-compose versions:
   ```bash
   docker --version
   docker-compose --version
   ```

2. Check Docker daemon status:
   ```bash
   systemctl status docker
   ```

3. Review detailed logs:
   ```bash
   docker-compose logs --tail=100
   ```

4. Check disk space:
   ```bash
   df -h
   docker system df
   ```
