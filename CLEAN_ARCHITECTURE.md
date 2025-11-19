# Clean Architecture - Post Cleanup

## Current Production Architecture (PokerKit-Driven)

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              (React + TypeScript)                            │
│                                                              │
│  - Table.tsx (displays cards, actions)                      │
│  - PlayingCard.tsx (renders cards)                          │
│  - TableActionButtons.tsx                                   │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/WebSocket
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│                  (api/main.py)                               │
│                                                              │
│  POST /tables/{id}/start    ──────┐                         │
│  GET  /tables/{id}/state    ──────┤                         │
│  POST /tables/{id}/actions  ──────┤                         │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                                    ↓ get_pokerkit_runtime_manager()
┌─────────────────────────────────────────────────────────────┐
│              PokerKit Runtime Layer                          │
│         (game_core/pokerkit_runtime.py)                      │
│                                                              │
│  - PokerKitTableRuntime                                      │
│  - PokerKitTableRuntimeManager                               │
│  - Maps user_id ↔ player_index                              │
│  - Serializes PokerKit state → JSON                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              PokerKit Adapter                                │
│         (engine_adapter/adapter.py)                          │
│                                                              │
│  - PokerEngineAdapter                                        │
│  - deal_new_hand() - shuffles deck, deals cards             │
│  - to_full_state() - serializes with card visibility        │
│  - fold(), check_or_call(), bet_or_raise()                  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                PokerKit Engine                               │
│                  (pokerkit/)                                 │
│                                                              │
│  - State (game state)                                        │
│  - NoLimitTexasHoldem (game rules)                           │
│  - Card dealing, pot calculation, winner determination      │
│  - ALL POKER RULES AND LOGIC                                │
└─────────────────────────────────────────────────────────────┘
```

## Deprecated Code (Tests Only)

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPRECATED                                │
│                                                              │
│  test_integration.py                                         │
│         ↓                                                    │
│  TableManager (manager.py) ← Contains duplicate logic       │
│         ↓                                                    │
│  PokerEngineAdapter                                          │
│                                                              │
│  test_gamecore_runtime.py                                    │
│         ↓                                                    │
│  TableRuntime (runtime.py) ← Custom poker logic             │
│                                                              │
│  ⚠️  These are kept for backward compatibility only          │
│  ⚠️  Marked with deprecation warnings                        │
│  ⚠️  Should be migrated to PokerKit runtime                  │
└─────────────────────────────────────────────────────────────┘
```

## No Conflicts or Duplicates

### Active Production Code
- ✅ **Single Runtime**: `pokerkit_runtime.py` only
- ✅ **Single Import**: API only imports `get_pokerkit_runtime_manager`
- ✅ **Consistent State**: All endpoints return PokerKit state
- ✅ **No Custom Logic**: All poker rules in PokerKit

### Deprecated Code
- ⚠️ **Clearly Marked**: Deprecation warnings in docstrings
- ⚠️ **Isolated**: Only used by old tests
- ⚠️ **No API Usage**: Not imported by API or services
- ⚠️ **No Frontend Impact**: Frontend never sees these

## Module Organization

```
telegram_poker_bot/
├── api/
│   └── main.py                    ← Uses get_pokerkit_runtime_manager()
├── game_core/
│   ├── __init__.py                ← Exports PokerKit runtime (primary)
│   ├── pokerkit_runtime.py        ← ACTIVE RUNTIME ✅
│   ├── runtime.py                 ← DEPRECATED (tests only) ⚠️
│   └── manager.py                 ← DEPRECATED TableManager (tests only) ⚠️
├── engine_adapter/
│   └── adapter.py                 ← PokerKit wrapper
├── shared/
│   └── services/
│       └── table_service.py       ← Uses pokerkit_runtime
└── tests/
    ├── test_pokerkit_adapter.py   ← Tests PokerKit adapter ✅
    ├── test_gamecore_runtime.py   ← Uses old runtime (to migrate)
    └── test_integration.py        ← Uses old TableManager (to migrate)
```

## Import Graph (No Conflicts)

```
API Layer:
  api/main.py
    └─> get_pokerkit_runtime_manager() ✅

Service Layer:
  table_service.py
    └─> pokerkit_runtime.refresh_table_runtime() ✅

Test Layer (Deprecated):
  test_integration.py
    └─> TableManager ⚠️ (deprecated)
  test_gamecore_runtime.py
    └─> runtime.TableRuntime ⚠️ (deprecated)

Frontend:
  (No direct imports of Python modules)
    └─> Uses API endpoints only ✅
```

## Benefits of Clean Architecture

1. **No Confusion**: Single active runtime path
2. **No Conflicts**: Deprecated code isolated to tests
3. **Clear Migration**: Deprecated code clearly marked
4. **Safe Transition**: Tests still work during migration
5. **Frontend Safety**: No frontend impact from cleanup

## Future Cleanup (Recommended)

1. Migrate `test_gamecore_runtime.py` to test PokerKit runtime
2. Migrate `test_integration.py` to use PokerKit runtime
3. Delete `runtime.py` completely
4. Extract `MatchmakingPool` to separate file
5. Delete `TableManager` from `manager.py`

## Summary

✅ **Production code**: Single PokerKit-driven runtime  
✅ **No duplicates**: Old code marked deprecated, isolated  
✅ **No conflicts**: Clear separation active vs deprecated  
✅ **Frontend safe**: No impact on client code  
✅ **Tests work**: Backward compatible during transition  
