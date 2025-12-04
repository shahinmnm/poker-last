"""Phase 4: Add JWT auth and RBAC tables.

Revision ID: 026_phase4_jwt_auth
Revises: 025_phase3_analytics
Create Date: 2024-12-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "026_phase4_jwt_auth"
down_revision = "025_phase3_analytics"
branch_labels = None
depends_on = None


def upgrade():
    """Apply Phase 4 JWT auth and RBAC changes."""
    
    # Create UserRole enum
    op.execute("""
        CREATE TYPE userrole AS ENUM ('admin', 'player', 'system');
    """)
    
    # Create user_roles table
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", postgresql.ENUM('admin', 'player', 'system', name='userrole'), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("granted_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_user_roles_user_id", "user_roles", ["user_id"])
    op.create_index("idx_user_roles_role", "user_roles", ["role"])
    
    # Create refresh_tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("device_info", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("idx_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("idx_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])
    op.create_index("idx_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])
    
    # Create admin_action_logs table
    op.create_table(
        "admin_action_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("admin_user_id", sa.Integer(), nullable=True),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["admin_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_admin_action_logs_admin_user_id", "admin_action_logs", ["admin_user_id"])
    op.create_index("idx_admin_action_logs_action_type", "admin_action_logs", ["action_type"])
    op.create_index("idx_admin_action_logs_created_at", "admin_action_logs", ["created_at"])


def downgrade():
    """Revert Phase 4 JWT auth and RBAC changes."""
    
    # Drop tables
    op.drop_index("idx_admin_action_logs_created_at", "admin_action_logs")
    op.drop_index("idx_admin_action_logs_action_type", "admin_action_logs")
    op.drop_index("idx_admin_action_logs_admin_user_id", "admin_action_logs")
    op.drop_table("admin_action_logs")
    
    op.drop_index("idx_refresh_tokens_expires_at", "refresh_tokens")
    op.drop_index("idx_refresh_tokens_token_hash", "refresh_tokens")
    op.drop_index("idx_refresh_tokens_user_id", "refresh_tokens")
    op.drop_table("refresh_tokens")
    
    op.drop_index("idx_user_roles_role", "user_roles")
    op.drop_index("idx_user_roles_user_id", "user_roles")
    op.drop_table("user_roles")
    
    # Drop enum
    op.execute("DROP TYPE userrole;")
