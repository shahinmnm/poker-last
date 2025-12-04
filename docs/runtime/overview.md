# Runtime Overview

High-level overview of the game runtime system.

## Purpose

Provides async wrapper around PokerKit engine with persistence and state management.

## Architecture

### Runtime Manager
Manages table runtimes, creates and destroys runtimes, routes actions to correct runtime, handles concurrent access.

### Table Runtime
One runtime instance per active table, wraps PokerKit state object, handles action execution, manages hand lifecycle, persists state changes.

### State Persistence
State serialized to database, restored on server restart, snapshots for recovery, atomic updates.

## Integration Points

### Backend API
Receives action requests from backend, returns results and state updates, provides current state queries, handles error conditions.

### PokerKit Engine
Creates state from template parameters, executes actions on state, queries state for allowed actions, handles hand completion.

### Database
Persists serialized game state, stores hand history, maintains transaction log, enables state recovery.

## Related Documentation

- [PokerKit Integration](./pokerkit.md) - Engine details
- [Table Lifecycle](./table-lifecycle.md) - Table flow
- [Hand Processing](./hand-processing.md) - Hand execution
