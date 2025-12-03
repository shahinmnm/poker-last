"""Add referral fields and promo code tables.

Revision ID: 020_referrals_promos
Revises: 019_admin_adjust_tx_type
Create Date: 2025-03-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "020_referrals_promos"
down_revision = "019_admin_adjust_tx_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "referrer_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("referral_code", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_users_referrer_id"), "users", ["referrer_id"], unique=False
    )
    op.create_index(
        op.f("ix_users_referral_code"), "users", ["referral_code"], unique=True
    )

    currency_enum = sa.Enum(
        "REAL",
        "PLAY",
        name="currencytype",
    )

    op.create_table(
        "promo_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False, unique=True),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency_type", currency_enum, nullable=False, server_default="REAL"),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("current_uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index(op.f("ix_promo_codes_code"), "promo_codes", ["code"], unique=True)

    op.create_table(
        "referral_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("invited_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_earnings", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Backfill referral codes for existing users
    op.execute("UPDATE users SET referral_code = 'ref' || id WHERE referral_code IS NULL;")


def downgrade() -> None:
    op.drop_table("referral_stats")
    op.drop_index(op.f("ix_promo_codes_code"), table_name="promo_codes")
    op.drop_table("promo_codes")

    op.drop_index(op.f("ix_users_referral_code"), table_name="users")
    op.drop_index(op.f("ix_users_referrer_id"), table_name="users")
    op.drop_column("users", "referral_code")
    op.drop_column("users", "referrer_id")
