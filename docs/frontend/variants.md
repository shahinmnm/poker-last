# Variant Support

High-level overview of multi-variant poker support in the frontend.

## Variant System

### Supported Variants
No-Limit Texas Hold'em, Short Deck Hold'em, Pot-Limit Omaha, Five Card Draw, Triple Draw 2-7 Lowball, Badugi, additional variants configurable.

### Variant Configuration
Each variant has display configuration, card count specifications, community card rules, draw round definitions, evaluation type.

## UI Adaptations

### Card Display
Two cards for Hold'em variants, four cards for Omaha, five cards for Draw poker, adaptive layout for card count, proper card positioning and rotation.

### Community Cards
Five cards for Hold'em, none for Draw variants, board progression indicators, flop, turn, river labels.

### Draw Interface
Discard action bar for draw games, card selection for discards, stand pat option, draw round indicators, multiple draw rounds supported.

### Action Buttons
Standard actions for betting games, discard actions for draw games, variant-specific bet limits, pot limit for Omaha.

## Template Integration

Frontend receives variant from backend, table template specifies variant, UI configured based on variant, no variant-specific hardcoding, all behavior template-driven.

## Related Documentation

- [Frontend Overview](./overview.md) - Architecture
- [Backend Templates](../backend/templates.md) - Configuration
- [Runtime](../runtime/overview.md) - Game logic
