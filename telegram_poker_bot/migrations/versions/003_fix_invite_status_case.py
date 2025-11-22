"""Normalize group invite status enum casing to match ORM values."""

# revision identifiers, used by Alembic.
revision = "003_fix_invite_status_case"
down_revision = "002_group_game_invites"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


ENUM_NAME = "groupgameinvitestatus"
TABLE_NAME = "group_game_invites"
COLUMN_NAME = "status"


def upgrade():
    """Upgrade enum values to lowercase for consistency with application code."""
    # Drop the server default before renaming enum values to avoid invalid references.
    op.execute(
        sa.text(
            f'ALTER TABLE "{TABLE_NAME}" ALTER COLUMN "{COLUMN_NAME}" DROP DEFAULT'
        )
    )

    for old, new in (
        ("PENDING", "pending"),
        ("READY", "ready"),
        ("CONSUMED", "consumed"),
        ("EXPIRED", "expired"),
    ):
        op.execute(
            sa.text(
                f"ALTER TYPE {ENUM_NAME} RENAME VALUE '{old}' TO '{new}'"
            )
        )

    # Restore the server default using the new lowercase enum literal.
    op.execute(
        sa.text(
            f'ALTER TABLE "{TABLE_NAME}" ALTER COLUMN "{COLUMN_NAME}" '
            f"SET DEFAULT 'pending'::{ENUM_NAME}"
        )
    )


def downgrade():
    """Revert enum values back to uppercase (original deployment state)."""
    op.execute(
        sa.text(
            f'ALTER TABLE "{TABLE_NAME}" ALTER COLUMN "{COLUMN_NAME}" DROP DEFAULT'
        )
    )

    for new, old in (
        ("pending", "PENDING"),
        ("ready", "READY"),
        ("consumed", "CONSUMED"),
        ("expired", "EXPIRED"),
    ):
        op.execute(
            sa.text(
                f"ALTER TYPE {ENUM_NAME} RENAME VALUE '{new}' TO '{old}'"
            )
        )

    op.execute(
        sa.text(
            f'ALTER TABLE "{TABLE_NAME}" ALTER COLUMN "{COLUMN_NAME}" '
            f"SET DEFAULT 'PENDING'::{ENUM_NAME}"
        )
    )
