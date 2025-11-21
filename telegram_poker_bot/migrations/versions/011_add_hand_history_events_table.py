"""Add hand_history_events table for detailed action tracking."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "011_add_hand_history_events_table"
down_revision = "010_add_hand_histories_table"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hand_history_events",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "hand_id",
            sa.Integer(),
            sa.ForeignKey("hands.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "table_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("street", sa.String(20), nullable=False),
        sa.Column("action_type", sa.String(30), nullable=False),
        sa.Column(
            "actor_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("amount", sa.Integer(), nullable=True),
        sa.Column("pot_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("board_cards", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "idx_hand_events_hand_seq",
        "hand_history_events",
        ["hand_id", "sequence"],
    )

    op.create_index(
        "idx_hand_events_table",
        "hand_history_events",
        ["table_id"],
    )


def downgrade():
    op.drop_index("idx_hand_events_table", table_name="hand_history_events")
    op.drop_index("idx_hand_events_hand_seq", table_name="hand_history_events")
    op.drop_table("hand_history_events")
