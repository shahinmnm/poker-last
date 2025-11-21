"""Add is_sitting_out_next_hand column to seats table."""

from alembic import op
import sqlalchemy as sa

revision = "009_add_seat_sitout_flag"
down_revision = "008_add_expired_table_status"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "seats",
        sa.Column(
            "is_sitting_out_next_hand",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade():
    op.drop_column("seats", "is_sitting_out_next_hand")
