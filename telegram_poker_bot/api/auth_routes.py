"""Admin authentication endpoints for Phase 4.

Provides JWT token-based authentication endpoints:
- Login (create token pair)
- Refresh access token
- Logout (revoke tokens)
- Create WS session token
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.auth_models import UserRole
from telegram_poker_bot.shared.services.jwt_auth_service import (
    get_jwt_auth_service,
    JWTAuthService,
    TokenPair,
    WSSessionToken,
)
from telegram_poker_bot.shared.services.rbac_middleware import (
    get_current_user,
    require_auth,
    require_admin,
    CurrentUser,
)

logger = get_logger(__name__)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


# ==================== Request/Response Models ====================

class LoginRequest(BaseModel):
    """Login request with Telegram init data."""
    
    telegram_init_data: str = Field(..., description="Telegram WebApp init data")
    device_info: Optional[str] = Field(None, description="Optional device information")


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""
    
    refresh_token: str = Field(..., description="Refresh token")


class AccessTokenResponse(BaseModel):
    """Access token response."""
    
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RoleInfo(BaseModel):
    """User role information."""
    
    user_id: int
    roles: list[str]
    is_admin: bool


# ==================== Endpoints ====================

@auth_router.post("/login", response_model=TokenPair)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
):
    """Login and create JWT token pair.
    
    This endpoint validates Telegram init data and creates access/refresh tokens.
    For now, it uses the existing Telegram verification from main.py.
    
    In production, this should:
    1. Verify Telegram init data
    2. Get or create user
    3. Check user roles
    4. Create token pair
    """
    # Import here to avoid circular dependency
    from telegram_poker_bot.api.main import verify_telegram_init_data, ensure_user
    
    # Verify Telegram init data
    auth = verify_telegram_init_data(request.telegram_init_data)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data",
        )
    
    # Ensure user exists
    user = await ensure_user(db, auth)
    
    # Create token pair
    token_pair = await jwt_service.create_token_pair(
        db,
        user.id,
        device_info=request.device_info,
    )
    
    await db.commit()
    
    logger.info(
        "User logged in",
        user_id=user.id,
        device_info=request.device_info,
    )
    
    return token_pair


@auth_router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
):
    """Refresh access token using refresh token."""
    access_token = await jwt_service.refresh_access_token(db, request.refresh_token)
    
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    
    # Access token expires in 15 minutes
    return AccessTokenResponse(
        access_token=access_token,
        expires_in=15 * 60,
    )


@auth_router.post("/logout")
async def logout(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
):
    """Logout by revoking refresh token."""
    revoked = await jwt_service.revoke_refresh_token(db, request.refresh_token)
    await db.commit()
    
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found",
        )
    
    return {"message": "Logged out successfully"}


@auth_router.post("/ws-session-token", response_model=WSSessionToken)
async def create_ws_session_token(
    current_user: CurrentUser = Depends(require_auth),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
):
    """Create a WebSocket session token.
    
    This is a short-lived token (60 minutes) that can be used for WebSocket
    connections that may outlive the access token.
    """
    ws_token = jwt_service.create_ws_session_token(
        current_user.user_id,
        current_user.roles,
    )
    
    return WSSessionToken(
        ws_token=ws_token,
        expires_in=60 * 60,  # 60 minutes
    )


@auth_router.get("/me/roles", response_model=RoleInfo)
async def get_my_roles(
    current_user: CurrentUser = Depends(require_auth),
):
    """Get current user's roles."""
    return RoleInfo(
        user_id=current_user.user_id,
        roles=[role.value for role in current_user.roles],
        is_admin=current_user.is_admin(),
    )


@auth_router.post("/revoke-all")
async def revoke_all_tokens(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
):
    """Revoke all refresh tokens for the current user.
    
    Useful for logout from all devices.
    """
    count = await jwt_service.revoke_all_user_tokens(db, current_user.user_id)
    await db.commit()
    
    return {
        "message": f"Revoked {count} tokens",
        "count": count,
    }
