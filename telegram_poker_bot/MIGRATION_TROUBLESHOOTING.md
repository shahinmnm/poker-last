# Database Migration Troubleshooting Guide

## Overview

The application uses Alembic for database migrations. Migrations run automatically when you start the application with `docker compose up` or via the deployment scripts.

## How Migrations Work

### Automatic Execution

When you run `docker compose up`, the following happens:

1. **PostgreSQL starts** and waits for health check to pass
2. **Migration service starts** (depends on postgres being healthy)
3. **Migration script runs** (`telegram_poker_bot/scripts/run_migrations.sh`)
   - Waits for database to be fully ready
   - Runs `alembic upgrade head`
   - Verifies tables were created
   - Exits with success or failure
4. **API and Bot start** (only if migrations completed successfully)

### Service Dependencies

```
postgres (healthy) → migrations (completed) → api, bot
```

The API and Bot services will NOT start until migrations complete successfully.

## Checking Migration Status

### View Migration Logs

```bash
# View migration logs
docker compose logs migrations

# Follow migration logs in real-time
docker compose logs -f migrations
```

### Check if Migrations Completed

```bash
# Check container exit status
docker compose ps migrations

# Should show:
# NAME                  STATUS
# pokerbot_migrations   Exited (0)
```

If the status shows `Exited (1)` or any non-zero code, migrations failed.

### Verify Database Schema

```bash
# Connect to database and list tables
docker compose exec postgres psql -U pokerbot -d pokerbot -c "\dt"

# Expected tables include:
# - users
# - tables
# - table_participants
# - alembic_version
# - and more...
```

## Common Issues and Solutions

### Issue: "relation 'users' does not exist"

**Cause:** Migrations didn't run or failed to complete.

**Solution:**

1. Check migration logs:
   ```bash
   docker compose logs migrations
   ```

2. Look for errors in the migration output

3. Try running migrations manually:
   ```bash
   make migrate
   # or
   docker compose run --rm migrations
   ```

### Issue: Migrations Container Keeps Restarting

**Cause:** Migration script has errors or database is not accessible.

**Solution:**

1. Stop all services:
   ```bash
   docker compose down
   ```

2. Start only PostgreSQL:
   ```bash
   docker compose up -d postgres
   ```

3. Wait for it to be healthy:
   ```bash
   docker compose ps postgres
   # Wait until STATUS shows "healthy"
   ```

4. Run migrations manually with verbose output:
   ```bash
   docker compose run --rm migrations
   ```

5. Review the detailed output for errors

### Issue: Database Connection Errors

**Cause:** Incorrect DATABASE_URL or PostgreSQL not accessible.

**Solution:**

1. Check your `.env` file has correct database settings:
   ```bash
   # .env should have:
   POSTGRES_DB=pokerbot
   POSTGRES_USER=pokerbot
   POSTGRES_PASSWORD=your_password
   ```

2. Verify PostgreSQL is running:
   ```bash
   docker compose ps postgres
   ```

3. Test database connection:
   ```bash
   docker compose exec postgres psql -U pokerbot -d pokerbot -c "SELECT 1"
   ```

### Issue: "permission denied" or Migration Script Not Found

**Cause:** Migration script doesn't exist or is not executable.

**Solution:**

1. Rebuild the Docker image:
   ```bash
   docker compose build
   ```

2. Verify the script exists in the image:
   ```bash
   docker compose run --rm migrations ls -la telegram_poker_bot/scripts/
   ```

### Issue: Migrations Succeed but Tables Still Missing

**Cause:** Migration files might be corrupted or database was reset.

**Solution:**

1. Check Alembic version table:
   ```bash
   docker compose exec postgres psql -U pokerbot -d pokerbot -c "SELECT * FROM alembic_version"
   ```

2. If no version is recorded, run migrations from scratch:
   ```bash
   # ⚠️ WARNING: THIS WILL DELETE ALL DATA! ⚠️
   # Make sure you have backups before running this command!
   docker compose down -v  # Removes volumes (DESTRUCTIVE!)
   docker compose up -d
   ```

## Manual Migration Commands

### Run Migrations Manually

```bash
# Recommended: Use Makefile target
make migrate

# Or directly with docker compose
docker compose run --rm migrations
```

### Check Migration Status

```bash
# Show current migration version
docker compose run --rm migrations alembic -c telegram_poker_bot/alembic.ini current

# Show migration history
docker compose run --rm migrations alembic -c telegram_poker_bot/alembic.ini history
```

### Create New Migration

```bash
# Auto-generate migration from model changes
docker compose run --rm migrations alembic -c telegram_poker_bot/alembic.ini revision --autogenerate -m "description"

# Create empty migration
docker compose run --rm migrations alembic -c telegram_poker_bot/alembic.ini revision -m "description"
```

## Deployment-Specific Notes

### Using Deployment Scripts

The deployment scripts (`deploy/first-deploy.sh` and `deploy/update.sh`) automatically run migrations:

```bash
# First-time deployment
./deploy/first-deploy.sh

# Update existing deployment
./deploy/update.sh
```

These scripts:
1. Start PostgreSQL
2. Run migrations
3. Start application services

### Skipping Migrations (Not Recommended)

If you need to skip migrations temporarily (e.g., for debugging):

```bash
./deploy/update.sh --skip-migrations
```

**Warning:** This will likely cause the application to fail if schema changes are required.

## Getting Help

If migrations continue to fail after trying these solutions:

1. Collect diagnostic information:
   ```bash
   # Save all logs
   docker compose logs > logs.txt
   
   # Get service status
   docker compose ps > status.txt
   
   # Check database state
   docker compose exec postgres psql -U pokerbot -d pokerbot -c "\dt" > tables.txt
   ```

2. Check the error messages in `logs.txt` for the `migrations` service

3. Review the [deployment documentation](../deploy/README.md)

4. Open an issue with the diagnostic files attached

## Advanced Debugging

### Interactive Migration Shell

Run an interactive shell in the migrations container:

```bash
docker compose run --rm --entrypoint bash migrations
```

Then manually run commands:
```bash
# Inside container
cd /opt/app
python -c "from telegram_poker_bot.shared.config import get_settings; print(get_settings().database_url)"
alembic -c telegram_poker_bot/alembic.ini current
alembic -c telegram_poker_bot/alembic.ini upgrade head
```

### Direct Database Access

Access PostgreSQL directly:

```bash
docker compose exec postgres psql -U pokerbot -d pokerbot
```

SQL commands:
```sql
-- List all tables
\dt

-- Show table structure
\d users

-- Check migration version
SELECT * FROM alembic_version;

-- Count records in tables
SELECT 
    schemaname,
    tablename,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
    SELECT 
        schemaname, 
        tablename, 
        query_to_xml(format('select count(*) as cnt from %I.%I', schemaname, tablename), false, true, '') as xml_count
    FROM pg_tables
    WHERE schemaname = 'public'
) t
ORDER BY tablename;
```

## Best Practices

1. **Always review migration logs** after deployment
2. **Back up your database** before running migrations in production
3. **Test migrations** on a staging environment first
4. **Never skip migrations** unless you know exactly what you're doing
5. **Keep .env file secure** and never commit it to version control

## Related Documentation

- [Deployment Guide](../deploy/README.md)
- [Environment Configuration](../ENV_FILES.md)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
