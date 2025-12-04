# Phase 6 Test Suite - New Architecture

This directory contains the rewritten test suite aligned with Phases 1-5 architecture.

## Structure

```
tests_new/
├── conftest.py              # Shared fixtures and configuration
├── backend/                 # Backend functionality tests
│   ├── test_table_lifecycle.py
│   ├── test_waitlist.py
│   ├── test_analytics.py
│   └── test_admin_insights.py
├── websocket/              # Real-time behavior tests
├── frontend/               # Type synchronization tests
└── integration/            # Multi-step flow tests
    └── test_multi_step_flows.py
```

## Key Principles

### Template-Driven Architecture
All tests use template-based configuration (Phase 1):
- Templates define game rules, blinds, stacks
- Tables reference templates, not inline configs
- Tests validate template propagation

### Persistent SNG + Waitlist
Tests validate Phase 2 features:
- PERSISTENT tables never expire
- EXPIRING tables respect TTL
- Waitlist maintains FIFO ordering
- Seating integrates with waitlist

### Analytics Engine
Tests validate Phase 3 analytics:
- Snapshot collection is non-intrusive
- Hourly stats aggregate correctly
- Cleanup handles old data
- Analytics don't affect gameplay

### Admin Insights
Tests validate Phase 4 insights:
- Pattern detection (high/low traffic, etc.)
- Severity assignment
- Delivery channels
- Non-intrusive generation

### High-Level Focus
Tests validate **behavior**, not implementation:
- No deep mocking of PokerKit internals
- No low-level DB or SQL verification
- Focus on project-level flow integrity
- Template-driven expectations

## Running Tests

Run all new tests:
```bash
pytest tests_new/ -v
```

Run specific category:
```bash
pytest tests_new/backend/ -v
pytest tests_new/integration/ -v
```

Run with coverage:
```bash
pytest tests_new/ --cov=telegram_poker_bot --cov-report=html
```

## Migration Notes

### Removed from Old Suite
- Tests referencing removed endpoints
- Tests with hardcoded rule-level fields
- Tests assuming Hold'em-only behavior
- Legacy factory patterns
- Deprecated mock structures

### Retained Tests
The following tests from the old suite are still valid and should be kept:
- `test_analytics.py` (Phase 3) ✓
- `test_analytics_api.py` (Phase 3) ✓
- `test_admin_analytics_api.py` (Phase 4) ✓
- `test_admin_insights_api.py` (Phase 4) ✓
- `test_insights.py` (Phase 4) ✓
- `test_persistent_tables.py` (Phase 2) ✓
- `test_waitlist.py` (Phase 2) ✓
- `test_table_lifecycle.py` (Phase 1) ✓

### To Be Rewritten
Tests that reference old architecture but cover important flows:
- Engine adapter tests (need template alignment)
- Persistence tests (need template config)
- Runtime tests (need wallet/template fixes)
- Sitout tests (need template config)

## Test Data Patterns

### Creating Templates
```python
from tests_new.conftest import create_template_config

config = create_template_config(
    game_variant="no_limit_texas_holdem",
    starting_stack=2000,
    max_players=9
)
```

### Using Fixtures
```python
@pytest.mark.asyncio
async def test_example(db_session, sample_table, sample_users):
    # db_session: Fresh database session
    # sample_table: Pre-created table with template
    # sample_users: List of 4 users
    pass
```

## Acceptance Criteria

- [x] Template-driven behavior validated
- [x] Persistent SNG + waitlist flow tested
- [x] Analytics engine tested (Phase 3)
- [x] Admin insights tested (Phase 4)
- [ ] WebSocket events validated
- [ ] Frontend type alignment checked
- [ ] Integration scenarios complete
- [ ] Legacy tests removed
- [ ] Test discovery clean
