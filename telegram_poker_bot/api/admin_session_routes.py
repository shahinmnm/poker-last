"""Admin session authentication routes.

This module provides secure admin panel access through one-time links:
1. POST /api/admin/session-token - Generate one-time entry token (bot-to-API)
2. GET /admin/enter - Validate token, create session, redirect to panel
3. POST /api/admin/logout - Invalidate session
4. GET /api/admin/session/validate - Check if session is valid
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Header
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.services.admin_session_service import (
    get_admin_session_service,
    AdminSession,
    AdminAuditLogEntry,
)

logger = get_logger(__name__)
settings = get_settings()

# Router for admin session endpoints
admin_session_router = APIRouter(tags=["admin-session"])


# ==================== Request/Response Models ====================

class SessionTokenRequest(BaseModel):
    """Request to create an admin entry token."""
    
    admin_chat_id: int = Field(..., description="Telegram chat ID of the admin")


class SessionTokenResponse(BaseModel):
    """Response with the one-time entry token."""
    
    token: str
    expires_at: str
    enter_url: str
    ttl_seconds: int


class SessionValidateResponse(BaseModel):
    """Response for session validation."""
    
    valid: bool
    admin_chat_id: Optional[int] = None
    expires_at: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Response with audit log entries."""
    
    entries: list[dict]
    total: int


class RedeemEntryTokenRequest(BaseModel):
    """Request to redeem a one-time admin entry token (SPA flow)."""
    
    token: str = Field(..., description="One-time entry token")


class RedeemEntryTokenResponse(BaseModel):
    """Response from redeeming an admin entry token."""
    
    ok: bool
    redirect: Optional[str] = None
    reason: Optional[str] = None


# ==================== Dependencies ====================

def get_client_ip(request: Request) -> str:
    """Get the client IP address from the request."""
    # Check for forwarded headers (behind proxy)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else "unknown"


def verify_internal_api_key(
    x_internal_api_key: Optional[str] = Header(None, alias="X-Internal-API-Key"),
) -> bool:
    """Verify the internal API key for bot-to-API communication."""
    if not settings.internal_api_key:
        # If not configured, allow all requests (development mode)
        logger.warning("INTERNAL_API_KEY not configured - allowing request in dev mode")
        return True
    
    if not x_internal_api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing internal API key",
        )
    
    if x_internal_api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid internal API key",
        )
    
    return True


async def get_admin_session_from_cookie(
    request: Request,
) -> Optional[AdminSession]:
    """Extract and validate admin session from cookie."""
    session_id = request.cookies.get("admin_session")
    if not session_id:
        return None
    
    service = get_admin_session_service()
    return await service.validate_session(session_id)


async def require_admin_session(
    request: Request,
    session: Optional[AdminSession] = Depends(get_admin_session_from_cookie),
) -> AdminSession:
    """Require a valid admin session."""
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Admin session required. Please use /admin command in Telegram to get access.",
        )
    return session


# ==================== Endpoints ====================

@admin_session_router.post("/api/admin/session-token", response_model=SessionTokenResponse)
async def create_session_token(
    request: Request,
    body: SessionTokenRequest,
    _: bool = Depends(verify_internal_api_key),
):
    """
    Create a one-time admin entry token.
    
    This endpoint is called by the Telegram bot when an admin uses /admin command.
    The token can only be used once and expires quickly (default: 2 minutes).
    
    Requires X-Internal-API-Key header for authentication.
    """
    service = get_admin_session_service()
    client_ip = get_client_ip(request)
    
    # Rate limiting
    ip_hash = service._hash_sensitive(client_ip)
    if not await service.check_rate_limit(f"token_create:{ip_hash}", max_requests=10, window_seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Too many token requests. Please wait before trying again.",
        )
    
    try:
        entry_token = await service.create_entry_token(
            admin_chat_id=body.admin_chat_id,
            ip_address=client_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    # Build the entry URL using admin_public_url (where /admin/enter is routed to backend)
    # This must be the externally reachable URL where nginx routes /admin/enter to the API
    base_url = settings.admin_public_url.rstrip("/")
    enter_url = f"{base_url}/admin/enter?token={entry_token.token}"
    
    logger.info(
        "Generated admin entry URL",
        admin_chat_id=body.admin_chat_id,
        enter_url_domain=base_url,
        token_prefix=entry_token.token[:8] if entry_token.token else None,
    )
    
    return SessionTokenResponse(
        token=entry_token.token,
        expires_at=entry_token.expires_at,
        enter_url=enter_url,
        ttl_seconds=settings.admin_entry_token_ttl_seconds,
    )


@admin_session_router.get("/admin/enter")
async def admin_enter(
    request: Request,
    token: str = Query(..., description="One-time entry token"),
):
    """
    Validate one-time token and establish admin session.
    
    This endpoint:
    1. Validates the one-time token
    2. Marks the token as used (single-use)
    3. Creates an admin session
    4. Sets a secure HTTP-only cookie
    5. Redirects to the admin panel (/admin/panel)
    
    If the token is invalid or expired, redirects to /admin/expired.
    """
    # PART 1: Debug logging - confirm this endpoint is being hit
    logger.info(
        "HIT /admin/enter",
        host=request.url.hostname,
        path=request.url.path,
        token_prefix=token[:8] if token else None,
        x_forwarded_proto=request.headers.get("X-Forwarded-Proto"),
        x_forwarded_for=request.headers.get("X-Forwarded-For"),
    )
    
    service = get_admin_session_service()
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "unknown")
    
    # Use mini_app_url for redirects (the frontend domain)
    frontend_base_url = settings.mini_app_url.rstrip("/")
    # Use admin_dashboard_path from config
    admin_dashboard_path = settings.admin_dashboard_path
    
    # Rate limiting
    ip_hash = service._hash_sensitive(client_ip)
    if not await service.check_rate_limit(f"enter:{ip_hash}", max_requests=10, window_seconds=60):
        logger.warning(
            "Admin enter rate limited",
            ip_hash=ip_hash,
        )
        return RedirectResponse(
            url=f"{frontend_base_url}/admin/expired?reason=rate_limited",
            status_code=302,
        )
    
    # Validate and consume token
    session = await service.validate_and_consume_token(
        token=token,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    
    if not session:
        logger.warning(
            "Admin enter failed - invalid or expired token",
            token_prefix=token[:8] if token else None,
        )
        return RedirectResponse(
            url=f"{frontend_base_url}/admin/expired?reason=invalid_token",
            status_code=302,
        )
    
    # Determine redirect target (admin dashboard)
    redirect_to = admin_dashboard_path
    
    # Create redirect response with session cookie
    response = RedirectResponse(
        url=f"{frontend_base_url}{redirect_to}",
        status_code=302,
    )
    
    # Set secure HTTP-only cookie
    # - HttpOnly=true: prevents JavaScript access (XSS protection)
    # - SameSite=Lax: CSRF protection while allowing navigation
    # - Secure: Only set to true if the request came via HTTPS (check X-Forwarded-Proto for proxy)
    #   In local http development, Secure=true would cause cookie to be dropped
    # - Path=/: applies to all routes (needed for /admin/* and /api/admin/*)
    
    # Determine if request is secure (behind HTTPS proxy or direct HTTPS)
    # Handle multiple values in X-Forwarded-Proto (e.g., "https,http" from chained proxies)
    x_forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
    # Take the first protocol if multiple are present (leftmost is from original client)
    first_proto = x_forwarded_proto.split(",")[0].strip().lower() if x_forwarded_proto else ""
    is_https_request = first_proto == "https" or frontend_base_url.startswith("https://")
    
    response.set_cookie(
        key="admin_session",
        value=session.session_id,
        max_age=settings.admin_session_ttl_seconds,
        httponly=True,
        secure=is_https_request,
        samesite="lax",
        path="/",
    )
    
    logger.info(
        "Admin enter success",
        admin_chat_id=session.admin_chat_id,
        redirect_to=redirect_to,
        redirect_full_url=f"{frontend_base_url}{redirect_to}",
    )
    logger.info(
        "Set-Cookie admin_session",
        path="/",
        httponly=True,
        secure=is_https_request,
        samesite="lax",
    )
    
    return response


@admin_session_router.post("/api/admin/redeem-entry-token", response_model=RedeemEntryTokenResponse)
async def redeem_entry_token(
    request: Request,
    body: RedeemEntryTokenRequest,
    response: Response,
):
    """
    Redeem a one-time admin entry token (SPA flow).
    
    This endpoint is called by the frontend SPA at /admin/enter route to:
    1. Validate the one-time token
    2. Mark the token as used (single-use)
    3. Create an admin session
    4. Set a secure HTTP-only cookie
    5. Return JSON with redirect path
    
    Unlike GET /admin/enter which redirects, this returns JSON for SPA consumption.
    
    Request JSON: { token: string }
    
    Response:
    - Success (200): { ok: true, redirect: "/admin/panel" }
    - Invalid token (401): { ok: false, reason: "invalid_token" }
    """
    service = get_admin_session_service()
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "unknown")
    
    # Rate limiting
    ip_hash = service._hash_sensitive(client_ip)
    if not await service.check_rate_limit(f"redeem:{ip_hash}", max_requests=10, window_seconds=60):
        logger.warning(
            "Admin redeem-entry-token rate limited",
            ip_hash=ip_hash,
        )
        return RedeemEntryTokenResponse(
            ok=False,
            reason="rate_limited",
        )
    
    # Validate and consume token
    session = await service.validate_and_consume_token(
        token=body.token,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    
    if not session:
        logger.warning(
            "Admin redeem-entry-token failed - invalid or expired token",
            token_prefix=body.token[:8] if body.token else None,
        )
        response.status_code = 401
        return RedeemEntryTokenResponse(
            ok=False,
            reason="invalid_token",
        )
    
    # Determine if request is secure (behind HTTPS proxy or direct HTTPS)
    x_forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
    first_proto = x_forwarded_proto.split(",")[0].strip().lower() if x_forwarded_proto else ""
    frontend_base_url = settings.mini_app_url.rstrip("/")
    is_https_request = first_proto == "https" or frontend_base_url.startswith("https://")
    
    # Set secure HTTP-only cookie
    response.set_cookie(
        key="admin_session",
        value=session.session_id,
        max_age=settings.admin_session_ttl_seconds,
        httponly=True,
        secure=is_https_request,
        samesite="lax",
        path="/",
    )
    
    logger.info(
        "Admin redeem-entry-token success",
        admin_chat_id=session.admin_chat_id,
        session_id_prefix=session.session_id[:8],
    )
    
    return RedeemEntryTokenResponse(
        ok=True,
        redirect=settings.admin_dashboard_path,
    )


@admin_session_router.get("/api/admin/session/validate", response_model=SessionValidateResponse)
async def validate_session(
    session: Optional[AdminSession] = Depends(get_admin_session_from_cookie),
):
    """
    Check if the current admin session is valid.
    
    This endpoint is used by the frontend to verify session status.
    """
    if not session:
        return SessionValidateResponse(valid=False)
    
    return SessionValidateResponse(
        valid=True,
        admin_chat_id=session.admin_chat_id,
        expires_at=session.expires_at,
    )


class WhoAmIResponse(BaseModel):
    """Response for whoami endpoint."""
    
    admin: bool
    chat_id: int
    session_expires_at: str


@admin_session_router.get("/api/admin/whoami", response_model=WhoAmIResponse)
async def admin_whoami(
    session: AdminSession = Depends(require_admin_session),
):
    """
    Get current admin identity.
    
    Protected endpoint that returns admin information.
    Used by frontend admin panel to verify session on load.
    
    Returns:
        - admin: true (always, since endpoint requires admin session)
        - chat_id: The admin's Telegram chat ID
        - session_expires_at: Session expiration timestamp
    
    Raises:
        401: If admin session is missing or invalid
    """
    return WhoAmIResponse(
        admin=True,
        chat_id=session.admin_chat_id,
        session_expires_at=session.expires_at,
    )


@admin_session_router.post("/api/admin/logout")
async def admin_logout(
    request: Request,
    response: Response,
    session: AdminSession = Depends(require_admin_session),
):
    """
    Logout and invalidate the admin session.
    
    Clears the session from Redis and removes the cookie.
    """
    service = get_admin_session_service()
    
    # Invalidate session in Redis
    await service.invalidate_session(session.session_id)
    
    # Log the action
    await service.log_audit_action(
        admin_chat_id=session.admin_chat_id,
        action_type="LOGOUT",
    )
    
    # Clear the cookie
    response.delete_cookie(key="admin_session", path="/")
    
    return {"success": True, "message": "Logged out successfully"}


@admin_session_router.get("/api/admin/audit-logs", response_model=AuditLogResponse)
async def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    action_type: Optional[str] = Query(default=None),
    session: AdminSession = Depends(require_admin_session),
):
    """
    Get admin audit log entries.
    
    Requires a valid admin session.
    """
    service = get_admin_session_service()
    
    entries = await service.get_audit_logs(
        limit=limit,
        offset=offset,
        action_type=action_type,
    )
    
    return AuditLogResponse(
        entries=[entry.model_dump() for entry in entries],
        total=len(entries),
    )
