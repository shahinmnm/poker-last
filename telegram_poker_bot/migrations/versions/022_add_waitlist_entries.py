"""Add waitlist_entries table for global waitlist system.

Revision ID: 022_add_waitlist_entries
Revises: 021_table_templates
Create Date: 2025-12-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "022_add_waitlist_entries"
down_revision = "021_table_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Create WaitlistStatus enum
    waitlist_status_enum = sa.Enum(
        "waiting",
        "entered",
        "cancelled",
        name="waitliststatus",
    )
    waitlist_status_enum.create(bind, checkfirst=True)

    # Create waitlist_entries table
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "table_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "status",
            waitlist_status_enum,
            nullable=False,
            server_default="waiting",
        ),
    )

    # Create indexes
    op.create_index(
        "idx_waitlist_table_status", "waitlist_entries", ["table_id", "status"]
    )
    op.create_index(
        "idx_waitlist_user_status", "waitlist_entries", ["user_id", "status"]
    )
    op.create_index(
        "idx_waitlist_table_created", "waitlist_entries", ["table_id", "created_at"]
    )
    op.create_index("ix_waitlist_entries_table_id", "waitlist_entries", ["table_id"])
    op.create_index("ix_waitlist_entries_user_id", "waitlist_entries", ["user_id"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_waitlist_entries_user_id", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_entries_table_id", table_name="waitlist_entries")
    op.drop_index("idx_waitlist_table_created", table_name="waitlist_entries")
    op.drop_index("idx_waitlist_user_status", table_name="waitlist_entries")
    op.drop_index("idx_waitlist_table_status", table_name="waitlist_entries")

    # Drop table
    op.drop_table("waitlist_entries")

    # Drop enum
    op.execute("DROP TYPE IF EXISTS waitliststatus")
