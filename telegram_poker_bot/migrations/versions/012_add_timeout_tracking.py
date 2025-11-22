"""Add timeout_tracking to hands table for consecutive timeout enforcement.

Revision ID: 012_add_timeout_tracking
Revises: 011_add_hand_history_events
Create Date: 2025-01-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '012_add_timeout_tracking'
down_revision = '011_add_hand_history_events'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add timeout_tracking JSONB field to hands table.
    
    This field tracks consecutive timeouts per player within a hand:
    {
        "user_id_1": {"count": 0, "last_timeout_at": "ISO8601"},
        "user_id_2": {"count": 1, "last_timeout_at": "ISO8601"}
    }
    
    Used for Rule C: consecutive timeout enforcement.
    """
    op.add_column(
        'hands',
        sa.Column(
            'timeout_tracking',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default='{}',
        )
    )


def downgrade() -> None:
    """Remove timeout_tracking field."""
    op.drop_column('hands', 'timeout_tracking')
