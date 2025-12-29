"""Admin session service for secure one-time token based authentication.

This service implements:
1. One-time admin entry tokens (stored in Redis, single-use, short TTL)
2. Admin session management (longer-lived session after token verification)
3. Audit logging for all admin actions
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from pydantic import BaseModel

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.game_core import get_redis_client

logger = get_logger(__name__)
settings = get_settings()

# Redis key prefixes
ADMIN_ENTRY_TOKEN_PREFIX = "admin:entry_token:"
ADMIN_SESSION_PREFIX = "admin:session:"
ADMIN_RATE_LIMIT_PREFIX = "admin:rate_limit:"
ADMIN_AUDIT_LOG_PREFIX = "admin:audit:"


class AdminEntryToken(BaseModel):
    """One-time admin entry token data."""
    
    token: str
    admin_chat_id: int
    created_at: str
    expires_at: str
    used_at: Optional[str] = None
    ip_hash: Optional[str] = None
    ua_hash: Optional[str] = None


class AdminSession(BaseModel):
    """Admin session data stored in Redis."""
    
    session_id: str
    admin_chat_id: int
    created_at: str
    expires_at: str
    last_activity_at: str
    ip_hash: Optional[str] = None
    ua_hash: Optional[str] = None


class AdminAuditLogEntry(BaseModel):
    """Admin action audit log entry."""
    
    id: str
    admin_chat_id: int
    action_type: str
    target: Optional[str] = None
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    ip_hash: Optional[str] = None
    timestamp: str


class AdminSessionService:
    """Service for managing admin authentication sessions via Redis."""

    def __init__(self):
        self._settings = get_settings()

    @staticmethod
    def _hash_sensitive(value: str) -> str:
        """Create a hash of sensitive data (IP, user agent) for logging."""
        return hashlib.sha256(value.encode()).hexdigest()[:16]

    @staticmethod
    def _generate_token() -> str:
        """Generate a cryptographically secure URL-safe token."""
        return secrets.token_urlsafe(32)

    def is_admin_chat_id(self, chat_id: int) -> bool:
        """Check if a chat_id is in the admin allowlist."""
        admin_id = self._settings.admin_chat_id
        return admin_id is not None and chat_id == admin_id

    async def create_entry_token(
        self,
        admin_chat_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AdminEntryToken:
        """
        Create a one-time admin entry token.
        
        Args:
            admin_chat_id: Telegram chat ID of the admin
            ip_address: Optional IP address for logging
            user_agent: Optional user agent for logging
            
        Returns:
            AdminEntryToken with the generated token
            
        Raises:
            ValueError: If chat_id is not an authorized admin
        """
        if not self.is_admin_chat_id(admin_chat_id):
            raise ValueError(f"Chat ID {admin_chat_id} is not authorized as admin")

        token = self._generate_token()
        now = datetime.now(timezone.utc)
        ttl = self._settings.admin_entry_token_ttl_seconds
        expires_at = now + timedelta(seconds=ttl)

        entry_token = AdminEntryToken(
            token=token,
            admin_chat_id=admin_chat_id,
            created_at=now.isoformat(),
            expires_at=expires_at.isoformat(),
            ip_hash=self._hash_sensitive(ip_address) if ip_address else None,
            ua_hash=self._hash_sensitive(user_agent) if user_agent else None,
        )

        # Store in Redis with TTL
        redis = await get_redis_client()
        key = f"{ADMIN_ENTRY_TOKEN_PREFIX}{token}"
        await redis.set(
            key,
            entry_token.model_dump_json(),
            ex=ttl,
        )

        logger.info(
            "Admin entry token created",
            admin_chat_id=admin_chat_id,
            expires_in_seconds=ttl,
        )

        # Audit log
        await self.log_audit_action(
            admin_chat_id=admin_chat_id,
            action_type="TOKEN_CREATED",
            metadata={"expires_at": expires_at.isoformat()},
        )

        return entry_token

    async def validate_and_consume_token(
        self,
        token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[AdminSession]:
        """
        Validate a one-time entry token and create a session.
        
        The token is consumed (deleted) after successful validation.
        
        Args:
            token: The one-time entry token
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            AdminSession if valid, None if invalid/expired/used
        """
        redis = await get_redis_client()
        key = f"{ADMIN_ENTRY_TOKEN_PREFIX}{token}"

        # Get and delete atomically using pipeline
        pipe = redis.pipeline()
        pipe.get(key)
        pipe.delete(key)
        results = await pipe.execute()

        token_data = results[0]
        if not token_data:
            logger.warning(
                "Admin entry token validation failed - token not found or expired",
                token_prefix=token[:8] if token else None,
            )
            await self.log_audit_action(
                admin_chat_id=0,  # Unknown
                action_type="ENTER_FAIL",
                reason="Token not found or expired",
                ip_hash=self._hash_sensitive(ip_address) if ip_address else None,
            )
            return None

        # Parse token data
        try:
            entry_token = AdminEntryToken.model_validate_json(token_data)
        except Exception as e:
            logger.error("Failed to parse entry token data", error=str(e))
            return None

        # Check if already used (shouldn't happen due to atomic get+delete)
        if entry_token.used_at:
            logger.warning(
                "Admin entry token already used",
                admin_chat_id=entry_token.admin_chat_id,
            )
            await self.log_audit_action(
                admin_chat_id=entry_token.admin_chat_id,
                action_type="ENTER_FAIL",
                reason="Token already used",
            )
            return None

        # Check expiration
        expires_at = datetime.fromisoformat(entry_token.expires_at)
        if datetime.now(timezone.utc) > expires_at:
            logger.warning(
                "Admin entry token expired",
                admin_chat_id=entry_token.admin_chat_id,
            )
            await self.log_audit_action(
                admin_chat_id=entry_token.admin_chat_id,
                action_type="ENTER_FAIL",
                reason="Token expired",
            )
            return None

        # Create session
        session = await self.create_session(
            admin_chat_id=entry_token.admin_chat_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(
            "Admin entry successful",
            admin_chat_id=entry_token.admin_chat_id,
            session_id=session.session_id[:8],
        )

        await self.log_audit_action(
            admin_chat_id=entry_token.admin_chat_id,
            action_type="ENTER_SUCCESS",
            metadata={"session_id": session.session_id[:8]},
            ip_hash=self._hash_sensitive(ip_address) if ip_address else None,
        )

        return session

    async def create_session(
        self,
        admin_chat_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AdminSession:
        """Create a new admin session."""
        session_id = self._generate_token()
        now = datetime.now(timezone.utc)
        ttl = self._settings.admin_session_ttl_seconds
        expires_at = now + timedelta(seconds=ttl)

        session = AdminSession(
            session_id=session_id,
            admin_chat_id=admin_chat_id,
            created_at=now.isoformat(),
            expires_at=expires_at.isoformat(),
            last_activity_at=now.isoformat(),
            ip_hash=self._hash_sensitive(ip_address) if ip_address else None,
            ua_hash=self._hash_sensitive(user_agent) if user_agent else None,
        )

        redis = await get_redis_client()
        key = f"{ADMIN_SESSION_PREFIX}{session_id}"
        await redis.set(
            key,
            session.model_dump_json(),
            ex=ttl,
        )

        return session

    async def validate_session(self, session_id: str) -> Optional[AdminSession]:
        """
        Validate an admin session and update last activity.
        
        Returns:
            AdminSession if valid, None if invalid/expired
        """
        if not session_id:
            return None

        redis = await get_redis_client()
        key = f"{ADMIN_SESSION_PREFIX}{session_id}"
        session_data = await redis.get(key)

        if not session_data:
            return None

        try:
            session = AdminSession.model_validate_json(session_data)
        except Exception as e:
            logger.error("Failed to parse session data", error=str(e))
            return None

        # Check expiration
        expires_at = datetime.fromisoformat(session.expires_at)
        if datetime.now(timezone.utc) > expires_at:
            await redis.delete(key)
            return None

        # Update last activity timestamp (extend TTL)
        now = datetime.now(timezone.utc)
        session.last_activity_at = now.isoformat()
        ttl = self._settings.admin_session_ttl_seconds
        await redis.set(
            key,
            session.model_dump_json(),
            ex=ttl,
        )

        return session

    async def invalidate_session(self, session_id: str) -> bool:
        """
        Invalidate (logout) an admin session.
        
        Returns:
            True if session was found and deleted, False otherwise
        """
        redis = await get_redis_client()
        key = f"{ADMIN_SESSION_PREFIX}{session_id}"
        deleted = await redis.delete(key)
        
        if deleted:
            logger.info("Admin session invalidated", session_id=session_id[:8])
        
        return deleted > 0

    async def check_rate_limit(
        self,
        identifier: str,
        max_requests: int = 10,
        window_seconds: int = 60,
    ) -> bool:
        """
        Check if a rate limit has been exceeded.
        
        Args:
            identifier: Unique identifier (e.g., IP address hash)
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            True if request is allowed, False if rate limited
        """
        redis = await get_redis_client()
        key = f"{ADMIN_RATE_LIMIT_PREFIX}{identifier}"

        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()

        count = results[0]
        return count <= max_requests

    async def log_audit_action(
        self,
        admin_chat_id: int,
        action_type: str,
        target: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_hash: Optional[str] = None,
    ) -> AdminAuditLogEntry:
        """
        Log an admin action to the audit log.
        
        Audit logs are stored in Redis with automatic expiration (30 days).
        For production, consider also writing to a database for permanent storage.
        """
        log_id = secrets.token_hex(8)
        now = datetime.now(timezone.utc)

        entry = AdminAuditLogEntry(
            id=log_id,
            admin_chat_id=admin_chat_id,
            action_type=action_type,
            target=target,
            reason=reason,
            metadata=metadata,
            ip_hash=ip_hash,
            timestamp=now.isoformat(),
        )

        # Store in Redis sorted set with timestamp score for ordering
        redis = await get_redis_client()
        key = f"{ADMIN_AUDIT_LOG_PREFIX}logs"
        score = now.timestamp()
        await redis.zadd(key, {entry.model_dump_json(): score})

        # Trim old entries (keep last 10000)
        await redis.zremrangebyrank(key, 0, -10001)

        logger.info(
            "Admin audit log entry created",
            log_id=log_id,
            admin_chat_id=admin_chat_id,
            action_type=action_type,
            target=target,
        )

        return entry

    async def get_audit_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        action_type: Optional[str] = None,
        admin_chat_id: Optional[int] = None,
    ) -> List[AdminAuditLogEntry]:
        """
        Retrieve audit log entries.
        
        Args:
            limit: Maximum entries to return
            offset: Offset for pagination
            action_type: Filter by action type
            admin_chat_id: Filter by admin chat ID
            
        Returns:
            List of audit log entries (newest first)
        """
        redis = await get_redis_client()
        key = f"{ADMIN_AUDIT_LOG_PREFIX}logs"

        # Get entries in reverse order (newest first)
        raw_entries = await redis.zrevrange(key, offset, offset + limit - 1)

        entries = []
        for raw in raw_entries:
            try:
                entry = AdminAuditLogEntry.model_validate_json(raw)
                
                # Apply filters
                if action_type and entry.action_type != action_type:
                    continue
                if admin_chat_id and entry.admin_chat_id != admin_chat_id:
                    continue
                    
                entries.append(entry)
            except Exception as e:
                logger.warning("Failed to parse audit log entry", error=str(e))
                continue

        return entries


# Singleton instance
_admin_session_service: Optional[AdminSessionService] = None


def get_admin_session_service() -> AdminSessionService:
    """Get the singleton admin session service instance."""
    global _admin_session_service
    if _admin_session_service is None:
        _admin_session_service = AdminSessionService()
    return _admin_session_service
