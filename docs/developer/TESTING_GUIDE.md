# Phase 6 Test Architecture - Developer Guide

## Overview

This guide explains how to write, run, and debug tests in the Phase 6 comprehensive test architecture.

## Test Organization

```
telegram_poker_bot/tests/
├── fixtures/                  # Shared test fixtures and data generators
│   ├── deck.py               # Seeded deck for deterministic tests
│   ├── users.py              # User fixtures
│   ├── templates.py          # Variant template fixtures
│   ├── tables.py             # Table fixtures
│   └── hands.py              # Hand scenario generators
├── backend/
│   ├── unit/                 # Backend unit tests
│   └── integration/          # Backend integration tests
├── integration/
│   └── variants/             # Full variant integration tests
├── api/
│   └── contract/             # REST API contract tests
├── websocket/
│   └── contract/             # WebSocket contract tests
├── analytics/                # Analytics tests
├── runtime/                  # Runtime manager tests
└── conftest.py              # Pytest configuration
```

## Running Tests

### All Tests
```bash
make test
```

### Backend Tests Only
```bash
make test-backend
make test-backend-unit
make test-backend-integration
```

### API Tests
```bash
make test-api
```

### WebSocket Tests
```bash
make test-websocket
```

### With Coverage
```bash
make test-coverage
```

### Specific Test File
```bash
pytest telegram_poker_bot/tests/backend/unit/test_adapter_deterministic.py -v
```

### Specific Test Function
```bash
pytest telegram_poker_bot/tests/backend/unit/test_adapter_deterministic.py::TestAdapterInitialization::test_create_adapter_with_default_settings -v
```

## Writing Tests

### Using Fixtures

All test fixtures are available in `telegram_poker_bot/tests/fixtures/`. Import them as needed:

```python
from telegram_poker_bot.tests.fixtures import (
    create_test_users,
    create_variant_template,
    create_multiway_table,
    create_simple_hand,
    create_deterministic_deck,
)
```

### Example: Backend Unit Test

```python
import pytest
from telegram_poker_bot.engine_adapter.adapter import PokerEngineAdapter
from telegram_poker_bot.tests.fixtures.deck import create_deterministic_deck


class TestMyFeature:
    """Test my feature."""
    
    def test_basic_functionality(self):
        """Test basic functionality."""
        adapter = PokerEngineAdapter(
            player_count=2,
            starting_stacks=[1000, 1000],
            small_blind=25,
            big_blind=50,
        )
        
        # Use deterministic deck for reproducible tests
        deck = create_deterministic_deck(seed=42)
        adapter._deck = [str(card) for card in deck.cards]
        
        # Your test logic here
        assert adapter.player_count == 2
```

### Example: Integration Test with Database

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from telegram_poker_bot.tests.fixtures import (
    create_test_users,
    create_variant_template,
    create_multiway_table,
)


@pytest.mark.asyncio
class TestTableIntegration:
    """Test table integration."""
    
    @pytest_asyncio.fixture
    async def setup_table(self, db_session: AsyncSession):
        """Set up a test table."""
        users = await create_test_users(db_session, count=4)
        template = await create_variant_template(
            db_session,
            variant="no_limit_texas_holdem"
        )
        table = await create_multiway_table(
            db_session,
            template=template,
            players=users
        )
        return table, users, template
    
    async def test_my_feature(self, setup_table):
        """Test my feature."""
        table, users, template = setup_table
        
        # Your test logic here
        assert table is not None
        assert len(users) == 4
```

## Adding New Variant Tests

To add tests for a new poker variant:

1. **Add variant configuration** to `fixtures/templates.py`:
```python
VARIANT_CONFIGS = {
    "my_new_variant": {
        "game_variant": "my_new_variant",
        "small_blind": 25,
        "big_blind": 50,
        # ... other config
    }
}
```

2. **Create hand scenarios** in `fixtures/hands.py`:
```python
def create_simple_hand(variant: str = "my_new_variant", seed: int = 42):
    # ... implementation
```

3. **Create integration test** in `tests/integration/variants/`:
```python
# test_my_variant_integration.py
@pytest.mark.asyncio
class TestMyVariantIntegration:
    async def test_simple_hand(self, db_session: AsyncSession):
        # ... implementation
```

## Writing WebSocket Message Tests

WebSocket tests validate message structure and ordering:

```python
@pytest.mark.asyncio
class TestMyWebSocketFeature:
    async def test_message_format(self, db_session: AsyncSession):
        # Set up table and clients
        users = await create_test_users(db_session, count=2)
        template = await create_variant_template(db_session)
        table = await create_multiway_table(db_session, template, users)
        
        # Create mock WebSocket client
        client = MockWebSocketClient(users[0].id)
        
        # Test message format
        # assert message["event_seq"] > 0
        # assert message["table_version"] > 0
        # assert "schema_version" in message
```

## Debugging Test Failures

### Enable Verbose Output
```bash
pytest -vv telegram_poker_bot/tests/path/to/test.py
```

### Show Print Statements
```bash
pytest -s telegram_poker_bot/tests/path/to/test.py
```

### Stop on First Failure
```bash
pytest -x telegram_poker_bot/tests/path/to/test.py
```

### Run Failed Tests Only
```bash
pytest --lf telegram_poker_bot/tests/
```

### Debug with PDB
```bash
pytest --pdb telegram_poker_bot/tests/path/to/test.py
```

## Debugging Desyncs

When testing WebSocket synchronization:

1. **Verify monotonic sequences**:
```python
# Collect messages
messages = []
# Verify event_seq increases
for i in range(1, len(messages)):
    assert messages[i]["event_seq"] > messages[i-1]["event_seq"]
```

2. **Check snapshot vs delta**:
```python
# First message should be snapshot
assert first_msg["type"] == "snapshot"

# Subsequent messages should be deltas
assert next_msg["type"] == "delta"
```

3. **Validate table_version**:
```python
# Each state change should increment version
assert new_version > old_version
```

## Test Data Seeding

### Deterministic Deck
```python
from telegram_poker_bot.tests.fixtures.deck import create_deterministic_deck

deck = create_deterministic_deck(seed=42)
cards = deck.deal(5)  # Always returns same 5 cards
```

### Preset Cards
```python
deck = create_deterministic_deck(
    seed=42,
    preset_cards=["Ah", "As", "Kh", "Kd", "Qh"]  # Royal flush
)
```

### Seeded RNG
```python
import random

rng = random.Random(42)  # Consistent results
value = rng.randint(1, 100)
```

## Coverage Requirements

- **Backend Python**: ≥80%
- **PokerKit Adapter**: ≥85%
- **REST API**: ≥80%
- **WebSocket**: Full contract coverage
- **Frontend**: ≥70%

Check coverage:
```bash
make test-coverage
open htmlcov/index.html
```

## Best Practices

1. **Use fixtures**: Don't recreate common test data
2. **Deterministic tests**: Use seeded RNG for reproducibility
3. **Test behavior, not implementation**: Focus on what, not how
4. **One assertion per test**: Makes failures clearer
5. **Descriptive names**: Test names should describe what they test
6. **Async tests**: Use `@pytest.mark.asyncio` for async code
7. **Database cleanup**: Use fixtures that clean up after tests

## Common Patterns

### Testing Edge Cases
```python
from telegram_poker_bot.tests.fixtures.hands import create_edge_case_hand

edge_case = create_edge_case_hand("illegal_raise", variant="no_limit_texas_holdem")
# Test that illegal raise is rejected
```

### Testing Multiway Pots
```python
hand_data = create_complex_hand(variant="no_limit_texas_holdem", seed=100)
# Verify side pots created
assert len(hand_data["expected_pots"]) > 1
```

### Testing Rake
```python
pot = 1000
rake_percentage = 0.05
rake_cap = 30
calculated_rake = min(pot * rake_percentage, rake_cap)
assert calculated_rake == 30
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main/develop branches

CI pipeline includes:
- Backend unit tests
- Backend integration tests
- API contract tests
- WebSocket contract tests
- Analytics tests
- Lint and format checks
- Migration dry runs

See `.github/workflows/phase6-tests.yml` for details.

## Troubleshooting

### Tests Fail Locally But Pass in CI
- Check environment variables
- Verify database state
- Check for race conditions

### Tests Are Flaky
- Use deterministic seeding
- Avoid sleep() - use proper async waiting
- Check for shared state between tests

### Database Errors
- Ensure migrations are current: `make migrate`
- Check database connection string
- Verify test database exists

### Import Errors
- Install all dependencies: `pip install -r telegram_poker_bot/requirements.txt`
- Ensure project is installed: `pip install -e .`

## Getting Help

- Check existing tests for examples
- Review fixture documentation in `tests/fixtures/`
- Check CI logs for detailed error messages
- Ask in team channel for guidance
