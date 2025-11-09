"""Initial database migration - create all tables."""

# revision identifiers, used by Alembic.
revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tg_user_id', sa.BigInteger(), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='en'),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('stats_blob', sa.JSON(), nullable=True, server_default='{}'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_users_tg_user_id', 'users', ['tg_user_id'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # Groups table
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tg_chat_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('settings_json', sa.JSON(), nullable=True, server_default='{}'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_groups_tg_chat_id', 'groups', ['tg_chat_id'], unique=True)
    op.create_index(op.f('ix_groups_id'), 'groups', ['id'], unique=False)

    # Tables table
    op.create_table(
        'tables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mode', sa.Enum('ANONYMOUS', 'GROUP', name='gamemode'), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('WAITING', 'ACTIVE', 'PAUSED', 'ENDED', name='tablestatus'), nullable=False, server_default='WAITING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('config_json', sa.JSON(), nullable=True, server_default='{}'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_tables_mode_status', 'tables', ['mode', 'status'])
    op.create_index(op.f('ix_tables_id'), 'tables', ['id'], unique=False)

    # Seats table
    op.create_table(
        'seats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('chips', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_seats_table_user', 'seats', ['table_id', 'user_id'])
    op.create_index('idx_seats_table_position', 'seats', ['table_id', 'position'])
    op.create_index(op.f('ix_seats_id'), 'seats', ['id'], unique=False)

    # Hands table
    op.create_table(
        'hands',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=False),
        sa.Column('hand_no', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'ENDED', name='handstatus'), nullable=False, server_default='PREFLOP'),
        sa.Column('engine_state_json', sa.JSON(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_hands_table_hand_no', 'hands', ['table_id', 'hand_no'])
    op.create_index(op.f('ix_hands_id'), 'hands', ['id'], unique=False)

    # Actions table
    op.create_table(
        'actions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hand_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN', name='actiontype'), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hand_id'], ['hands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_actions_hand_created', 'actions', ['hand_id', 'created_at'])
    op.create_index(op.f('ix_actions_id'), 'actions', ['id'], unique=False)

    # Pots table
    op.create_table(
        'pots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hand_id', sa.Integer(), nullable=False),
        sa.Column('pot_index', sa.Integer(), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['hand_id'], ['hands.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_pots_hand_index', 'pots', ['hand_id', 'pot_index'])
    op.create_index(op.f('ix_pots_id'), 'pots', ['id'], unique=False)

    # Messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=False),
        sa.Column('tg_chat_id', sa.BigInteger(), nullable=False),
        sa.Column('tg_message_id', sa.Integer(), nullable=False),
        sa.Column('anchor', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_messages_table_chat', 'messages', ['table_id', 'tg_chat_id'])
    op.create_index('idx_messages_chat_message', 'messages', ['tg_chat_id', 'tg_message_id'])
    op.create_index(op.f('ix_messages_id'), 'messages', ['id'], unique=False)

    # Wallet tables (placeholder for future feature)
    op.create_table(
        'wallets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('balance', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_wallets_id'), 'wallets', ['id'], unique=False)
    op.create_index(op.f('ix_wallets_user_id'), 'wallets', ['user_id'], unique=False)

    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('metadata_json', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_transactions_user_created', 'transactions', ['user_id', 'created_at'])
    op.create_index(op.f('ix_transactions_id'), 'transactions', ['id'], unique=False)


def downgrade():
    op.drop_table('transactions')
    op.drop_table('wallets')
    op.drop_table('messages')
    op.drop_table('pots')
    op.drop_table('actions')
    op.drop_table('hands')
    op.drop_table('seats')
    op.drop_table('tables')
    op.drop_table('groups')
    op.drop_table('users')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS actiontype')
    op.execute('DROP TYPE IF EXISTS handstatus')
    op.execute('DROP TYPE IF EXISTS tablestatus')
    op.execute('DROP TYPE IF EXISTS gamemode')
