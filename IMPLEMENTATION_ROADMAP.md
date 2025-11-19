# PokerLib Integration Implementation Roadmap

## Overview

This document provides a detailed, actionable roadmap for integrating the kuco23/pokerlib library into the poker-last project using a dual-engine adapter pattern.

**Status**: Ready for Implementation  
**Timeline**: 5-8 weeks  
**Risk Level**: Low (additive, non-breaking changes)

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend (React)                        │
│              Pure Presentation Layer                    │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (GameEvents)
┌────────────────────▼────────────────────────────────────┐
│             API Layer (FastAPI)                         │
│         WebSocket + REST Endpoints                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           Game Core (Orchestration)                     │
│        Table Manager + Event Broadcaster                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         IPokerEngine Interface (NEW)                    │
│         Unified API for all engines                     │
└─────────┬──────────────────────────────┬────────────────┘
          │                              │
┌─────────▼──────────┐        ┌──────────▼─────────────┐
│ PokerKitAdapter    │        │ PokerLibAdapter (NEW)  │
│ (Existing, Updated)│        │ (Event-Driven)         │
└─────────┬──────────┘        └──────────┬─────────────┘
          │                              │
┌─────────▼──────────┐        ┌──────────▼─────────────┐
│    PokerKit        │        │     PokerLib           │
│ (Current Engine)   │        │  (Alternative Engine)  │
└────────────────────┘        └────────────────────────┘
```

---

## Phase 1: Foundation Setup (Week 1-2)

### Objectives
- Set up infrastructure for dual-engine support
- Define interfaces and contracts
- Update build and dependency management

### Tasks

#### 1.1 Dependencies and Environment

```bash
# Add pokerlib to requirements
echo "pokerlib==2.2.7" >> telegram_poker_bot/requirements.txt

# Install locally for development
pip install pokerlib==2.2.7

# Update .gitignore if needed
echo "*.pyc" >> .gitignore
echo "__pycache__/" >> .gitignore
```

**Files Modified:**
- `telegram_poker_bot/requirements.txt`
- `telegram_poker_bot/requirements.runtime.txt` (add pokerlib as optional)

**Acceptance Criteria:**
- [ ] PokerLib installs without conflicts
- [ ] All existing tests still pass
- [ ] No breaking changes to current functionality

#### 1.2 Interface Definition (Already Complete)

**Files Created:**
- ✅ `telegram_poker_bot/engine_adapter/interface.py`
- ✅ `telegram_poker_bot/engine_adapter/translator.py`
- ✅ `telegram_poker_bot/engine_adapter/pokerlib_adapter.py` (skeleton)

**Next Steps:**
- Review and refine interface based on feedback
- Add docstring examples
- Create interface validation tests

#### 1.3 Configuration System

```python
# telegram_poker_bot/config/engine.py (NEW)

from enum import Enum
from typing import Optional


class PokerEngineType(Enum):
    """Available poker engine implementations."""
    POKERKIT = "pokerkit"
    POKERLIB = "pokerlib"


class EngineConfig:
    """Configuration for poker engine selection."""
    
    # Default engine for new tables
    DEFAULT_ENGINE: PokerEngineType = PokerEngineType.POKERKIT
    
    # Feature flags
    ALLOW_ENGINE_SELECTION: bool = False  # Admin only initially
    ENABLE_POKERLIB: bool = False  # Disabled by default
    
    # Performance tuning
    POKERKIT_MAX_CACHE_SIZE: int = 1000
    POKERLIB_EVENT_QUEUE_SIZE: int = 100
    
    # A/B testing
    POKERLIB_TRAFFIC_PERCENTAGE: int = 0  # 0-100
    
    @classmethod
    def from_env(cls):
        """Load configuration from environment variables."""
        import os
        
        cls.DEFAULT_ENGINE = PokerEngineType(
            os.getenv("POKER_ENGINE", "pokerkit")
        )
        cls.ENABLE_POKERLIB = os.getenv("ENABLE_POKERLIB", "false").lower() == "true"
        cls.POKERLIB_TRAFFIC_PERCENTAGE = int(
            os.getenv("POKERLIB_TRAFFIC_PERCENTAGE", "0")
        )
```

**Files Created:**
- `telegram_poker_bot/config/engine.py`

**Environment Variables:**
```bash
# .env additions
POKER_ENGINE=pokerkit  # or pokerlib
ENABLE_POKERLIB=false
POKERLIB_TRAFFIC_PERCENTAGE=0
```

**Acceptance Criteria:**
- [ ] Configuration loads from environment
- [ ] Defaults to PokerKit (safe fallback)
- [ ] Feature flags work as expected

#### 1.4 Engine Factory Pattern

```python
# telegram_poker_bot/engine_adapter/factory.py (NEW)

from typing import List
from telegram_poker_bot.config.engine import EngineConfig, PokerEngineType
from telegram_poker_bot.engine_adapter.interface import IPokerEngine
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


class EngineFactory:
    """Factory for creating poker engine instances."""
    
    @staticmethod
    def create_engine(
        table_id: str,
        player_count: int,
        starting_stacks: List[int],
        small_blind: int = 25,
        big_blind: int = 50,
        engine_type: PokerEngineType = None,
        **kwargs
    ) -> IPokerEngine:
        """Create a poker engine instance.
        
        Args:
            table_id: Unique table identifier
            player_count: Number of players (2-8)
            starting_stacks: Starting chip stacks
            small_blind: Small blind amount
            big_blind: Big blind amount
            engine_type: Engine to use (defaults to config)
            **kwargs: Engine-specific options
            
        Returns:
            IPokerEngine implementation
            
        Raises:
            ValueError: If engine type is invalid or disabled
        """
        # Determine engine type
        if engine_type is None:
            engine_type = EngineFactory._select_engine()
        
        # Validate engine is enabled
        if engine_type == PokerEngineType.POKERLIB and not EngineConfig.ENABLE_POKERLIB:
            logger.warning(
                "PokerLib requested but disabled, falling back to PokerKit",
                table_id=table_id
            )
            engine_type = PokerEngineType.POKERKIT
        
        # Create engine instance
        if engine_type == PokerEngineType.POKERKIT:
            from telegram_poker_bot.engine_adapter.pokerkit_adapter import PokerKitAdapter
            
            logger.info("Creating PokerKit engine", table_id=table_id)
            return PokerKitAdapter(
                table_id=table_id,
                player_count=player_count,
                starting_stacks=starting_stacks,
                small_blind=small_blind,
                big_blind=big_blind,
                **kwargs
            )
        
        elif engine_type == PokerEngineType.POKERLIB:
            from telegram_poker_bot.engine_adapter.pokerlib_adapter import PokerLibAdapter
            
            logger.info("Creating PokerLib engine", table_id=table_id)
            return PokerLibAdapter(
                table_id=table_id,
                player_count=player_count,
                starting_stacks=starting_stacks,
                small_blind=small_blind,
                big_blind=big_blind,
                **kwargs
            )
        
        else:
            raise ValueError(f"Unknown engine type: {engine_type}")
    
    @staticmethod
    def _select_engine() -> PokerEngineType:
        """Select engine based on configuration.
        
        Implements A/B testing based on traffic percentage.
        """
        import random
        
        # Check if A/B testing is enabled
        if EngineConfig.ENABLE_POKERLIB and EngineConfig.POKERLIB_TRAFFIC_PERCENTAGE > 0:
            # Random selection based on percentage
            if random.randint(1, 100) <= EngineConfig.POKERLIB_TRAFFIC_PERCENTAGE:
                return PokerEngineType.POKERLIB
        
        # Default to configured engine
        return EngineConfig.DEFAULT_ENGINE
```

**Files Created:**
- `telegram_poker_bot/engine_adapter/factory.py`

**Acceptance Criteria:**
- [ ] Factory creates correct engine type
- [ ] A/B testing works correctly
- [ ] Falls back safely if engine disabled
- [ ] Logs engine selection decisions

---

## Phase 2: PokerKit Adapter Refactoring (Week 2-3)

### Objectives
- Update existing PokerKit adapter to implement IPokerEngine
- Add event translation for PokerKit
- Maintain backward compatibility

### Tasks

#### 2.1 Update PokerKit Adapter

**Files Modified:**
- `telegram_poker_bot/engine_adapter/adapter.py` → `pokerkit_adapter.py`

**Changes:**
```python
# Before
class PokerEngineAdapter:
    def __init__(self, ...):
        # ...

# After
from telegram_poker_bot.engine_adapter.interface import IPokerEngine

class PokerKitAdapter(IPokerEngine):
    def __init__(self, table_id: str, ...):
        # Add table_id parameter
        self.table_id = table_id
        # ... rest of existing code
```

**Key Updates:**
1. Rename class to `PokerKitAdapter`
2. Implement all `IPokerEngine` abstract methods
3. Add event queue and translation
4. Update return types to `List[GameEvent]`

**Acceptance Criteria:**
- [ ] Implements all IPokerEngine methods
- [ ] All existing tests pass
- [ ] Events are properly translated
- [ ] No breaking changes to callers

#### 2.2 Add Event Generation for PokerKit

```python
# In PokerKitAdapter

def fold(self, player_index: int) -> List[GameEvent]:
    """Player folds."""
    # Existing logic
    operation = self.state.fold()
    
    # NEW: Translate to events
    events = GameEventTranslator.from_pokerkit_operation(
        operation, 
        self.state
    )
    
    # Store in event queue
    self._event_queue.extend(events)
    
    return events
```

**Acceptance Criteria:**
- [ ] All actions generate appropriate events
- [ ] Events match the schema in `interface.py`
- [ ] Event queue is properly managed

#### 2.3 Update Tests

```python
# tests/test_engine_adapters.py (NEW)

import pytest
from telegram_poker_bot.engine_adapter.factory import EngineFactory
from telegram_poker_bot.config.engine import PokerEngineType
from telegram_poker_bot.engine_adapter.interface import GameEventType


class TestPokerKitAdapter:
    """Tests for PokerKit adapter."""
    
    def test_create_adapter(self):
        """Test adapter creation."""
        adapter = EngineFactory.create_engine(
            table_id="test_table",
            player_count=2,
            starting_stacks=[1000, 1000],
            engine_type=PokerEngineType.POKERKIT
        )
        
        assert adapter is not None
        assert adapter.table_id == "test_table"
    
    def test_fold_generates_events(self):
        """Test that folding generates events."""
        adapter = EngineFactory.create_engine(
            table_id="test_table",
            player_count=2,
            starting_stacks=[1000, 1000],
            engine_type=PokerEngineType.POKERKIT
        )
        
        # Perform action
        events = adapter.fold(0)
        
        # Verify events
        assert len(events) > 0
        assert any(e.type == GameEventType.PLAYER_FOLDED for e in events)
    
    def test_get_game_state(self):
        """Test game state retrieval."""
        adapter = EngineFactory.create_engine(
            table_id="test_table",
            player_count=2,
            starting_stacks=[1000, 1000],
            engine_type=PokerEngineType.POKERKIT
        )
        
        state = adapter.get_game_state()
        
        assert state.table_id == "test_table"
        assert state.player_count == 2
        assert len(state.players) == 2
```

**Files Created:**
- `tests/test_engine_adapters.py`
- `tests/test_pokerkit_adapter.py`
- `tests/test_factory.py`

**Acceptance Criteria:**
- [ ] All adapter methods tested
- [ ] Event generation tested
- [ ] State serialization tested
- [ ] 80%+ code coverage

---

## Phase 3: PokerLib Adapter Implementation (Week 3-4)

### Objectives
- Complete PokerLib adapter implementation
- Handle edge cases and special scenarios
- Comprehensive testing

### Tasks

#### 3.1 Complete PokerLib Adapter

**Files Modified:**
- `telegram_poker_bot/engine_adapter/pokerlib_adapter.py`

**Implementation Checklist:**
- [x] Basic structure (already created)
- [ ] Winner tracking
- [ ] Side pot handling
- [ ] All-in scenarios
- [ ] Showdown logic
- [ ] Muck/show card handling
- [ ] State persistence
- [ ] Error handling

#### 3.2 Event Translation for PokerLib

**Files Modified:**
- `telegram_poker_bot/engine_adapter/translator.py`

**Updates:**
- [ ] Complete all PokerLib event mappings
- [ ] Handle edge cases (ties, side pots, etc.)
- [ ] Add hand evaluation data
- [ ] Test all event types

#### 3.3 Integration Testing

```python
# tests/test_pokerlib_adapter.py

class TestPokerLibAdapter:
    """Tests for PokerLib adapter."""
    
    def test_full_hand_completion(self):
        """Test complete hand from start to finish."""
        adapter = EngineFactory.create_engine(
            table_id="test_table",
            player_count=2,
            starting_stacks=[1000, 1000],
            engine_type=PokerEngineType.POKERLIB
        )
        
        # Simulate full hand
        # Player 0 calls
        events = adapter.check_or_call(0)
        assert any(e.type == GameEventType.PLAYER_CALLED for e in events)
        
        # Player 1 checks
        events = adapter.check_or_call(1)
        assert any(e.type == GameEventType.PLAYER_CHECKED for e in events)
        
        # ... continue through all streets
        
        # Verify winner
        assert adapter.is_hand_complete()
        winners = adapter.get_winners()
        assert len(winners) > 0
```

**Acceptance Criteria:**
- [ ] Can play complete hands
- [ ] All player actions work correctly
- [ ] Winners determined correctly
- [ ] Events generated for all actions

#### 3.4 Compatibility Testing

```python
# tests/test_engine_compatibility.py

def test_both_engines_same_result():
    """Test that both engines produce the same results."""
    
    # Same scenario for both engines
    scenarios = [
        {
            'name': 'simple_fold',
            'actions': [
                ('fold', 0),
            ],
            'expected_winner': 1
        },
        # ... more scenarios
    ]
    
    for scenario in scenarios:
        # Run with PokerKit
        pk_result = run_scenario(PokerEngineType.POKERKIT, scenario)
        
        # Run with PokerLib
        pl_result = run_scenario(PokerEngineType.POKERLIB, scenario)
        
        # Results should match
        assert pk_result['winner'] == pl_result['winner']
        assert pk_result['pot'] == pl_result['pot']
```

**Acceptance Criteria:**
- [ ] Both engines produce same winners
- [ ] Both engines calculate same pots
- [ ] Events are semantically equivalent

---

## Phase 4: Game Core Integration (Week 4-5)

### Objectives
- Update game orchestration to use IPokerEngine
- Remove direct PokerKit dependencies
- Ensure WebSocket events are engine-agnostic

### Tasks

#### 4.1 Update Table Manager

**Files Modified:**
- `telegram_poker_bot/game_core/manager.py`

**Changes:**
```python
# Before
from telegram_poker_bot.engine_adapter.adapter import PokerEngineAdapter

# After
from telegram_poker_bot.engine_adapter.factory import EngineFactory
from telegram_poker_bot.engine_adapter.interface import IPokerEngine

class TableManager:
    def create_table(self, ...):
        # Before
        # self.engine = PokerEngineAdapter(...)
        
        # After
        self.engine = EngineFactory.create_engine(
            table_id=table_id,
            player_count=player_count,
            starting_stacks=starting_stacks,
            # engine_type determined by config
        )
```

**Acceptance Criteria:**
- [ ] Uses factory instead of direct instantiation
- [ ] No direct PokerKit imports
- [ ] Works with both engines transparently

#### 4.2 Update Event Broadcasting

**Files Modified:**
- `telegram_poker_bot/game_core/runtime.py`

**Changes:**
```python
def handle_player_action(self, player_id: int, action: str, **kwargs):
    """Handle player action and broadcast events."""
    
    # Execute action on engine
    events = self.engine.perform_action(player_id, action, **kwargs)
    
    # Broadcast events to all players
    for event in events:
        if event.is_private:
            # Send to specific player
            self.send_private_event(event.player_id, event)
        else:
            # Broadcast to all
            self.broadcast_event(event)
```

**Acceptance Criteria:**
- [ ] Events properly routed (private vs public)
- [ ] All players receive correct updates
- [ ] No engine-specific logic in orchestration

#### 4.3 Update State Persistence

**Files Modified:**
- `telegram_poker_bot/game_core/manager.py`

**Changes:**
```python
def save_table_state(self, table_id: str):
    """Save table state to database."""
    
    # Get engine state
    engine_state = self.engine.to_state_dict()
    
    # Add metadata
    state_data = {
        'table_id': table_id,
        'engine_type': type(self.engine).__name__,
        'engine_state': engine_state,
        'timestamp': datetime.utcnow(),
    }
    
    # Save to database
    self.db.save_state(table_id, state_data)

def restore_table_state(self, table_id: str):
    """Restore table state from database."""
    
    # Load from database
    state_data = self.db.load_state(table_id)
    
    # Determine engine type
    engine_type = PokerEngineType[state_data['engine_type']]
    
    # Restore engine
    self.engine = EngineFactory.restore_engine(
        engine_type=engine_type,
        state_dict=state_data['engine_state']
    )
```

**Acceptance Criteria:**
- [ ] State can be saved and restored
- [ ] Works with both engines
- [ ] Engine type tracked in database

---

## Phase 5: Frontend Updates (Week 5)

### Objectives
- Ensure frontend is engine-agnostic
- Update TypeScript interfaces
- Test with both engines

### Tasks

#### 5.1 Update TypeScript Interfaces

**Files Modified:**
- `telegram_poker_bot/frontend/src/types/game.ts`

**Changes:**
```typescript
// game.ts

export enum GameEventType {
  PLAYER_FOLDED = 'player_folded',
  PLAYER_CALLED = 'player_called',
  PLAYER_RAISED = 'player_raised',
  // ... all event types from Python
}

export interface GameEvent {
  type: GameEventType;
  timestamp: string;
  data: any;
  player_id?: number;
  is_private: boolean;
}

export interface GameState {
  table_id: string;
  player_count: number;
  players: Player[];
  street: string;
  board_cards: string[];
  pot: number;
  // ... match Python GameState
}
```

**Acceptance Criteria:**
- [ ] TypeScript types match Python types
- [ ] No engine-specific assumptions
- [ ] Type-safe event handling

#### 5.2 Update WebSocket Handler

**Files Modified:**
- `telegram_poker_bot/frontend/src/hooks/useWebSocket.ts`

**Changes:**
```typescript
export function useWebSocket(tableId: string) {
  const handleEvent = useCallback((event: GameEvent) => {
    switch (event.type) {
      case GameEventType.PLAYER_FOLDED:
        // Update UI for fold
        break;
      case GameEventType.PLAYER_CALLED:
        // Update UI for call
        break;
      // ... all event types
    }
  }, []);
  
  // No engine-specific logic!
  // Just consume normalized events
}
```

**Acceptance Criteria:**
- [ ] Handles all event types
- [ ] No engine-specific code
- [ ] Works with both engines

#### 5.3 Testing with Both Engines

**Manual Testing Checklist:**
- [ ] Create table with PokerKit
- [ ] Play complete hand
- [ ] Verify all UI updates
- [ ] Create table with PokerLib
- [ ] Play same hand
- [ ] Verify identical UI behavior

---

## Phase 6: Performance Testing & Optimization (Week 6)

### Objectives
- Benchmark both engines
- Optimize hot paths
- Tune configuration

### Tasks

#### 6.1 Performance Benchmarking

```python
# tests/benchmark_engines.py

import time
import memory_profiler
from telegram_poker_bot.engine_adapter.factory import EngineFactory
from telegram_poker_bot.config.engine import PokerEngineType


@memory_profiler.profile
def benchmark_engine(engine_type: PokerEngineType, num_hands: int = 1000):
    """Benchmark engine performance."""
    
    start = time.time()
    memory_start = memory_profiler.memory_usage()[0]
    
    for i in range(num_hands):
        adapter = EngineFactory.create_engine(
            table_id=f"bench_{i}",
            player_count=6,
            starting_stacks=[1000] * 6,
            engine_type=engine_type
        )
        
        # Simulate full hand
        simulate_full_hand(adapter)
    
    elapsed = time.time() - start
    memory_end = memory_profiler.memory_usage()[0]
    
    return {
        'engine': engine_type.value,
        'hands_per_second': num_hands / elapsed,
        'avg_time_per_hand': elapsed / num_hands,
        'memory_used_mb': memory_end - memory_start,
    }


if __name__ == '__main__':
    print("Benchmarking PokerKit...")
    pk_results = benchmark_engine(PokerEngineType.POKERKIT)
    print(pk_results)
    
    print("\nBenchmarking PokerLib...")
    pl_results = benchmark_engine(PokerEngineType.POKERLIB)
    print(pl_results)
```

**Metrics to Track:**
- Hands per second
- Memory usage per table
- Event generation overhead
- Latency (p50, p95, p99)

**Acceptance Criteria:**
- [ ] Both engines meet performance targets
- [ ] No memory leaks
- [ ] Acceptable latency

#### 6.2 Optimization

**Areas to Optimize:**
1. Event queue management
2. State serialization
3. Hand evaluation caching
4. Card conversion overhead

**Acceptance Criteria:**
- [ ] 10%+ performance improvement
- [ ] No functionality regressions

---

## Phase 7: Production Deployment (Week 7-8)

### Objectives
- Deploy to staging
- A/B testing
- Gradual rollout

### Tasks

#### 7.1 Staging Deployment

**Deployment Steps:**
1. Deploy code with PokerLib disabled
2. Verify all existing functionality works
3. Enable PokerLib for 1% traffic
4. Monitor metrics

**Environment Configuration:**
```bash
# staging.env
POKER_ENGINE=pokerkit
ENABLE_POKERLIB=true
POKERLIB_TRAFFIC_PERCENTAGE=1
```

**Monitoring:**
- Error rates by engine
- Latency by engine
- Memory usage by engine
- User feedback/reports

**Acceptance Criteria:**
- [ ] Zero errors in staging
- [ ] Both engines working correctly
- [ ] Metrics show acceptable performance

#### 7.2 Gradual Rollout

**Rollout Plan:**
- Week 7: 1% PokerLib traffic
- Week 7.5: 5% PokerLib traffic
- Week 8: 10% PokerLib traffic
- Week 8+: Evaluate and decide

**Go/No-Go Criteria:**
- Error rate < 0.1%
- Latency < 100ms p99
- No critical bugs reported
- User satisfaction maintained

**Rollback Plan:**
```python
# Emergency rollback
EngineConfig.ENABLE_POKERLIB = False
EngineConfig.POKERLIB_TRAFFIC_PERCENTAGE = 0
# Restart services
```

**Acceptance Criteria:**
- [ ] Successful gradual rollout
- [ ] No incidents
- [ ] Metrics within acceptable ranges

---

## Risk Management

### High Risk Items

1. **State Persistence**
   - Risk: PokerLib state may not serialize correctly
   - Mitigation: Comprehensive serialization tests
   - Fallback: Store action history for replay

2. **Edge Cases**
   - Risk: PokerLib handles edge cases differently
   - Mitigation: Extensive compatibility testing
   - Fallback: Keep PokerKit as primary

3. **Performance**
   - Risk: PokerLib may be slower than expected
   - Mitigation: Benchmark early
   - Fallback: Disable if performance unacceptable

### Medium Risk Items

1. **Event Translation**
   - Risk: Events may not translate correctly
   - Mitigation: Comprehensive event tests
   - Fallback: Add logging for debugging

2. **Dependency Conflicts**
   - Risk: PokerLib may conflict with other dependencies
   - Mitigation: Test in isolated environment
   - Fallback: Pin versions carefully

---

## Success Metrics

### Technical Metrics

- [ ] 100% test coverage for adapters
- [ ] Both engines pass all integration tests
- [ ] Performance within 10% of PokerKit
- [ ] Zero production incidents
- [ ] < 0.1% error rate

### Business Metrics

- [ ] No user complaints about gameplay
- [ ] No increase in support tickets
- [ ] Maintained or improved latency
- [ ] Maintained or improved throughput

---

## Decision Points

### After Phase 3 (Week 4)

**Question**: Is PokerLib adapter working correctly?

**Go Criteria:**
- All tests passing
- Event translation complete
- Performance acceptable

**No-Go**: Stop PokerLib work, keep PokerKit only

### After Phase 6 (Week 6)

**Question**: Should we deploy PokerLib to production?

**Go Criteria:**
- Benchmarks show acceptable performance
- No critical bugs in testing
- Team confidence is high

**No-Go**: Keep as research project only

### After Phase 7 (Week 8)

**Question**: What's the final engine strategy?

**Options:**
1. **Keep Both**: Use based on table type/load
2. **PokerLib Primary**: Migrate fully
3. **PokerKit Only**: Disable PokerLib
4. **Feature-Based**: PokerLib for cash games, PokerKit for tournaments

**Decision Factors:**
- Performance data
- User feedback
- Maintenance burden
- Future roadmap

---

## Rollback Procedures

### Immediate Rollback (< 1 hour)

```python
# In production environment
EngineConfig.ENABLE_POKERLIB = False
# Restart services
systemctl restart poker-api
systemctl restart poker-bot
```

### Full Rollback (< 1 day)

```bash
# Revert to previous deployment
git revert <commit-hash>
./deploy/update.sh
```

### Data Recovery

- All games in-progress complete on their current engine
- No data loss (engine choice in database)
- Can restore from backups if needed

---

## Appendix

### Useful Commands

```bash
# Run tests
pytest tests/test_engine_adapters.py -v

# Run benchmarks
python tests/benchmark_engines.py

# Check coverage
pytest --cov=telegram_poker_bot/engine_adapter tests/

# Type checking
mypy telegram_poker_bot/engine_adapter/

# Run specific engine
POKER_ENGINE=pokerlib python -m telegram_poker_bot.api.main
```

### Reference Documents

- [PokerLib Integration Analysis](./POKERLIB_INTEGRATION_ANALYSIS.md)
- [Interface Definition](./telegram_poker_bot/engine_adapter/interface.py)
- [Event Translator](./telegram_poker_bot/engine_adapter/translator.py)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-19  
**Status**: Ready for Implementation
