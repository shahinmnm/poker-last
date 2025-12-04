# Phase 6: Test Suite Rewrite - Implementation Plan

## Executive Summary

This document provides the high-level structure for the new test suite and cleanup notes for migrating from the legacy test suite to the Phase 1-5 aligned architecture.

## Test Suite Classification

### Tests to KEEP (Aligned with Phases 1-5)

These tests are already aligned with the template-driven, persistent SNG, and analytics architecture:

#### Phase 3: Analytics (KEEP)
- `telegram_poker_bot/tests/test_analytics.py` ✅
  - 9 tests validating analytics service
  - Snapshot collection, hourly stats, cleanup
  - Already non-intrusive and template-agnostic

- `telegram_poker_bot/tests/test_analytics_api.py` ✅
  - 5 tests for analytics API endpoints
  - Read-only API tests
  - No legacy dependencies

#### Phase 4: Admin & Insights (KEEP)
- `telegram_poker_bot/tests/test_admin_analytics_api.py` ✅
  - 8 tests for admin analytics endpoints
  - Template-agnostic, read-only

- `telegram_poker_bot/tests/test_admin_insights_api.py` ✅
  - 7 tests for admin insights API
  - Insights generation and delivery

- `telegram_poker_bot/tests/test_insights.py` ✅
  - 11 tests for insights engine
  - Pattern detection, severity, delivery channels

#### Phase 2: Persistent Tables & Waitlist (KEEP)
- `telegram_poker_bot/tests/test_persistent_tables.py` ✅
  - 6 tests for PERSISTENT vs EXPIRING tables
  - Template-driven lifecycle

- `telegram_poker_bot/tests/test_waitlist.py` ✅
  - 8 tests for waitlist functionality
  - FIFO ordering, entry management

#### Phase 1: Template-Driven (KEEP)
- `telegram_poker_bot/tests/test_table_lifecycle.py` ✅
  - Tests for template-based table lifecycle
  - Expiry computation, status transitions

#### Infrastructure (KEEP)
- `telegram_poker_bot/tests/test_config.py` ✅
  - Configuration and environment tests
  - No legacy dependencies

- `telegram_poker_bot/tests/test_api_mounting.py` ✅
  - API mount prefix regression tests

- `telegram_poker_bot/tests/test_avatar_service.py` ✅
  - Avatar generation service tests

- `telegram_poker_bot/tests/test_bot_webhook.py` ✅
  - Webhook validation tests

- `telegram_poker_bot/tests/test_invite_tokens.py` ✅
  - Token generation utilities

- `telegram_poker_bot/tests/test_stats_processor.py` ✅
  - User stats processing

- `telegram_poker_bot/tests/test_engine_adapter.py` ✅
  - PokerKit adapter unit tests
  - Engine abstraction layer

- `telegram_poker_bot/tests/test_integration.py` ✅
  - Basic integration tests (matchmaking pool)

- `telegram_poker_bot/tests/conftest.py` ✅
  - Test fixtures and configuration
  - Already has `create_test_template_config()` factory

### Tests to REWRITE (Need Template Alignment)

These tests cover important functionality but need updates to work with template-driven architecture:

#### Runtime Tests (REWRITE - Wallet/Template Issues)
- `telegram_poker_bot/tests/test_persistence.py` ⚠️
  - **Issue**: Some tests fail with wallet balance errors
  - **Fix Needed**: Update to use template-based config
  - **Keep**: Core persistence logic is valid
  - **Action**: Update fixtures to provide starting_stack from template

- `telegram_poker_bot/tests/test_pokerkit_concurrency.py` ⚠️
  - **Issue**: Fails with "Insufficient balance for buy-in"
  - **Fix Needed**: Wallet initialization in test fixtures
  - **Keep**: Concurrency logic is important
  - **Action**: Fix wallet setup in fixtures

- `telegram_poker_bot/tests/test_pokerkit_end_to_end_runtime.py` ⚠️
  - **Issue**: Wallet balance errors
  - **Fix Needed**: Proper template config with starting_stack
  - **Keep**: End-to-end runtime flows
  - **Action**: Update to use template_config_factory

- `telegram_poker_bot/tests/test_pokerkit_runtime_refresh.py` ⚠️
  - **Issue**: Wallet balance errors
  - **Fix Needed**: Template config
  - **Keep**: Runtime refresh logic
  - **Action**: Fix fixture setup

- `telegram_poker_bot/tests/test_sitout.py` ⚠️
  - **Issue**: "starting_stack is required in table template config"
  - **Fix Needed**: Use template_config_factory
  - **Keep**: Sit-out functionality tests
  - **Action**: Simple fixture update

- `telegram_poker_bot/tests/test_pokerkit_adapter.py` ✅
  - **Status**: Currently passing
  - **Keep**: Adapter abstraction tests

#### Flow Tests (REWRITE - Minor Fixes)
- `telegram_poker_bot/tests/test_hand_completion_refactor.py` ⚠️
  - **Issue**: Expects ENDED status, gets INTER_HAND_WAIT
  - **Fix Needed**: Update assertions for inter-hand phase
  - **Keep**: Hand completion logic
  - **Action**: Update expected states

- `telegram_poker_bot/tests/test_inter_hand_deadline_broadcast.py` ⚠️
  - **Issue**: Wallet balance
  - **Fix Needed**: Fixture setup
  - **Keep**: Inter-hand deadline logic
  - **Action**: Fix wallet initialization

- `telegram_poker_bot/tests/test_inter_hand_hand_no_increment.py` ✅
  - **Status**: Passing
  - **Keep**: Hand number increment logic

- `telegram_poker_bot/tests/test_inter_hand_ready_phase.py` ⚠️
  - **Issue**: Some tests fail with wallet issues
  - **Fix Needed**: Template config
  - **Keep**: Ready phase logic (2 tests passing, 2 failing)
  - **Action**: Fix failing tests

#### Endpoint Tests (REWRITE - Schema Issues)
- `telegram_poker_bot/tests/test_my_tables_endpoint.py` ⚠️
  - **Issue**: Schema/wallet issues in some tests
  - **Fix Needed**: Template alignment
  - **Keep**: Endpoint validation (2 passing, 4 failing)
  - **Action**: Fix schema and wallet setup

- `telegram_poker_bot/tests/test_table_status_endpoint.py` ⚠️
  - **Issue**: Wallet balance
  - **Fix Needed**: Fixture setup
  - **Keep**: Status endpoint tests
  - **Action**: Fix wallet

#### Legacy/Deprecated (REVIEW)
- `telegram_poker_bot/tests/test_group_invite_*.py` 🔍
  - **Status**: Tests for group invite flow
  - **Keep**: If feature is still active
  - **Action**: Review if group invites are part of current architecture

- `telegram_poker_bot/tests/test_new_bot_handlers.py` ✅
  - **Status**: Passing
  - **Keep**: Bot handler tests

- `telegram_poker_bot/tests/test_table_visibility.py` ⚠️
  - **Issue**: NameError: name 'rules' is not defined
  - **Fix Needed**: Remove reference to removed 'rules' object
  - **Keep**: Visibility logic
  - **Action**: Update to use template.config_json

- `telegram_poker_bot/tests/test_wallet_initial_balance.py` ⚠️
  - **Issue**: Balance initialization failures
  - **Fix Needed**: Wallet service integration
  - **Keep**: If wallet feature is enabled
  - **Action**: Check feature_wallet flag and fix

- `telegram_poker_bot/tests/test_street_progression.py` ⚠️
  - **Issue**: "No board dealing is pending"
  - **Fix Needed**: PokerKit API usage
  - **Keep**: Street progression logic
  - **Action**: Update to current PokerKit API

- `telegram_poker_bot/tests/test_multiworker_safety.py` ⚠️
  - **Issue**: Wallet balance
  - **Fix Needed**: Fixture setup
  - **Keep**: Worker safety is important
  - **Action**: Fix fixtures

### Tests to REMOVE (Obsolete)

None identified - but may emerge during cleanup pass.

## New Test Directory Structure

```
telegram_poker_bot/tests/
├── conftest.py                    # Shared fixtures (UPDATED)
├── __init__.py
│
├── backend/                       # Backend functionality
│   ├── test_table_lifecycle.py   # KEEP (Phase 1)
│   ├── test_persistent_tables.py # KEEP (Phase 2)
│   ├── test_waitlist.py          # KEEP (Phase 2)
│   ├── test_analytics.py         # KEEP (Phase 3)
│   ├── test_analytics_api.py     # KEEP (Phase 3)
│   ├── test_admin_analytics_api.py # KEEP (Phase 4)
│   ├── test_admin_insights_api.py  # KEEP (Phase 4)
│   ├── test_insights.py          # KEEP (Phase 4)
│   ├── test_engine_adapter.py    # KEEP
│   ├── test_config.py            # KEEP
│   ├── test_stats_processor.py   # KEEP
│   └── test_avatar_service.py    # KEEP
│
├── runtime/                      # PokerKit runtime tests
│   ├── test_persistence.py       # REWRITE (fix wallet)
│   ├── test_pokerkit_concurrency.py # REWRITE (fix wallet)
│   ├── test_pokerkit_runtime.py  # REWRITE (consolidate end-to-end)
│   ├── test_sitout.py            # REWRITE (fix template config)
│   └── test_multiworker_safety.py # REWRITE (fix wallet)
│
├── flows/                        # Game flow tests
│   ├── test_hand_completion.py   # REWRITE (consolidate)
│   ├── test_inter_hand_phase.py  # REWRITE (consolidate)
│   └── test_street_progression.py # REWRITE (fix PokerKit API)
│
├── api/                          # API endpoint tests
│   ├── test_api_mounting.py     # KEEP
│   ├── test_bot_webhook.py      # KEEP
│   ├── test_my_tables_endpoint.py # REWRITE (fix schema)
│   └── test_table_status_endpoint.py # REWRITE (fix wallet)
│
├── integration/                  # Integration tests
│   ├── test_integration.py      # KEEP
│   ├── test_group_invite_*.py   # REVIEW
│   └── test_table_visibility.py # REWRITE (remove 'rules')
│
├── utilities/                    # Utility tests
│   ├── test_invite_tokens.py    # KEEP
│   └── test_wallet_initial_balance.py # REVIEW/FIX
│
└── websocket/                    # WebSocket tests (NEW)
    └── test_realtime_events.py  # TODO
```

## Cleanup Actions

### 1. Remove Legacy References

**Files to scan for legacy patterns:**
- Any reference to `table.rules` (removed in Phase 1)
- Hardcoded `small_blind`, `big_blind` on Table model
- Old configuration fields not in `template.config_json`
- Deprecated `PokerKitAdapter` methods

**Search patterns:**
```bash
# Find references to removed 'rules' field
grep -r "\.rules" telegram_poker_bot/tests/

# Find hardcoded blind references on table
grep -r "table\.small_blind" telegram_poker_bot/tests/
grep -r "table\.big_blind" telegram_poker_bot/tests/

# Find non-template config usage
grep -r "config_json\s*=" telegram_poker_bot/tests/ | grep -v "template"
```

### 2. Consolidate Duplicate Tests

**Candidates for consolidation:**
- `test_inter_hand_*.py` files (3 files) → consolidate to `test_inter_hand_phase.py`
- `test_pokerkit_*.py` files (4 files) → consolidate to `test_pokerkit_runtime.py`
- `test_hand_completion_refactor.py` → merge into `test_hand_completion.py`

### 3. Update Test Fixtures

**conftest.py updates needed:**
- ✅ Already has `create_test_template_config()` factory
- ❌ Update `sample_table` fixture to use `creator_user_id` not `creator_id`
- ❌ Ensure wallet balances are initialized when `feature_wallet=True`
- ❌ Add `template_config_factory` fixture if not present
- ❌ Remove any deprecated factory functions

**Example fix:**
```python
# OLD (broken)
table = Table(
    creator_id=user.id,  # Wrong field name
    small_blind=25,      # Should be in template
)

# NEW (correct)
template = TableTemplate(
    name="Test",
    table_type=TableTemplateType.PERSISTENT,
    config_json=create_test_template_config(small_blind=25)
)
table = Table(
    creator_user_id=user.id,  # Correct field
    template_id=template.id
)
```

### 4. Remove Unused Helpers

**Scan for:**
- Deprecated mock factories
- Old test data generators
- Unused fixture functions
- Debug/print statements in tests

**Files to review:**
```bash
# Find test files with print statements
grep -r "print(" telegram_poker_bot/tests/ | grep -v "# print"

# Find commented-out code blocks
grep -r "^#.*def test_" telegram_poker_bot/tests/

# Find imports of removed modules
grep -r "from.*rules import" telegram_poker_bot/tests/
```

### 5. Rename Test Directories

**Migration:**
```bash
# Create new structure
mkdir -p telegram_poker_bot/tests/{backend,runtime,flows,api,integration,utilities,websocket}

# Move tests to new locations (examples)
mv telegram_poker_bot/tests/test_analytics*.py telegram_poker_bot/tests/backend/
mv telegram_poker_bot/tests/test_pokerkit*.py telegram_poker_bot/tests/runtime/
mv telegram_poker_bot/tests/test_inter_hand*.py telegram_poker_bot/tests/flows/
mv telegram_poker_bot/tests/test_*_endpoint.py telegram_poker_bot/tests/api/
```

## Test Coverage Description

### Backend (High-Level)

**Table Lifecycle:**
- Template-based table creation
- PERSISTENT vs EXPIRING table types
- Status transitions (WAITING → ACTIVE → ENDED)
- Expiry computation based on template config
- Template configuration propagation

**Waitlist:**
- FIFO ordering maintained
- Join/leave waitlist operations
- Position tracking
- Entry timeout/cleanup
- Integration with seating

**Analytics Engine (Phase 3):**
- Non-intrusive snapshot collection
- Hourly statistics aggregation
- Data retention and cleanup
- Read-only API endpoints
- Cross-table analytics

**Admin Insights (Phase 4):**
- Pattern detection (high/low traffic, inactivity, etc.)
- Severity assignment (info/warning/critical)
- Delivery channel abstraction
- Non-intrusive generation
- Read-only admin APIs

### Runtime (High-Level)

**Persistence:**
- PokerKit state serialization
- Hand state restoration after restart
- Action history persistence
- Template-driven engine initialization

**Concurrency:**
- Per-table locking
- Concurrent action serialization
- Thread-safe state access
- Worker isolation

**Game Flows:**
- Hand completion lifecycle
- Inter-hand wait phase
- Ready/not-ready mechanics
- Street progression
- Sit-out functionality

### API (High-Level)

**Endpoints:**
- Table listing and filtering
- Table status retrieval
- User table associations
- Webhook validation
- API mount prefix handling

### Integration (High-Level)

**Multi-Step Flows:**
- User joins waitlist → gets seated → hand starts
- Table creation → player join → game start → hand completion
- Analytics snapshot → hourly aggregation → insight generation
- Variant changes behavior (when multi-variant support added)

### WebSocket (High-Level) - TODO

**Real-Time Events:**
- Lobby updates (table created/ended)
- Table state updates (player joined/left)
- Waitlist notifications
- Analytics event streaming
- Backward compatibility (no legacy WS events)

### Frontend Type Sync (High-Level) - TODO

**Type Alignment:**
- TypeScript types match backend schemas
- GameVariant enum synchronized
- Action types aligned
- Table state structure consistent
- No Hold'em-only assumptions

## Migration Checklist

### Phase 1: Cleanup (Week 1)
- [ ] Run test discovery to catalog all tests
- [ ] Categorize each test as KEEP/REWRITE/REMOVE
- [ ] Create new directory structure
- [ ] Move KEEP tests to new locations
- [ ] Run tests to verify they still pass after move

### Phase 2: Fix Rewrite Tests (Week 2)
- [ ] Fix wallet initialization issues
  - [ ] Update conftest.py fixtures
  - [ ] Ensure template configs include starting_stack
  - [ ] Initialize wallets with proper balances
- [ ] Fix schema issues
  - [ ] Update creator_id → creator_user_id
  - [ ] Remove references to table.rules
  - [ ] Use template.config_json for all configs
- [ ] Fix PokerKit API usage
  - [ ] Update to current API in failing tests
  - [ ] Remove deprecated method calls

### Phase 3: Consolidation (Week 3)
- [ ] Consolidate inter-hand tests
- [ ] Consolidate runtime tests
- [ ] Remove duplicate test logic
- [ ] Update test names for clarity

### Phase 4: New Coverage (Week 4)
- [ ] Add WebSocket event tests
- [ ] Add frontend type synchronization tests
- [ ] Add variant-aware integration tests
- [ ] Add missing edge cases

### Phase 5: Final Validation
- [ ] Run full test suite
- [ ] Verify all tests pass
- [ ] Check test coverage reports
- [ ] Remove any remaining deprecated code
- [ ] Update documentation

## Expected Test Counts

**Current State:** 188 tests (137 passing, 51 failing)

**Target State:**
- Backend: ~60 tests
- Runtime: ~30 tests
- Flows: ~20 tests
- API: ~15 tests
- Integration: ~20 tests
- Utilities: ~10 tests
- WebSocket: ~15 tests (new)
- Frontend: ~10 tests (new)

**Total: ~180 tests** (similar count, but 100% passing and better organized)

## Success Criteria

- ✅ All tests aligned with template-driven architecture
- ✅ No references to removed components
- ✅ Clean test discovery (no warnings/errors)
- ✅ 100% test pass rate
- ✅ Logical directory structure
- ✅ High-level behavioral focus (not implementation details)
- ✅ Analytics, insights, waitlist, multi-variant flows validated
- ✅ Repository-wide validation complete
