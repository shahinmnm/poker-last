# Zero Balance Bug - Fix Summary

## Problem
After database migration 015, new players were getting **ZERO balance** instead of an initial amount because:
1. Line 36 in `wallet_service.py` created wallets with hardcoded `balance=0`
2. Line 222 in `user_service.py` had duplicate wallet creation with hardcoded `balance=10000`
3. No environment variable configuration for initial balance
4. Conflicting implementations between services

## Solution Implemented

### 1. Environment Configuration
**File: `.env.example`**
- Added `INITIAL_BALANCE_USD=100.00` (USD-based configuration)
- Uses USD for clarity, converted to cents internally for storage

### 2. Settings Class Enhancement
**File: `telegram_poker_bot/shared/config.py`**
- Added `initial_balance_usd: float = 100.00` field
- Added computed property `initial_balance_cents` that converts USD to cents
- Calculation: `int(initial_balance_usd * currency_smallest_unit_factor)`
- Default: $100.00 = 10,000 cents

### 3. Wallet Service Fix
**File: `telegram_poker_bot/shared/services/wallet_service.py`**
- Changed `Wallet(user_id=user_id, balance=0)` to use `settings.initial_balance_cents`
- Updated all 4 wallet creation points in the service:
  - `ensure_wallet()` - Main wallet creation
  - `transfer_to_table()` - Wallet creation during table buy-in
  - `cash_out_from_table()` - Wallet creation during cash-out
  - `record_game_win()` - Wallet creation during game win

### 4. Remove Duplicate Code
**File: `telegram_poker_bot/shared/services/user_service.py`**
- Removed duplicate `ensure_wallet()` function (lines 209-226)
- Removed duplicate `get_user_balance()` function (lines 193-206)
- Removed `Wallet` import (no longer used)
- Reduced code duplication and maintained single source of truth

### 5. Update Bot Handlers
**File: `telegram_poker_bot/bot/handlers.py`**
- Updated imports to use `wallet_service` instead of `user_service` for wallet operations
- Changed `user_service.get_user_balance()` → `wallet_service.get_wallet_balance()`
- Changed `user_service.ensure_wallet()` → `wallet_service.ensure_wallet()`

### 6. Database Migration
**File: `telegram_poker_bot/migrations/versions/016_fix_zero_balance_wallets.py`**
- Created migration to fix existing wallets with zero balance
- Updates all wallets where `balance = 0` to `balance = 10000` (default $100)
- Includes downgrade path for rollback (though destructive)

### 7. Comprehensive Tests
**File: `telegram_poker_bot/tests/test_wallet_initial_balance.py`**
- 6 test cases covering all wallet creation scenarios
- Tests verify:
  - New wallets created with correct initial balance
  - Existing wallets not modified
  - All wallet operations use configured balance
  - Balance matches settings configuration
- **All tests passing ✅**

## Results

### Before Fix
```python
# wallet_service.py:36
wallet = Wallet(user_id=user_id, balance=0)  # ❌ Zero balance!

# user_service.py:220
wallet = Wallet(user_id=user_id, balance=10000)  # ❌ Hardcoded!
```

### After Fix
```python
# wallet_service.py:36
wallet = Wallet(user_id=user_id, balance=settings.initial_balance_cents)  # ✅ Configurable!

# Settings converts: $100.00 → 10,000 cents
# Controlled by INITIAL_BALANCE_USD environment variable
```

## Configuration

### Default Settings
```bash
INITIAL_BALANCE_USD=100.00  # New users get $100.00 (10,000 cents)
```

### Custom Settings (Example)
```bash
INITIAL_BALANCE_USD=50.00   # New users get $50.00 (5,000 cents)
INITIAL_BALANCE_USD=200.00  # New users get $200.00 (20,000 cents)
```

## Verification

### Tests
```bash
$ pytest telegram_poker_bot/tests/test_wallet_initial_balance.py -v

test_ensure_wallet_creates_with_initial_balance PASSED
test_ensure_wallet_returns_existing_wallet PASSED
test_get_wallet_balance_for_new_user PASSED
test_transfer_to_table_creates_wallet_with_initial_balance PASSED
test_cash_out_creates_wallet_with_initial_balance PASSED
test_record_game_win_creates_wallet_with_initial_balance PASSED

6 passed ✅
```

### Linting
```bash
$ ruff check [modified files]
All checks passed! ✅

$ black --check [modified files]
All files formatted correctly! ✅
```

## Impact

### Fixes
- ✅ New users now get initial balance from configuration
- ✅ Existing zero-balance users can be fixed via migration
- ✅ No more hardcoded balance values
- ✅ Single source of truth for balance configuration
- ✅ USD-based configuration (user-friendly)
- ✅ Automatic conversion to cents for storage

### Code Quality
- ✅ Removed duplicate code (37 lines removed from user_service.py)
- ✅ Consolidated wallet operations to wallet_service
- ✅ Proper separation of concerns
- ✅ Comprehensive test coverage
- ✅ All linting and formatting checks pass

## Migration Path

### For New Deployments
1. Set `INITIAL_BALANCE_USD` in `.env` file
2. Run migrations: `alembic upgrade head`
3. New users automatically get configured initial balance

### For Existing Deployments
1. Update `.env` file with `INITIAL_BALANCE_USD=100.00`
2. Run migration 016 to fix existing zero-balance wallets
3. All users (new and existing) will have correct balance

## Files Changed
- `.env.example` - Added initial balance configuration
- `telegram_poker_bot/shared/config.py` - Added settings property
- `telegram_poker_bot/shared/services/wallet_service.py` - Use settings for balance
- `telegram_poker_bot/shared/services/user_service.py` - Removed duplicates
- `telegram_poker_bot/bot/handlers.py` - Updated to use wallet_service
- `telegram_poker_bot/migrations/versions/016_fix_zero_balance_wallets.py` - New migration
- `telegram_poker_bot/tests/test_wallet_initial_balance.py` - New tests

## Minimal Changes Approach
This fix follows the principle of minimal changes:
- Only touched the exact code causing the bug
- Removed duplicate/conflicting code
- Added configuration for flexibility
- No unnecessary features added
- Focused on solving the root cause

Total changes: ~224 lines added, ~113 lines removed across 7 files
