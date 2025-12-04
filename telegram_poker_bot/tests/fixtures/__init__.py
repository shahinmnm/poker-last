"""Test fixtures and data generators for Phase 6 test architecture.

This module provides:
- Seeded RNG for deterministic tests
- Variant-specific test data
- User and table fixtures
- PHH (Poker Hand History) replay utilities
"""

from .deck import SeededDeck, create_deterministic_deck
from .users import create_test_user, create_test_users, create_admin_user
from .templates import create_variant_template, VARIANT_CONFIGS
from .tables import create_test_table, create_multiway_table
from .hands import create_simple_hand, create_complex_hand

__all__ = [
    "SeededDeck",
    "create_deterministic_deck",
    "create_test_user",
    "create_test_users",
    "create_admin_user",
    "create_variant_template",
    "VARIANT_CONFIGS",
    "create_test_table",
    "create_multiway_table",
    "create_simple_hand",
    "create_complex_hand",
]
