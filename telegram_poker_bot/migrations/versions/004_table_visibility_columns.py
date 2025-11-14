"""Add explicit table visibility columns.

Revision ID: 004_table_visibility_columns
Revises: 003_lowercase_group_game_invite_status
Create Date: 2024-07-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = "004_table_visibility_columns"
down_revision = "003_lowercase_invite_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tables",
        sa.Column("creator_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tables",
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.create_foreign_key(
        "fk_tables_creator_user_id_users",
        "tables",
        "users",
        ["creator_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_tables_creator_user_id",
        "tables",
        ["creator_user_id"],
    )
    op.create_index(
        "ix_tables_is_public_status",
        "tables",
        ["is_public", "status"],
    )

    bind = op.get_bind()

    # Populate creator_user_id from existing config_json payloads
    bind.execute(
        text(
            """
            UPDATE tables
            SET creator_user_id = (config_json ->> 'creator_user_id')::integer
            WHERE config_json ? 'creator_user_id'
            """
        )
    )

    # Normalize visibility
    bind.execute(
        text(
            """
            UPDATE tables
            SET is_public = CASE
                WHEN config_json ? 'visibility' THEN
                    CASE
                        WHEN lower(config_json ->> 'visibility') = 'private' THEN FALSE
                        ELSE TRUE
                    END
                WHEN config_json ? 'is_private' THEN
                    CASE
                        WHEN lower(config_json ->> 'is_private') IN ('true', '1', 'yes', 'y', 'private') THEN FALSE
                        ELSE TRUE
                    END
                ELSE TRUE
            END
            """
        )
    )

    # Ensure JSON metadata remains consistent for new columns
    bind.execute(
        text(
            """
            UPDATE tables
            SET config_json = jsonb_set(
                jsonb_set(
                    COALESCE(config_json, '{}'::jsonb),
                    '{visibility}',
                    CASE WHEN is_public THEN '"public"'::jsonb ELSE '"private"'::jsonb END,
                    true
                ),
                '{is_private}',
                CASE WHEN is_public THEN 'false'::jsonb ELSE 'true'::jsonb END,
                true
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_tables_is_public_status", table_name="tables")
    op.drop_index("ix_tables_creator_user_id", table_name="tables")
    op.drop_constraint("fk_tables_creator_user_id_users", "tables", type_="foreignkey")
    op.drop_column("tables", "is_public")
    op.drop_column("tables", "creator_user_id")
