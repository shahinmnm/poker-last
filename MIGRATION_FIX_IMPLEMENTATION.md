# Database Migration Fix - Implementation Summary

## Problem Solved

Fixed the "relation 'users' does not exist" error by ensuring database migrations run automatically and reliably on application startup.

## What Was Changed

### 1. Enhanced Migration Script
**File:** `telegram_poker_bot/scripts/run_migrations.sh`

A new wrapper script that:
- ✅ Waits for PostgreSQL to be fully ready (not just health check)
- ✅ Runs `alembic upgrade head` with verbose logging
- ✅ Verifies tables were created after migration
- ✅ Provides clear error messages with troubleshooting hints
- ✅ Exits with proper status codes (0=success, 1=failure)

### 2. Updated Docker Compose
**File:** `docker-compose.yml`

Changed migrations service command from:
```yaml
command: ["alembic", "-c", "telegram_poker_bot/alembic.ini", "upgrade", "head"]
```

To:
```yaml
command: ["bash", "telegram_poker_bot/scripts/run_migrations.sh"]
```

This provides better error handling and logging while maintaining the same service dependency structure.

### 3. Improved Makefile
**File:** `Makefile`

Enhanced targets:
- `make compose-up` - Now shows migration status after starting services
- `make migrate` - Improved with better error handling and explicit postgres health check

### 4. Deployment Script Updates
**File:** `deploy/lib/common.sh`

Removed `--profile ops` from `run_migrations()` for consistency with direct `docker compose up` behavior.

### 5. Comprehensive Documentation
**New File:** `telegram_poker_bot/MIGRATION_TROUBLESHOOTING.md`

A complete troubleshooting guide covering:
- How migrations work
- Common issues and solutions
- Manual debugging steps
- SQL commands for verification
- Best practices

**Updated Files:**
- `deploy/README.md` - Added migration troubleshooting references
- `telegram_poker_bot/README.md` - Updated with automatic migration information

## How to Use

### Starting the Application

**Option 1: Docker Compose (Recommended)**
```bash
docker compose up -d
```
Migrations run automatically before API and bot start.

**Option 2: Using Makefile**
```bash
make compose-up
```
Shows migration status after startup.

**Option 3: Deployment Scripts**
```bash
./deploy/first-deploy.sh      # First time
./deploy/update.sh            # Updates
```

### Checking Migration Status

```bash
# View migration logs
docker compose logs migrations

# Check exit status (should be "Exited (0)")
docker compose ps migrations

# Verify database tables exist
docker compose exec postgres psql -U pokerbot -d pokerbot -c "\dt"
```

### Manual Migration (Troubleshooting)

```bash
# Using Makefile (recommended)
make migrate

# Or directly
docker compose run --rm migrations
```

## Service Dependency Flow

```
PostgreSQL (healthy)
    ↓
Migration Service (runs script)
    ↓
Migration Completes Successfully (Exited 0)
    ↓
API & Bot Services Start
```

**Key Point:** API and Bot will NOT start if migrations fail. This prevents "relation does not exist" errors.

## What Happens During Migration

1. **Database Readiness Check**
   - Script waits up to 60 seconds for PostgreSQL to be ready
   - Tests actual database connection, not just health check

2. **Migration Execution**
   - Runs `alembic upgrade head`
   - Shows detailed progress and any errors

3. **Verification**
   - Lists all created tables
   - Checks for critical tables (users, tables, table_participants, etc.)
   - Reports any missing tables

4. **Status Report**
   - Success: Shows "✅ Migrations completed successfully!"
   - Failure: Shows "❌ ERROR: Migrations failed!" with troubleshooting hints

## Troubleshooting

### "relation 'users' does not exist"

This error should no longer occur because migrations run before API starts. If you still see it:

1. Check migration logs:
   ```bash
   docker compose logs migrations
   ```

2. Check migration exit status:
   ```bash
   docker compose ps migrations
   ```
   Should show "Exited (0)" not "Exited (1)"

3. Run migrations manually:
   ```bash
   make migrate
   ```

### Migrations Failed

Check the error message in logs:
```bash
docker compose logs migrations
```

Common issues:
- Database connection string incorrect
- PostgreSQL not running
- Permission issues

See `telegram_poker_bot/MIGRATION_TROUBLESHOOTING.md` for detailed solutions.

### Fresh Start

To start completely fresh:
```bash
# WARNING: This deletes all data
docker compose down -v
docker compose up -d
```

## Testing the Fix

### Quick Test
```bash
# Start from clean slate
docker compose down -v

# Start everything
docker compose up -d

# Wait 30 seconds for startup

# Check migrations succeeded
docker compose ps migrations
# Should show: Exited (0)

# Check tables exist
docker compose exec postgres psql -U pokerbot -d pokerbot -c "\dt"
# Should list: users, tables, table_participants, etc.

# Check API works
docker compose logs api | grep -i error
# Should not show "relation does not exist"
```

### Full Test Suite

See `/tmp/migration_test_plan.md` for comprehensive test scenarios.

## Benefits of This Fix

1. **Automatic Execution**: No manual intervention needed
2. **Clear Feedback**: Detailed logs show exactly what's happening
3. **Fail-Safe**: API won't start if migrations fail
4. **Better Debugging**: Comprehensive error messages and troubleshooting guide
5. **Consistent Behavior**: Works the same with docker compose, make, or deployment scripts

## Backward Compatibility

✅ All existing workflows continue to work:
- `docker compose up`
- `make deploy`
- `./deploy/first-deploy.sh`
- `./deploy/update.sh`

No changes required to existing deployment processes.

## Next Steps

1. **Test the changes** using the methods above
2. **Review migration logs** to ensure they provide useful information
3. **Update any custom deployment scripts** if you have them (optional)
4. **Share the troubleshooting guide** with your team

## Support

If you encounter issues:
1. Check `telegram_poker_bot/MIGRATION_TROUBLESHOOTING.md`
2. Review migration logs: `docker compose logs migrations`
3. Verify database state: see commands in troubleshooting guide
4. Check service dependencies: `docker compose ps`

## Files Modified

- ✅ `docker-compose.yml`
- ✅ `Makefile`
- ✅ `deploy/lib/common.sh`
- ✅ `deploy/README.md`
- ✅ `telegram_poker_bot/README.md`

## Files Created

- ✅ `telegram_poker_bot/scripts/run_migrations.sh`
- ✅ `telegram_poker_bot/MIGRATION_TROUBLESHOOTING.md`

All changes are minimal and focused on solving the migration issue while maintaining backward compatibility.
