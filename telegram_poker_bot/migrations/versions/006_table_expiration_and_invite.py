"""Add table expiration and invite code fields.

Revision ID: 006_table_expiration_and_invite
Revises: 005_active_table_indexes
Create Date: 2025-11-16 00:00:00.000000

This migration adds:
- expires_at: Timestamp for when table should expire (10 minutes from creation)
- invite_code: Short code for sharing private tables (6-8 chars)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = "006_table_expiration_and_invite"
down_revision = "005_active_table_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add expires_at and invite_code columns to tables."""
    bind = op.get_bind()
    
    # Add expires_at column (nullable initially for existing tables)
    op.add_column(
        "tables",
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    
    # Add invite_code column for private tables
    op.add_column(
        "tables",
        sa.Column(
            "invite_code",
            sa.String(16),
            nullable=True,
        ),
    )
    
    # Create index on expires_at for efficient filtering
    op.create_index(
        "ix_tables_expires_at",
        "tables",
        ["expires_at"],
    )
    
    # Create unique index on invite_code (for lookups)
    op.create_index(
        "ix_tables_invite_code",
        "tables",
        ["invite_code"],
        unique=True,
    )
    
    # Backfill expires_at for existing tables (created_at + 10 minutes)
    # Only for non-ENDED tables (status enum values are uppercase)
    bind.execute(
        text(
            """
            UPDATE tables
            SET expires_at = created_at + INTERVAL '10 minutes'
            WHERE expires_at IS NULL
            AND status != 'ENDED'
            """
        )
    )


def downgrade() -> None:
    """Remove expires_at and invite_code columns."""
    op.drop_index("ix_tables_invite_code", table_name="tables")
    op.drop_index("ix_tables_expires_at", table_name="tables")
    op.drop_column("tables", "invite_code")
    op.drop_column("tables", "expires_at")
