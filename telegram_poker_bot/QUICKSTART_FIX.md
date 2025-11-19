# Quick Start: Fixing "GET /users/me/tables" Error

## The Problem

You're getting this error:
```
asyncpg.exceptions.UndefinedColumnError: column tables.creator_user_id does not exist
```

## The Solution (30 seconds)

### Step 1: Apply the Migration

```bash
cd telegram_poker_bot
alembic upgrade head
```

**That's it!** The migration already exists and will add the missing columns.

### Step 2: Verify

```bash
alembic current
```

Should show: `005_active_table_indexes (head)`

### Step 3: Restart Services

```bash
# If using Docker
docker compose restart api bot

# If running locally
# Restart your API and bot services
```

### Step 4: Test

```bash
# API should now work
curl http://localhost:8000/users/me/tables \
  -H "x-telegram-init-data: <valid-data>"

# Or just open the mini-app and go to Lobby
```

## What This Does

The migration adds two columns to the `tables` table:
- `creator_user_id` - Who created the table
- `is_public` - Whether the table is public or private

These columns are already used by the code, they just weren't in the database.

## Need More Details?

- **Troubleshooting**: See `MIGRATION_FIX_GUIDE.md`
- **Architecture**: See `IMPLEMENTATION_SUMMARY.md`
- **Security**: See `SECURITY_SUMMARY.md`
- **Testing**: Run `pytest tests/test_my_tables_endpoint.py`

## Still Having Issues?

### Check Migration Status

```bash
alembic current
# Should show: 005_active_table_indexes (head)
```

### Check Database

```sql
-- Should return 2 rows
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tables' 
  AND column_name IN ('creator_user_id', 'is_public');
```

### Check Logs

```bash
# Look for migration errors
tail -f /var/log/api.log

# Or with Docker
docker compose logs api
```

## Common Issues

### "Migration already at head"
✅ **Good!** The migration is already applied. The error might be from a caching issue. Try restarting services.

### "Can't locate revision 004_table_visibility_columns"
❌ **Problem**: Migration file missing or corrupted.
- Check `telegram_poker_bot/migrations/versions/004_table_visibility_columns.py` exists
- Run `alembic history` to see all migrations

### "Column already exists"
✅ **Good!** The columns are already in the database. The error might be from something else.
- Check `alembic current` shows correct version
- Restart services to clear any caches

### Database connection error
❌ **Problem**: Can't connect to PostgreSQL
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Verify credentials

## Production Deployment

### Pre-deployment Checklist

- [ ] Backup database
- [ ] Test in staging first
- [ ] Stop all services
- [ ] Run migration
- [ ] Start services
- [ ] Test endpoint
- [ ] Monitor logs for 30 minutes

### Migration Command (Production)

```bash
# As deploy user
cd /path/to/telegram_poker_bot
source venv/bin/activate  # if using venv
alembic upgrade head

# Verify
alembic current
# Should show: 005_active_table_indexes (head)

# Restart services
sudo systemctl restart poker-api
sudo systemctl restart poker-bot
```

## Rollback (If Needed)

**Only if something goes very wrong:**

```bash
# Rollback to before the creator_user_id changes
alembic downgrade 003_lowercase_invite_status

# This removes both columns
# You'll lose creator/visibility data (but tables remain)
```

## Summary

**TL;DR**: Run `alembic upgrade head` and restart services. Everything else is already correct.

The code, tests, and documentation are all ready. You just need to apply the migration that was created earlier but never run.
