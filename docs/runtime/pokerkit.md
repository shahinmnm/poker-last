# PokerKit Integration

High-level overview of PokerKit engine integration.

## PokerKit Role

Provides pure poker game logic without modification, handles all poker rules and mechanics, supports multiple variants, calculates hand rankings and equity.

## Integration Approach

### Wrapper Pattern
Runtime wraps PokerKit state objects, translates API actions to PokerKit methods, extracts results from PokerKit state, never modifies PokerKit internals.

### State Initialization
Template parameters converted to PokerKit format, state created with proper configuration, automations configured, state validated before use.

### Action Execution
API action mapped to PokerKit method, method called on state object, state changes extracted, results returned to API layer.

## Variant Support

PokerKit supports multiple poker variants, runtime uses appropriate variant class, template specifies variant type, variant-specific parameters passed to PokerKit.

## Related Documentation

- [Runtime Overview](./overview.md) - Runtime architecture
- [Templates](../backend/templates.md) - Configuration
- [Hand Processing](./hand-processing.md) - Execution flow
