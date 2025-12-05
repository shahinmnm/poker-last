"""Migrate table templates to UUID primary keys and add ui schema metadata.

Revision ID: 027_template_ui_schema
Revises: 026_phase4_jwt_auth
Create Date: 2025-03-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "027_template_ui_schema"
down_revision = "026_phase4_jwt_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # Expand enum for new template categories
    op.execute("ALTER TYPE tabletemplatetype ADD VALUE IF NOT EXISTS 'CASH_GAME'")
    op.execute("ALTER TYPE tabletemplatetype ADD VALUE IF NOT EXISTS 'TOURNAMENT'")

    # Add new UUID primary key + metadata to table_templates
    op.add_column(
        "table_templates",
        sa.Column(
            "legacy_id",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.add_column(
        "table_templates",
        sa.Column(
            "id_new",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )
    op.add_column(
        "table_templates",
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.execute("UPDATE table_templates SET legacy_id = id WHERE legacy_id IS NULL")
    op.execute("UPDATE table_templates SET id_new = gen_random_uuid() WHERE id_new IS NULL")

    # Add new FK columns to dependent tables
    op.add_column(
        "tables",
        sa.Column(
            "template_id_new",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "hand_analytics",
        sa.Column(
            "template_id_new",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "player_sessions",
        sa.Column(
            "template_id_new",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Populate new template_id columns
    op.execute(
        """
        UPDATE tables t
        SET template_id_new = tt.id_new
        FROM table_templates tt
        WHERE t.template_id = tt.id
        """
    )
    op.execute(
        """
        UPDATE hand_analytics ha
        SET template_id_new = tt.id_new
        FROM table_templates tt
        WHERE ha.template_id = tt.id
        """
    )
    op.execute(
        """
        UPDATE player_sessions ps
        SET template_id_new = tt.id_new
        FROM table_templates tt
        WHERE ps.template_id = tt.id
        """
    )

    # Drop old constraints/indexes on integer template ids
    op.drop_constraint("fk_tables_template_id_table_templates", "tables", type_="foreignkey")
    op.execute("ALTER TABLE hand_analytics DROP CONSTRAINT IF EXISTS hand_analytics_template_id_fkey")
    op.execute("ALTER TABLE player_sessions DROP CONSTRAINT IF EXISTS player_sessions_template_id_fkey")
    op.drop_index("ix_tables_template_id", table_name="tables")
    op.drop_index("idx_hand_analytics_template", table_name="hand_analytics")
    op.drop_index("idx_player_sessions_template", table_name="player_sessions")

    # Remove old integer columns
    op.drop_column("tables", "template_id")
    op.drop_column("hand_analytics", "template_id")
    op.drop_column("player_sessions", "template_id")

    # Replace primary key on table_templates
    op.drop_constraint("table_templates_pkey", "table_templates", type_="primary")
    op.drop_column("table_templates", "id")
    op.alter_column("table_templates", "id_new", new_column_name="id")
    op.create_primary_key("table_templates_pkey", "table_templates", ["id"])

    # Rename new FK columns, recreate indexes and constraints
    op.alter_column(
        "tables",
        "template_id_new",
        new_column_name="template_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_index("ix_tables_template_id", "tables", ["template_id"])
    op.create_foreign_key(
        "fk_tables_template_id_table_templates",
        "tables",
        "table_templates",
        ["template_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.alter_column(
        "hand_analytics",
        "template_id_new",
        new_column_name="template_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.create_index("idx_hand_analytics_template", "hand_analytics", ["template_id"])
    op.create_foreign_key(
        "hand_analytics_template_id_fkey",
        "hand_analytics",
        "table_templates",
        ["template_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.alter_column(
        "player_sessions",
        "template_id_new",
        new_column_name="template_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.create_index("idx_player_sessions_template", "player_sessions", ["template_id"])
    op.create_foreign_key(
        "player_sessions_template_id_fkey",
        "player_sessions",
        "table_templates",
        ["template_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    # Full downgrade would require reversing UUID PK migration; not supported.
    raise NotImplementedError("Downgrade is not supported for 027_template_ui_schema")
