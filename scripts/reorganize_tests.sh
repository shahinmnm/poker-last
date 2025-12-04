#!/bin/bash
# Phase 6 Test Suite Reorganization Script
#
# This script reorganizes the test suite according to the Phase 6 plan.
# It creates new directory structure and moves tests to appropriate locations.

set -e

echo "Phase 6: Test Suite Reorganization"
echo "==================================="
echo

# Base directory
TEST_DIR="telegram_poker_bot/tests"

# Create new directory structure
echo "Creating new directory structure..."
mkdir -p "$TEST_DIR/backend"
mkdir -p "$TEST_DIR/runtime"
mkdir -p "$TEST_DIR/flows"
mkdir -p "$TEST_DIR/api"
mkdir -p "$TEST_DIR/integration"
mkdir -p "$TEST_DIR/utilities"
mkdir -p "$TEST_DIR/websocket"

# Create __init__.py files
touch "$TEST_DIR/backend/__init__.py"
touch "$TEST_DIR/runtime/__init__.py"
touch "$TEST_DIR/flows/__init__.py"
touch "$TEST_DIR/api/__init__.py"
touch "$TEST_DIR/integration/__init__.py"
touch "$TEST_DIR/utilities/__init__.py"
touch "$TEST_DIR/websocket/__init__.py"

echo "✓ Directory structure created"
echo

# Move backend tests (Phase 1-4)
echo "Moving backend tests..."
mv -v "$TEST_DIR/test_table_lifecycle.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_persistent_tables.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_waitlist.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_analytics.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_analytics_api.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_admin_analytics_api.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_admin_insights_api.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_insights.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_engine_adapter.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_config.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_stats_processor.py" "$TEST_DIR/backend/" 2>/dev/null || true
mv -v "$TEST_DIR/test_avatar_service.py" "$TEST_DIR/backend/" 2>/dev/null || true

echo "✓ Backend tests moved"
echo

# Move runtime tests
echo "Moving runtime tests..."
mv -v "$TEST_DIR/test_persistence.py" "$TEST_DIR/runtime/" 2>/dev/null || true
mv -v "$TEST_DIR/test_pokerkit_concurrency.py" "$TEST_DIR/runtime/" 2>/dev/null || true
mv -v "$TEST_DIR/test_pokerkit_end_to_end_runtime.py" "$TEST_DIR/runtime/" 2>/dev/null || true
mv -v "$TEST_DIR/test_pokerkit_runtime_refresh.py" "$TEST_DIR/runtime/" 2>/dev/null || true
mv -v "$TEST_DIR/test_pokerkit_adapter.py" "$TEST_DIR/runtime/" 2>/dev/null || true
mv -v "$TEST_DIR/test_sitout.py" "$TEST_DIR/runtime/" 2>/dev/null || true
mv -v "$TEST_DIR/test_multiworker_safety.py" "$TEST_DIR/runtime/" 2>/dev/null || true

echo "✓ Runtime tests moved"
echo

# Move flow tests
echo "Moving flow tests..."
mv -v "$TEST_DIR/test_hand_completion_refactor.py" "$TEST_DIR/flows/" 2>/dev/null || true
mv -v "$TEST_DIR/test_inter_hand_deadline_broadcast.py" "$TEST_DIR/flows/" 2>/dev/null || true
mv -v "$TEST_DIR/test_inter_hand_hand_no_increment.py" "$TEST_DIR/flows/" 2>/dev/null || true
mv -v "$TEST_DIR/test_inter_hand_ready_phase.py" "$TEST_DIR/flows/" 2>/dev/null || true
mv -v "$TEST_DIR/test_street_progression.py" "$TEST_DIR/flows/" 2>/dev/null || true

echo "✓ Flow tests moved"
echo

# Move API tests
echo "Moving API tests..."
mv -v "$TEST_DIR/test_api_mounting.py" "$TEST_DIR/api/" 2>/dev/null || true
mv -v "$TEST_DIR/test_bot_webhook.py" "$TEST_DIR/api/" 2>/dev/null || true
mv -v "$TEST_DIR/test_my_tables_endpoint.py" "$TEST_DIR/api/" 2>/dev/null || true
mv -v "$TEST_DIR/test_table_status_endpoint.py" "$TEST_DIR/api/" 2>/dev/null || true

echo "✓ API tests moved"
echo

# Move integration tests
echo "Moving integration tests..."
mv -v "$TEST_DIR/test_integration.py" "$TEST_DIR/integration/" 2>/dev/null || true
mv -v "$TEST_DIR/test_group_invite_db_insert.py" "$TEST_DIR/integration/" 2>/dev/null || true
mv -v "$TEST_DIR/test_group_invite_flow.py" "$TEST_DIR/integration/" 2>/dev/null || true
mv -v "$TEST_DIR/test_group_invite_status.py" "$TEST_DIR/integration/" 2>/dev/null || true
mv -v "$TEST_DIR/test_table_visibility.py" "$TEST_DIR/integration/" 2>/dev/null || true
mv -v "$TEST_DIR/test_new_bot_handlers.py" "$TEST_DIR/integration/" 2>/dev/null || true

echo "✓ Integration tests moved"
echo

# Move utility tests
echo "Moving utility tests..."
mv -v "$TEST_DIR/test_invite_tokens.py" "$TEST_DIR/utilities/" 2>/dev/null || true
mv -v "$TEST_DIR/test_wallet_initial_balance.py" "$TEST_DIR/utilities/" 2>/dev/null || true

echo "✓ Utility tests moved"
echo

# List any remaining tests in root
echo
echo "Remaining tests in root directory:"
ls -1 "$TEST_DIR"/test_*.py 2>/dev/null || echo "(none)"
echo

echo "✓ Test suite reorganization complete!"
echo
echo "Next steps:"
echo "1. Run: pytest telegram_poker_bot/tests/ --collect-only"
echo "2. Review test discovery output"
echo "3. Fix any import errors"
echo "4. Run: pytest telegram_poker_bot/tests/ -v"
echo "5. Address failing tests according to PHASE_6_TEST_PLAN.md"
