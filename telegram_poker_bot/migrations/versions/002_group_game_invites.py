"""Add group game invite table for deep-link sharing."""

# revision identifiers, used by Alembic.
revision = "002_group_game_invites"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade():
    group_invite_status = postgresql.ENUM(
        "PENDING",
        "READY",
        "CONSUMED",
        "EXPIRED",
        name="groupgameinvitestatus",
        create_type=False,
    )
    group_invite_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "group_game_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.String(length=64), nullable=False),
        sa.Column("creator_user_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("status", group_invite_status, nullable=False, server_default="PENDING"),
        sa.Column("deep_link", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.ForeignKeyConstraint(["creator_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id"),
    )

    op.create_index(
        "idx_group_invites_status_expires",
        "group_game_invites",
        ["status", "expires_at"],
    )
    op.create_index(
        op.f("ix_group_game_invites_id"),
        "group_game_invites",
        ["id"],
        unique=False,
    )
    op.create_index(
        "idx_group_game_invites_creator",
        "group_game_invites",
        ["creator_user_id"],
    )
    op.create_index(
        "idx_group_game_invites_group",
        "group_game_invites",
        ["group_id"],
    )
    op.create_index(
        "idx_group_game_invites_game_id",
        "group_game_invites",
        ["game_id"],
    )


def downgrade():
    op.drop_index("idx_group_game_invites_game_id", table_name="group_game_invites")
    op.drop_index("idx_group_game_invites_group", table_name="group_game_invites")
    op.drop_index("idx_group_game_invites_creator", table_name="group_game_invites")
    op.drop_index("idx_group_invites_status_expires", table_name="group_game_invites")
    op.drop_index(op.f("ix_group_game_invites_id"), table_name="group_game_invites")
    op.drop_table("group_game_invites")
    op.execute("DROP TYPE IF EXISTS groupgameinvitestatus")
