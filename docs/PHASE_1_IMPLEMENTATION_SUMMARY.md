# Phase 1: Template Architecture Rewrite - Implementation Summary

## Executive Summary

Phase 1 successfully converts the entire table creation system to a **template-driven architecture** where `TableTemplate` serves as the single source of truth for all table configuration. This eliminates scattered config parameters and establishes a clean, validated, and scalable foundation for future features.

## Problem Statement

**Before Phase 1:**
- Table configuration scattered across function parameters
- No centralized validation
- Tests used hardcoded values
- No way to list or discover table configurations
- Runtime blinds/stacks constructed outside templates
- Legacy paths allowed bypassing template system

**After Phase 1:**
- Templates are the only source of configuration
- Strict schema validation enforced
- All paths require template_id
- API endpoint for template discovery
- Tests use proper template infrastructure
- Zero legacy bypasses remaining

## Architecture Changes

### 1. Data Model (No Changes Required)
The existing `TableTemplate` model already supported the new architecture:
- `config_json` (JSONB) stores all game rules
- `table_type` (PERSISTENT/EXPIRING/PRIVATE) controls lifecycle
- `has_waitlist` (Boolean) enables queueing
- `Table.template_id` (NOT NULL) enforces relationship

### 2. Service Layer

#### New Functions
```python
validate_template_config(config: Dict[str, Any]) -> None
    """Validates all required and optional fields in template config."""
    Required: small_blind, big_blind, starting_stack, max_players, 
              game_variant, currency_type
    Optional but validated: ante, rake_percentage, timeout, etc.
```

#### Modified Functions
```python
create_table_with_config(
    db: AsyncSession,
    *,
    creator_user_id: int,
    template_id: int,  # NOW REQUIRED (was Optional[int])
    **legacy_config: Any,  # IGNORED (logged as warning)
) -> Table
```

**Breaking Change:** `template_id` is now required. Passing `template_id=None` raises `ValueError`.

#### Deprecated but Maintained
```python
create_default_template(...)
    """DEPRECATED: Use only for tests. Production code should use
    seed_default_templates.py instead."""
```

### 3. API Layer

#### New Endpoint
```http
GET /table-templates
Response: {
  "templates": [
    {
      "id": 1,
      "name": "Beginner - Play Money (10/20)",
      "table_type": "EXPIRING",
      "has_waitlist": false,
      "config": { /* validated config */ },
      "created_at": "2024-...",
      "updated_at": "2024-..."
    },
    // ... more templates
  ]
}
```

### 4. Seeding System

**New Script:** `scripts/seed_default_templates.py`

Creates 7 production-ready templates:
1. **Beginner - Play Money (10/20)** - Small stakes, 6 players, 30min
2. **Standard - Play Money (25/50)** - Medium stakes, 8 players, 60min
3. **High Stakes - Play Money (100/200)** - Large stakes, 8 players, 120min
4. **Micro Stakes - Real Money (1/2)** - Real money, 6 players, 5% rake
5. **Low Stakes - Real Money (5/10)** - Real money, 8 players, 5% rake
6. **Private Game - Play Money** - Invite-only, customizable
7. **Short Deck - Play Money (10/20)** - Alternative variant

**Usage:**
```bash
python scripts/seed_default_templates.py
```

Idempotent - safe to run multiple times. Updates existing templates by name.

## Test Infrastructure

### New Test Helper
```python
async def create_test_template(db, **kwargs) -> TableTemplate:
    """Create a template with test-friendly defaults and validation."""
    # Merges kwargs with sensible defaults
    # Validates config
    # Returns created template
```

**Usage in Tests:**
```python
# Old (deprecated)
table = await table_service.create_table_with_config(
    db, 
    creator_user_id=user.id,
    small_blind=25,
    big_blind=50,
    starting_stack=1000,
)

# New (correct)
template = await create_test_template(
    db,
    small_blind=25,
    big_blind=50,
    starting_stack=1000,
)
table = await table_service.create_table(
    db,
    creator_user_id=user.id,
    template_id=template.id,
)
```

### Migrated Test Files
All 7 test files updated to use templates:
- ✅ test_pokerkit_end_to_end_runtime.py
- ✅ test_multiworker_safety.py
- ✅ test_pokerkit_concurrency.py
- ✅ test_pokerkit_runtime_refresh.py
- ✅ test_my_tables_endpoint.py
- ✅ test_table_status_endpoint.py
- ✅ test_table_visibility.py

## Configuration Schema

### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `small_blind` | int | Small blind amount | 25 |
| `big_blind` | int | Big blind amount | 50 |
| `starting_stack` | int | Player starting chips | 1000 |
| `max_players` | int | Max seats (2-8) | 8 |
| `game_variant` | str | Poker variant | "no_limit_texas_holdem" |
| `currency_type` | str | PLAY or REAL | "PLAY" |

### Optional Fields
| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `ante` | int | Ante amount | 0 |
| `rake_percentage` | float | Commission rate (0-1) | 0.05 |
| `rake_cap` | int | Max commission | 100 |
| `turn_timeout_seconds` | int | Action timeout | 30 |
| `expiration_minutes` | int | Table lifetime | 60 |
| `table_name` | str | Display name | "Table #N" |

## Migration Guide

### For Backend Developers

1. **Creating New Tables in Code:**
   ```python
   # Don't create one-off templates in runtime code
   # Use existing templates from database
   
   templates = await db.execute(
       select(TableTemplate).where(
           TableTemplate.table_type == TableTemplateType.EXPIRING
       )
   )
   template = templates.scalars().first()
   
   table = await table_service.create_table(
       db,
       creator_user_id=user_id,
       template_id=template.id,
   )
   ```

2. **Writing Tests:**
   ```python
   from telegram_poker_bot.tests.conftest import create_test_template
   
   async def test_my_feature(db_session):
       template = await create_test_template(
           db_session,
           small_blind=10,
           big_blind=20,
       )
       table = await table_service.create_table(
           db_session,
           creator_user_id=1,
           template_id=template.id,
       )
       # ... rest of test
   ```

3. **Database Seeding:**
   ```bash
   # Production deployment
   python scripts/seed_default_templates.py
   
   # Persistent tables (optional)
   python scripts/seed_persistent_tables.py
   ```

### For Frontend Developers

1. **Fetch Available Templates:**
   ```javascript
   const response = await fetch('/api/table-templates');
   const { templates } = await response.json();
   
   // Display in dropdown/selector
   templates.forEach(t => {
       console.log(`${t.name}: ${t.config.small_blind}/${t.config.big_blind}`);
   });
   ```

2. **Create Table from Template:**
   ```javascript
   const response = await fetch('/api/tables', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           template_id: selectedTemplate.id,
           auto_seat_host: true,
       })
   });
   ```

## Validation Rules

The `validate_template_config()` function enforces:

1. **Required field presence** - All mandatory fields must exist
2. **Type correctness** - Integers must be integers, floats must be floats
3. **Enum validation** - `game_variant` and `currency_type` must be valid
4. **Range checks** - `max_players` must be 2-8, `rake_percentage` must be 0-1
5. **Consistency** - `raw_blinds_or_straddles` must match `small_blind`/`big_blind`

Validation happens at:
- Template creation time (`create_table_template`)
- Template seeding (`seed_default_templates.py`)
- Rule parsing (`parse_template_rules`)

## Runtime Integration

The PokerKit adapter receives configuration exclusively from templates:

```python
# table_service.py
def _get_table_rules(table: Table):
    """Parse rules from table's template."""
    config = table.template.config_json
    return parse_template_rules(config)

# pokerkit_runtime.py
rules = _get_table_rules(table)
engine = PokerEngineAdapter(
    player_count=len(active_players),
    starting_stacks=[rules.starting_stack] * len(active_players),
    small_blind=rules.small_blind,
    big_blind=rules.big_blind,
    raw_antes=rules.raw_antes,
    # ... all from template
)
```

**No hardcoded defaults in runtime paths.**

## Security Improvements

1. **Input Validation** - All config validated before use
2. **Type Safety** - Pydantic-like validation prevents type errors
3. **Enum Enforcement** - Only valid variants/currencies accepted
4. **Range Bounds** - Prevents impossible configurations
5. **Audit Trail** - Templates have created_at/updated_at timestamps

## Performance Considerations

1. **Template Caching** - Templates rarely change, can be cached
2. **Eager Loading** - `joinedload(Table.template)` avoids N+1 queries
3. **Index Usage** - `template_id` is indexed on `tables` table
4. **Validation Cost** - Validation only at template creation, not per-table

## Future Enhancements (Post-Phase 1)

### Phase 2: Persistent SNG + Global Waitlist
- Templates with `table_type=PERSISTENT`
- Global waitlist across multiple tables
- Auto-seat from waitlist

### Phase 3: Testing & Validation
- End-to-end integration tests
- Performance benchmarks
- Frontend validation

### Phase 4: Frontend Integration
- Template selector dropdown
- Live template preview
- Custom template creation UI

### Phase 5-6: Advanced Features
- Tournament templates
- Dynamic blind structures
- Template versioning

## Rollback Plan

If issues arise, rollback is straightforward:

1. **Revert commits** - Git revert Phase 1 commits
2. **Database** - Templates are additive, no destructive changes
3. **Tests** - Old test code still in git history
4. **API** - New endpoint can be disabled without affecting existing code

**Note:** Once frontend uses new endpoint, coordinate rollback with frontend deployment.

## Success Metrics

✅ **Zero** legacy table creation calls without template_id
✅ **100%** of tests use template-based creation
✅ **7** production-ready templates available
✅ **Strict** validation on all template configs
✅ **Clean** separation of template (config) vs table (instance)

## Conclusion

Phase 1 successfully establishes a robust, validated, template-driven architecture for table creation. All legacy paths have been eliminated, comprehensive validation is enforced, and a clean foundation exists for future enhancements.

**Status:** ✅ **COMPLETE**

**Next:** Phase 2 - Persistent SNG Tables + Global Waitlist
