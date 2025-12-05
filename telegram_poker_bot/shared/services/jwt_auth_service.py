"""JWT Authentication Service for Phase 4 RBAC.

Provides token generation, validation, and refresh functionality.
Implements secure JWT handling with role-based access control.
"""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
import jwt
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.auth_models import (
    UserRole,
    TokenType,
    UserRoles,
    RefreshToken,
    AdminActionLog,
)
from telegram_poker_bot.shared.models import User

settings = get_settings()
logger = get_logger(__name__)

# JWT Configuration
if hasattr(settings, "jwt_secret_key") and settings.jwt_secret_key and settings.jwt_secret_key != "CHANGE_ME_IN_PRODUCTION":
    JWT_SECRET_KEY = settings.jwt_secret_key
else:
    # For development/testing only - use a consistent but insecure key
    # In production, this must be set via environment variable
    import os
    if os.getenv("TESTING") or os.getenv("DEVELOPMENT"):
        JWT_SECRET_KEY = "INSECURE_DEV_KEY_DO_NOT_USE_IN_PRODUCTION"
        logger.warning(
            "Using insecure JWT secret key for development/testing. "
            "Set JWT_SECRET_KEY environment variable for production."
        )
    else:
        raise RuntimeError(
            "JWT_SECRET_KEY is not configured or uses insecure default. "
            "Please set JWT_SECRET_KEY environment variable to a secure random value."
        )
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Short-lived
REFRESH_TOKEN_EXPIRE_DAYS = 30  # Long-lived
WS_SESSION_TOKEN_EXPIRE_MINUTES = 60  # WebSocket session token


# ==================== Pydantic Models ====================

class TokenPayload(BaseModel):
    """JWT token payload."""
    
    sub: Union[int, str] = Field(..., description="User ID")
    roles: List[str] = Field(default_factory=list, description="User roles")
    role: Optional[str] = Field(None, description="Primary role claim")
    is_admin: Optional[bool] = Field(False, description="Admin flag claim")
    token_type: str = Field(..., description="Token type (access/refresh/ws_session)")
    exp: int = Field(..., description="Expiration timestamp")
    iat: int = Field(..., description="Issued at timestamp")
    jti: Optional[str] = Field(None, description="JWT ID for refresh tokens")


class TokenPair(BaseModel):
    """Access and refresh token pair."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token expiration in seconds")


class WSSessionToken(BaseModel):
    """WebSocket session token."""
    
    ws_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token expiration in seconds")


# ==================== JWT Auth Service ====================

class JWTAuthService:
    """Service for JWT token management."""
    
    def __init__(self):
        self.secret_key = JWT_SECRET_KEY
        self.algorithm = JWT_ALGORITHM
    
    async def get_user_roles(self, db: AsyncSession, user_id: int) -> List[UserRole]:
        """Get all roles assigned to a user."""
        result = await db.execute(
            select(UserRoles.role).where(UserRoles.user_id == user_id)
        )
        roles = result.scalars().all()
        return list(roles)
    
    async def has_role(self, db: AsyncSession, user_id: int, role: UserRole) -> bool:
        """Check if user has a specific role."""
        result = await db.execute(
            select(UserRoles).where(
                and_(
                    UserRoles.user_id == user_id,
                    UserRoles.role == role,
                )
            )
        )
        return result.scalar_one_or_none() is not None
    
    async def assign_role(
        self,
        db: AsyncSession,
        user_id: int,
        role: UserRole,
        granted_by: Optional[int] = None,
    ) -> UserRoles:
        """Assign a role to a user."""
        # Check if role already exists
        existing = await db.execute(
            select(UserRoles).where(
                and_(
                    UserRoles.user_id == user_id,
                    UserRoles.role == role,
                )
            )
        )
        if existing.scalar_one_or_none():
            logger.info(
                "Role already assigned",
                user_id=user_id,
                role=role.value,
            )
            return existing.scalar_one()
        
        # Create new role assignment
        user_role = UserRoles(
            user_id=user_id,
            role=role,
            granted_by=granted_by,
        )
        db.add(user_role)
        await db.flush()
        
        logger.info(
            "Role assigned",
            user_id=user_id,
            role=role.value,
            granted_by=granted_by,
        )
        
        return user_role
    
    async def revoke_role(
        self,
        db: AsyncSession,
        user_id: int,
        role: UserRole,
    ) -> bool:
        """Revoke a role from a user."""
        result = await db.execute(
            select(UserRoles).where(
                and_(
                    UserRoles.user_id == user_id,
                    UserRoles.role == role,
                )
            )
        )
        user_role = result.scalar_one_or_none()
        
        if user_role:
            await db.delete(user_role)
            await db.flush()
            logger.info(
                "Role revoked",
                user_id=user_id,
                role=role.value,
            )
            return True
        
        return False
    
    def create_access_token(
        self,
        user_id: int,
        roles: List[UserRole],
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a short-lived access token."""
        if expires_delta is None:
            expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "sub": user_id,
            "roles": [role.value for role in roles],
            "token_type": TokenType.ACCESS.value,
            "exp": int(expire.timestamp()),
            "iat": int(now.timestamp()),
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return token
    
    async def create_refresh_token(
        self,
        db: AsyncSession,
        user_id: int,
        device_info: Optional[str] = None,
    ) -> str:
        """Create a long-lived refresh token."""
        # Generate unique token
        jti = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(jti.encode()).hexdigest()
        
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        # Store in database
        refresh_token_record = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expire,
            device_info=device_info,
        )
        db.add(refresh_token_record)
        await db.flush()
        
        # Create JWT with jti
        payload = {
            "sub": user_id,
            "token_type": TokenType.REFRESH.value,
            "exp": int(expire.timestamp()),
            "iat": int(now.timestamp()),
            "jti": jti,
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return token
    
    def create_ws_session_token(
        self,
        user_id: int,
        roles: List[UserRole],
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a short-lived WebSocket session token."""
        if expires_delta is None:
            expires_delta = timedelta(minutes=WS_SESSION_TOKEN_EXPIRE_MINUTES)
        
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "sub": user_id,
            "roles": [role.value for role in roles],
            "token_type": TokenType.WS_SESSION.value,
            "exp": int(expire.timestamp()),
            "iat": int(now.timestamp()),
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return token
    
    def verify_token(self, token: str) -> Optional[TokenPayload]:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
            )
            return TokenPayload(**payload)
        except jwt.ExpiredSignatureError:
            logger.debug("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token", error=str(e))
            return None
    
    async def verify_refresh_token(
        self,
        db: AsyncSession,
        token: str,
    ) -> Optional[int]:
        """Verify a refresh token and return user_id if valid."""
        payload = self.verify_token(token)
        if not payload or payload.token_type != TokenType.REFRESH.value:
            return None
        
        if not payload.jti:
            logger.warning("Refresh token missing jti")
            return None
        
        # Check if token exists and is not revoked
        token_hash = hashlib.sha256(payload.jti.encode()).hexdigest()
        result = await db.execute(
            select(RefreshToken).where(
                and_(
                    RefreshToken.token_hash == token_hash,
                    RefreshToken.user_id == payload.sub,
                    RefreshToken.is_revoked is not True,
                    RefreshToken.expires_at > datetime.now(timezone.utc),
                )
            )
        )
        refresh_token_record = result.scalar_one_or_none()
        
        if not refresh_token_record:
            logger.warning(
                "Refresh token not found or revoked",
                user_id=payload.sub,
            )
            return None
        
        return payload.sub
    
    async def revoke_refresh_token(
        self,
        db: AsyncSession,
        token: str,
    ) -> bool:
        """Revoke a refresh token."""
        payload = self.verify_token(token)
        if not payload or not payload.jti:
            return False
        
        token_hash = hashlib.sha256(payload.jti.encode()).hexdigest()
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        refresh_token_record = result.scalar_one_or_none()
        
        if refresh_token_record:
            refresh_token_record.is_revoked = True
            refresh_token_record.revoked_at = datetime.now(timezone.utc)
            await db.flush()
            logger.info(
                "Refresh token revoked",
                user_id=refresh_token_record.user_id,
            )
            return True
        
        return False
    
    async def revoke_all_user_tokens(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> int:
        """Revoke all refresh tokens for a user."""
        result = await db.execute(
            select(RefreshToken).where(
                and_(
                    RefreshToken.user_id == user_id,
                    RefreshToken.is_revoked is not True,
                )
            )
        )
        tokens = result.scalars().all()
        
        count = 0
        now = datetime.now(timezone.utc)
        for token in tokens:
            token.is_revoked = True
            token.revoked_at = now
            count += 1
        
        if count > 0:
            await db.flush()
            logger.info(
                "All user tokens revoked",
                user_id=user_id,
                count=count,
            )
        
        return count
    
    async def create_token_pair(
        self,
        db: AsyncSession,
        user_id: int,
        device_info: Optional[str] = None,
    ) -> TokenPair:
        """Create access and refresh token pair."""
        # Get user roles
        roles = await self.get_user_roles(db, user_id)
        
        # If no roles assigned, default to PLAYER
        if not roles:
            roles = [UserRole.PLAYER]
        
        # Create tokens
        access_token = self.create_access_token(user_id, roles)
        refresh_token = await self.create_refresh_token(db, user_id, device_info)
        
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    
    async def refresh_access_token(
        self,
        db: AsyncSession,
        refresh_token: str,
    ) -> Optional[str]:
        """Get a new access token using a refresh token."""
        user_id = await self.verify_refresh_token(db, refresh_token)
        if not user_id:
            return None
        
        # Get user roles
        roles = await self.get_user_roles(db, user_id)
        if not roles:
            roles = [UserRole.PLAYER]
        
        # Create new access token
        access_token = self.create_access_token(user_id, roles)
        return access_token
    
    async def log_admin_action(
        self,
        db: AsyncSession,
        admin_user_id: int,
        action_type: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AdminActionLog:
        """Log an admin action for audit trail."""
        log = AdminActionLog(
            admin_user_id=admin_user_id,
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
        )
        db.add(log)
        await db.flush()
        
        logger.info(
            "Admin action logged",
            admin_user_id=admin_user_id,
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        
        return log


# Singleton instance
_jwt_auth_service: Optional[JWTAuthService] = None


def get_jwt_auth_service() -> JWTAuthService:
    """Get the JWT auth service singleton."""
    global _jwt_auth_service
    if _jwt_auth_service is None:
        _jwt_auth_service = JWTAuthService()
    return _jwt_auth_service
