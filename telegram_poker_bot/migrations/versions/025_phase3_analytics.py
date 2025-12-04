"""Phase 3: Advanced Analytics Engine - Add analytics models

Revision ID: 025_phase3_analytics
Revises: 024_add_sng_and_global_waitlist
Create Date: 2024-12-04

Adds comprehensive analytics tables for Phase 3:
- HandAnalytics: Hand-level summaries
- PlayerSession: Session tracking
- HourlyPlayerStats: Player hourly aggregates
- LeaderboardSnapshot: Leaderboard history
- AnalyticsJob: Job queue for batch processing
- AnomalyAlert: Outlier detection alerts
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '025_phase3_analytics'
down_revision = '024_add_sng_and_global_waitlist'
branch_labels = None
depends_on = None


def upgrade():
    """Add Phase 3 analytics tables."""
    # Reuse existing currency enum introduced in earlier migrations
    currency_enum = postgresql.ENUM(
        'REAL',
        'PLAY',
        name='currencytype',
        create_type=False,
    )

    # HandAnalytics table
    op.create_table(
        'hand_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=False),
        sa.Column('hand_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('hand_no', sa.Integer(), nullable=False),
        sa.Column('variant', sa.String(50), nullable=False),
        sa.Column('stakes', sa.String(50), nullable=True),
        sa.Column('currency', currency_enum, nullable=False, server_default='PLAY'),
        sa.Column('players_in_hand', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('positions', postgresql.JSONB(), nullable=True),
        sa.Column('button_seat', sa.Integer(), nullable=True),
        sa.Column('sb_seat', sa.Integer(), nullable=True),
        sa.Column('bb_seat', sa.Integer(), nullable=True),
        sa.Column('vpip_mask', postgresql.JSONB(), nullable=True),
        sa.Column('pfr_mask', postgresql.JSONB(), nullable=True),
        sa.Column('actions_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('aggression_factor', sa.Integer(), nullable=True),
        sa.Column('total_pot', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('rake', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('multiway', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('went_to_showdown', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('showdown_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('winners', postgresql.JSONB(), nullable=True),
        sa.Column('timeouts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('autofolds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('player_deltas', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['hand_id'], ['hands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['table_templates.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_hand_analytics_table_hand', 'hand_analytics', ['table_id', 'hand_no'], unique=True)
    op.create_index('idx_hand_analytics_template', 'hand_analytics', ['template_id'])
    op.create_index('idx_hand_analytics_variant', 'hand_analytics', ['variant'])
    op.create_index('idx_hand_analytics_created', 'hand_analytics', ['created_at'])
    
    # PlayerSession table
    op.create_table(
        'player_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('session_start', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('session_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('buy_in', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('cash_out', sa.BigInteger(), nullable=True),
        sa.Column('net', sa.BigInteger(), nullable=True),
        sa.Column('hands_played', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('vpip_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pfr_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('af_numerator', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('af_denominator', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('timeouts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['table_templates.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_player_sessions_user_table', 'player_sessions', ['user_id', 'table_id'])
    op.create_index('idx_player_sessions_template', 'player_sessions', ['template_id'])
    op.create_index('idx_player_sessions_start', 'player_sessions', ['session_start'])
    
    # HourlyPlayerStats table
    op.create_table(
        'hourly_player_stats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('hour_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('hands_played', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tables_played', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('vpip_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pfr_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('af_numerator', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('af_denominator', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('wwsf', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('wsd', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('showdown_wins', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('showdown_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('three_bet_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cbet_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fold_to_cbet_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('steal_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fold_to_steal_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('net_profit', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('rake_paid', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('bb100', sa.Integer(), nullable=True),
        sa.Column('variant_breakdown', postgresql.JSONB(), nullable=True),
        sa.Column('stakes_breakdown', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_hourly_player_stats_user_hour', 'hourly_player_stats', ['user_id', 'hour_start'], unique=True)
    op.create_index('idx_hourly_player_stats_hour', 'hourly_player_stats', ['hour_start'])
    
    # LeaderboardSnapshot table
    op.create_table(
        'leaderboard_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('snapshot_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('leaderboard_type', sa.String(50), nullable=False),
        sa.Column('variant', sa.String(50), nullable=True),
        sa.Column('stakes', sa.String(50), nullable=True),
        sa.Column('rankings', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_leaderboard_type_time', 'leaderboard_snapshots', ['leaderboard_type', 'snapshot_time'])
    op.create_index('idx_leaderboard_variant', 'leaderboard_snapshots', ['variant'])
    
    # AnalyticsJob table
    op.create_table(
        'analytics_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_type', sa.String(50), nullable=False),
        sa.Column('deduplication_key', sa.String(255), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('params', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.String(1000), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('deduplication_key'),
    )
    op.create_index('idx_analytics_jobs_status_created', 'analytics_jobs', ['status', 'created_at'])
    op.create_index('idx_analytics_jobs_type', 'analytics_jobs', ['job_type'])
    
    # AnomalyAlert table
    op.create_table(
        'anomaly_alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('hand_id', sa.Integer(), nullable=True),
        sa.Column('message', sa.String(500), nullable=False),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['hand_id'], ['hands.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_anomaly_alerts_type_created', 'anomaly_alerts', ['alert_type', 'created_at'])
    op.create_index('idx_anomaly_alerts_severity_status', 'anomaly_alerts', ['severity', 'status'])
    op.create_index('idx_anomaly_alerts_table', 'anomaly_alerts', ['table_id'])


def downgrade():
    """Remove Phase 3 analytics tables."""
    
    op.drop_table('anomaly_alerts')
    op.drop_table('analytics_jobs')
    op.drop_table('leaderboard_snapshots')
    op.drop_table('hourly_player_stats')
    op.drop_table('player_sessions')
    op.drop_table('hand_analytics')
