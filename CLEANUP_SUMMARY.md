# Cleanup Summary - Eliminating Duplicate Runtime Logic

## Problem Identified

The codebase had duplicate and conflicting poker game runtime logic:

1. **Old Runtime** (`runtime.py`): Custom poker logic with deck, dealing, betting, pot calculation
2. **New Runtime** (`pokerkit_runtime.py`): PokerKit-driven runtime (correct implementation)
3. **Manager** (`manager.py`): TableManager with more duplicate logic
4. **Conflicts**: Both runtimes imported, potential frontend confusion

## Changes Made

### 1. API Cleanup (`api/main.py`)
**Removed**: Unused import of `get_runtime_manager` from old runtime
```python
# Before:
from telegram_poker_bot.game_core.runtime import get_runtime_manager
from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager

# After:
from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager
```
**Impact**: Eliminates confusion about which runtime is being used.

### 2. PokerKit Runtime Enhancement (`pokerkit_runtime.py`)
**Added**: `refresh_table_runtime()` function needed by table_service
```python
async def refresh_table_runtime(db: AsyncSession, table_id: int) -> None:
    """Refresh table runtime by ensuring it exists in the runtime manager."""
    await get_pokerkit_runtime_manager().ensure_table(db, table_id)
```
**Impact**: Provides feature parity with old runtime for table service.

### 3. Table Service Update (`shared/services/table_service.py`)
**Changed**: Import to use new PokerKit runtime instead of old runtime
```python
# Before:
from telegram_poker_bot.game_core import runtime as game_runtime

# After:
from telegram_poker_bot.game_core import pokerkit_runtime as game_runtime
```
**Impact**: All table operations now use PokerKit-driven runtime.

### 4. Module Exports Update (`game_core/__init__.py`)
**Added**: Exports for new PokerKit runtime components
**Marked**: Old components as deprecated
```python
__all__ = [
    # Matchmaking (still used)
    "MatchmakingPool",
    "get_matchmaking_pool",
    "get_redis_client",
    # PokerKit Runtime (actively used)
    "PokerKitTableRuntime",
    "PokerKitTableRuntimeManager",
    "get_pokerkit_runtime_manager",
    "refresh_table_runtime",
    "reset_pokerkit_runtime_cache",
    # Deprecated - kept for backward compatibility
    "TableManager",
    "runtime",
]
```
**Impact**: Clear API showing what's current vs deprecated.

### 5. Deprecation Warnings Added

**runtime.py**: Added clear deprecation notice
```python
"""
DEPRECATED: This module contains custom poker logic and is being replaced by
pokerkit_runtime.py which uses PokerKit as the authoritative game engine.

This module is kept for backward compatibility with existing tests only.
New code should use telegram_poker_bot.game_core.pokerkit_runtime instead.
"""
```

**manager.py**: Added deprecation notice for TableManager
```python
"""
NOTE: The TableManager class in this file contains duplicate poker logic
and is DEPRECATED. It is kept only for backward compatibility with existing tests.

The MatchmakingPool class is still actively used.
"""
```

**Impact**: Developers clearly see what not to use.

## What Was NOT Removed

**Kept for backward compatibility:**
- `runtime.py` - Only used in `test_gamecore_runtime.py`
- `manager.py` TableManager - Only used in `test_integration.py`

**Rationale**: Breaking existing tests during cleanup is risky. These can be removed in a separate PR after updating/removing those tests.

## Frontend Impact

**None**. The frontend never directly imported these modules. All interaction is through API endpoints which now consistently use PokerKit runtime.

## Current State After Cleanup

### Active Code Path (PokerKit-Driven)
```
API (/tables/{id}/start, /state, /actions)
  ↓
get_pokerkit_runtime_manager()
  ↓
PokerKitTableRuntime
  ↓
PokerEngineAdapter
  ↓
PokerKit State (authoritative poker engine)
```

### Deprecated Code Path (For Tests Only)
```
test_integration.py
  ↓
TableManager (marked deprecated)
  ↓
PokerEngineAdapter (but with custom logic too)
```

```
test_gamecore_runtime.py
  ↓
TableRuntime (marked deprecated)
  ↓
Custom poker logic (not using PokerKit)
```

## Benefits

1. ✅ **Single Active Runtime**: Only `pokerkit_runtime.py` is used in production
2. ✅ **Clear Deprecation**: Old code clearly marked as deprecated
3. ✅ **No Frontend Conflicts**: Frontend only sees consistent PokerKit state
4. ✅ **Backward Compatible**: Tests still work during transition
5. ✅ **Clean Imports**: No duplicate or unused imports in API

## Recommended Next Steps

1. Update `test_gamecore_runtime.py` to test PokerKit runtime instead
2. Update `test_integration.py` to use PokerKit runtime
3. After tests updated, delete `runtime.py` completely
4. Consider extracting `MatchmakingPool` from `manager.py` to its own file
5. Delete `manager.py` TableManager after test migration

## Files Modified

1. `telegram_poker_bot/api/main.py` - Removed unused import
2. `telegram_poker_bot/game_core/pokerkit_runtime.py` - Added refresh function
3. `telegram_poker_bot/shared/services/table_service.py` - Updated import
4. `telegram_poker_bot/game_core/__init__.py` - Updated exports
5. `telegram_poker_bot/game_core/runtime.py` - Added deprecation warning
6. `telegram_poker_bot/game_core/manager.py` - Added deprecation warning
