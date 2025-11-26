# PokerKit Migration Plan

## Current Engine Map
- **Data models (SQLAlchemy)**: `telegram_poker_bot/shared/models.py`
  - `Table`, `Seat`, `Hand`, `HandHistory`, `HandHistoryEvent`, `Pot`, `Action`, `HandStatus`, `ActionType`, and lifecycle fields like `TableStatus`. `Hand.engine_state_json` already stores serialized PokerKit state and `timeout_tracking` is used for turn enforcement.
- **Poker runtime (current single source of truth attempt)**: `telegram_poker_bot/game_core/pokerkit_runtime.py`
  - `PokerKitTableRuntime` wraps the running game per table: builds player order, instantiates `PokerEngineAdapter`, deals streets, logs `HandHistoryEvent`s, enforces inter-hand waits, and applies rake/payouts. `PokerKitTableRuntimeManager` caches runtimes, serializes DB access with per-table locks, drives `handle_action`, and exposes `get_state`.
- **PokerKit adapter (custom wrapper over PokerKit.State)**: `telegram_poker_bot/engine_adapter/adapter.py`
  - Manages hole/board dealing with a local shuffled deck, infers blinds, exposes action helpers (`fold`, `check_or_call`, `bet_or_raise`, `all_in`), serializes/deserializes PokerKit `State`, and computes winner breakdowns. Also auto-advances streets when the actor queue empties.
- **Table lifecycle & orchestration**: `telegram_poker_bot/shared/services/table_service.py` handles table creation, seating, start/end transitions, and delegates runtime refresh/start to `game_core.pokerkit_runtime`. `telegram_poker_bot/shared/services/table_lifecycle.py` evaluates expiry/zombie cleanup.
- **API surface / action entry points**: `telegram_poker_bot/api/main.py`
  - REST endpoints: `/tables/{table_id}/start` kicks off a new hand via `PokerKitTableRuntimeManager.start_game`; `/tables/{table_id}/actions` routes player actions to `handle_action`; `/tables/{table_id}/ready` coordinates inter-hand readiness; `/tables/{table_id}/hands` & `/users/me/hands` expose history. Background timeout loop auto-folds/checks through `handle_action`.
  - WebSocket: `/ws/{table_id}` broadcasts states returned from runtime manager plus explicit `hand_ended_event` payloads.
- **Statistics**: `telegram_poker_bot/game_core/stats_processor.py` calculates VPIP/PFR post-hand using recorded `Action`s (simplified; lacks street granularity).

## Existing PokerKit Usage & Gaps
- PokerKit is used through `PokerEngineAdapter` and `PokerKitTableRuntime`, but custom logic still handles shuffling/dealing, blind inference, street advancement, and rake calculations. Board/hole cards live in adapter-managed deck rather than PokerKit’s internal RNG, and allowed-actions derivation mixes engine state with custom fallbacks.
- State is persisted in `Hand.engine_state_json`, yet restoration relies on adapter serialization and may not rebuild full PokerKit internals across workers.
- Pots, bets, and winners primarily come from PokerKit, but timeout handling and inter-hand readiness maintain parallel flags (`timeout_tracking`, `ready_players`).

### PokerKit Single Source of Truth Goals
PokerKit must exclusively own:
- Valid actions and turn order
- Blinds/antes/bets, pots, and chip movement
- Board/hole cards and street progression
- Showdown evaluation and winner computation

## Target Architecture
- **PokerKit adapter layer**: A thin adapter around `pokerkit.State` that exposes persistence-safe serialization/deserialization, action guards, and visibility-aware state rendering without duplicating dealing logic.
- **Table runtime**: One runtime per table orchestrating hand lifecycle, turn timers, rake application, and DB persistence. Runtime should hydrate from PokerKit state alone and avoid secondary state machines.
- **API/WebSocket boundary**: REST and WebSocket handlers talk only to the runtime. Payloads are shaped from PokerKit-derived state; legacy fields are adapted without recomputing game rules.

## Phased Migration Steps
1. **Adapter hardening**: Align adapter with PokerKit primitives—remove custom deck handling, rely on PokerKit shuffling/dealing, and ensure serialization fully restores `State` (including actor queues and pots). Add explicit TODOs for any duplicated logic.
2. **Runtime persistence & hydration**: Teach `PokerKitTableRuntime` to load/save PokerKit state as the canonical store, rehydrate engines on worker boundaries, and drop fallback status mutations. Normalize rake and timeout bookkeeping around PokerKit outcomes.
3. **API/runtime wiring**: Ensure `/start`, `/actions`, timeouts, and readiness flows call runtime methods that act solely on PokerKit state. Remove parallel validations and consolidate error handling/logging around runtime/adapter errors.
4. **WebSocket & frontend alignment**: Standardize payloads sourced from PokerKit (`allowed_actions`, board/hole visibility, pots) and document any legacy fields that need adapters. Remove duplicated hand_ended broadcasts once PokerKit-driven events suffice.
5. **Testing & simulation**: Add engine-level unit tests (state transitions, winner computation), runtime integration tests (multi-hand flows, timeouts), and load/simulation scripts comparing PokerKit outcomes with stored histories.

## DO / DO NOT
- **DO** delegate all poker rules (actions, dealing, pots, showdown) to PokerKit `State`.
- **DO** keep FastAPI/WebSocket responses stable while internally swapping to PokerKit data.
- **DO** persist and reload PokerKit state as the single source of truth.
- **DO NOT** maintain parallel state machines or recompute blinds/pots/winners outside PokerKit.
- **DO NOT** manually manage decks/board dealing once PokerKit handling is in place.
- **DO NOT** bypass runtime when broadcasting or persisting game state.
