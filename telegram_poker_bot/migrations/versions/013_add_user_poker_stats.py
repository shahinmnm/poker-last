"""Add user_poker_stats table and GIN index for board_cards.

Revision ID: 013_add_user_poker_stats
Revises: 012_add_timeout_tracking
Create Date: 2025-01-23 15:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "013_add_user_poker_stats"
down_revision = "012_add_timeout_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add user_poker_stats table for aggregated statistics.
    Add GIN index for board_cards JSONB field in hand_history_events.
    """
    # Create user_poker_stats table
    op.create_table(
        "user_poker_stats",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("total_hands", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("vpip_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pfr_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_winnings", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_hand_rank", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "idx_user_poker_stats_user_id",
        "user_poker_stats",
        ["user_id"],
        unique=False,
    )

    # Add GIN index for board_cards JSONB field in hand_history_events
    # GIN (Generalized Inverted Index) is optimized for JSONB queries
    op.execute(
        """
        CREATE INDEX idx_hand_history_board_cards 
        ON hand_history_events USING GIN (board_cards)
        """
    )


def downgrade() -> None:
    """Remove user_poker_stats table and GIN index."""
    # Drop GIN index
    op.drop_index("idx_hand_history_board_cards", table_name="hand_history_events")

    # Drop user_poker_stats table
    op.drop_index("idx_user_poker_stats_user_id", table_name="user_poker_stats")
    op.drop_table("user_poker_stats")
