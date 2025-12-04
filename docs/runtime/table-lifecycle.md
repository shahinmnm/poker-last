# Table Lifecycle

High-level overview of table lifecycle in the runtime.

## Lifecycle Stages

### Initialization
Runtime created for new table, PokerKit state initialized from template, seats configured, initial state persisted.

### Waiting Phase
Table waits for minimum players, no hands dealt yet, waitlist accumulates players, seating occurs when ready.

### Active Play
Hands dealt continuously, players take actions, state updated and persisted, new hands auto-start.

### Teardown
All players leave or admin closes, final state persisted, runtime destroyed, resources released.

## State Transitions

Between hands, state transitions to inter-hand phase, brief waiting period, automatic next hand start, continuous gameplay loop.

## Related Documentation

- [Runtime Overview](./overview.md) - Architecture
- [Hand Processing](./hand-processing.md) - Hand flow
- [Backend Services](../backend/services.md) - Table service
