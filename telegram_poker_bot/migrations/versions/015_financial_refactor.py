"""Extend financial models with bigint columns and ledger links.

Revision ID: 015_financial_refactor
Revises: 014_bigint_currency_transactions
Create Date: 2025-02-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "015_financial_refactor"
down_revision = "014_bigint_currency_transactions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # User balance for direct ledger reporting
    op.add_column(
        "users",
        sa.Column(
            "balance",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )

    # Minimum buy-in stored as bigint
    op.add_column(
        "tables",
        sa.Column(
            "min_buy_in",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )

    # Persist pot size for auditing
    op.add_column(
        "hands",
        sa.Column("pot_size", sa.BigInteger(), nullable=False, server_default="0"),
    )

    # Relax balance_after and link transactions to tables/hands
    op.alter_column(
        "transactions",
        "balance_after",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    op.add_column(
        "transactions",
        sa.Column("table_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("hand_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_table_id_tables",
        "transactions",
        "tables",
        ["table_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_transactions_hand_id_hands",
        "transactions",
        "hands",
        ["hand_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_hand_id_hands", "transactions", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_transactions_table_id_tables", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "hand_id")
    op.drop_column("transactions", "table_id")
    op.alter_column(
        "transactions",
        "balance_after",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
    op.drop_column("hands", "pot_size")
    op.drop_column("tables", "min_buy_in")
    op.drop_column("users", "balance")
