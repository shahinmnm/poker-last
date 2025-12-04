"""Authentication and authorization models for Phase 4 RBAC.

Implements JWT-based authentication with role-based access control.
Supports access tokens (short-lived) and refresh tokens (long-lived).
"""

from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Boolean,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from telegram_poker_bot.shared.models import Base


class UserRole(str, PyEnum):
    """User role enumeration for RBAC."""
    
    ADMIN = "admin"
    PLAYER = "player"
    SYSTEM = "system"  # Internal jobs and automation


class TokenType(str, PyEnum):
    """Token type enumeration."""
    
    ACCESS = "access"
    REFRESH = "refresh"
    WS_SESSION = "ws_session"  # Short-lived WebSocket session token


class UserRoles(Base):
    """User role assignments for RBAC.
    
    Allows multiple roles per user.
    """
    
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(
        Enum(
            UserRole,
            values_callable=lambda enum: [role.value for role in enum],
            name="userrole",
        ),
        nullable=False,
    )
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="role_assignments")
    granter = relationship("User", foreign_keys=[granted_by])
    
    __table_args__ = (
        Index("idx_user_roles_user_id", "user_id"),
        Index("idx_user_roles_role", "role"),
    )


class RefreshToken(Base):
    """Refresh token for JWT authentication.
    
    Long-lived tokens used to obtain new access tokens without re-authentication.
    """
    
    __tablename__ = "refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    is_revoked = Column(Boolean, nullable=False, default=False, server_default="false")
    device_info = Column(String(255), nullable=True)  # Optional device/client info
    
    # Relationships
    user = relationship("User", backref="refresh_tokens")
    
    __table_args__ = (
        Index("idx_refresh_tokens_user_id", "user_id"),
        Index("idx_refresh_tokens_token_hash", "token_hash"),
        Index("idx_refresh_tokens_expires_at", "expires_at"),
    )


class AdminActionLog(Base):
    """Audit log for admin actions.
    
    Records all admin operations for security and compliance.
    """
    
    __tablename__ = "admin_action_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(100), nullable=False)  # e.g., "anomaly_reviewed", "export_created"
    resource_type = Column(String(100), nullable=True)  # e.g., "anomaly", "export_job"
    resource_id = Column(Integer, nullable=True)
    details = Column(String, nullable=True)  # JSON string with action details
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    admin = relationship("User", backref="admin_actions")
    
    __table_args__ = (
        Index("idx_admin_action_logs_admin_user_id", "admin_user_id"),
        Index("idx_admin_action_logs_action_type", "action_type"),
        Index("idx_admin_action_logs_created_at", "created_at"),
    )
