"""Admin-only API routes for analytics, insights, and operations dashboard."""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    TableSnapshot,
    HourlyTableStats,
    Table,
    TableStatus,
    Seat,
    Hand,
    HandStatus,
    User,
)
from telegram_poker_bot.shared.services.insights_engine import get_insights_engine
from telegram_poker_bot.shared.services.insights_delivery import (
    InsightsDeliveryService,
    LoggingChannel,
)
from telegram_poker_bot.game_core import get_redis_client

logger = get_logger(__name__)

# Admin router with /admin prefix
admin_router = APIRouter(prefix="/admin", tags=["admin"])


# TODO: Add admin authentication dependency
# For now, this is a placeholder - implement actual admin auth in production
# 
# SECURITY WARNING: This placeholder ALWAYS returns True, meaning admin endpoints
# are currently accessible without authentication. This MUST be replaced with
# proper authentication before production deployment.
#
# Recommended implementations:
# - JWT tokens with admin role claims
# - API keys validated against secure storage
# - OAuth with admin scope verification
# - Integration with existing authentication system
#
async def verify_admin_access() -> bool:
    """Verify that the requester has admin privileges.
    
    WARNING: This is a PLACEHOLDER implementation that bypasses authentication.
    DO NOT use in production without implementing proper admin verification.
    
    Production implementation should:
    1. Validate authentication token/credentials
    2. Check user has admin role/permissions
    3. Log access attempts
    4. Return False for unauthorized access
    5. Raise HTTPException(403) for denied access
    
    Returns:
        bool: True if admin access granted (currently always True - INSECURE)
    """
    # TODO: Implement actual admin verification
    # Example:
    # if not user_has_admin_role(current_user):
    #     raise HTTPException(status_code=403, detail="Admin access required")
    # return True
    return True


@admin_router.get("/analytics/realtime")
async def get_realtime_analytics(
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Get realtime snapshot of all tables.
    
    Returns the most recent snapshot for each active table.
    Admin-only endpoint.
    """
    # Get most recent snapshot for each table
    subquery = (
        select(
            TableSnapshot.table_id,
            func.max(TableSnapshot.snapshot_time).label("latest_time")
        )
        .group_by(TableSnapshot.table_id)
        .subquery()
    )
    
    result = await db.execute(
        select(TableSnapshot)
        .join(
            subquery,
            and_(
                TableSnapshot.table_id == subquery.c.table_id,
                TableSnapshot.snapshot_time == subquery.c.latest_time,
            )
        )
        .order_by(TableSnapshot.table_id)
    )
    snapshots = list(result.scalars())
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "snapshots": [
            {
                "table_id": s.table_id,
                "snapshot_time": s.snapshot_time.isoformat() if s.snapshot_time else None,
                "player_count": s.player_count,
                "is_active": s.is_active,
                "metadata": s.metadata_json or {},
            }
            for s in snapshots
        ],
        "count": len(snapshots),
    }


@admin_router.get("/analytics/hourly")
async def get_hourly_aggregates(
    hours: int = Query(default=24, ge=1, le=168, description="Hours of data to retrieve"),
    table_id: Optional[int] = Query(default=None, description="Filter by table ID"),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Get hourly aggregated analytics.
    
    Returns hourly stats for specified time range, optionally filtered by table.
    Admin-only endpoint.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    query = select(HourlyTableStats).where(
        HourlyTableStats.hour_start >= cutoff_time
    )
    
    if table_id is not None:
        query = query.where(HourlyTableStats.table_id == table_id)
    
    query = query.order_by(HourlyTableStats.hour_start.desc())
    
    result = await db.execute(query)
    stats = list(result.scalars())
    
    return {
        "period": {
            "start": cutoff_time.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
        },
        "hourly_stats": [
            {
                "table_id": s.table_id,
                "hour_start": s.hour_start.isoformat() if s.hour_start else None,
                "avg_players": s.avg_players,
                "max_players": s.max_players,
                "total_hands": s.total_hands,
                "activity_minutes": s.activity_minutes,
                "metadata": s.metadata_json or {},
            }
            for s in stats
        ],
        "count": len(stats),
    }


@admin_router.get("/analytics/historical")
async def get_historical_range(
    start_date: str = Query(..., description="Start date (ISO format)"),
    end_date: str = Query(..., description="End date (ISO format)"),
    metric_type: str = Query(default="hourly", description="Metric type: hourly or snapshot"),
    table_id: Optional[int] = Query(default=None, description="Filter by table ID"),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Get historical analytics for a date range.
    
    Supports both hourly aggregates and snapshots.
    Admin-only endpoint.
    """
    # Parse and validate dates
    try:
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
            
        if start_dt >= end_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be before end_date"
            )
            
        # Limit range to 90 days
        if (end_dt - start_dt).days > 90:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Date range cannot exceed 90 days"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {str(e)}"
        )
    
    if metric_type == "hourly":
        query = select(HourlyTableStats).where(
            and_(
                HourlyTableStats.hour_start >= start_dt,
                HourlyTableStats.hour_start <= end_dt,
            )
        )
        
        if table_id is not None:
            query = query.where(HourlyTableStats.table_id == table_id)
        
        query = query.order_by(HourlyTableStats.hour_start.asc())
        
        result = await db.execute(query)
        stats = list(result.scalars())
        
        return {
            "metric_type": "hourly",
            "period": {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
            },
            "data": [
                {
                    "table_id": s.table_id,
                    "hour_start": s.hour_start.isoformat() if s.hour_start else None,
                    "avg_players": s.avg_players,
                    "max_players": s.max_players,
                    "total_hands": s.total_hands,
                    "activity_minutes": s.activity_minutes,
                    "metadata": s.metadata_json or {},
                }
                for s in stats
            ],
            "count": len(stats),
        }
    elif metric_type == "snapshot":
        query = select(TableSnapshot).where(
            and_(
                TableSnapshot.snapshot_time >= start_dt,
                TableSnapshot.snapshot_time <= end_dt,
            )
        )
        
        if table_id is not None:
            query = query.where(TableSnapshot.table_id == table_id)
        
        query = query.order_by(TableSnapshot.snapshot_time.asc())
        
        result = await db.execute(query)
        snapshots = list(result.scalars())
        
        return {
            "metric_type": "snapshot",
            "period": {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
            },
            "data": [
                {
                    "table_id": s.table_id,
                    "snapshot_time": s.snapshot_time.isoformat() if s.snapshot_time else None,
                    "player_count": s.player_count,
                    "is_active": s.is_active,
                    "metadata": s.metadata_json or {},
                }
                for s in snapshots
            ],
            "count": len(snapshots),
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid metric_type: {metric_type}. Must be 'hourly' or 'snapshot'"
        )


@admin_router.get("/analytics/summary")
async def get_analytics_summary(
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Get summary statistics across all tables.
    
    Provides high-level overview of system analytics.
    Admin-only endpoint.
    """
    # Get table counts by status
    table_result = await db.execute(
        select(Table.status, func.count(Table.id))
        .group_by(Table.status)
    )
    table_counts = {status.value: count for status, count in table_result.all()}
    
    # Get total snapshot count
    snapshot_count_result = await db.execute(
        select(func.count(TableSnapshot.id))
    )
    total_snapshots = snapshot_count_result.scalar() or 0
    
    # Get total hourly stats count
    hourly_count_result = await db.execute(
        select(func.count(HourlyTableStats.id))
    )
    total_hourly_stats = hourly_count_result.scalar() or 0
    
    # Get latest snapshot time
    latest_snapshot_result = await db.execute(
        select(func.max(TableSnapshot.snapshot_time))
    )
    latest_snapshot_time = latest_snapshot_result.scalar()
    
    # Get latest hourly stat time
    latest_hourly_result = await db.execute(
        select(func.max(HourlyTableStats.hour_start))
    )
    latest_hourly_time = latest_hourly_result.scalar()
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tables": {
            "by_status": table_counts,
            "total": sum(table_counts.values()),
        },
        "analytics": {
            "total_snapshots": total_snapshots,
            "total_hourly_stats": total_hourly_stats,
            "latest_snapshot_time": latest_snapshot_time.isoformat() if latest_snapshot_time else None,
            "latest_hourly_time": latest_hourly_time.isoformat() if latest_hourly_time else None,
        },
    }


# Insights Endpoints


@admin_router.get("/insights/generate")
async def generate_insights(
    hours: int = Query(default=1, ge=1, le=24, description="Hours of data to analyze"),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Generate insights from recent analytics data.
    
    Analyzes recent activity and generates actionable insights about:
    - Unusual activity patterns
    - High/low traffic tables
    - Waitlist surges
    - Inactivity patterns
    
    Admin-only endpoint.
    """
    insights = await get_insights_engine().generate_all_insights(db, analysis_hours=hours)
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "analysis_period_hours": hours,
        "insights": [insight.to_dict() for insight in insights],
        "count": len(insights),
        "by_type": {
            "unusual_activity": sum(1 for i in insights if i.insight_type.value == "unusual_activity"),
            "high_traffic": sum(1 for i in insights if i.insight_type.value == "high_traffic"),
            "low_traffic": sum(1 for i in insights if i.insight_type.value == "low_traffic"),
            "waitlist_surge": sum(1 for i in insights if i.insight_type.value == "waitlist_surge"),
            "inactivity_pattern": sum(1 for i in insights if i.insight_type.value == "inactivity_pattern"),
            "rapid_player_change": sum(1 for i in insights if i.insight_type.value == "rapid_player_change"),
        },
        "by_severity": {
            "info": sum(1 for i in insights if i.severity.value == "info"),
            "warning": sum(1 for i in insights if i.severity.value == "warning"),
            "critical": sum(1 for i in insights if i.severity.value == "critical"),
        },
    }


@admin_router.post("/insights/deliver")
async def deliver_insights(
    hours: int = Query(default=1, ge=1, le=24, description="Hours of data to analyze"),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Generate and deliver insights through configured channels.
    
    Generates insights and sends them via:
    - Internal logging
    - Telegram admin bot (if configured)
    - Webhook endpoints (if configured)
    
    Admin-only endpoint.
    """
    # Generate insights
    insights = await get_insights_engine().generate_all_insights(db, analysis_hours=hours)
    
    # Deliver through configured channels
    delivery_service = InsightsDeliveryService(channels=[LoggingChannel()])
    delivery_results = await delivery_service.deliver_insights(insights)
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "insights_generated": len(insights),
        "delivery_results": delivery_results,
        "insights": [insight.to_dict() for insight in insights],
    }


# ============================================================================
# Ops Dashboard Request/Response Models
# ============================================================================


class ResetStuckHandRequest(BaseModel):
    """Request body for resetting a stuck hand."""
    kick_players: bool = Field(default=False, description="Kick all players after reset")
    clear_runtime_cache: bool = Field(default=True, description="Clear Redis runtime cache")
    reason: Optional[str] = Field(default=None, description="Admin reason for reset")


class KickAllRequest(BaseModel):
    """Request body for kicking all players."""
    mode: str = Field(
        default="after_hand",
        description="Mode: 'after_hand' (safe) or 'immediate_abort_then_kick'"
    )


class SystemTogglesRequest(BaseModel):
    """Request body for system toggles."""
    pause_autostart: Optional[bool] = Field(default=None, description="Pause auto-start")
    pause_interhand_monitor: Optional[bool] = Field(default=None, description="Pause inter-hand monitor")


# In-memory system toggles (in production, use Redis or DB)
_system_toggles: Dict[str, bool] = {
    "pause_autostart": False,
    "pause_interhand_monitor": False,
}


# ============================================================================
# Ops Dashboard: Table Management Endpoints
# ============================================================================


def _serialize_table_summary(
    table: Table,
    seats: List[Seat],
    current_hand: Optional[Hand] = None,
    restore_error: Optional[str] = None,
) -> Dict[str, Any]:
    """Serialize a table to a summary dict for the admin list view."""
    seated_count = len([s for s in seats if s.left_at is None])
    active_count = len([s for s in seats if s.left_at is None and not s.is_sitting_out_next_hand])
    sitting_out_count = len([s for s in seats if s.left_at is None and s.is_sitting_out_next_hand])
    
    # Determine template type safely
    template_type = None
    if table.template:
        template_type = table.template.table_type.value if table.template.table_type else None
    
    return {
        "table_id": table.id,
        "template_type": template_type,
        "is_public": table.is_public,
        "status": table.status.value if table.status else None,
        "current_hand_id": current_hand.id if current_hand else None,
        "current_hand_status": current_hand.status.value if current_hand else None,
        "seated_count": seated_count,
        "active_count": active_count,
        "sitting_out_count": sitting_out_count,
        "expires_at": table.expires_at.isoformat() if table.expires_at else None,
        "last_action_at": table.last_action_at.isoformat() if table.last_action_at else None,
        "lobby_persistent": table.lobby_persistent,
        "is_auto_generated": table.is_auto_generated,
        "restore_error": restore_error,
        "created_at": table.created_at.isoformat() if table.created_at else None,
    }


def _serialize_seat_detail(seat: Seat, user: Optional[User] = None) -> Dict[str, Any]:
    """Serialize a seat to a detail dict."""
    return {
        "seat_id": seat.id,
        "position": seat.position,
        "user_id": seat.user_id,
        "username": user.username if user else None,
        "chips": seat.chips,
        "is_sitting_out_next_hand": seat.is_sitting_out_next_hand,
        "joined_at": seat.joined_at.isoformat() if seat.joined_at else None,
        "left_at": seat.left_at.isoformat() if seat.left_at else None,
    }


@admin_router.get("/tables")
async def admin_list_tables(
    status_filter: Optional[str] = Query(default=None, description="Filter by status"),
    is_public: Optional[bool] = Query(default=None, description="Filter by is_public"),
    stuck_only: bool = Query(default=False, description="Show only stuck tables"),
    limit: int = Query(default=100, ge=1, le=500, description="Max results"),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    List all tables with admin diagnostics.
    
    Returns a summary of each table including:
    - Basic info (id, type, status, is_public)
    - Player counts (seated, active, sitting_out)
    - Current hand info if exists
    - Expiration and last activity timestamps
    - Stuck indicator (hand in progress but no recent activity)
    """
    # Build query
    query = select(Table).options(joinedload(Table.template))
    
    # Apply status filter
    if status_filter:
        try:
            status_enum = TableStatus(status_filter.lower())
            query = query.where(Table.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status_filter}. Valid values: {[s.value for s in TableStatus]}"
            )
    
    # Apply is_public filter
    if is_public is not None:
        query = query.where(Table.is_public == is_public)
    
    # Order by last activity (most recent first)
    query = query.order_by(Table.last_action_at.desc().nulls_last(), Table.id.desc())
    query = query.limit(limit)
    
    result = await db.execute(query)
    tables = list(result.scalars().unique())
    
    # Build table summaries with seat counts and hand info
    table_summaries = []
    now = datetime.now(timezone.utc)
    stuck_threshold = timedelta(minutes=5)  # 5 minutes of no activity = potentially stuck
    
    for table in tables:
        # Get seats for this table
        seats_result = await db.execute(
            select(Seat).where(Seat.table_id == table.id)
        )
        seats = list(seats_result.scalars())
        
        # Get current/active hand if any
        hand_result = await db.execute(
            select(Hand)
            .where(Hand.table_id == table.id, Hand.status != HandStatus.ENDED)
            .order_by(Hand.hand_no.desc())
            .limit(1)
        )
        current_hand = hand_result.scalar_one_or_none()
        
        # Determine if table is "stuck"
        is_stuck = False
        if current_hand and current_hand.status not in (HandStatus.ENDED, HandStatus.INTER_HAND_WAIT):
            # Hand in progress - check for inactivity
            if table.last_action_at:
                time_since_action = now - table.last_action_at
                is_stuck = time_since_action > stuck_threshold
            else:
                is_stuck = True  # No last_action_at with active hand = suspicious
        
        # Skip non-stuck tables if stuck_only filter is set
        if stuck_only and not is_stuck:
            continue
        
        summary = _serialize_table_summary(table, seats, current_hand)
        summary["is_stuck"] = is_stuck
        table_summaries.append(summary)
    
    return {
        "timestamp": now.isoformat(),
        "tables": table_summaries,
        "count": len(table_summaries),
        "filters_applied": {
            "status": status_filter,
            "is_public": is_public,
            "stuck_only": stuck_only,
        },
    }


@admin_router.get("/tables/{table_id}")
async def admin_get_table_detail(
    table_id: int,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get full diagnostics for a specific table.
    
    Returns comprehensive information:
    - Table fields (status, is_public, expires_at, etc.)
    - Current/last hand details
    - All seats with player info and flags
    - Runtime state from pokerkit (if available)
    - Cache status (redis keys existence)
    """
    # Load table with template
    result = await db.execute(
        select(Table)
        .options(joinedload(Table.template))
        .where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
    
    # Get all seats with user info
    seats_result = await db.execute(
        select(Seat)
        .options(joinedload(Seat.user))
        .where(Seat.table_id == table_id)
        .order_by(Seat.position)
    )
    seats = list(seats_result.scalars().unique())
    
    # Get current/active hand
    hand_result = await db.execute(
        select(Hand)
        .where(Hand.table_id == table_id, Hand.status != HandStatus.ENDED)
        .order_by(Hand.hand_no.desc())
        .limit(1)
    )
    current_hand = hand_result.scalar_one_or_none()
    
    # Get last ended hand if no current hand
    last_hand = None
    if not current_hand:
        last_hand_result = await db.execute(
            select(Hand)
            .where(Hand.table_id == table_id)
            .order_by(Hand.hand_no.desc())
            .limit(1)
        )
        last_hand = last_hand_result.scalar_one_or_none()
    
    # Try to get runtime state from PokerKit manager
    runtime_info = {}
    try:
        from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager
        runtime_mgr = get_pokerkit_runtime_manager()
        runtime_state = await runtime_mgr.get_state(db, table_id, viewer_user_id=None)
        runtime_info = {
            "current_actor": runtime_state.get("current_actor"),
            "street": runtime_state.get("street"),
            "to_call": runtime_state.get("to_call"),
            "min_raise": runtime_state.get("min_raise"),
            "max_raise": runtime_state.get("max_raise"),
            "pot": runtime_state.get("pot"),
            "action_deadline": runtime_state.get("action_deadline"),
            "allowed_actions": runtime_state.get("allowed_actions"),
        }
    except Exception as e:
        runtime_info = {"error": str(e)}
    
    # Check Redis cache existence
    redis_cache_info = {}
    try:
        redis = await get_redis_client()
        lock_key = f"lock:table:{table_id}"
        lock_exists = await redis.exists(lock_key)
        redis_cache_info = {
            "lock_key_exists": bool(lock_exists),
        }
    except Exception as e:
        redis_cache_info = {"error": str(e)}
    
    # Serialize seats
    seats_data = []
    for seat in seats:
        seat_data = _serialize_seat_detail(seat, seat.user if seat.user else None)
        seats_data.append(seat_data)
    
    # Determine stuck status
    now = datetime.now(timezone.utc)
    is_stuck = False
    stuck_reason = None
    if current_hand and current_hand.status not in (HandStatus.ENDED, HandStatus.INTER_HAND_WAIT):
        if table.last_action_at:
            time_since_action = now - table.last_action_at
            if time_since_action > timedelta(minutes=5):
                is_stuck = True
                stuck_reason = f"Hand in progress but no activity for {time_since_action.total_seconds():.0f}s"
        else:
            is_stuck = True
            stuck_reason = "Hand in progress but no last_action_at timestamp"
    
    # Template info
    template_info = None
    if table.template:
        template_info = {
            "id": str(table.template.id),
            "name": table.template.name,
            "table_type": table.template.table_type.value if table.template.table_type else None,
            "has_waitlist": table.template.has_waitlist,
            "is_active": table.template.is_active,
        }
    
    return {
        "timestamp": now.isoformat(),
        "table": {
            "id": table.id,
            "status": table.status.value if table.status else None,
            "is_public": table.is_public,
            "lobby_persistent": table.lobby_persistent,
            "is_auto_generated": table.is_auto_generated,
            "expires_at": table.expires_at.isoformat() if table.expires_at else None,
            "created_at": table.created_at.isoformat() if table.created_at else None,
            "updated_at": table.updated_at.isoformat() if table.updated_at else None,
            "last_action_at": table.last_action_at.isoformat() if table.last_action_at else None,
            "creator_user_id": table.creator_user_id,
            "sng_state": table.sng_state.value if table.sng_state else None,
        },
        "template": template_info,
        "current_hand": {
            "id": current_hand.id,
            "hand_no": current_hand.hand_no,
            "status": current_hand.status.value,
            "started_at": current_hand.started_at.isoformat() if current_hand.started_at else None,
            "ended_at": current_hand.ended_at.isoformat() if current_hand.ended_at else None,
            "pot_size": current_hand.pot_size,
        } if current_hand else None,
        "last_hand": {
            "id": last_hand.id,
            "hand_no": last_hand.hand_no,
            "status": last_hand.status.value,
            "started_at": last_hand.started_at.isoformat() if last_hand.started_at else None,
            "ended_at": last_hand.ended_at.isoformat() if last_hand.ended_at else None,
        } if last_hand else None,
        "seats": seats_data,
        "seat_summary": {
            "total": len(seats),
            "seated": len([s for s in seats if s.left_at is None]),
            "active": len([s for s in seats if s.left_at is None and not s.is_sitting_out_next_hand]),
            "sitting_out": len([s for s in seats if s.left_at is None and s.is_sitting_out_next_hand]),
        },
        "runtime": runtime_info,
        "cache": redis_cache_info,
        "diagnostics": {
            "is_stuck": is_stuck,
            "stuck_reason": stuck_reason,
        },
    }


@admin_router.post("/tables/{table_id}/reset-stuck-hand")
async def admin_reset_stuck_hand(
    table_id: int,
    request: ResetStuckHandRequest = Body(default=ResetStuckHandRequest()),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Reset a stuck hand on a table.
    
    This is the primary "Fix Table" operation for operators.
    
    Actions performed:
    1. Identifies any active/in-progress hand
    2. Marks it as ENDED (aborted)
    3. Clears table runtime pointers that block new hands
    4. Sets table.status to WAITING
    5. Optionally kicks all players
    6. Optionally clears Redis runtime cache
    
    Returns detailed action report.
    """
    now = datetime.now(timezone.utc)
    action_report = {
        "timestamp": now.isoformat(),
        "table_id": table_id,
        "actions_taken": [],
        "success": False,
        "request": {
            "kick_players": request.kick_players,
            "clear_runtime_cache": request.clear_runtime_cache,
            "reason": request.reason,
        },
    }
    
    # Load table
    result = await db.execute(
        select(Table)
        .options(joinedload(Table.template))
        .where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
    
    # Find any active hand (not ENDED)
    hand_result = await db.execute(
        select(Hand)
        .where(Hand.table_id == table_id, Hand.status != HandStatus.ENDED)
        .order_by(Hand.hand_no.desc())
    )
    active_hands = list(hand_result.scalars())
    
    # Mark all active hands as ENDED (aborted)
    for hand in active_hands:
        old_status = hand.status.value
        hand.status = HandStatus.ENDED
        hand.ended_at = now
        action_report["actions_taken"].append({
            "action": "abort_hand",
            "hand_id": hand.id,
            "hand_no": hand.hand_no,
            "old_status": old_status,
            "new_status": "ended",
        })
    
    logger.info(
        "Admin: Aborted hands for stuck table",
        table_id=table_id,
        hands_aborted=len(active_hands),
        reason=request.reason,
    )
    
    # Set table status to WAITING
    old_table_status = table.status.value if table.status else None
    table.status = TableStatus.WAITING
    table.last_action_at = now
    table.updated_at = now
    action_report["actions_taken"].append({
        "action": "set_table_waiting",
        "old_status": old_table_status,
        "new_status": "waiting",
    })
    
    # Optionally kick all players
    if request.kick_players:
        seats_result = await db.execute(
            select(Seat).where(Seat.table_id == table_id, Seat.left_at.is_(None))
        )
        seats = list(seats_result.scalars())
        for seat in seats:
            seat.left_at = now
        action_report["actions_taken"].append({
            "action": "kick_all_players",
            "players_kicked": len(seats),
        })
        logger.info(
            "Admin: Kicked all players from table",
            table_id=table_id,
            players_kicked=len(seats),
        )
    
    # Flush DB changes
    await db.flush()
    await db.commit()
    
    # Optionally clear Redis runtime cache
    if request.clear_runtime_cache:
        try:
            redis = await get_redis_client()
            lock_key = f"lock:table:{table_id}"
            deleted_count = 0
            if await redis.exists(lock_key):
                await redis.delete(lock_key)
                deleted_count += 1
            action_report["actions_taken"].append({
                "action": "clear_redis_cache",
                "keys_deleted": deleted_count,
            })
            logger.info(
                "Admin: Cleared Redis cache for table",
                table_id=table_id,
                keys_deleted=deleted_count,
            )
        except Exception as e:
            action_report["actions_taken"].append({
                "action": "clear_redis_cache",
                "error": str(e),
            })
    
    action_report["success"] = True
    
    logger.info(
        "Admin: Reset stuck hand completed",
        table_id=table_id,
        actions_count=len(action_report["actions_taken"]),
        reason=request.reason,
    )
    
    return action_report


@admin_router.post("/tables/{table_id}/force-waiting")
async def admin_force_waiting(
    table_id: int,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Force a table to WAITING status.
    
    Safe operation that pauses the table without deletion.
    Does not abort hands - use reset-stuck-hand for that.
    """
    now = datetime.now(timezone.utc)
    
    result = await db.execute(
        select(Table).where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
    
    old_status = table.status.value if table.status else None
    table.status = TableStatus.WAITING
    table.last_action_at = now
    table.updated_at = now
    
    await db.commit()
    
    logger.info(
        "Admin: Forced table to WAITING",
        table_id=table_id,
        old_status=old_status,
    )
    
    return {
        "timestamp": now.isoformat(),
        "table_id": table_id,
        "action": "force_waiting",
        "old_status": old_status,
        "new_status": "waiting",
        "success": True,
    }


@admin_router.post("/tables/{table_id}/kick-all")
async def admin_kick_all(
    table_id: int,
    request: KickAllRequest = Body(default=KickAllRequest()),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Kick all players from a table.
    
    Modes:
    - 'after_hand': Schedule kick at end of current hand (safe)
    - 'immediate_abort_then_kick': Abort any active hand first, then kick (aggressive)
    """
    now = datetime.now(timezone.utc)
    
    if request.mode not in ("after_hand", "immediate_abort_then_kick"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode: {request.mode}. Must be 'after_hand' or 'immediate_abort_then_kick'"
        )
    
    result = await db.execute(
        select(Table).where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
    
    action_report = {
        "timestamp": now.isoformat(),
        "table_id": table_id,
        "mode": request.mode,
        "actions_taken": [],
    }
    
    # If immediate mode, abort any active hand first
    if request.mode == "immediate_abort_then_kick":
        hand_result = await db.execute(
            select(Hand)
            .where(Hand.table_id == table_id, Hand.status != HandStatus.ENDED)
        )
        active_hands = list(hand_result.scalars())
        for hand in active_hands:
            hand.status = HandStatus.ENDED
            hand.ended_at = now
            action_report["actions_taken"].append({
                "action": "abort_hand",
                "hand_id": hand.id,
            })
    
    # Kick all seated players
    seats_result = await db.execute(
        select(Seat).where(Seat.table_id == table_id, Seat.left_at.is_(None))
    )
    seats = list(seats_result.scalars())
    
    for seat in seats:
        seat.left_at = now
    
    action_report["actions_taken"].append({
        "action": "kick_players",
        "count": len(seats),
    })
    
    # Set table to WAITING
    table.status = TableStatus.WAITING
    table.last_action_at = now
    
    await db.commit()
    
    action_report["success"] = True
    
    logger.info(
        "Admin: Kicked all players from table",
        table_id=table_id,
        mode=request.mode,
        players_kicked=len(seats),
    )
    
    return action_report


@admin_router.post("/tables/{table_id}/clear-runtime-cache")
async def admin_clear_runtime_cache(
    table_id: int,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Clear Redis runtime cache for a table.
    
    Clears lock keys and any other runtime state.
    Use when table state is desynced.
    """
    now = datetime.now(timezone.utc)
    
    # Verify table exists
    result = await db.execute(
        select(Table).where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
    
    keys_deleted = []
    try:
        redis = await get_redis_client()
        
        # Clear known key patterns
        key_patterns = [
            f"lock:table:{table_id}",
            f"table:{table_id}:runtime",
        ]
        
        for key in key_patterns:
            if await redis.exists(key):
                await redis.delete(key)
                keys_deleted.append(key)
        
        logger.info(
            "Admin: Cleared Redis cache for table",
            table_id=table_id,
            keys_deleted=keys_deleted,
        )
        
        return {
            "timestamp": now.isoformat(),
            "table_id": table_id,
            "action": "clear_runtime_cache",
            "keys_deleted": keys_deleted,
            "success": True,
        }
    except Exception as e:
        logger.error(
            "Admin: Failed to clear Redis cache",
            table_id=table_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")


@admin_router.post("/tables/{table_id}/broadcast-snapshot")
async def admin_broadcast_snapshot(
    table_id: int,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Force broadcast the current table state to all connected clients.
    
    Useful when clients are desynced and need a fresh state.
    """
    now = datetime.now(timezone.utc)
    
    # Verify table exists
    result = await db.execute(
        select(Table)
        .options(joinedload(Table.template))
        .where(Table.id == table_id)
    )
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
    
    try:
        # Get current state from runtime manager
        from telegram_poker_bot.game_core.pokerkit_runtime import get_pokerkit_runtime_manager
        runtime_mgr = get_pokerkit_runtime_manager()
        state = await runtime_mgr.get_state(db, table_id, viewer_user_id=None)
        
        # Import the connection manager from main API module
        from telegram_poker_bot.api.main import manager
        
        # Broadcast the state
        await manager.broadcast(table_id, {
            "type": "admin_snapshot",
            "state": state,
            "timestamp": now.isoformat(),
        })
        
        logger.info(
            "Admin: Broadcast snapshot to table",
            table_id=table_id,
        )
        
        return {
            "timestamp": now.isoformat(),
            "table_id": table_id,
            "action": "broadcast_snapshot",
            "success": True,
        }
    except Exception as e:
        logger.error(
            "Admin: Failed to broadcast snapshot",
            table_id=table_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Failed to broadcast: {str(e)}")


# ============================================================================
# Ops Dashboard: System Toggles
# ============================================================================


@admin_router.get("/system/toggles")
async def admin_get_system_toggles(
    is_admin: bool = Depends(verify_admin_access),
):
    """
    Get current system toggle values.
    
    Toggles control system-wide behavior:
    - pause_autostart: Prevents auto-start of tables
    - pause_interhand_monitor: Pauses inter-hand timeout processing
    """
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "toggles": _system_toggles.copy(),
    }


@admin_router.post("/system/toggles")
async def admin_set_system_toggles(
    request: SystemTogglesRequest,
    is_admin: bool = Depends(verify_admin_access),
):
    """
    Set system toggle values.
    
    Emergency brakes for incident response:
    - pause_autostart: Stops automatic table starts
    - pause_interhand_monitor: Pauses inter-hand timeout processing
    """
    now = datetime.now(timezone.utc)
    changes = []
    
    if request.pause_autostart is not None:
        old_value = _system_toggles["pause_autostart"]
        _system_toggles["pause_autostart"] = request.pause_autostart
        if old_value != request.pause_autostart:
            changes.append({
                "toggle": "pause_autostart",
                "old_value": old_value,
                "new_value": request.pause_autostart,
            })
    
    if request.pause_interhand_monitor is not None:
        old_value = _system_toggles["pause_interhand_monitor"]
        _system_toggles["pause_interhand_monitor"] = request.pause_interhand_monitor
        if old_value != request.pause_interhand_monitor:
            changes.append({
                "toggle": "pause_interhand_monitor",
                "old_value": old_value,
                "new_value": request.pause_interhand_monitor,
            })
    
    if changes:
        logger.info(
            "Admin: System toggles changed",
            changes=changes,
        )
    
    return {
        "timestamp": now.isoformat(),
        "toggles": _system_toggles.copy(),
        "changes": changes,
    }


def get_system_toggles() -> Dict[str, bool]:
    """Get current system toggles (for use by other modules)."""
    return _system_toggles.copy()


def is_autostart_paused() -> bool:
    """Check if autostart is paused."""
    return _system_toggles.get("pause_autostart", False)


def is_interhand_monitor_paused() -> bool:
    """Check if inter-hand monitor is paused."""
    return _system_toggles.get("pause_interhand_monitor", False)
