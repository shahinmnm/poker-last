"""Global waitlist API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.models import GlobalWaitlistEntry, WaitlistStatus
from telegram_poker_bot.shared.services import global_waitlist

router = APIRouter(prefix="/global-waitlist", tags=["global_waitlist"])


class JoinGlobalWaitlistRequest(BaseModel):
    """Request to join the global waitlist."""
    game_variant: Optional[str] = None


class JoinGlobalWaitlistResponse(BaseModel):
    """Response after joining global waitlist."""
    position: int
    estimated_wait_time: int  # seconds


class GlobalWaitlistStatsResponse(BaseModel):
    """Global waitlist statistics."""
    total_waiting: int
    by_variant: dict


def get_user_id(x_user_id: Optional[str] = None) -> int:
    """Dependency to get user ID from headers.
    
    WARNING: This is a SIMPLIFIED authentication mechanism for Phase 2 demonstration.
    In production, this MUST be replaced with:
    1. Telegram Mini App init data validation (verify_telegram_init_data)
    2. JWT token-based authentication
    3. Or other secure authentication mechanism
    
    The current implementation is VULNERABLE to user ID spoofing and should
    NEVER be used in production without proper security hardening.
    
    TODO (Security): Replace with proper authentication before production deployment.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    try:
        return int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")


@router.post("/join", response_model=JoinGlobalWaitlistResponse)
async def join_global_waitlist_endpoint(
    request: JoinGlobalWaitlistRequest,
    user_id: int = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Join the global waitlist for auto-routing to available tables."""
    try:
        entry = await global_waitlist.join_global_waitlist(
            db,
            user_id=user_id,
            game_variant=request.game_variant,
        )
        await db.commit()
        
        # Calculate position (count earlier entries)
        result = await db.execute(
            select(func.count(GlobalWaitlistEntry.id)).where(
                GlobalWaitlistEntry.status == WaitlistStatus.WAITING,
                GlobalWaitlistEntry.created_at <= entry.created_at,
            )
        )
        position = result.scalar() or 1
        
        return JoinGlobalWaitlistResponse(
            position=position,
            estimated_wait_time=position * 30,  # Rough estimate: 30s per position
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/leave")
async def leave_global_waitlist_endpoint(
    user_id: int = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Leave the global waitlist."""
    entry = await global_waitlist.leave_global_waitlist(db, user_id)
    await db.commit()
    
    if not entry:
        raise HTTPException(status_code=404, detail="User not in global waitlist")
    
    return {"success": True}


@router.get("", response_model=GlobalWaitlistStatsResponse)
async def get_global_waitlist_stats_endpoint(
    db: AsyncSession = Depends(get_db),
):
    """Get global waitlist statistics."""
    stats = await global_waitlist.get_global_waitlist_stats(db)
    return GlobalWaitlistStatsResponse(**stats)
