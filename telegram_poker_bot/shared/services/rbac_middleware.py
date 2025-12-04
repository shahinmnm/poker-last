"""RBAC Middleware and dependencies for admin routes.

Provides authentication and authorization for FastAPI endpoints.
Implements role-based access control for admin operations.
"""

from typing import Optional, List
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.auth_models import UserRole
from telegram_poker_bot.shared.services.jwt_auth_service import (
    get_jwt_auth_service,
    JWTAuthService,
    TokenPayload,
)

logger = get_logger(__name__)

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


class CurrentUser:
    """Current authenticated user information."""
    
    def __init__(
        self,
        user_id: int,
        roles: List[UserRole],
        token_payload: TokenPayload,
    ):
        self.user_id = user_id
        self.roles = roles
        self.token_payload = token_payload
    
    def has_role(self, role: UserRole) -> bool:
        """Check if user has a specific role."""
        return role in self.roles
    
    def is_admin(self) -> bool:
        """Check if user is an admin."""
        return UserRole.ADMIN in self.roles
    
    def is_system(self) -> bool:
        """Check if user is a system account."""
        return UserRole.SYSTEM in self.roles


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
) -> Optional[CurrentUser]:
    """Get current authenticated user from JWT token.
    
    Returns None if no valid token is provided (for optional auth).
    """
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = jwt_service.verify_token(token)
    
    if not payload:
        return None
    
    # Parse roles
    roles = [UserRole(role) for role in payload.roles]
    
    return CurrentUser(
        user_id=payload.sub,
        roles=roles,
        token_payload=payload,
    )


async def require_auth(
    current_user: Optional[CurrentUser] = Depends(get_current_user),
) -> CurrentUser:
    """Require authentication for an endpoint.
    
    Raises 401 if not authenticated.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return current_user


async def require_admin(
    current_user: CurrentUser = Depends(require_auth),
) -> CurrentUser:
    """Require admin role for an endpoint.
    
    Raises 403 if user is not an admin.
    """
    if not current_user.is_admin():
        logger.warning(
            "Admin access denied",
            user_id=current_user.user_id,
            roles=[r.value for r in current_user.roles],
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    return current_user


async def require_role(
    required_role: UserRole,
) -> CurrentUser:
    """Create a dependency that requires a specific role.
    
    Usage:
        @app.get("/endpoint")
        async def endpoint(user: CurrentUser = Depends(require_role(UserRole.ADMIN))):
            ...
    """
    async def _check_role(
        current_user: CurrentUser = Depends(require_auth),
    ) -> CurrentUser:
        if not current_user.has_role(required_role):
            logger.warning(
                "Role access denied",
                user_id=current_user.user_id,
                required_role=required_role.value,
                user_roles=[r.value for r in current_user.roles],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role.value}' required",
            )
        return current_user
    
    return _check_role


class AdminWSAuth:
    """WebSocket authentication for admin connections.
    
    Supports two authentication methods:
    1. Access token (standard JWT)
    2. WS session token (short-lived, derived from access token)
    """
    
    def __init__(self, jwt_service: JWTAuthService):
        self.jwt_service = jwt_service
    
    async def authenticate_ws(
        self,
        token: str,
    ) -> Optional[CurrentUser]:
        """Authenticate a WebSocket connection.
        
        Args:
            token: JWT token (access or ws_session type)
        
        Returns:
            CurrentUser if authenticated, None otherwise
        """
        payload = self.jwt_service.verify_token(token)
        
        if not payload:
            logger.debug("WebSocket auth failed: invalid token")
            return None
        
        # Accept both access and ws_session tokens
        if payload.token_type not in ["access", "ws_session"]:
            logger.warning(
                "WebSocket auth failed: invalid token type",
                token_type=payload.token_type,
            )
            return None
        
        # Parse roles
        roles = [UserRole(role) for role in payload.roles]
        
        return CurrentUser(
            user_id=payload.sub,
            roles=roles,
            token_payload=payload,
        )
    
    async def require_admin_ws(
        self,
        token: str,
    ) -> Optional[CurrentUser]:
        """Authenticate and authorize admin WebSocket connection.
        
        Returns CurrentUser if authenticated and authorized, None otherwise.
        """
        current_user = await self.authenticate_ws(token)
        
        if not current_user:
            return None
        
        if not current_user.is_admin():
            logger.warning(
                "Admin WebSocket access denied",
                user_id=current_user.user_id,
                roles=[r.value for r in current_user.roles],
            )
            return None
        
        return current_user
    
    def create_ws_session_token(
        self,
        user_id: int,
        roles: List[UserRole],
    ) -> str:
        """Create a WebSocket session token.
        
        This is a short-lived token derived from an access token,
        used for WebSocket connections that may outlive the access token.
        """
        return self.jwt_service.create_ws_session_token(user_id, roles)


# Singleton instance
_admin_ws_auth: Optional[AdminWSAuth] = None


def get_admin_ws_auth() -> AdminWSAuth:
    """Get the admin WebSocket auth singleton."""
    global _admin_ws_auth
    if _admin_ws_auth is None:
        _admin_ws_auth = AdminWSAuth(get_jwt_auth_service())
    return _admin_ws_auth
