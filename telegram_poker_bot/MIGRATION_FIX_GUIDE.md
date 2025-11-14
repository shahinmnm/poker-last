# Fix Guide: UndefinedColumnError for GET /users/me/tables

## Root Cause Summary

The error `asyncpg.exceptions.UndefinedColumnError: column tables.creator_user_id does not exist` occurs because:

1. **Migration 004 exists** (`004_table_visibility_columns.py`) which adds the `creator_user_id` and `is_public` columns
2. **The migration hasn't been applied** to the production/development database
3. **The code expects these columns** because:
   - SQLAlchemy model `Table` (in `shared/models.py`) defines both columns
   - Service code (`user_service.get_active_tables()`) selects these columns
   - Frontend expects these fields in the response

## Why This Happened

Migration 004 was created to add table ownership and visibility features, but it was never run against the database. This is a classic migration-code mismatch where:

- **Models were updated** ✅
- **Migration was created** ✅
- **Migration was NOT applied** ❌

## Solution

### Step 1: Apply the Migration

The simplest fix is to run the pending migrations:

```bash
cd telegram_poker_bot
alembic upgrade head
```

This will apply migration 004 (and 005 if not already applied), adding:
- `tables.creator_user_id` (INTEGER, nullable, FK to users.id)
- `tables.is_public` (BOOLEAN, default TRUE)
- Indexes for performance optimization

### Step 2: Verify Migration Applied

Check the alembic version:

```bash
alembic current
```

Should show: `005_active_table_indexes (head)`

### Step 3: Test the Endpoint

```bash
curl -X GET "http://localhost:8000/users/me/tables" \
  -H "x-telegram-init-data: <valid-telegram-init-data>"
```

Should return:
```json
{
  "tables": [
    {
      "table_id": 1,
      "mode": "anonymous",
      "status": "waiting",
      "player_count": 1,
      "max_players": 8,
      "small_blind": 25,
      "big_blind": 50,
      "starting_stack": 10000,
      "table_name": "Table #1",
      "host": {
        "user_id": 123,
        "username": "player1",
        "display_name": "player1"
      },
      "created_at": "2024-07-07T10:00:00Z",
      "is_public": true,
      "visibility": "public",
      "viewer": {
        "is_seated": true,
        "seat_position": 0,
        "chips": 10000,
        "joined_at": "2024-07-07T10:00:00Z",
        "is_creator": true
      }
    }
  ]
}
```

## Migration Details

### What Migration 004 Does

1. **Adds `creator_user_id` column**:
   - Type: INTEGER
   - Nullable: TRUE (allows existing rows)
   - Foreign Key: users.id with ON DELETE SET NULL
   - Index: `ix_tables_creator_user_id`

2. **Adds `is_public` column**:
   - Type: BOOLEAN
   - Nullable: FALSE
   - Default: TRUE (all existing tables become public)
   - Index: `ix_tables_is_public_status` (composite with status)

3. **Data Migration**:
   - Populates `creator_user_id` from existing `config_json` if present
   - Normalizes `is_public` from various config fields (`visibility`, `is_private`)
   - Ensures `config_json` is consistent with new columns

### What Migration 005 Does

Adds performance indexes:
- `ix_tables_status_created_at` - for lobby queries
- `ix_seats_user_left_at` - for active seat lookups

## Files Affected

### Database Schema
- `migrations/versions/004_table_visibility_columns.py` - Adds columns
- `migrations/versions/005_active_table_indexes.py` - Adds indexes

### Models
- `shared/models.py` - Table model (lines 141-147)
  - Defines `creator_user_id` and `is_public` columns
  - Adds relationship to User via `creator`

### Services
- `shared/services/user_service.py` - Uses columns in queries
  - `get_active_tables()` - Selects and uses both columns
  
- `shared/services/table_service.py` - Creates tables with these values
  - `create_table_with_config()` - Sets `creator_user_id` and `is_public`
  - `list_available_tables()` - Filters by `is_public`
  - `get_table_info()` - Returns visibility info

### API Endpoints
- `api/main.py`
  - `GET /users/me/tables` (line 896) - Returns user's active tables
  - `GET /tables?scope=public` (line 632) - Returns public tables

### Frontend
- `frontend/src/pages/Lobby.tsx` - Displays tables
  - Shows "My Tables" section
  - Shows "Available Tables" (public) section
  - Renders creator info and visibility badges

## Architecture Notes

### Table Ownership Model

Every table can optionally have a creator:
- `creator_user_id` is nullable (tables can be system-created)
- Creator has special permissions (can start game, etc.)
- Frontend shows "You Host" badge for creator

### Public vs Private Tables

- **Public tables** (`is_public = TRUE`):
  - Visible in lobby to all users
  - Anyone can join (if not full)
  - Listed in `GET /tables?scope=public`

- **Private tables** (`is_public = FALSE`):
  - Only visible to creator and invited users
  - Typically created via group invites
  - Not listed in public lobby

### Performance Optimizations

1. **Indexes**:
   - `(is_public, status)` - Fast lobby queries
   - `(status, created_at)` - Sorted lists
   - `(user_id, left_at)` - Active seats

2. **Redis Caching**:
   - Public tables cached for 20 seconds
   - Cache invalidated on table creation/status change
   - Per-mode caching for filtered views

3. **Query Optimization**:
   - Batch loading of seat counts
   - Batch loading of creator info
   - Eager loading to avoid N+1 queries

## Manual Test Plan

### Test 1: Apply Migration

```bash
cd telegram_poker_bot

# Check current version
alembic current

# Apply migrations
alembic upgrade head

# Verify
alembic current
# Should show: 005_active_table_indexes (head)
```

### Test 2: Create and Query Tables

```bash
# Start the API server
uvicorn api.main:app --host 0.0.0.0 --port 8000

# In another terminal, test the endpoint
curl -X GET "http://localhost:8000/users/me/tables" \
  -H "x-telegram-init-data: <valid-init-data>"
```

Expected: 200 OK with JSON response (no 500 error)

### Test 3: Frontend Testing

1. **As User A**:
   - Navigate to mini-app
   - Create a public table
   - Sit at the table
   - Navigate to "Lobby" page
   - Verify table appears in "My Tables" section with:
     - Table name
     - Stakes (blinds/stack)
     - Player count
     - Status badge
     - "You Host" badge
     - Visibility badge

2. **As User B**:
   - Navigate to mini-app
   - Go to "Lobby" page
   - Verify User A's table appears in "Available Tables" section
   - Click "Join" to sit at the table
   - Verify table now appears in "My Tables" section

3. **Test Empty States**:
   - As new User C (no tables)
   - Go to "Lobby" page
   - Verify "My Tables" shows empty state with:
     - Message: "You're not seated at any tables right now."
     - "Create a table" button
     - "Browse public tables" link

### Test 4: Verify Data Consistency

```sql
-- Check that migration was applied
SELECT * FROM alembic_version;
-- Should show: 005_active_table_indexes

-- Check new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tables'
  AND column_name IN ('creator_user_id', 'is_public');

-- Check sample data
SELECT id, creator_user_id, is_public, status, created_at
FROM tables
LIMIT 5;

-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tables'
  AND indexname LIKE '%creator%' OR indexname LIKE '%public%';
```

## Rollback Plan

If issues occur, rollback the migration:

```bash
# Downgrade to version 003
alembic downgrade 003_lowercase_invite_status

# This removes:
# - tables.creator_user_id column
# - tables.is_public column
# - Related indexes
```

**Warning**: This will lose any creator/visibility data. Only rollback if absolutely necessary.

## Future Improvements

1. **Add Migration Test**:
   - Create test that verifies migration can be applied
   - Test both upgrade and downgrade paths

2. **Add Seeders**:
   - Create script to seed test data with proper ownership
   - Include mix of public and private tables

3. **Add Monitoring**:
   - Log slow queries on `/users/me/tables`
   - Monitor Redis cache hit rate
   - Alert on high error rates

4. **Documentation**:
   - Add API docs for table visibility model
   - Document permission model for table actions
   - Add frontend component documentation

## References

- **Migration**: `telegram_poker_bot/migrations/versions/004_table_visibility_columns.py`
- **Model**: `telegram_poker_bot/shared/models.py` (Table class)
- **Service**: `telegram_poker_bot/shared/services/user_service.py` (get_active_tables)
- **API**: `telegram_poker_bot/api/main.py` (GET /users/me/tables)
- **Frontend**: `telegram_poker_bot/frontend/src/pages/Lobby.tsx`
- **Alembic Config**: `telegram_poker_bot/alembic.ini`
