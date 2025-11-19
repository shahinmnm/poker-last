"""Normalize groupgameinvitestatus enum values to lowercase."""

# revision identifiers, used by Alembic.
revision = "003_lowercase_invite_status"
down_revision = "002_group_game_invites"
branch_labels = None
depends_on = None

from alembic import op


def upgrade():
    op.execute("ALTER TYPE groupgameinvitestatus RENAME TO groupgameinvitestatus_old")
    op.execute(
        "CREATE TYPE groupgameinvitestatus AS ENUM ('pending', 'ready', 'consumed', 'expired')"
    )
    op.execute("ALTER TABLE group_game_invites ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE group_game_invites "
        "ALTER COLUMN status TYPE groupgameinvitestatus "
        "USING lower(status::text)::groupgameinvitestatus"
    )
    op.execute("ALTER TABLE group_game_invites ALTER COLUMN status SET DEFAULT 'pending'")
    op.execute("DROP TYPE groupgameinvitestatus_old")


def downgrade():
    op.execute("ALTER TYPE groupgameinvitestatus RENAME TO groupgameinvitestatus_lower")
    op.execute(
        "CREATE TYPE groupgameinvitestatus AS ENUM ('PENDING', 'READY', 'CONSUMED', 'EXPIRED')"
    )
    op.execute("ALTER TABLE group_game_invites ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE group_game_invites "
        "ALTER COLUMN status TYPE groupgameinvitestatus "
        "USING upper(status::text)::groupgameinvitestatus"
    )
    op.execute("ALTER TABLE group_game_invites ALTER COLUMN status SET DEFAULT 'PENDING'")
    op.execute("DROP TYPE groupgameinvitestatus_lower")
