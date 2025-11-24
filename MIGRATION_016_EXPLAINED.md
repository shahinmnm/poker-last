# Migration 016 - Beta Bonus & Initial Balance Fix

## Overview

Migration 016 serves two purposes:
1. **ONE-TIME BETA BONUS**: Gives $100 to existing beta testers who have zero balance
2. **FUTURE-PROOF**: Ensures new users get initial balance from configuration

## How It Works

### For Current Beta Testers (One-Time Only)

When you run this migration **NOW** during beta testing:
```sql
UPDATE wallets 
SET balance = 10000  -- $100 in cents
WHERE balance = 0
```

- All wallets with `balance = 0` get $100 (10,000 cents)
- This is a **one-time** operation
- The migration is tracked by Alembic and won't run again

### For Future Users (Production)

After this migration runs, **all new users** automatically get initial balance via:
```python
# In wallet_service.py
wallet = Wallet(user_id=user_id, balance=settings.initial_balance_cents)
```

- New wallets are created with `settings.initial_balance_cents` (default: $100)
- Controlled by `INITIAL_BALANCE_USD` in `.env` file
- No migration needed for new users

## Important: Migration Safety

### Why This is Safe

1. **Alembic Tracking**: Once migration 016 runs, Alembic marks it as "applied"
2. **Never Runs Twice**: Even if you update your code, the migration won't run again
3. **New Users Protected**: New users get balance from code, not migration
4. **Zero Balance Won't Trigger Bonus**: If a user spends all chips after migration, they won't get another $100

### Example Timeline

```
Day 1 (Beta - Before Migration):
  User A created → balance = 0 (BUG)
  User B created → balance = 0 (BUG)

Day 2 (You Run Migration 016):
  User A → balance = 10000 ($100) ✅
  User B → balance = 10000 ($100) ✅
  Migration marked as "applied" in database

Day 3 (Beta - After Migration):
  User C created → balance = 10000 (from wallet_service.py) ✅
  User A spends all chips → balance = 0
  
Day 4 (You Update Code):
  Migration 016 does NOT run again
  User A still has balance = 0 (no bonus given again) ✅
  User D created → balance = 10000 (from wallet_service.py) ✅

Day 100 (Production Launch):
  Migration 016 does NOT run (already applied)
  New User E → balance = 10000 (from wallet_service.py) ✅
  Only first-time users get the bonus ✅
```

## Configuration

### Current (Beta) Setting
```bash
# .env
INITIAL_BALANCE_USD=100.00  # Beta testers get $100
```

### Future (Production) Options
```bash
# You can change this later without affecting existing users
INITIAL_BALANCE_USD=50.00   # New users get $50
INITIAL_BALANCE_USD=200.00  # New users get $200
INITIAL_BALANCE_USD=0.00    # New users get nothing (free-to-play)
```

## FAQ

### Q: Will users who spend all their chips get another $100?
**A: NO.** The migration runs only once. Users who reach zero balance after migration won't get another bonus.

### Q: What happens when I update my code later?
**A: Nothing.** The migration has already run and won't run again. New users get balance from code.

### Q: Can I change the initial balance for new users?
**A: YES.** Update `INITIAL_BALANCE_USD` in `.env`. Only affects NEW users created after the change.

### Q: What if I need to reset all wallets in the future?
**A: Don't use migration.** Create a new migration with a different name if needed, or use SQL directly.

### Q: Is this safe for production?
**A: YES.** The migration is idempotent and one-time. It won't affect production users.

## Summary

✅ **Beta testers** (existing users with zero balance) get $100 ONE TIME  
✅ **New users** (after migration) get initial balance from configuration  
✅ **Future updates** won't trigger the migration again  
✅ **Users who go broke** won't get free money again  
✅ **Production safe** - only affects users created before migration  

## Manual Override (If Needed)

If you ever need to give specific users a bonus in the future, do it via SQL or API, NOT via migration:

```sql
-- Don't do this via migration, do it manually:
UPDATE wallets SET balance = balance + 10000 WHERE user_id IN (1, 2, 3);
```

Or create a new migration with a different name and purpose.
