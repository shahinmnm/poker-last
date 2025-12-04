# Runtime Documentation

This section covers the game runtime and PokerKit integration.

## Contents

- [Runtime Overview](./overview.md) - Runtime architecture
- [PokerKit Integration](./pokerkit.md) - Engine integration
- [Table Lifecycle](./table-lifecycle.md) - Table management
- [Hand Processing](./hand-processing.md) - Hand execution

## Runtime Purpose

Wraps PokerKit engine with persistence, async handling, and state management for the poker bot system.

## Key Responsibilities

### State Management
Initialize PokerKit states from templates, persist state to database, restore state on reload, synchronize state with clients.

### Action Processing
Validate player actions, execute actions in PokerKit, extract state changes, broadcast updates.

### Hand Flow
Deal new hands automatically, progress through streets, handle showdowns, award pots, trigger next hand.

## Technology Stack

- **PokerKit**: Poker game engine
- **Async/Await**: Non-blocking operations
- **PostgreSQL**: State persistence
- **Redis**: Caching and queues

## Related Documentation

- [Architecture](../architecture/overview.md) - System design
- [Backend](../backend/overview.md) - API integration
- [Templates](../backend/templates.md) - Configuration
