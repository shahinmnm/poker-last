"""Add analytics tables for periodic snapshots and hourly stats.

Revision ID: 023_add_analytics_tables
Revises: 022_add_waitlist_entries
Create Date: 2025-12-03 21:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "023_add_analytics_tables"
down_revision = "022_add_waitlist_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create table_snapshots table
    op.create_table(
        "table_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "table_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "snapshot_time",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("player_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(),
            nullable=True,
            server_default="{}",
        ),
    )

    # Create indexes for table_snapshots
    op.create_index("ix_table_snapshots_table_id", "table_snapshots", ["table_id"])
    op.create_index("ix_table_snapshots_snapshot_time", "table_snapshots", ["snapshot_time"])
    op.create_index(
        "idx_table_snapshots_table_time", "table_snapshots", ["table_id", "snapshot_time"]
    )
    op.create_index("idx_table_snapshots_time", "table_snapshots", ["snapshot_time"])

    # Create hourly_table_stats table
    op.create_table(
        "hourly_table_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "table_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "hour_start",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("avg_players", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_players", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_hands", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activity_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(),
            nullable=True,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create indexes for hourly_table_stats
    op.create_index("ix_hourly_table_stats_table_id", "hourly_table_stats", ["table_id"])
    op.create_index("ix_hourly_table_stats_hour_start", "hourly_table_stats", ["hour_start"])
    op.create_index(
        "idx_hourly_stats_table_hour",
        "hourly_table_stats",
        ["table_id", "hour_start"],
        unique=True,
    )
    op.create_index("idx_hourly_stats_hour", "hourly_table_stats", ["hour_start"])


def downgrade() -> None:
    # Drop hourly_table_stats indexes
    op.drop_index("idx_hourly_stats_hour", table_name="hourly_table_stats")
    op.drop_index("idx_hourly_stats_table_hour", table_name="hourly_table_stats")
    op.drop_index("ix_hourly_table_stats_hour_start", table_name="hourly_table_stats")
    op.drop_index("ix_hourly_table_stats_table_id", table_name="hourly_table_stats")

    # Drop hourly_table_stats table
    op.drop_table("hourly_table_stats")

    # Drop table_snapshots indexes
    op.drop_index("idx_table_snapshots_time", table_name="table_snapshots")
    op.drop_index("idx_table_snapshots_table_time", table_name="table_snapshots")
    op.drop_index("ix_table_snapshots_snapshot_time", table_name="table_snapshots")
    op.drop_index("ix_table_snapshots_table_id", table_name="table_snapshots")

    # Drop table_snapshots table
    op.drop_table("table_snapshots")
