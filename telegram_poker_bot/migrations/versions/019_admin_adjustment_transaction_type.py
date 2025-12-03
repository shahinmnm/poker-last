"""Add admin_adjustment to transactiontype enum.

Revision ID: 019_admin_adjustment_transaction_type
Revises: 018_dual_currency_support
Create Date: 2025-03-07 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "019_admin_adjustment_transaction_type"
down_revision = "018_dual_currency_support"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'admin_adjustment';")


def downgrade() -> None:
    # Cannot safely remove enum value in PostgreSQL without recreating the type.
    pass
