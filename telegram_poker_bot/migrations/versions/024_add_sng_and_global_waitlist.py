"""Add SNG state and global waitlist support

Revision ID: 024_add_sng_and_global_waitlist
Revises: 023_add_analytics_tables
Create Date: 2024-12-04 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '024_add_sng_and_global_waitlist'
down_revision = '023_add_analytics_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create SNG state enum
    sngstate_enum = postgresql.ENUM(
        'waiting', 'join_window', 'ready', 'active', 'completed',
        name='sngstate',
        create_type=True
    )
    sngstate_enum.create(op.get_bind(), checkfirst=True)
    
    # Add SNG fields to tables
    op.add_column('tables', sa.Column('sng_state', sngstate_enum, nullable=True))
    op.add_column('tables', sa.Column(
        'sng_join_window_started_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.create_index('idx_tables_sng_state', 'tables', ['sng_state'])
    
    # Create global waitlist table
    op.create_table(
        'global_waitlist_entries',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), nullable=False, index=True),
        sa.Column('game_variant', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('status', postgresql.ENUM(
            'waiting', 'entered', 'cancelled',
            name='waitliststatus',
            create_type=False  # Already exists from previous migration
        ), nullable=False, server_default='waiting'),
        sa.Column('routed_table_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['routed_table_id'], ['tables.id'], ondelete='SET NULL'),
    )
    
    # Create indexes for global waitlist
    op.create_index(
        'idx_global_waitlist_user_status',
        'global_waitlist_entries',
        ['user_id', 'status']
    )
    op.create_index(
        'idx_global_waitlist_variant_status',
        'global_waitlist_entries',
        ['game_variant', 'status']
    )
    op.create_index(
        'idx_global_waitlist_created',
        'global_waitlist_entries',
        ['created_at']
    )


def downgrade() -> None:
    # Drop global waitlist table and indexes
    op.drop_index('idx_global_waitlist_created', 'global_waitlist_entries')
    op.drop_index('idx_global_waitlist_variant_status', 'global_waitlist_entries')
    op.drop_index('idx_global_waitlist_user_status', 'global_waitlist_entries')
    op.drop_table('global_waitlist_entries')
    
    # Drop SNG fields from tables
    op.drop_index('idx_tables_sng_state', 'tables')
    op.drop_column('tables', 'sng_join_window_started_at')
    op.drop_column('tables', 'sng_state')
    
    # Drop SNG state enum
    sa.Enum(name='sngstate').drop(op.get_bind(), checkfirst=True)
