# Verification Steps

## How to Test the Fix

### 1. Before Testing (Current Broken State)

If you want to verify the bug exists first:

```bash
# Check current enum definition (should be broken if you haven't merged)
cd /home/runner/work/poker-last/poker-last
grep -A 5 "class GroupGameInviteStatus" telegram_poker_bot/shared/models.py
```

**Broken version shows:**
```python
class GroupGameInviteStatus(PyEnum):  # ← Missing 'str,'
```

### 2. Apply the Fix

Merge this PR or manually apply:

```bash
cd /home/runner/work/poker-last/poker-last
git checkout copilot/fix-group-game-invite-bug
```

**Fixed version shows:**
```python
class GroupGameInviteStatus(str, PyEnum):  # ← Has 'str,'
```

### 3. Restart the Application

```bash
# If using Docker Compose
docker-compose down
docker-compose up --build -d

# Check logs
docker-compose logs -f api
```

### 4. Test the Endpoint

#### Option A: Using curl

```bash
# Replace <YOUR_TELEGRAM_INIT_DATA> with actual Telegram Mini App init data
curl -X POST "https://poker.shahin8n.sbs/api/group-games/invites" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: <YOUR_TELEGRAM_INIT_DATA>" \
  -v
```

**Expected Response (200/201):**
```json
{
  "game_id": "ABC123DEF456",
  "deep_link": "https://t.me/pokerbazabot?startgroup=ABC123DEF456",
  "startapp_link": "https://t.me/pokerbazabot?startapp=ABC123DEF456",
  "expires_at": "2025-11-13T16:30:00.000Z"
}
```

**NOT this (500 error):**
```json
{
  "detail": "Internal Server Error"
}
```

#### Option B: Using Telegram Mini App

1. Open your Telegram poker mini-app
2. Navigate to "Create Group Game" or similar
3. Click "Generate Invite Link" button
4. **Expected**: Link is created successfully
5. **NOT**: Error message or 500 response

### 5. Verify Database

Connect to PostgreSQL and check the inserted record:

```bash
# Connect to database
docker exec -it pokerbot_postgres psql -U pokerbot -d pokerbot

# Check the enum type
\dT+ groupgameinvitestatus

# Should show:
# List of data types
# Schema | Name                    | Type | Description
# -------+-------------------------+------+-------------
# public | groupgameinvitestatus   | enum | 
# Elements: pending | ready | consumed | expired
```

```sql
-- Check recent invites
SELECT 
    id, 
    game_id, 
    status, 
    deep_link,
    created_at,
    expires_at
FROM group_game_invites
ORDER BY created_at DESC
LIMIT 5;
```

**Expected output:**
```
 id | game_id        | status  | deep_link                                      | created_at                  | expires_at
----+----------------+---------+------------------------------------------------+-----------------------------+---------------------------
  1 | ABC123DEF456   | pending | https://t.me/pokerbazabot?startgroup=ABC123... | 2025-11-13 15:45:00.123456  | 2025-11-13 16:45:00.123456
```

**Note**: `status` column shows `'pending'` (lowercase), NOT `'PENDING'`

### 6. Check Logs

```bash
# Should NOT see this error anymore:
docker-compose logs postgres | grep "invalid input value for enum"

# Before fix - you would see:
# ERROR:  invalid input value for enum groupgameinvitestatus: "PENDING"

# After fix - no such errors
```

### 7. Test Status Transitions

If you want to be thorough, test all status transitions:

```sql
-- Update status to 'ready'
UPDATE group_game_invites 
SET status = 'ready' 
WHERE game_id = 'ABC123DEF456';

-- Update status to 'consumed'
UPDATE group_game_invites 
SET status = 'consumed', consumed_at = now() 
WHERE game_id = 'ABC123DEF456';

-- Update status to 'expired'
UPDATE group_game_invites 
SET status = 'expired' 
WHERE game_id = 'ABC123DEF456';

-- All should work without errors
```

## What You Should See

### ✅ Success Indicators

1. **API Returns 201**: POST /group-games/invites returns status 201 Created
2. **Database Insert Works**: New row appears in `group_game_invites` table
3. **Status is Lowercase**: `status` column contains `'pending'`, `'ready'`, etc. (lowercase)
4. **No Postgres Errors**: No "invalid input value for enum" in logs
5. **Tests Pass**: All 4 tests pass

### ❌ Failure Indicators (Pre-Fix)

1. **API Returns 500**: Internal Server Error
2. **Postgres Log Error**: `invalid input value for enum groupgameinvitestatus: "PENDING"`
3. **No Database Row**: Invite is not created
4. **asyncpg Error**: `asyncpg.exceptions.InvalidTextRepresentationError`

## Run Tests Locally

```bash
cd /home/runner/work/poker-last/poker-last

# Install test dependencies
pip install pytest pytest-asyncio aiosqlite sqlalchemy

# Run all group invite tests
python -m pytest telegram_poker_bot/tests/test_group_invite*.py -v

# Expected output:
# test_uppercase_status_normalizes_to_enum PASSED
# test_enum_inserts_with_correct_lowercase_value PASSED
# test_string_status_normalizes_on_assignment PASSED
# test_all_status_transitions PASSED
```

## Troubleshooting

### If the fix doesn't work:

1. **Check the enum definition:**
   ```bash
   grep "class GroupGameInviteStatus" telegram_poker_bot/shared/models.py
   ```
   Must show: `class GroupGameInviteStatus(str, PyEnum):`

2. **Restart services:**
   ```bash
   docker-compose restart api bot
   ```

3. **Check database enum:**
   ```sql
   SELECT enumlabel FROM pg_enum 
   WHERE enumtypid = 'groupgameinvitestatus'::regtype 
   ORDER BY enumlabel;
   ```
   Should show: `consumed`, `expired`, `pending`, `ready` (all lowercase)

4. **Check migrations:**
   ```bash
   # Ensure migration 003 has been applied
   docker exec pokerbot_api alembic current
   # Should show: 003_lowercase_invite_status (head)
   ```

## Expected Timeline

- **Rebuild images**: 2-3 minutes
- **Restart services**: 30 seconds
- **Run tests**: 5 seconds
- **Test endpoint**: Instant
- **Verify database**: Instant

## Summary

The fix is a **one-line change** that restores `str` inheritance to the enum. After applying:

- ✅ Invites create successfully
- ✅ Database gets lowercase values
- ✅ All tests pass
- ✅ No migration needed
- ✅ No breaking changes
