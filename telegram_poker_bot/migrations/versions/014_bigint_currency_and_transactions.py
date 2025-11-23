"""Convert money columns to BigInteger and enhance Transaction model.

Revision ID: 014_bigint_currency_and_transactions
Revises: 013_add_user_poker_stats
Create Date: 2025-01-23 16:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "014_bigint_currency_and_transactions"
down_revision = "013_add_user_poker_stats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Upgrade schema to use BigInteger for all money/chip columns.
    Enhance Transaction model with proper ledger system fields.
    """
    # 1. Convert Seat.chips from Integer to BigInteger
    op.alter_column(
        "seats",
        "chips",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    # 2. Convert Action.amount from Integer to BigInteger
    op.alter_column(
        "actions",
        "amount",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    # 3. Convert Pot.size from Integer to BigInteger
    op.alter_column(
        "pots",
        "size",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    # 4. Convert HandHistoryEvent.amount from Integer to BigInteger
    op.alter_column(
        "hand_history_events",
        "amount",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=True,
    )

    # 5. Convert HandHistoryEvent.pot_size from Integer to BigInteger
    op.alter_column(
        "hand_history_events",
        "pot_size",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    # 6. Convert Wallet.balance from Integer to BigInteger
    op.alter_column(
        "wallets",
        "balance",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    # 7. Convert UserPokerStats.total_winnings from Integer to BigInteger
    op.alter_column(
        "user_poker_stats",
        "total_winnings",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    # 8. Drop old transactions table
    op.drop_table("transactions")

    # 9. Create TransactionType enum (idempotent for reruns)
    transaction_type_enum = postgresql.ENUM(
        "deposit",
        "withdrawal",
        "buy_in",
        "cash_out",
        "game_win",
        "game_payout",
        "rake",
        name="transactiontype",
        create_type=False,
    )
    transaction_type_enum.create(op.get_bind(), checkfirst=True)

    # 10. Create new transactions table with enhanced schema
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=True,  # Nullable for system transactions (rake)
        ),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("balance_after", sa.BigInteger(), nullable=False),
        sa.Column(
            "type",
            transaction_type_enum,
            nullable=False,
        ),
        sa.Column("reference_id", sa.String(length=255), nullable=True),
        sa.Column(
            "metadata_json", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_transactions_user_created",
        "transactions",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema back to Integer columns."""
    # Drop new transactions table and enum
    op.drop_index("idx_transactions_user_created", table_name="transactions")
    op.drop_table("transactions")
    op.execute("DROP TYPE IF EXISTS transactiontype")

    # Recreate old transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="pending"
        ),
        sa.Column(
            "metadata_json", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_transactions_user_created",
        "transactions",
        ["user_id", "created_at"],
        unique=False,
    )

    # Convert BigInteger columns back to Integer
    op.alter_column(
        "user_poker_stats",
        "total_winnings",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    op.alter_column(
        "wallets",
        "balance",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    op.alter_column(
        "hand_history_events",
        "pot_size",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    op.alter_column(
        "hand_history_events",
        "amount",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=True,
    )

    op.alter_column(
        "pots",
        "size",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    op.alter_column(
        "actions",
        "amount",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    op.alter_column(
        "seats",
        "chips",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )
