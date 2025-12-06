# Auto-Create System Canonical Schema Implementation Summary

## Overview
This implementation enforces the canonical auto_create schema across the Telegram Poker Bot codebase, ensuring that:
1. Template configs only contain valid auto_create fields
2. Table flags (is_auto_generated, lobby_persistent) are stored in DB columns, not config
3. All existing templates are migrated to the canonical schema

## Canonical Schema

### Required Fields (ONLY these 5 fields allowed):
```json
{
  "enabled": boolean,           // Whether auto-creation is enabled
  "min_tables": integer,        // Minimum number of tables to maintain (>= 0)
  "max_tables": integer,        // Maximum number of tables to create (>= min_tables, >= 1)
  "on_startup_repair": boolean, // Whether to repair missing tables on startup
  "allow_missing_runtime": boolean // Whether to allow missing tables at runtime
}
```

### FORBIDDEN Fields (belong in tables DB columns):
- `lobby_persistent` → stored in `tables.lobby_persistent` column
- `is_auto_generated` → stored in `tables.is_auto_generated` column

## Changes Made

### 1. Pydantic Schema (`telegram_poker_bot/shared/schemas.py`)
- **Updated `AutoCreateConfig`** to enforce canonical 5-field schema
- **Added `extra="forbid"`** to reject any extra fields
- **Removed defaults** - all fields must be explicitly provided
- **Kept validation** for min_tables <= max_tables

### 2. Table Auto-Creator (`telegram_poker_bot/services/table_auto_creator.py`)
**Key Changes:**
- `create_single_table()` now accepts `on_startup_repair` parameter
- Sets `is_auto_generated=True` for all auto-created tables
- Sets `lobby_persistent=on_startup_repair` from config value
- Never reads lobby_persistent or is_auto_generated from template config
- `get_existing_table_count()` counts `is_auto_generated` tables instead of lobby_persistent

### 3. Repair Script (`scripts/repair_auto_create.py`)
**New Features:**
- `canonicalize_auto_create()` function removes invalid fields
- Adds missing required fields with defaults
- `--canonicalize-only` flag for config-only repairs
- Prints exact count of templates fixed

**Usage:**
```bash
# Canonicalize configs only
python scripts/repair_auto_create.py --canonicalize-only

# Canonicalize and repair tables
python scripts/repair_auto_create.py

# Dry run
python scripts/repair_auto_create.py --dry-run
```

### 4. Migration (`029_canonicalize_auto_create.py`)
- Automatically migrates all existing templates
- Removes invalid fields (lobby_persistent, is_auto_generated)
- Adds missing fields with defaults
- Prints count of templates updated

### 5. Validators (`telegram_poker_bot/shared/validators/template_config_validator.py`)
- Updated comments to reflect canonical schema
- `AutoCreateConfig` dataclass matches canonical schema
- Legacy compatibility maintained

### 6. Tests (`telegram_poker_bot/tests/test_auto_create/`)
- Removed invalid fields from all test configs
- Updated assertions to check is_auto_generated instead of lobby_persistent
- All tests verify canonical schema compliance

## Database Schema (Unchanged)

The database already has the correct schema:

```sql
CREATE TABLE tables (
  ...
  is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  lobby_persistent BOOLEAN NOT NULL DEFAULT false,
  ...
);
```

These columns are populated by the backend logic, NOT by template config.

## Behavior Changes

### Before:
- Template configs could contain `lobby_persistent` and `is_auto_generated`
- Tables read these flags from template config
- Inconsistent handling of auto-generated vs lobby-persistent tables

### After:
- Template configs ONLY contain canonical auto_create fields
- Table flags are set by backend when creating tables:
  - `is_auto_generated = True` (always for auto-created tables)
  - `lobby_persistent = auto_create.on_startup_repair` (from config)
- Consistent handling - auto-created tables tracked via is_auto_generated

## Validation Examples

### ✅ VALID Config:
```json
{
  "backend": { ... },
  "ui_schema": { ... },
  "auto_create": {
    "enabled": true,
    "min_tables": 2,
    "max_tables": 5,
    "on_startup_repair": true,
    "allow_missing_runtime": true
  }
}
```

### ❌ INVALID Config (will be rejected):
```json
{
  "backend": { ... },
  "ui_schema": { ... },
  "auto_create": {
    "enabled": true,
    "min_tables": 2,
    "max_tables": 5,
    "lobby_persistent": true,      // FORBIDDEN
    "is_auto_generated": true      // FORBIDDEN
  }
}
```

## Migration Path

1. Run migration: `alembic upgrade head`
   - Canonicalizes all existing templates
   
2. Run repair script: `python scripts/repair_auto_create.py`
   - Ensures all templates have correct number of tables

3. Verify: Check that templates have canonical configs and proper table counts

## Testing

All canonical schema functionality has been tested:
- ✅ Pydantic validation rejects invalid fields
- ✅ Pydantic validation enforces required fields
- ✅ Pydantic validation enforces min_tables <= max_tables
- ✅ Canonicalize function removes invalid fields
- ✅ Canonicalize function adds missing defaults
- ✅ Table auto-creator uses canonical schema
- ✅ Tables have correct is_auto_generated flag
- ✅ Tables have correct lobby_persistent flag

## Security

- ✅ CodeQL analysis: 0 alerts
- ✅ No SQL injection vulnerabilities
- ✅ Proper parameter binding in migrations
- ✅ Input validation via Pydantic

## Backwards Compatibility

- Legacy `validate_auto_create_config()` function maintained
- `lobby_persistent_only` parameter deprecated but kept
- Existing tests updated but structure preserved
- Migration is one-way (no downgrade needed)

## Files Modified

1. `telegram_poker_bot/shared/schemas.py` - Pydantic schema
2. `telegram_poker_bot/services/table_auto_creator.py` - Auto-creation logic
3. `telegram_poker_bot/shared/validators/template_config_validator.py` - Validators
4. `scripts/repair_auto_create.py` - Repair tool
5. `telegram_poker_bot/migrations/versions/029_canonicalize_auto_create.py` - Migration
6. `telegram_poker_bot/tests/test_auto_create/test_auto_creation.py` - Tests

## Summary

This implementation strictly follows the requirements:
- ✅ Canonical schema with exactly 5 required fields
- ✅ No lobby_persistent or is_auto_generated in template config
- ✅ Backend sets table flags from canonical config
- ✅ Migration canonicalizes existing templates
- ✅ Repair script fixes invalid configs
- ✅ Validation rejects invalid configs
- ✅ Tests updated to use canonical schema
- ✅ No breaking changes to database schema
- ✅ Security validated with CodeQL
