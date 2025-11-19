"""Add indexes to accelerate lobby and active table lookups."""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005_active_table_indexes"
down_revision = "004_table_visibility_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_tables_status_created_at",
        "tables",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_seats_user_left_at",
        "seats",
        ["user_id", "left_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_seats_user_left_at", table_name="seats")
    op.drop_index("ix_tables_status_created_at", table_name="tables")
