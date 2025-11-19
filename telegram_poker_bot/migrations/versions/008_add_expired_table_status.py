"""Add expired status and normalize table status enum to lowercase."""

# revision identifiers, used by Alembic.
revision = "008_add_expired_table_status"
down_revision = "007_table_last_action_timestamp"
branch_labels = None
depends_on = None

from alembic import op



def upgrade():
    op.execute("ALTER TYPE tablestatus RENAME TO tablestatus_old")
    op.execute(
        "CREATE TYPE tablestatus AS ENUM ('waiting', 'active', 'paused', 'ended', 'expired')"
    )
    op.execute("ALTER TABLE tables ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE tables "
        "ALTER COLUMN status TYPE tablestatus "
        "USING lower(status::text)::tablestatus"
    )
    op.execute("ALTER TABLE tables ALTER COLUMN status SET DEFAULT 'waiting'")
    op.execute("DROP TYPE tablestatus_old")



def downgrade():
    op.execute("ALTER TYPE tablestatus RENAME TO tablestatus_lower")
    op.execute(
        "CREATE TYPE tablestatus AS ENUM ('WAITING', 'ACTIVE', 'PAUSED', 'ENDED')"
    )
    op.execute("ALTER TABLE tables ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE tables "
        "ALTER COLUMN status TYPE tablestatus "
        "USING upper(status::text)::tablestatus"
    )
    op.execute("ALTER TABLE tables ALTER COLUMN status SET DEFAULT 'WAITING'")
    op.execute("DROP TYPE tablestatus_lower")
