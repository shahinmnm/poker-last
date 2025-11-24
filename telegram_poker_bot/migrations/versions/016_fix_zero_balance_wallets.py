"""Fix zero balance wallets with initial balance from settings.

Revision ID: 016_fix_zero_balance_wallets
Revises: 015_financial_refactor
Create Date: 2025-11-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "016_fix_zero_balance_wallets"
down_revision = "015_financial_refactor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Fix existing wallets with zero balance.

    Sets balance to initial_balance_cents (default: 10000 cents = $100)
    for all wallets that currently have balance = 0.

    Note: The value 10000 represents $100.00 in cents (default INITIAL_BALANCE_USD=100.00)
    This is intentionally hardcoded to match the default setting at migration time.
    Migrations must be immutable and not depend on runtime configuration.
    """
    # Update all wallets with zero balance to have the initial balance
    # Default initial balance is $100.00 (10000 cents)
    op.execute(
        """
        UPDATE wallets 
        SET balance = 10000 
        WHERE balance = 0
    """
    )


def downgrade() -> None:
    """
    Downgrade: Set wallets back to zero balance.

    WARNING: This is a DESTRUCTIVE operation intended for development only.
    It will set ALL wallets with the default initial balance (10000) to zero,
    which may incorrectly affect wallets that legitimately have this balance
    from gameplay or other sources.

    In production, this downgrade should NOT be used. If you must rollback,
    restore from database backup instead.
    """
    op.execute(
        """
        UPDATE wallets 
        SET balance = 0 
        WHERE balance = 10000
    """
    )
