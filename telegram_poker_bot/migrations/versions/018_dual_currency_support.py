"""Add dual-currency balances and currency typing.

Revision ID: 018_dual_currency_support
Revises: 017_persistent_tables
Create Date: 2025-03-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "018_dual_currency_support"
down_revision = "017_persistent_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    currency_enum = sa.Enum("REAL", "PLAY", name="currencytype")
    currency_enum.create(op.get_bind(), checkfirst=True)

    # Rename existing balance to balance_real and add balance_play
    op.alter_column(
        "users",
        "balance",
        new_column_name="balance_real",
        existing_type=sa.BigInteger(),
        existing_nullable=False,
        existing_server_default=sa.text("0"),
    )
    op.add_column(
        "users",
        sa.Column(
            "balance_play",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("100000"),
        ),
    )

    # Table currency flag
    op.add_column(
        "tables",
        sa.Column(
            "currency_type",
            currency_enum,
            nullable=False,
            server_default="REAL",
        ),
    )

    # Transaction currency flag
    op.add_column(
        "transactions",
        sa.Column(
            "currency_type",
            currency_enum,
            nullable=False,
            server_default="REAL",
        ),
    )


def downgrade() -> None:
    op.drop_column("transactions", "currency_type")
    op.drop_column("tables", "currency_type")
    op.drop_column("users", "balance_play")
    op.alter_column(
        "users",
        "balance_real",
        new_column_name="balance",
        existing_type=sa.BigInteger(),
        existing_nullable=False,
        existing_server_default=sa.text("0"),
    )

    sa.Enum(name="currencytype").drop(op.get_bind(), checkfirst=True)
