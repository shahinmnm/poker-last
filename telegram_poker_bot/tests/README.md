# Test Suite

This directory contains the test suite for the poker bot system, organized by functional domain.

## Test Organization

Tests are organized into logical categories:

```
telegram_poker_bot/tests/
├── backend/         # Backend functionality (templates, analytics, insights, lifecycle)
├── runtime/         # Game runtime and PokerKit integration
├── flows/           # Game flow scenarios (hand completion, inter-hand)
├── api/             # API endpoint tests
├── integration/     # Multi-component integration tests
├── utilities/       # Utility functions and helpers
└── websocket/       # WebSocket event tests (future)
```

## Running Tests

```bash
# Run all tests
pytest telegram_poker_bot/tests

# Run specific category
pytest telegram_poker_bot/tests/backend
pytest telegram_poker_bot/tests/runtime
pytest telegram_poker_bot/tests/flows

# Run with coverage
pytest telegram_poker_bot/tests --cov=telegram_poker_bot --cov-report=html

# Run specific test file
pytest telegram_poker_bot/tests/backend/test_analytics.py

# Run tests matching pattern
pytest -k "test_analytics"
```

## Test Categories

### Backend Tests
Tests for core backend functionality including:
- Table templates and lifecycle
- Waitlist management (FIFO ordering)
- Analytics snapshot collection
- Hourly statistics aggregation
- Admin insights generation
- Insights delivery channels

### Runtime Tests
Tests for game runtime including:
- PokerKit state initialization
- Action execution and validation
- Hand progression and completion
- State persistence and restoration
- Concurrency and thread safety

### Flow Tests
Tests for complete game flows:
- Hand completion scenarios
- Inter-hand transitions
- Street progression
- Multi-player interactions

### API Tests
Tests for API endpoints:
- User registration and authentication
- Table operations (list, create, join, leave)
- Game action submission
- WebSocket connections
- Admin analytics endpoints

### Integration Tests
Tests for multi-component workflows:
- End-to-end game scenarios
- User registration to gameplay
- Waitlist to seating flow
- Analytics collection pipeline

## Test Principles

### Template-Driven
All tests use table templates for configuration, no hardcoded game parameters, validate template propagation to runtime.

### Isolation
Each test is independent, database cleaned between tests, no shared state across tests, fixtures provide clean slate.

### High-Level Focus
Tests validate behavior not implementation, minimal mocking of internal components, focus on observable outcomes.

## Writing Tests

### Test Structure
Use pytest fixtures for setup, clear test names describing scenario, arrange-act-assert pattern, cleanup handled by fixtures.

### Fixtures
`db_session`: Fresh database session for test, `sample_users`: Pre-created test users with wallets, `sample_table`: Table created from template, `sample_template`: Test table template configuration.

### Template Usage
```python
def test_example(db_session, sample_table):
    # Table already created from template
    # Template config available in sample_table.template
    assert sample_table.status == TableStatus.WAITING
```

## Test Alignment

Tests align with Phase 1-6 architecture:
- **Phase 1-2**: Template-driven tables, persistent SNG, waitlist
- **Phase 3**: Analytics snapshots and hourly aggregation
- **Phase 4**: Admin insights and delivery
- **Phase 5**: Variant-aware behavior (tests prepared)
- **Phase 6**: Reorganized test structure

## Coverage Goals

Maintain high coverage for:
- Template creation and validation
- Table lifecycle transitions
- Waitlist FIFO ordering
- Analytics collection (non-intrusive)
- Insights pattern detection
- API endpoint responses
- Runtime state management

## Related Documentation

- [Developer Testing Guide](../../docs/developer/testing.md) - Testing best practices
- [Architecture](../../docs/architecture/overview.md) - System design
- [Backend Documentation](../../docs/backend/README.md) - Component details
