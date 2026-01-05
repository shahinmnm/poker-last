"""Add preferred currency to users.

Revision ID: 030_add_user_preferences
Revises: 029_canonicalize_auto_create
Create Date: 2026-01-06
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "030_add_user_preferences"
down_revision = "029_canonicalize_auto_create"
branch_labels = None
depends_on = None


def upgrade() -> None:
    currency_enum = sa.Enum("REAL", "PLAY", name="currencytype")
    op.add_column(
        "users",
        sa.Column(
            "preferred_currency",
            currency_enum,
            nullable=False,
            server_default="REAL",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_currency")
