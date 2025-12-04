# Database Models

This document describes the database schema and relationships at a conceptual level.

## Core Entities

### User
Represents a registered player in the system.

**Attributes**
- Telegram user identifier
- Username and display name
- Language preference
- Registration timestamp
- Last activity tracking
- Account status flags

**Relationships**
- Has one wallet (if wallet feature enabled)
- Has many table seats (current and historical)
- Has many waitlist positions
- Has many game statistics records
- Created many tables (as admin)

### Table
Represents a poker table instance.

**Attributes**
- Table name and description
- Reference to table template
- Current status (waiting, active, ended)
- Creation and last activity timestamps
- Player count and seat configuration
- Button position for dealer
- Expiry timestamp (for expiring tables)

**Relationships**
- References one table template
- Has many seats
- Has one waitlist
- Has many hand history records
- Has many analytics snapshots
- Has many hourly statistics records
- Created by one user (admin)

### TableTemplate
Defines configuration for table creation.

**Attributes**
- Template name and description
- Game variant identifier
- Configuration JSON with all game parameters
- Creation timestamp
- Active status flag
- Template type (persistent or expiring)

**Configuration Content**
- Blind structure and levels
- Starting stack sizes
- Minimum and maximum players
- Time-to-live for expiring tables
- Ante requirements
- Rake configuration
- Variant-specific rules

### Seat
Represents a player's position at a table.

**Attributes**
- Position number at table
- Current chip stack
- Seat status (active, sitting out, reserved)
- Join timestamp
- Last action timestamp

**Relationships**
- Belongs to one table
- Occupied by one user
- Associated with table session

### Waitlist
Manages player queue for table seating.

**Attributes**
- Queue position (FIFO ordering)
- Join timestamp
- Status (waiting, seated, cancelled)
- Notification preferences

**Relationships**
- Belongs to one table
- References one user
- Ordered by timestamp

### Hand
Records the history of a completed hand.

**Attributes**
- Hand number for table
- Start and end timestamps
- Board cards if applicable
- Pot size and winner information
- Actions taken during hand
- Serialized game state

**Relationships**
- Belongs to one table
- Has many player hand records
- References winning users

### TableSnapshot
Analytics snapshot of table state.

**Attributes**
- Snapshot timestamp
- Player count at time of capture
- Table active status flag
- Metadata JSON with additional metrics

**Relationships**
- Belongs to one table
- Used to generate hourly stats

### HourlyTableStats
Aggregated hourly statistics per table.

**Attributes**
- Hour start timestamp
- Average player count
- Maximum players observed
- Total hands played (if available)
- Activity duration in minutes
- Metadata JSON

**Relationships**
- Belongs to one table
- Unique constraint on table and hour
- Generated from multiple snapshots

### Wallet
Player wallet for chip management.

**Attributes**
- Real money balance
- Play money balance
- Currency identifier
- Transaction limits
- Last transaction timestamp

**Relationships**
- Belongs to one user
- Has many transactions

### Transaction
Records financial transactions.

**Attributes**
- Transaction type (deposit, withdrawal, rake)
- Amount and currency
- Status (pending, completed, failed)
- Timestamp and completion time
- External reference ID

**Relationships**
- Belongs to one wallet
- References one user

## Relationships Overview

### User-Centric
User → Wallet (one-to-one), User → Seats (one-to-many), User → Waitlist Positions (one-to-many), User → Created Tables (one-to-many as admin).

### Table-Centric
Table → Template (many-to-one), Table → Seats (one-to-many), Table → Waitlist (one-to-many), Table → Hands (one-to-many), Table → Snapshots (one-to-many), Table → Hourly Stats (one-to-many).

### Analytics Chain
Table → Snapshots (periodic capture), Snapshots → Hourly Stats (aggregation), Hourly Stats → Insights (pattern detection).

## Data Integrity

### Constraints
- User Telegram IDs are unique
- Table names are unique per namespace
- Waitlist positions strictly ordered by timestamp
- Seat positions unique per table
- Hourly stats unique per table per hour
- Transaction IDs globally unique

### Cascading Behavior
- Deleting table removes seats, waitlist, and snapshots
- User deletion restricted if active seats exist
- Template deletion restricted if tables reference it
- Wallet deletion removes associated transactions

### Referential Integrity
Foreign keys enforced at database level, orphaned records prevented, consistent state maintained across transactions.

## Indexing Strategy

### Performance Indexes
- User lookups by Telegram ID
- Table queries by status and template
- Waitlist ordering by timestamp
- Snapshot queries by table and time range
- Hourly stats queries by table and date
- Hand history by table and time

### Composite Indexes
- Table and user for seat lookups
- Table and hour for hourly stats
- User and timestamp for transaction history

## Migration Management

### Version Control
Database schema versioned with Alembic, each change has forward and backward migration, migrations tested before deployment.

### Deployment
Migrations run automatically on application startup, zero-downtime migrations preferred, data transformations handled in migrations.

### Rollback
Downgrade paths provided for all migrations, rollback tested in staging, data preservation ensured.

## Data Lifecycle

### Active Data
Current game states and user sessions, active table data and waitlists, recent analytics snapshots, pending transactions.

### Historical Data
Completed hands and table sessions, older analytics snapshots, completed transactions, archived user sessions.

### Retention Policies
Snapshots older than retention period deleted, hand history retained indefinitely, transaction records retained per regulations, user data retained until account deletion.

## Related Documentation

- [API Overview](./api-overview.md) - Endpoint details
- [Services](./services.md) - Business logic
- [Templates](./templates.md) - Configuration system
- [Analytics](../analytics/overview.md) - Analytics models
