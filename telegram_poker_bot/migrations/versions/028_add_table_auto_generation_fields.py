"""Add is_auto_generated and lobby_persistent columns to tables.

Revision ID: 028_add_table_auto_generation_fields
Revises: 027_template_ui_schema
Create Date: 2025-12-05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "028_add_table_auto_generation_fields"
down_revision = "027_template_ui_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_auto_generated and lobby_persistent columns to tables table."""
    # Add is_auto_generated column with default False
    op.add_column(
        "tables",
        sa.Column(
            "is_auto_generated",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    
    # Add lobby_persistent column with default False
    op.add_column(
        "tables",
        sa.Column(
            "lobby_persistent",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    
    # Create index for lobby_persistent to improve query performance
    op.create_index(
        "ix_tables_lobby_persistent",
        "tables",
        ["lobby_persistent"],
    )


def downgrade() -> None:
    """Remove is_auto_generated and lobby_persistent columns from tables table."""
    op.drop_index("ix_tables_lobby_persistent", table_name="tables")
    op.drop_column("tables", "lobby_persistent")
    op.drop_column("tables", "is_auto_generated")
