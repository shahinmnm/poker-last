"""Add last_action_at column to tables.

Revision ID: 007_table_last_action_timestamp
Revises: 006_table_expiration_and_invite
Create Date: 2025-11-17 00:00:00.000000

Adds a timestamp for the most recent player/table activity.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = "007_table_last_action_timestamp"
down_revision = "006_table_expiration_and_invite"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add last_action_at column and populate existing rows."""
    bind = op.get_bind()

    op.add_column(
        "tables",
        sa.Column(
            "last_action_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_tables_last_action_at",
        "tables",
        ["last_action_at"],
    )

    # Backfill existing rows so analytics and ordering logic work consistently
    bind.execute(
        text(
            """
            UPDATE tables
            SET last_action_at = COALESCE(updated_at, created_at)
            WHERE last_action_at IS NULL
            """
        )
    )


def downgrade() -> None:
    """Remove last_action_at column."""
    op.drop_index("ix_tables_last_action_at", table_name="tables")
    op.drop_column("tables", "last_action_at")
