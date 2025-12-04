"""User analytics API routes - Public analytics endpoints.

Provides privacy-safe analytics endpoints for users including:
- Personal statistics
- Hand history
- Leaderboards
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    HandAnalytics,
    PlayerSession,
    HourlyPlayerStats,
    LeaderboardSnapshot,
    User,
)

logger = get_logger(__name__)

# Router for user analytics
analytics_user_router = APIRouter(prefix="/profile", tags=["user-analytics"])


# ==================== Request/Response Models ====================

class UserStatsResponse(BaseModel):
    """User statistics summary."""
    user_id: int
    total_hands: int
    total_sessions: int
    net_profit: int
    vpip_pct: float
    pfr_pct: float
    af: Optional[float]


class HandSummaryResponse(BaseModel):
    """Hand summary for user."""
    hand_id: int
    table_id: int
    hand_no: int
    variant: str
    stakes: str
    players_in_hand: int
    total_pot: int
    my_net: Optional[int]
    created_at: datetime


# ==================== Helper Functions ====================

async def get_current_user_id() -> int:
    """Get current authenticated user ID.
    
    TODO: Implement actual authentication
    For now, returns a placeholder.
    """
    # TODO: Extract from JWT token or session
    return 1


# ==================== Profile Stats Endpoints ====================

@analytics_user_router.get("/stats")
async def get_my_stats(
    hours: int = Query(default=168, ge=1, le=720, description="Hours of data to retrieve"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get authenticated user's statistics.
    
    Returns personal performance metrics including VPIP, PFR, AF,
    profit/loss, and session summaries.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Get hourly stats
    hourly_result = await db.execute(
        select(HourlyPlayerStats)
        .where(
            and_(
                HourlyPlayerStats.user_id == user_id,
                HourlyPlayerStats.hour_start >= cutoff_time,
            )
        )
        .order_by(HourlyPlayerStats.hour_start)
    )
    hourly_stats = list(hourly_result.scalars().all())
    
    # Calculate aggregates
    total_hands = sum(s.hands_played for s in hourly_stats)
    total_vpip = sum(s.vpip_count for s in hourly_stats)
    total_pfr = sum(s.pfr_count for s in hourly_stats)
    total_af_num = sum(s.af_numerator for s in hourly_stats)
    total_af_den = sum(s.af_denominator for s in hourly_stats)
    total_profit = sum(s.net_profit for s in hourly_stats)
    total_rake = sum(s.rake_paid for s in hourly_stats)
    
    vpip_pct = (total_vpip / total_hands) if total_hands > 0 else 0.0
    pfr_pct = (total_pfr / total_hands) if total_hands > 0 else 0.0
    af = (total_af_num / total_af_den) if total_af_den > 0 else None
    
    # Get variant breakdown
    variant_breakdown = {}
    for stat in hourly_stats:
        if stat.variant_breakdown:
            for variant, data in stat.variant_breakdown.items():
                if variant not in variant_breakdown:
                    variant_breakdown[variant] = {"hands": 0, "profit": 0}
                variant_breakdown[variant]["hands"] += data.get("hands", 0)
                variant_breakdown[variant]["profit"] += data.get("profit", 0)
    
    return {
        "user_id": user_id,
        "period": {
            "start": cutoff_time.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
        },
        "summary": {
            "total_hands": total_hands,
            "net_profit": total_profit,
            "total_rake": total_rake,
            "vpip_pct": round(vpip_pct, 3),
            "pfr_pct": round(pfr_pct, 3),
            "af": round(af, 2) if af is not None else None,
        },
        "variant_breakdown": variant_breakdown,
        "hourly_stats": [
            {
                "hour_start": s.hour_start.isoformat() if s.hour_start else None,
                "hands_played": s.hands_played,
                "net_profit": s.net_profit,
                "vpip_pct": round(s.vpip_count / s.hands_played, 3) if s.hands_played > 0 else 0.0,
                "pfr_pct": round(s.pfr_count / s.hands_played, 3) if s.hands_played > 0 else 0.0,
            }
            for s in hourly_stats
        ],
    }


@analytics_user_router.get("/hands")
async def get_my_hands(
    limit: int = Query(50, ge=1, le=200, description="Number of hands to retrieve"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    variant: Optional[str] = Query(None, description="Filter by variant"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get authenticated user's hand history.
    
    Returns detailed hand summaries where user participated.
    Privacy-safe: Does not expose other players' hole cards.
    """
    # Get hands where user participated
    # This is simplified - ideally we'd query HandAnalytics.positions JSONB
    # For now, get recent sessions and their hands
    
    sessions_result = await db.execute(
        select(PlayerSession)
        .where(PlayerSession.user_id == user_id)
        .order_by(PlayerSession.session_start.desc())
        .limit(100)
    )
    sessions = list(sessions_result.scalars().all())
    
    table_ids = [s.table_id for s in sessions]
    
    if not table_ids:
        return {
            "count": 0,
            "hands": [],
        }
    
    # Get hand analytics for these tables
    query = select(HandAnalytics).where(
        HandAnalytics.table_id.in_(table_ids)
    )
    
    if variant:
        query = query.where(HandAnalytics.variant == variant)
    
    query = query.order_by(HandAnalytics.created_at.desc())
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    hands = list(result.scalars().all())
    
    # Build response with user's perspective
    hands_response = []
    for hand in hands:
        # Extract user's net from player_deltas
        my_net = None
        if hand.player_deltas and user_id in hand.player_deltas:
            my_net = hand.player_deltas[user_id].get("net_chips")
        
        hands_response.append({
            "hand_id": hand.hand_id,
            "table_id": hand.table_id,
            "hand_no": hand.hand_no,
            "variant": hand.variant,
            "stakes": hand.stakes,
            "players_in_hand": hand.players_in_hand,
            "total_pot": hand.total_pot,
            "my_net": my_net,
            "went_to_showdown": hand.went_to_showdown,
            "multiway": hand.multiway,
            "created_at": hand.created_at.isoformat() if hand.created_at else None,
        })
    
    return {
        "count": len(hands_response),
        "hands": hands_response,
    }


@analytics_user_router.get("/sessions")
async def get_my_sessions(
    limit: int = Query(20, ge=1, le=100, description="Number of sessions to retrieve"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get authenticated user's session history.
    
    Returns session summaries with buy-in, cash-out, and performance metrics.
    """
    result = await db.execute(
        select(PlayerSession)
        .where(PlayerSession.user_id == user_id)
        .order_by(PlayerSession.session_start.desc())
        .offset(offset)
        .limit(limit)
    )
    sessions = list(result.scalars().all())
    
    return {
        "count": len(sessions),
        "sessions": [
            {
                "session_id": s.id,
                "table_id": s.table_id,
                "session_start": s.session_start.isoformat() if s.session_start else None,
                "session_end": s.session_end.isoformat() if s.session_end else None,
                "duration_minutes": (
                    int((s.session_end - s.session_start).total_seconds() / 60)
                    if s.session_end and s.session_start
                    else None
                ),
                "buy_in": s.buy_in,
                "cash_out": s.cash_out,
                "net": s.net,
                "hands_played": s.hands_played,
                "vpip_pct": round(s.vpip_count / s.hands_played, 3) if s.hands_played > 0 else 0.0,
                "pfr_pct": round(s.pfr_count / s.hands_played, 3) if s.hands_played > 0 else 0.0,
            }
            for s in sessions
        ],
    }


# ==================== Leaderboards ====================

@analytics_user_router.get("/leaderboards")
async def get_public_leaderboards(
    leaderboard_type: str = Query("daily", description="Leaderboard type"),
    variant: Optional[str] = Query(None, description="Filter by variant"),
    db: AsyncSession = Depends(get_db),
):
    """Get public leaderboards.
    
    Returns anonymized leaderboard data (usernames only, no personal details).
    """
    # Get latest snapshot for the requested type
    query = select(LeaderboardSnapshot).where(
        LeaderboardSnapshot.leaderboard_type == leaderboard_type
    )
    
    if variant:
        query = query.where(LeaderboardSnapshot.variant == variant)
    
    query = query.order_by(LeaderboardSnapshot.snapshot_time.desc()).limit(1)
    
    result = await db.execute(query)
    snapshot = result.scalar_one_or_none()
    
    if not snapshot:
        return {
            "leaderboard_type": leaderboard_type,
            "variant": variant,
            "snapshot_time": None,
            "rankings": [],
        }
    
    # Anonymize rankings (remove sensitive info)
    anonymized_rankings = []
    for ranking in (snapshot.rankings or []):
        # Get username for display
        user_result = await db.execute(
            select(User.username).where(User.id == ranking.get("user_id"))
        )
        user_row = user_result.one_or_none()
        username = user_row[0] if user_row else "Anonymous"
        
        anonymized_rankings.append({
            "rank": ranking.get("rank"),
            "username": username,
            "score": ranking.get("score"),
            "hands": ranking.get("hands"),
        })
    
    return {
        "leaderboard_type": leaderboard_type,
        "variant": snapshot.variant,
        "snapshot_time": snapshot.snapshot_time.isoformat() if snapshot.snapshot_time else None,
        "rankings": anonymized_rankings,
    }


@analytics_user_router.get("/leaderboards/my-rank")
async def get_my_leaderboard_rank(
    leaderboard_type: str = Query("daily", description="Leaderboard type"),
    variant: Optional[str] = Query(None, description="Filter by variant"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get authenticated user's rank on leaderboard.
    
    Returns user's current position and nearby players.
    """
    # Get latest snapshot
    query = select(LeaderboardSnapshot).where(
        LeaderboardSnapshot.leaderboard_type == leaderboard_type
    )
    
    if variant:
        query = query.where(LeaderboardSnapshot.variant == variant)
    
    query = query.order_by(LeaderboardSnapshot.snapshot_time.desc()).limit(1)
    
    result = await db.execute(query)
    snapshot = result.scalar_one_or_none()
    
    if not snapshot:
        return {
            "leaderboard_type": leaderboard_type,
            "variant": variant,
            "my_rank": None,
            "nearby": [],
        }
    
    # Find user's rank
    my_ranking = None
    for ranking in (snapshot.rankings or []):
        if ranking.get("user_id") == user_id:
            my_ranking = ranking
            break
    
    if not my_ranking:
        return {
            "leaderboard_type": leaderboard_type,
            "variant": variant,
            "my_rank": None,
            "nearby": [],
        }
    
    # Get nearby players (±5 ranks)
    my_rank = my_ranking.get("rank")
    nearby = []
    
    for ranking in (snapshot.rankings or []):
        rank = ranking.get("rank")
        if abs(rank - my_rank) <= 5:
            # Get username
            user_result = await db.execute(
                select(User.username).where(User.id == ranking.get("user_id"))
            )
            user_row = user_result.one_or_none()
            username = user_row[0] if user_row else "Anonymous"
            
            nearby.append({
                "rank": rank,
                "username": username,
                "score": ranking.get("score"),
                "is_me": ranking.get("user_id") == user_id,
            })
    
    return {
        "leaderboard_type": leaderboard_type,
        "variant": variant,
        "my_rank": my_rank,
        "my_score": my_ranking.get("score"),
        "nearby": sorted(nearby, key=lambda x: x["rank"]),
    }
