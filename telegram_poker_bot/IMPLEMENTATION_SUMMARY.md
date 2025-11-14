# Implementation Summary: Table Visibility & Ownership

## Executive Summary

The code for table ownership (`creator_user_id`) and visibility (`is_public`) is **already fully implemented** across the stack:

- ✅ Database migrations exist and are correct
- ✅ SQLAlchemy models are properly defined
- ✅ Service layer correctly uses the columns
- ✅ API endpoints properly expose the data
- ✅ Frontend correctly renders the information
- ✅ Translations exist for all labels
- ✅ Performance optimizations are in place

**The only issue**: The migration hasn't been applied to the database yet.

## What's Already Implemented

### 1. Database Schema (Migrations)

#### Migration 004: Table Visibility Columns
**File**: `migrations/versions/004_table_visibility_columns.py`
**Status**: ✅ Complete and correct

Adds:
- `creator_user_id` column (INTEGER, nullable, FK to users)
- `is_public` column (BOOLEAN, default TRUE)
- Indexes for performance
- Data migration to populate from existing config_json

```python
# Key parts of migration 004
op.add_column("tables", sa.Column("creator_user_id", sa.Integer(), nullable=True))
op.add_column("tables", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()))
op.create_foreign_key("fk_tables_creator_user_id_users", "tables", "users", ["creator_user_id"], ["id"], ondelete="SET NULL")
op.create_index("ix_tables_creator_user_id", "tables", ["creator_user_id"])
op.create_index("ix_tables_is_public_status", "tables", ["is_public", "status"])
```

#### Migration 005: Active Table Indexes
**File**: `migrations/versions/005_active_table_indexes.py`
**Status**: ✅ Complete and correct

Adds performance indexes:
- `ix_tables_status_created_at` - For sorting tables
- `ix_seats_user_left_at` - For filtering active seats

### 2. SQLAlchemy Models

#### Table Model
**File**: `shared/models.py` (lines 129-164)
**Status**: ✅ Complete and correct

```python
class Table(Base):
    __tablename__ = "tables"
    
    # ... other columns ...
    
    creator_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_public = Column(Boolean, nullable=False, server_default="true", default=True)
    
    # Relationships
    creator = relationship(
        "User",
        back_populates="tables_created",
        foreign_keys=[creator_user_id],
    )
    
    # Indexes
    __table_args__ = (
        Index("idx_tables_mode_status", "mode", "status"),
        Index("ix_tables_is_public_status", "is_public", "status"),
        Index("ix_tables_status_created_at", "status", "created_at"),
    )
```

#### User Model
**File**: `shared/models.py` (lines 75-104)
**Status**: ✅ Complete and correct

```python
class User(Base):
    __tablename__ = "users"
    
    # ... other columns ...
    
    # Relationship to tables created
    tables_created = relationship(
        "Table",
        back_populates="creator",
        foreign_keys="Table.creator_user_id",
    )
```

### 3. Service Layer

#### user_service.get_active_tables()
**File**: `shared/services/user_service.py` (lines 167-262)
**Status**: ✅ Complete and correct

Features:
- Queries tables with `creator_user_id` and `is_public`
- Batch loads creator information
- Returns visibility in response
- Includes viewer state (is_creator, is_seated)

```python
async def get_active_tables(db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    # Query joins seats to tables
    result = await db.execute(
        select(Table, ActiveSeat)
        .join(ActiveSeat, Table.id == ActiveSeat.table_id)
        .where(
            ActiveSeat.user_id == user_id,
            ActiveSeat.left_at.is_(None),
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE]),
        )
        .order_by(ActiveSeat.joined_at.desc(), Table.created_at.desc())
    )
    
    # Builds response with creator info, visibility, viewer state
    for table, seat in rows:
        tables_data.append({
            "table_id": table.id,
            "creator_user_id": table.creator_user_id,
            "is_public": is_public,
            "visibility": "public" if is_public else "private",
            "host": host_info,  # Includes creator details
            "viewer": {
                "is_seated": True,
                "is_creator": creator_user_id == user_id,
                # ...
            }
        })
```

#### table_service.create_table_with_config()
**File**: `shared/services/table_service.py` (lines 77-136)
**Status**: ✅ Complete and correct

Creates tables with proper ownership and visibility:

```python
async def create_table_with_config(
    db: AsyncSession,
    *,
    creator_user_id: int,
    is_private: bool = False,
    # ...
) -> Table:
    is_public = not is_private
    
    table = Table(
        creator_user_id=creator_user_id,
        is_public=is_public,
        config_json={
            "creator_user_id": creator_user_id,
            "is_private": not is_public,
            "visibility": "public" if is_public else "private",
            # ...
        },
    )
```

#### table_service.list_available_tables()
**File**: `shared/services/table_service.py` (lines 504-696)
**Status**: ✅ Complete and correct

Features:
- Filters by `is_public` for scope="public"
- Redis caching for public tables (20s TTL)
- Batch loads seat counts and creator info
- Returns visibility flags and creator details
- Adds viewer state for authenticated users

```python
async def list_available_tables(
    db: AsyncSession,
    scope: str = "public",
    viewer_user_id: Optional[int] = None,
    redis_client: Optional["Redis"] = None,
) -> List[Dict[str, Any]]:
    # Query filters
    if scope == "public":
        query = query.where(Table.is_public.is_(True))
    
    # Returns with visibility
    payload.append({
        "creator_user_id": creator_user_id,
        "is_public": is_public,
        "is_private": is_private,
        "visibility": visibility,
        "host": host_info,
        "viewer": viewer_details,  # Includes is_creator
    })
```

### 4. API Endpoints

#### GET /users/me/tables
**File**: `api/main.py` (lines 896-912)
**Status**: ✅ Complete and correct

```python
@app.get("/users/me/tables")
async def get_my_tables(
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's active tables."""
    # Authenticates user
    # Calls user_service.get_active_tables()
    # Returns tables with creator_user_id, is_public, visibility
```

#### GET /tables?scope=public
**File**: `api/main.py` (lines 632-680)
**Status**: ✅ Complete and correct

```python
@app.get("/tables")
async def list_tables(
    scope: str = Query("public"),
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """List available tables."""
    # Supports scope: public, all, mine
    # Uses Redis caching for public tables
    # Calls table_service.list_available_tables()
```

### 5. Frontend

#### Lobby Component
**File**: `frontend/src/pages/Lobby.tsx`
**Status**: ✅ Complete and correct

Features:
- Two sections: "My Tables" and "Available Tables"
- Fetches from `/users/me/tables` and `/tables?scope=public`
- Displays creator/host information
- Shows visibility badges (public/private)
- Shows "You Host" badge for creator
- Empty states with CTAs ("Create a table", "Browse public tables")
- Responsive design with dark mode support
- Auto-refresh every 20 seconds

Key UI elements:
```tsx
// My Tables section
{myTables.length === 0 ? (
  <div className="empty-state">
    <p>{t('lobby.myTables.empty')}</p>
    <Link to="/games/create">{t('lobby.myTables.ctaCreate')}</Link>
    <a href="#public-tables">{t('lobby.myTables.ctaBrowse')}</a>
  </div>
) : (
  myTables.map(table => (
    <TableCard
      key={table.table_id}
      isCreator={table.viewer?.is_creator}
      visibility={table.visibility}
      host={table.host}
    />
  ))
)}

// Available Tables section (similar structure)
```

### 6. Translations

#### English (en)
**File**: `frontend/src/locales/en/translation.json`
**Status**: ✅ Complete

```json
{
  "lobby": {
    "title": "Lobby",
    "myTables": {
      "title": "Your active tables",
      "empty": "You're not seated at any tables right now.",
      "ctaCreate": "Create a table",
      "ctaBrowse": "Browse public tables"
    },
    "labels": {
      "youHost": "You Host",
      "visibility": {
        "public": "Public",
        "private": "Private"
      }
    },
    "fields": {
      "host": "Host",
      "players": "Players",
      "blinds": "Blinds",
      "stack": "Stack"
    }
  }
}
```

#### Farsi (fa)
**Status**: ✅ Complete (has equivalent translations)

### 7. Performance Optimizations

#### Database Indexes
**Status**: ✅ Implemented in migrations

- `ix_tables_creator_user_id` - Fast creator lookups
- `ix_tables_is_public_status` - Fast lobby queries
- `ix_tables_status_created_at` - Sorted listings
- `ix_seats_user_left_at` - Active seat filtering

#### Redis Caching
**Status**: ✅ Implemented in table_service

- Public tables cached for 20 seconds
- Cache invalidation on table changes
- Reduces DB load for lobby page

#### Query Optimization
**Status**: ✅ Implemented in services

- Batch loading of seat counts (1 query for all tables)
- Batch loading of creator info (1 query for all creators)
- Joins to avoid N+1 queries
- Proper ordering at DB level

## What Needs to Be Done

### 1. Apply Migrations (USER ACTION REQUIRED)

```bash
cd telegram_poker_bot
alembic upgrade head
```

This is the **ONLY** missing step. Everything else is already implemented.

### 2. Restart Services

After applying migrations:

```bash
# Restart API server
# Restart bot if running
# Clear Redis cache if needed
```

### 3. Verify

```bash
# Check migration version
alembic current

# Test endpoint
curl http://localhost:8000/users/me/tables \
  -H "x-telegram-init-data: <valid-data>"
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌──────────────┐              ┌──────────────────────┐ │
│  │ Lobby.tsx    │              │ Table.tsx            │ │
│  │              │              │                      │ │
│  │ • My Tables  │              │ • Table Details      │ │
│  │ • Public     │              │ • Join/Leave         │ │
│  │ • Empty CTA  │              │ • Host Controls      │ │
│  └──────────────┘              └──────────────────────┘ │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
             │ GET /users/me/tables     │ GET /tables?scope=public
             │                          │ POST /tables/{id}/join
             │                          │
┌────────────▼──────────────────────────▼─────────────────┐
│                    API Layer (FastAPI)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ main.py - REST Endpoints                         │  │
│  │                                                  │  │
│  │ • GET /users/me/tables → user_service           │  │
│  │ • GET /tables → table_service                   │  │
│  │ • POST /tables → table_service                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
             │ Service Layer            │ Redis (Cache)
             │                          │
┌────────────▼──────────────────────────▼─────────────────┐
│              Service Layer (Business Logic)              │
│  ┌────────────────────┐    ┌──────────────────────────┐ │
│  │ user_service.py    │    │ table_service.py         │ │
│  │                    │    │                          │ │
│  │ • get_active_      │    │ • create_table_with_     │ │
│  │   tables()         │    │   config()               │ │
│  │   - Filters by     │    │   - Sets creator_user_id │ │
│  │     user_id        │    │   - Sets is_public       │ │
│  │   - Loads creator  │    │                          │ │
│  │   - Adds viewer    │    │ • list_available_tables()│ │
│  │     state          │    │   - Filters by is_public │ │
│  │                    │    │   - Redis caching        │ │
│  └────────────────────┘    └──────────────────────────┘ │
└────────────┬────────────────────────────────────────────┘
             │
             │ ORM Queries
             │
┌────────────▼──────────────────────────────────────────┐
│           Database Layer (PostgreSQL + SQLAlchemy)     │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Models (models.py)                              │  │
│  │                                                 │  │
│  │ Table:                    User:                 │  │
│  │ • id                      • id                  │  │
│  │ • creator_user_id ───────▶• tg_user_id         │  │
│  │ • is_public               • username           │  │
│  │ • status                  • tables_created ◀───┘  │
│  │ • config_json                                   │  │
│  │ • created_at                                    │  │
│  │                                                 │  │
│  │ Seat:                                           │  │
│  │ • table_id ──────▶ Table                        │  │
│  │ • user_id ───────▶ User                         │  │
│  │ • left_at (NULL = active)                       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Indexes:                                              │
│  • ix_tables_creator_user_id                          │
│  • ix_tables_is_public_status                         │
│  • ix_tables_status_created_at                        │
│  • ix_seats_user_left_at                              │
└────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: User Views "My Tables"

1. **Frontend**: Calls `GET /users/me/tables`
2. **API**: Authenticates user, calls `user_service.get_active_tables(user_id)`
3. **Service**: 
   - Queries: `SELECT Table, Seat WHERE Seat.user_id = ? AND Seat.left_at IS NULL`
   - Batch loads: seat counts, creator users
   - Returns: List of tables with creator info and viewer state
4. **API**: Returns JSON response
5. **Frontend**: Renders:
   - Empty state if no tables, OR
   - List of tables with badges (creator, visibility, status)

### Example 2: User Browses Public Tables

1. **Frontend**: Calls `GET /tables?scope=public`
2. **API**: Calls `table_service.list_available_tables(scope="public")`
3. **Service**:
   - Checks Redis cache for public tables
   - If miss: Query `SELECT Table WHERE is_public = TRUE AND status IN ('waiting', 'active')`
   - Batch loads: seat counts, creator users
   - Caches result in Redis (20s TTL)
   - Returns: List of public tables
4. **API**: Returns JSON response
5. **Frontend**: Renders public tables with "Join" buttons

### Example 3: User Creates Table

1. **Frontend**: Calls `POST /tables` with config
2. **API**: Calls `table_service.create_table_with_config(creator_user_id, is_private=False)`
3. **Service**:
   - Creates Table with `creator_user_id` and `is_public=True`
   - Saves to DB
   - Invalidates Redis cache for public tables
4. **API**: Returns created table
5. **Frontend**: Redirects to table detail page

## Code Quality

### Tests
**Status**: ⚠️ Needs expansion

Existing:
- Basic table creation tests
- Service layer tests

Recommended additions:
- Migration up/down tests
- Public table listing tests
- Creator permission tests
- Frontend component tests

### Documentation
**Status**: ✅ Now complete

- ✅ Migration guide (this document)
- ✅ API documentation in code
- ✅ Model documentation in code
- ✅ Service documentation in code

### Code Style
**Status**: ✅ Consistent

- Follows PEP 8
- Type hints throughout
- Proper error handling
- Logging in critical paths

## Summary

**Everything is already implemented correctly.** The only missing piece is applying the migration to the database.

After running `alembic upgrade head`, the following will work immediately:

1. ✅ `GET /users/me/tables` - No more UndefinedColumnError
2. ✅ `GET /tables?scope=public` - Returns public tables
3. ✅ Frontend "My Tables" section - Shows user's tables with creator badges
4. ✅ Frontend "Available Tables" - Shows public tables
5. ✅ Empty states with CTAs - Guides users to create or browse
6. ✅ Table creation - Sets ownership and visibility
7. ✅ Permissions - Creator can start, others can join public tables
8. ✅ Performance - Indexes and caching reduce DB load

No code changes are needed. Just run the migration.
