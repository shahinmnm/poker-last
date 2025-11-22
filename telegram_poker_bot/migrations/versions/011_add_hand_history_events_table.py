"""Compatibility shim for renamed hand history events migration."""

revision = "011_add_hand_history_events_table"
down_revision = "010_add_hand_histories_table"
branch_labels = None
depends_on = None


def upgrade():
    # This migration previously created the hand_history_events table. It now
    # serves as a compatibility placeholder so databases stamped at this
    # revision can continue upgrading to newer revisions without errors.
    pass


def downgrade():
    # No changes were applied in this compatibility shim.
    pass
