"""Add INTER_HAND_WAIT to handstatus enum.

Revision ID: 016_add_inter_hand_wait
Revises: 015_financial_refactor
Create Date: 2025-03-01 00:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "016_add_inter_hand_wait"
down_revision = "015_financial_refactor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE handstatus ADD VALUE IF NOT EXISTS 'INTER_HAND_WAIT';")


def downgrade() -> None:
    # Removing enum values is intentionally left as a no-op to avoid breaking history
    pass
