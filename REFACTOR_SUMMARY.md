# Legacy Runtime and TableManager Removal - Refactor Summary

## Overview

This refactor successfully removed deprecated game engine components from the Telegram Poker Mini-App, ensuring **PokerKitTableRuntime is the only game engine** used in production code. This makes the codebase smaller, clearer, and easier to maintain.

## Changes Made

### Files Deleted

1. **`telegram_poker_bot/game_core/runtime.py`** (518 lines)
   - Contained custom poker logic that duplicated functionality
   - Was marked as DEPRECATED with note to use pokerkit_runtime instead
   - Implemented custom card dealing, betting rounds, pot calculation
   - Replaced by PokerKit library which is the authoritative game engine

2. **`telegram_poker_bot/tests/test_gamecore_runtime.py`** (76 lines)
   - Tested the deprecated runtime module
   - Tests for public/private table runtime bootstrapping
   - No longer needed as legacy runtime is removed

### Files Modified

1. **`telegram_poker_bot/game_core/__init__.py`**
   - Removed import: `from telegram_poker_bot.game_core import runtime`
   - Removed import: `TableManager` from manager imports
   - Removed from `__all__`: `"runtime"`, `"TableManager"`
   - Now only exports:
     - MatchmakingPool utilities (still used for public lobby)
     - PokerKitTableRuntime components (the canonical game engine)

2. **`telegram_poker_bot/game_core/manager.py`** (reduced by 245 lines)
   - Removed entire `TableManager` class (90+ lines)
   - Removed unused imports:
     - `asyncio`, `Set` from typing, `Enum`
     - `AsyncSession`, `select` from sqlalchemy
     - All model imports except those used by MatchmakingPool
     - `PokerEngineAdapter`, `Mode` from pokerkit
   - Updated module docstring to note TableManager has been removed
   - Kept only:
     - `MatchmakingPool` class
     - `get_redis_client()` function
     - `get_matchmaking_pool()` function

3. **`telegram_poker_bot/tests/test_integration.py`**
   - Removed import: `TableManager, GameMode, TableStatus`
   - Removed unused import: `AsyncSession`
   - Fixed duplicate `import pytest`
   - Removed `test_table_creation()` test that used deprecated TableManager
   - Kept `test_matchmaking_pool_add_remove()` test (still passing)

## What Was Preserved

### MatchmakingPool
The `MatchmakingPool` class and related utilities were **intentionally kept** because they serve a different purpose:
- Used for public lobby and Redis caching
- Manages player waiting queues
- Independent of the game runtime engine
- Still actively used in production (see `telegram_poker_bot/api/main.py`)

### PokerKitTableRuntime
The modern PokerKit-based runtime was preserved and is now the **only** game engine:
- Located in `telegram_poker_bot/game_core/pokerkit_runtime.py`
- Uses PokerKit library as authoritative poker engine
- Imported by API layer: `from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager`
- All game actions now flow through this runtime

## Verification

### Tests Passing
✅ **Integration tests:** 1/1 passing
- `test_matchmaking_pool_add_remove` - validates MatchmakingPool still works

✅ **PokerKit runtime tests:** 2/2 passing
- `test_runtime_refreshes_seats_when_players_join`
- `test_runtime_refreshes_when_player_leaves`

✅ **Config tests:** 10/10 passing
- All configuration tests still working

### Code Quality
✅ **Ruff linting:** All checks passed
✅ **Black formatting:** All files properly formatted
✅ **CodeQL security scan:** 0 alerts found

### No Legacy References Remaining
Verified that no code in the repository references:
- `from telegram_poker_bot.game_core import runtime`
- `from telegram_poker_bot.game_core import TableManager`

## Impact Analysis

### API Layer (telegram_poker_bot/api/main.py)
Already using the correct imports:
```python
from telegram_poker_bot.game_core import get_matchmaking_pool
from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager
```
✅ No changes needed - already using modern runtime

### Production Code
- ✅ All game actions flow through PokerKitTableRuntime
- ✅ MatchmakingPool still handles public lobby
- ✅ No duplicate poker logic remains

### Test Coverage
- ⚠️ Lost 2 tests that validated legacy runtime behavior
- ✅ PokerKit runtime has its own comprehensive test suite
- ✅ Integration tests for MatchmakingPool preserved

## Lines of Code Removed

| File | Lines Removed |
|------|---------------|
| `runtime.py` (deleted) | 518 |
| `test_gamecore_runtime.py` (deleted) | 76 |
| `manager.py` (TableManager class) | ~245 |
| `manager.py` (unused imports) | ~15 |
| `test_integration.py` (test_table_creation) | ~13 |
| **Total** | **~867 lines** |

## Benefits

1. **Single Source of Truth**: PokerKit is now the only poker engine
   - No more confusion about which runtime to use
   - No duplicate poker logic to maintain

2. **Reduced Complexity**: Nearly 900 lines of code removed
   - Easier to understand the codebase
   - Less code to maintain and test

3. **Better Maintainability**: Clear separation of concerns
   - MatchmakingPool handles lobby/queue management
   - PokerKitTableRuntime handles all game logic
   - No overlap or duplication

4. **Security**: CodeQL scan passed with 0 alerts
   - No new vulnerabilities introduced
   - Legacy code that could have bugs is now gone

## Migration Notes

### For Future Development

**DO NOT** create new instances of:
- ~~`TableRuntime`~~ (deleted)
- ~~`TableManager`~~ (deleted)
- ~~`runtime.get_runtime_manager()`~~ (deleted)

**DO** use:
- `PokerKitTableRuntime` from `telegram_poker_bot.game_core.pokerkit_runtime`
- `get_pokerkit_runtime_manager()` for game state management
- `MatchmakingPool` for lobby/queue management only

### API Usage
```python
# Correct - for game state
from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager
runtime_manager = get_pokerkit_runtime_manager()
state = await runtime_manager.get_state(db, table_id, user_id)

# Correct - for matchmaking
from telegram_poker_bot.game_core import get_matchmaking_pool
pool = await get_matchmaking_pool()
await pool.add_player(user_id)
```

## Conclusion

This refactor successfully achieved all goals:
- ✅ Legacy runtime module removed
- ✅ TableManager class removed
- ✅ Tests adjusted and passing
- ✅ No remaining references to legacy code
- ✅ PokerKit runtime is now the sole game engine
- ✅ All linting and security checks passing
- ✅ ~867 lines of code removed

The codebase is now simpler, clearer, and easier to maintain with a single, authoritative poker game engine powered by PokerKit.
