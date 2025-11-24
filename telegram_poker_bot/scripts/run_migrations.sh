#!/usr/bin/env bash
# Database migration runner with proper error handling and logging

set -euo pipefail

# Enable debug mode if DEBUG env var is set
if [ "${DEBUG:-}" = "1" ]; then
    set -x
fi

echo "========================================" 
echo "Starting database migrations"
echo "========================================"
echo "Database URL: ${DATABASE_URL:-not set}"
echo "Working directory: $(pwd)"
echo "Alembic config: telegram_poker_bot/alembic.ini"
echo "Max retry attempts: ${MIGRATION_MAX_ATTEMPTS:-30}"
echo "----------------------------------------"

# Wait for PostgreSQL to be truly ready (beyond health check)
echo "Waiting for PostgreSQL to be ready..."
max_attempts=${MIGRATION_MAX_ATTEMPTS:-30}
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if python -c "
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from telegram_poker_bot.shared.config import get_settings

async def check_db():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    try:
        async with engine.begin() as conn:
            await conn.execute(__import__('sqlalchemy').text('SELECT 1'))
        print('✓ Database connection successful', file=sys.stderr)
        return True
    except Exception as e:
        print(f'✗ Database connection failed: {e}', file=sys.stderr)
        return False
    finally:
        await engine.dispose()

sys.exit(0 if asyncio.run(check_db()) else 1)
" 2>&1; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    
    attempt=$((attempt + 1))
    if [ $attempt -lt $max_attempts ]; then
        echo "Database not ready yet (attempt $attempt/$max_attempts), waiting 2 seconds..."
        sleep 2
    else
        echo "❌ ERROR: Database did not become ready after $max_attempts attempts"
        exit 1
    fi
done

echo "----------------------------------------"
echo "Running Alembic migrations..."
echo "----------------------------------------"

# Run migrations with verbose output
if alembic -c telegram_poker_bot/alembic.ini upgrade head; then
    echo "----------------------------------------"
    echo "✅ Migrations completed successfully!"
    echo "----------------------------------------"
    
    # Verify tables were created
    echo "Verifying database schema..."
    python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from telegram_poker_bot.shared.config import get_settings

async def verify_schema():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text(
                \"\"\"
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
                \"\"\"
            ))
            tables = [row[0] for row in result]
            print(f'✓ Found {len(tables)} tables in database:')
            for table in tables:
                print(f'  - {table}')
            
            # Check for critical tables required for basic operation
            # - users: user accounts and authentication
            # - tables: poker game tables
            # - seats: tracks users seated at tables (replaces legacy table_participants)
            # - alembic_version: migration version tracking
            critical_tables = ['users', 'tables', 'seats', 'alembic_version']
            missing = [t for t in critical_tables if t not in tables]
            if missing:
                print(f'⚠ WARNING: Missing expected tables: {missing}')
                return False
            else:
                print('✓ All critical tables present')
                return True
    finally:
        await engine.dispose()

asyncio.run(verify_schema())
" 2>&1
    
    echo "========================================"
    echo "Migration process completed successfully"
    echo "========================================"
    exit 0
else
    echo "----------------------------------------"
    echo "❌ ERROR: Migrations failed!"
    echo "----------------------------------------"
    echo "This error means the database schema could not be created."
    echo "Please check the error messages above for details."
    echo ""
    echo "Common issues:"
    echo "  - Database connection string is incorrect"
    echo "  - PostgreSQL is not running or not accessible"
    echo "  - Migration files have syntax errors"
    echo "  - Database user lacks necessary permissions"
    echo "========================================"
    exit 1
fi
