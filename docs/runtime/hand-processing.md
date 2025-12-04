# Hand Processing

High-level overview of hand execution in the runtime.

## Hand Flow

### Initialization
New hand started by runtime, button position advanced, blinds and antes posted, hole cards dealt, state persisted.

### Action Rounds
Current player determined, allowed actions calculated, action awaited from player, action executed and validated, state updated and broadcast.

### Street Progression
Betting round completes, community cards dealt if applicable, new betting round begins, process repeats for each street.

### Showdown
Final betting complete, active hands compared, winner determined, pot awarded, results broadcast.

### Completion
Hand marked complete, statistics updated, next hand queued, inter-hand period begins.

## State Persistence

State saved after each action, atomic database updates, rollback on errors, state recovery on restart.

## Related Documentation

- [Runtime Overview](./overview.md) - Architecture
- [PokerKit Integration](./pokerkit.md) - Engine usage
- [Table Lifecycle](./table-lifecycle.md) - Table flow
