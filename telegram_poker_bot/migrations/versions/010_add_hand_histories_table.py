"""Add hand_histories table for hand history persistence."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "010_add_hand_histories_table"
down_revision = "009_add_seat_sitout_flag"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hand_histories",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "table_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("hand_no", sa.Integer(), nullable=False),
        sa.Column("payload_json", JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    
    op.create_index(
        "idx_hand_histories_table_hand",
        "hand_histories",
        ["table_id", "hand_no"],
        unique=True,
    )


def downgrade():
    op.drop_index("idx_hand_histories_table_hand", table_name="hand_histories")
    op.drop_table("hand_histories")
