"""Admin-only API routes for analytics, insights, and operations dashboard."""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Request
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
    Transaction,
    CurrencyType,
    TransactionType,
)
from telegram_poker_bot.shared.services.insights_engine import get_insights_engine
from telegram_poker_bot.shared.services.insights_delivery import (
    InsightsDeliveryService,
    LoggingChannel,
)
from telegram_poker_bot.shared.services.admin_session_service import (
    get_admin_session_service,
    AdminSession,
)
from telegram_poker_bot.game_core import get_redis_client

logger = get_logger(__name__)

# Admin router with /admin prefix
admin_router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================================
# Admin Session Authentication Dependency
# ============================================================================


async def get_admin_session_from_cookie(
    request: Request,
) -> Optional[AdminSession]:
    """Extract and validate admin session from cookie."""
    session_id = request.cookies.get("admin_session")
    if not session_id:
        return None
    
    service = get_admin_session_service()
    return await service.validate_session(session_id)


async def verify_admin_access(
    request: Request,
    session: Optional[AdminSession] = Depends(get_admin_session_from_cookie),
) -> AdminSession:
    """Verify that the requester has a valid admin session.
    
    This replaces the old placeholder authentication with session-based auth.
    Admin sessions are created through the Telegram /admin command flow.
    
    Returns:
        AdminSession: The validated admin session
        
    Raises:
        HTTPException: If session is missing or invalid
    """
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session required. Please use /admin command in Telegram to get access.",
            headers={"WWW-Authenticate": "AdminSession"},
        )
    return session


@admin_router.get("/analytics/realtime")
async def get_realtime_analytics(
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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


# Redis key for system toggles (persistent across restarts and workers)
SYSTEM_TOGGLES_REDIS_KEY = "admin:system_toggles"

# Default system toggles
_DEFAULT_SYSTEM_TOGGLES: Dict[str, bool] = {
    "pause_autostart": False,
    "pause_interhand_monitor": False,
}

# Stuck table threshold in minutes (configurable)
STUCK_TABLE_THRESHOLD_MINUTES = 5


async def _get_system_toggles_from_redis() -> Dict[str, bool]:
    """Get system toggles from Redis, falling back to defaults."""
    try:
        redis = await get_redis_client()
        data = await redis.hgetall(SYSTEM_TOGGLES_REDIS_KEY)
        if not data:
            return _DEFAULT_SYSTEM_TOGGLES.copy()
        return {
            "pause_autostart": data.get(b"pause_autostart", b"false").decode() == "true",
            "pause_interhand_monitor": data.get(b"pause_interhand_monitor", b"false").decode() == "true",
        }
    except Exception as e:
        logger.warning("Failed to get system toggles from Redis, using defaults", error=str(e))
        return _DEFAULT_SYSTEM_TOGGLES.copy()


async def _set_system_toggle_in_redis(toggle: str, value: bool) -> None:
    """Set a system toggle in Redis."""
    try:
        redis = await get_redis_client()
        await redis.hset(SYSTEM_TOGGLES_REDIS_KEY, toggle, "true" if value else "false")
    except Exception as e:
        logger.error("Failed to set system toggle in Redis", toggle=toggle, value=value, error=str(e))
        raise


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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    stuck_threshold = timedelta(minutes=STUCK_TABLE_THRESHOLD_MINUTES)
    
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
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
    admin_session: AdminSession = Depends(verify_admin_access),
):
    """
    Get current system toggle values.
    
    Toggles control system-wide behavior:
    - pause_autostart: Prevents auto-start of tables
    - pause_interhand_monitor: Pauses inter-hand timeout processing
    
    Toggles are stored in Redis for persistence across restarts and workers.
    """
    toggles = await _get_system_toggles_from_redis()
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "toggles": toggles,
    }


@admin_router.post("/system/toggles")
async def admin_set_system_toggles(
    request: SystemTogglesRequest,
    admin_session: AdminSession = Depends(verify_admin_access),
):
    """
    Set system toggle values.
    
    Emergency brakes for incident response:
    - pause_autostart: Stops automatic table starts
    - pause_interhand_monitor: Pauses inter-hand timeout processing
    
    Toggles are stored in Redis for persistence across restarts and workers.
    """
    now = datetime.now(timezone.utc)
    current_toggles = await _get_system_toggles_from_redis()
    changes = []
    
    if request.pause_autostart is not None:
        old_value = current_toggles["pause_autostart"]
        if old_value != request.pause_autostart:
            await _set_system_toggle_in_redis("pause_autostart", request.pause_autostart)
            changes.append({
                "toggle": "pause_autostart",
                "old_value": old_value,
                "new_value": request.pause_autostart,
            })
    
    if request.pause_interhand_monitor is not None:
        old_value = current_toggles["pause_interhand_monitor"]
        if old_value != request.pause_interhand_monitor:
            await _set_system_toggle_in_redis("pause_interhand_monitor", request.pause_interhand_monitor)
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
    
    # Get updated toggles from Redis
    updated_toggles = await _get_system_toggles_from_redis()
    
    return {
        "timestamp": now.isoformat(),
        "toggles": updated_toggles,
        "changes": changes,
    }


async def get_system_toggles() -> Dict[str, bool]:
    """Get current system toggles from Redis (for use by other modules)."""
    return await _get_system_toggles_from_redis()


async def is_autostart_paused() -> bool:
    """Check if autostart is paused (async - reads from Redis)."""
    toggles = await _get_system_toggles_from_redis()
    return toggles.get("pause_autostart", False)


async def is_interhand_monitor_paused() -> bool:
    """Check if inter-hand monitor is paused (async - reads from Redis)."""
    toggles = await _get_system_toggles_from_redis()
    return toggles.get("pause_interhand_monitor", False)


# ============================================================================
# Dashboard KPIs Endpoint
# ============================================================================


@admin_router.get("/dashboard/kpis")
async def admin_get_dashboard_kpis(
    admin_session: AdminSession = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get key performance indicators for the admin dashboard.
    
    Returns:
    - Total users count
    - Active tables count
    - Tables by status
    - Total hands played (last 24h)
    - Total deposit/withdrawal volume (last 24h)
    - Active players (users with activity in last 24h)
    """
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    
    # Total users
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0
    
    # Table counts by status
    table_counts_result = await db.execute(
        select(Table.status, func.count(Table.id))
        .group_by(Table.status)
    )
    table_counts = {status.value: count for status, count in table_counts_result.all()}
    
    # Active tables (WAITING + ACTIVE)
    active_tables = table_counts.get("waiting", 0) + table_counts.get("active", 0)
    
    # Total hands in last 24h
    hands_result = await db.execute(
        select(func.count(Hand.id))
        .where(Hand.started_at >= last_24h)
    )
    hands_24h = hands_result.scalar() or 0
    
    # Transaction volume in last 24h
    deposits_result = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.created_at >= last_24h,
            Transaction.type == TransactionType.DEPOSIT,
            Transaction.amount > 0,
        )
    )
    deposits_24h = deposits_result.scalar() or 0
    
    withdrawals_result = await db.execute(
        select(func.sum(func.abs(Transaction.amount)))
        .where(
            Transaction.created_at >= last_24h,
            Transaction.type == TransactionType.WITHDRAWAL,
        )
    )
    withdrawals_24h = withdrawals_result.scalar() or 0
    
    # Active players (seated in last 24h)
    active_players_result = await db.execute(
        select(func.count(func.distinct(Seat.user_id)))
        .where(Seat.joined_at >= last_24h)
    )
    active_players_24h = active_players_result.scalar() or 0
    
    # Stuck tables count
    stuck_tables_result = await db.execute(
        select(func.count(Table.id))
        .where(
            Table.status == TableStatus.ACTIVE,
            Table.last_action_at < now - timedelta(minutes=STUCK_TABLE_THRESHOLD_MINUTES),
        )
    )
    stuck_tables = stuck_tables_result.scalar() or 0
    
    return {
        "timestamp": now.isoformat(),
        "kpis": {
            "total_users": total_users,
            "active_tables": active_tables,
            "tables_by_status": table_counts,
            "hands_24h": hands_24h,
            "deposits_24h": deposits_24h,
            "withdrawals_24h": withdrawals_24h,
            "net_flow_24h": deposits_24h - withdrawals_24h,
            "active_players_24h": active_players_24h,
            "stuck_tables": stuck_tables,
        },
    }


# ============================================================================
# User/Banking Admin Endpoints
# ============================================================================


class AdminDepositRequest(BaseModel):
    """Request body for admin deposit."""
    amount: int = Field(..., gt=0, description="Amount in cents to deposit")
    reason: str = Field(..., min_length=3, description="Reason for the deposit")
    currency_type: str = Field(default="REAL", description="Currency type: REAL or PLAY")
    client_action_id: Optional[str] = Field(None, description="Idempotency key")


class AdminWithdrawRequest(BaseModel):
    """Request body for admin withdrawal."""
    amount: int = Field(..., gt=0, description="Amount in cents to withdraw")
    reason: str = Field(..., min_length=3, description="Reason for the withdrawal")
    currency_type: str = Field(default="REAL", description="Currency type: REAL or PLAY")
    client_action_id: Optional[str] = Field(None, description="Idempotency key")


@admin_router.get("/users")
async def admin_list_users(
    search: Optional[str] = Query(None, description="Search by username or ID"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    admin_session: AdminSession = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    List users with search capability.
    
    Search by:
    - User ID (numeric)
    - Telegram user ID (numeric)
    - Username (partial match)
    """
    query = select(User)
    
    if search:
        search = search.strip()
        # Try numeric search first
        try:
            numeric_id = int(search)
            query = query.where(
                or_(
                    User.id == numeric_id,
                    User.tg_user_id == numeric_id,
                )
            )
        except ValueError:
            # Text search on username
            query = query.where(
                User.username.ilike(f"%{search}%")
            )
    
    query = query.order_by(User.id.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    users = list(result.scalars())
    
    return {
        "users": [
            {
                "id": u.id,
                "tg_user_id": u.tg_user_id,
                "username": u.username,
                "balance_real": u.balance_real,
                "balance_play": u.balance_play,
                "first_seen_at": u.first_seen_at.isoformat() if u.first_seen_at else None,
                "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
            }
            for u in users
        ],
        "count": len(users),
        "offset": offset,
        "limit": limit,
    }


@admin_router.get("/users/{user_id}/wallet")
async def admin_get_user_wallet(
    user_id: int,
    admin_session: AdminSession = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed wallet information for a user.
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    
    # Get recent transactions
    tx_result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(20)
    )
    transactions = list(tx_result.scalars())
    
    return {
        "user": {
            "id": user.id,
            "tg_user_id": user.tg_user_id,
            "username": user.username,
        },
        "wallet": {
            "balance_real": user.balance_real,
            "balance_play": user.balance_play,
        },
        "recent_transactions": [
            {
                "id": tx.id,
                "type": tx.type.value if hasattr(tx.type, 'value') else str(tx.type),
                "amount": tx.amount,
                "balance_after": tx.balance_after,
                "currency_type": tx.currency_type.value if hasattr(tx.currency_type, 'value') else str(tx.currency_type),
                "metadata": tx.metadata_json,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx in transactions
        ],
    }


@admin_router.post("/users/{user_id}/deposit")
async def admin_deposit(
    user_id: int,
    request: AdminDepositRequest,
    admin_session: AdminSession = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Deposit funds to a user's wallet.
    
    Requires:
    - amount: Positive amount in cents
    - reason: Explanation for audit trail
    """
    from telegram_poker_bot.shared.services import wallet_service
    from telegram_poker_bot.shared.services.admin_session_service import get_admin_session_service
    
    # Verify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    
    # Parse currency type
    try:
        currency = CurrencyType(request.currency_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid currency type: {request.currency_type}")
    
    # Perform deposit
    try:
        new_balance = await wallet_service.adjust_balance(
            db,
            user_id=user_id,
            amount=request.amount,
            currency_type=currency,
            transaction_type=TransactionType.DEPOSIT,
            metadata={
                "admin_reason": request.reason,
                "admin_chat_id": admin_session.admin_chat_id,
                "client_action_id": request.client_action_id,
            },
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    
    # Audit log
    admin_service = get_admin_session_service()
    await admin_service.log_audit_action(
        admin_chat_id=admin_session.admin_chat_id,
        action_type="DEPOSIT",
        target=f"user:{user_id}",
        reason=request.reason,
        metadata={
            "amount": request.amount,
            "currency": currency.value,
            "new_balance": new_balance,
        },
    )
    
    logger.info(
        "Admin deposit completed",
        user_id=user_id,
        amount=request.amount,
        currency=currency.value,
        admin_chat_id=admin_session.admin_chat_id,
        reason=request.reason,
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "amount": request.amount,
        "currency_type": currency.value,
        "new_balance": new_balance,
        "reason": request.reason,
    }


@admin_router.post("/users/{user_id}/withdraw")
async def admin_withdraw(
    user_id: int,
    request: AdminWithdrawRequest,
    admin_session: AdminSession = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Withdraw funds from a user's wallet.
    
    Requires:
    - amount: Positive amount in cents
    - reason: Explanation for audit trail
    """
    from telegram_poker_bot.shared.services import wallet_service
    from telegram_poker_bot.shared.services.admin_session_service import get_admin_session_service
    
    # Verify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    
    # Parse currency type
    try:
        currency = CurrencyType(request.currency_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid currency type: {request.currency_type}")
    
    # Perform withdrawal (negative amount)
    try:
        new_balance = await wallet_service.adjust_balance(
            db,
            user_id=user_id,
            amount=-request.amount,  # Negative for withdrawal
            currency_type=currency,
            transaction_type=TransactionType.WITHDRAWAL,
            metadata={
                "admin_reason": request.reason,
                "admin_chat_id": admin_session.admin_chat_id,
                "client_action_id": request.client_action_id,
            },
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    
    # Audit log
    admin_service = get_admin_session_service()
    await admin_service.log_audit_action(
        admin_chat_id=admin_session.admin_chat_id,
        action_type="WITHDRAW",
        target=f"user:{user_id}",
        reason=request.reason,
        metadata={
            "amount": request.amount,
            "currency": currency.value,
            "new_balance": new_balance,
        },
    )
    
    logger.info(
        "Admin withdrawal completed",
        user_id=user_id,
        amount=request.amount,
        currency=currency.value,
        admin_chat_id=admin_session.admin_chat_id,
        reason=request.reason,
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "amount": request.amount,
        "currency_type": currency.value,
        "new_balance": new_balance,
        "reason": request.reason,
    }


@admin_router.get("/transactions")
async def admin_list_transactions(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    tx_type: Optional[str] = Query(None, description="Filter by transaction type"),
    currency_type: Optional[str] = Query(None, description="Filter by currency type"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    admin_session: AdminSession = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """
    List transactions with filters.
    """
    query = select(Transaction)
    
    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)
    
    if tx_type:
        try:
            tx_type_enum = TransactionType(tx_type)
            query = query.where(Transaction.type == tx_type_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid transaction type: {tx_type}")
    
    if currency_type:
        try:
            currency_enum = CurrencyType(currency_type)
            query = query.where(Transaction.currency_type == currency_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid currency type: {currency_type}")
    
    query = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    transactions = list(result.scalars())
    
    return {
        "transactions": [
            {
                "id": tx.id,
                "user_id": tx.user_id,
                "type": tx.type.value if hasattr(tx.type, 'value') else str(tx.type),
                "amount": tx.amount,
                "balance_after": tx.balance_after,
                "currency_type": tx.currency_type.value if hasattr(tx.currency_type, 'value') else str(tx.currency_type),
                "reference_id": tx.reference_id,
                "metadata": tx.metadata_json,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx in transactions
        ],
        "count": len(transactions),
        "offset": offset,
        "limit": limit,
    }
