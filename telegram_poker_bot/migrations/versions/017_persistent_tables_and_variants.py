"""Add persistent table flag and game variants.

Revision ID: 017_persistent_tables
Revises: 016_add_inter_hand_wait
Create Date: 2025-03-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "017_persistent_tables"
down_revision = "016_add_inter_hand_wait"
branch_labels = None
depends_on = None


def upgrade() -> None:
    gamevariant_enum = sa.Enum(
        "no_limit_texas_holdem",
        "no_limit_short_deck_holdem",
        name="gamevariant",
    )
    gamevariant_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "tables",
        sa.Column(
            "is_persistent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "tables",
        sa.Column(
            "game_variant",
            gamevariant_enum,
            nullable=False,
            server_default="no_limit_texas_holdem",
        ),
    )


def downgrade() -> None:
    op.drop_column("tables", "game_variant")
    op.drop_column("tables", "is_persistent")
    sa.Enum(name="gamevariant").drop(op.get_bind(), checkfirst=True)
