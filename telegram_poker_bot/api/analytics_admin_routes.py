"""Admin analytics API routes - Phase 4 Enhanced Admin API.

Provides comprehensive analytics endpoints for admin dashboard including:
- Real-time table metrics
- Player statistics  
- Hand drill-down
- Anomaly alerts management
- Data export
- Template-aware analytics
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func, desc, or_, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    HandAnalytics,
    PlayerSession,
    HourlyTableStats,
    HourlyPlayerStats,
    LeaderboardSnapshot,
    AnomalyAlert,
    AnalyticsJob,
    Table,
    User,
    Hand,
    TableTemplate,
    GameVariant,
)
from telegram_poker_bot.game_core.manager import get_redis_client
from telegram_poker_bot.shared.services.redis_analytics import get_redis_analytics
from telegram_poker_bot.shared.services.outlier_detector import OutlierDetector
from telegram_poker_bot.shared.services.rbac_middleware import require_admin, CurrentUser
from telegram_poker_bot.shared.services.jwt_auth_service import get_jwt_auth_service, JWTAuthService

logger = get_logger(__name__)

# Router for admin analytics
analytics_admin_router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])


# ==================== Request/Response Models ====================

class TimeRangeFilter(BaseModel):
    """Time range filter for analytics queries."""
    start: datetime = Field(..., description="Start timestamp (inclusive)")
    end: datetime = Field(..., description="End timestamp (inclusive)")


class TableFilters(BaseModel):
    """Filters for table analytics queries."""
    variant: Optional[GameVariant] = None
    stakes_min: Optional[int] = None
    stakes_max: Optional[int] = None
    table_type: Optional[str] = None  # public/private/persistent/sng
    template_id: Optional[int] = None


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    per_page: int = Field(50, ge=1, le=100, description="Items per page")


class CursorPaginationParams(BaseModel):
    """Cursor-based pagination parameters."""
    cursor: Optional[str] = Field(None, description="Pagination cursor")
    limit: int = Field(50, ge=1, le=100, description="Items per page")


class TableMetricsResponse(BaseModel):
    """Real-time table metrics from Redis."""
    table_id: int
    hand_count: int
    pot_sum: int
    active_seats: int
    waitlist_count: int
    actions_histogram: dict
    aggression_metrics: dict
    recent_pot_stats: dict
    showdown_frequency: float
    turn_time_p95: float


class TableHourlyStatsResponse(BaseModel):
    """Hourly table statistics."""
    hour_start: datetime
    avg_players: float
    max_players: int
    total_hands: int
    activity_minutes: int
    metadata: Dict[str, Any]


class TableAnalyticsSummary(BaseModel):
    """Table analytics summary with template metadata."""
    table_id: int
    template_id: Optional[int]
    template_name: Optional[str]
    table_type: str
    variant: str
    stakes: Dict[str, int]
    total_hands: int
    avg_pot: float
    max_pot: int
    total_rake: int
    multiway_freq: float
    showdown_freq: float


class PlayerStatsResponse(BaseModel):
    """Player statistics summary."""
    user_id: int
    username: Optional[str]
    total_hands: int
    total_sessions: int
    net_profit: int
    total_rake: int
    vpip_pct: float
    pfr_pct: float
    af: Optional[float]
    bb100: Optional[float]


class PlayerSessionSummary(BaseModel):
    """Player session summary."""
    session_id: int
    table_id: int
    template_id: Optional[int]
    variant: Optional[str]
    session_start: datetime
    session_end: Optional[datetime]
    buy_in: int
    cash_out: Optional[int]
    net: Optional[int]
    hands_played: int


class HandSummaryResponse(BaseModel):
    """Hand summary for drill-down."""
    hand_id: int
    hand_no: int
    table_id: int
    template_id: Optional[int]
    variant: Optional[str]
    board_cards: List[str]
    pot_total: int
    rake: int
    winners: List[int]
    went_to_showdown: bool
    created_at: datetime


class HandDetailResponse(BaseModel):
    """Detailed hand information."""
    hand_id: int
    hand_no: int
    table_id: int
    template_id: Optional[int]
    variant: Optional[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    board_cards: List[str]
    pot_total: int
    rake: int
    winners: List[Dict[str, Any]]
    players: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]


class AnomalyAlertResponse(BaseModel):
    """Anomaly alert details."""
    id: int
    alert_type: str
    severity: str
    table_id: Optional[int]
    user_id: Optional[int]
    hand_id: Optional[int]
    message: str
    metadata: dict
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[int]


class AnomalyReviewRequest(BaseModel):
    """Request to review/acknowledge anomaly."""
    status: str = Field(..., description="New status: 'acknowledged' or 'resolved'")
    notes: Optional[str] = Field(None, description="Review notes")


class ExportRequest(BaseModel):
    """Export job request."""
    export_type: str = Field(..., description="Export type: hourly_aggregates, hand_summaries, player_sessions, anomalies")
    time_range: Optional[TimeRangeFilter] = None
    filters: Optional[Dict[str, Any]] = None
    format: str = Field("json", description="Export format: json, csv, jsonl")


class ExportJobResponse(BaseModel):
    """Export job status."""
    job_id: int
    export_type: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    download_url: Optional[str]


# ==================== Real-Time Metrics Endpoints ====================

@analytics_admin_router.get("/tables/{table_id}/live")
async def get_table_live_metrics(
    table_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time metrics for a specific table from Redis.
    
    Admin-only endpoint. Returns live counters including hand count, pot sum,
    active seats, waitlist count, aggression metrics, and performance indicators.
    """
    redis_client = await get_redis_client()
    redis_analytics = await get_redis_analytics(redis_client)
    
    # Get all metrics in one call
    metrics = await redis_analytics.get_all_table_metrics(table_id)
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="view_table_live_metrics",
        resource_type="table",
        resource_id=table_id,
    )
    await db.commit()
    
    return {
        "table_id": table_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
    }


@analytics_admin_router.get("/tables/live")
async def get_all_tables_live_metrics(
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time metrics for all active tables.
    
    Admin-only endpoint. Returns aggregated view of all active tables
    with their current metrics.
    """
    redis_client = await get_redis_client()
    redis_analytics = await get_redis_analytics(redis_client)
    
    # Get all active tables
    tables_result = await db.execute(
        select(Table.id, Table.status)
        .where(Table.status.in_(["waiting", "active"]))
    )
    tables = tables_result.all()
    
    tables_metrics = []
    for table_id, status in tables:
        metrics = await redis_analytics.get_all_table_metrics(table_id)
        tables_metrics.append({
            "table_id": table_id,
            "status": status,
            "metrics": metrics,
        })
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="view_all_tables_live_metrics",
    )
    await db.commit()
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": len(tables_metrics),
        "tables": tables_metrics,
    }


# ==================== Table Analytics Endpoints ====================

@analytics_admin_router.get("/tables/{table_id}/hourly")
async def get_table_hourly_stats(
    table_id: int,
    hours: int = Query(default=24, ge=1, le=720, description="Hours of data to retrieve"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get hourly aggregated statistics for a table.
    
    Admin-only endpoint. Merges historical Postgres data with live Redis counters
    for the current hour.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Get hourly stats from Postgres
    hourly_result = await db.execute(
        select(HourlyTableStats)
        .where(
            and_(
                HourlyTableStats.table_id == table_id,
                HourlyTableStats.hour_start >= cutoff_time,
            )
        )
        .order_by(HourlyTableStats.hour_start)
    )
    hourly_stats = list(hourly_result.scalars().all())
    
    # Get live metrics from Redis for current hour
    redis_client = await get_redis_client()
    redis_analytics = await get_redis_analytics(redis_client)
    live_metrics = await redis_analytics.get_all_table_metrics(table_id)
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="view_table_hourly_stats",
        resource_type="table",
        resource_id=table_id,
    )
    await db.commit()
    
    return {
        "table_id": table_id,
        "period": {
            "start": cutoff_time.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
        },
        "hourly_stats": [
            {
                "hour_start": s.hour_start.isoformat() if s.hour_start else None,
                "avg_players": s.avg_players,
                "max_players": s.max_players,
                "total_hands": s.total_hands,
                "activity_minutes": s.activity_minutes,
                "metadata": s.metadata_json or {},
            }
            for s in hourly_stats
        ],
        "live_metrics": live_metrics,
    }


@analytics_admin_router.get("/tables/{table_id}/analytics")
async def get_table_analytics_summary(
    table_id: int,
    hours: int = Query(default=24, ge=1, le=168, description="Hours of data to retrieve"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive analytics summary for a table.
    
    Admin-only endpoint. Includes template metadata, hand statistics,
    and financial summaries.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Get table with template
    table_result = await db.execute(
        select(Table).options(joinedload(Table.template)).where(Table.id == table_id)
    )
    table = table_result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Get hand analytics summary
    hands_result = await db.execute(
        select(
            func.count(HandAnalytics.id).label("total_hands"),
            func.avg(HandAnalytics.total_pot).label("avg_pot"),
            func.max(HandAnalytics.total_pot).label("max_pot"),
            func.sum(HandAnalytics.rake).label("total_rake"),
            func.avg(func.cast(HandAnalytics.multiway, Integer)).label("multiway_freq"),
            func.avg(func.cast(HandAnalytics.went_to_showdown, Integer)).label("showdown_freq"),
        )
        .where(
            and_(
                HandAnalytics.table_id == table_id,
                HandAnalytics.created_at >= cutoff_time,
            )
        )
    )
    hands_summary = hands_result.one_or_none()
    
    # Get template metadata
    template_metadata = {}
    if table.template:
        config = table.template.config_json or {}
        template_metadata = {
            "template_id": table.template.id,
            "template_name": table.template.name,
            "table_type": table.template.table_type.value,
            "variant": config.get("variant", "no_limit_texas_holdem"),
            "stakes": {
                "small_blind": config.get("small_blind"),
                "big_blind": config.get("big_blind"),
            },
            "currency": config.get("currency", "PLAY"),
        }
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="view_table_analytics",
        resource_type="table",
        resource_id=table_id,
    )
    await db.commit()
    
    return {
        "table_id": table_id,
        "template": template_metadata,
        "period": {
            "start": cutoff_time.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
        },
        "summary": {
            "total_hands": int(hands_summary[0]) if hands_summary and hands_summary[0] else 0,
            "avg_pot": float(hands_summary[1]) if hands_summary and hands_summary[1] else 0.0,
            "max_pot": int(hands_summary[2]) if hands_summary and hands_summary[2] else 0,
            "total_rake": int(hands_summary[3]) if hands_summary and hands_summary[3] else 0,
            "multiway_freq": float(hands_summary[4]) if hands_summary and hands_summary[4] else 0.0,
            "showdown_freq": float(hands_summary[5]) if hands_summary and hands_summary[5] else 0.0,
        },
    }


@analytics_admin_router.get("/tables")
async def list_tables_analytics(
    variant: Optional[str] = Query(None),
    table_type: Optional[str] = Query(None),
    template_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List tables with analytics summaries.
    
    Admin-only endpoint. Supports filtering by variant, table type, and template.
    """
    query = select(Table).options(joinedload(Table.template))
    
    if variant:
        # Filter by variant in template config
        query = query.join(TableTemplate).where(
            TableTemplate.config_json["variant"].astext == variant
        )
    
    if table_type:
        query = query.join(TableTemplate).where(
            TableTemplate.table_type == table_type
        )
    
    if template_id:
        query = query.where(Table.template_id == template_id)
    
    # Add pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)
    
    result = await db.execute(query)
    tables = result.scalars().all()
    
    # Get analytics for each table
    tables_analytics = []
    for table in tables:
        # Get basic stats
        hands_count = await db.execute(
            select(func.count(HandAnalytics.id)).where(HandAnalytics.table_id == table.id)
        )
        total_hands = hands_count.scalar() or 0
        
        template_info = {}
        if table.template:
            config = table.template.config_json or {}
            template_info = {
                "template_id": table.template.id,
                "template_name": table.template.name,
                "table_type": table.template.table_type.value,
                "variant": config.get("variant"),
            }
        
        tables_analytics.append({
            "table_id": table.id,
            "status": table.status.value if hasattr(table.status, "value") else str(table.status),
            "template": template_info,
            "total_hands": total_hands,
        })
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="list_tables_analytics",
    )
    await db.commit()
    
    return {
        "tables": tables_analytics,
        "count": len(tables_analytics),
        "page": page,
        "per_page": per_page,
    }





# ==================== Table Analytics Endpoints ====================

@analytics_admin_router.get("/tables/{table_id}/stats")
async def get_table_stats(
    table_id: int,
    hours: int = Query(default=24, ge=1, le=168, description="Hours of data to retrieve"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get historical statistics for a table.
    
    Returns hourly aggregated data including player counts, hand counts,
    activity metrics, and financial summaries.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Get hourly stats
    hourly_result = await db.execute(
        select(HourlyTableStats)
        .where(
            and_(
                HourlyTableStats.table_id == table_id,
                HourlyTableStats.hour_start >= cutoff_time,
            )
        )
        .order_by(HourlyTableStats.hour_start)
    )
    hourly_stats = list(hourly_result.scalars().all())
    
    # Get hand analytics summary
    hands_result = await db.execute(
        select(
            func.count(HandAnalytics.id).label("total_hands"),
            func.avg(HandAnalytics.total_pot).label("avg_pot"),
            func.max(HandAnalytics.total_pot).label("max_pot"),
            func.sum(HandAnalytics.rake).label("total_rake"),
            func.avg(func.cast(HandAnalytics.multiway, Integer)).label("multiway_freq"),
            func.avg(func.cast(HandAnalytics.went_to_showdown, Integer)).label("showdown_freq"),
        )
        .where(
            and_(
                HandAnalytics.table_id == table_id,
                HandAnalytics.created_at >= cutoff_time,
            )
        )
    )
    hands_summary = hands_result.one_or_none()
    
    return {
        "table_id": table_id,
        "period": {
            "start": cutoff_time.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
        },
        "hourly_stats": [
            {
                "hour_start": s.hour_start.isoformat() if s.hour_start else None,
                "avg_players": s.avg_players,
                "max_players": s.max_players,
                "total_hands": s.total_hands,
                "activity_minutes": s.activity_minutes,
                "metadata": s.metadata_json or {},
            }
            for s in hourly_stats
        ],
        "summary": {
            "total_hands": int(hands_summary[0]) if hands_summary and hands_summary[0] else 0,
            "avg_pot": float(hands_summary[1]) if hands_summary and hands_summary[1] else 0.0,
            "max_pot": int(hands_summary[2]) if hands_summary and hands_summary[2] else 0,
            "total_rake": int(hands_summary[3]) if hands_summary and hands_summary[3] else 0,
            "multiway_freq": float(hands_summary[4]) if hands_summary and hands_summary[4] else 0.0,
            "showdown_freq": float(hands_summary[5]) if hands_summary and hands_summary[5] else 0.0,
        },
    }


# ==================== Player Analytics Endpoints ====================

@analytics_admin_router.get("/players/{user_id}/stats")
async def get_player_stats(
    user_id: int,
    hours: int = Query(default=168, ge=1, le=720, description="Hours of data to retrieve"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive statistics for a player.
    
    Returns aggregated performance metrics including VPIP, PFR, AF,
    profit/loss, session history, and variant breakdowns.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Get user info
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    
    # Get recent sessions
    sessions_result = await db.execute(
        select(PlayerSession)
        .where(
            and_(
                PlayerSession.user_id == user_id,
                PlayerSession.session_start >= cutoff_time,
            )
        )
        .order_by(PlayerSession.session_start.desc())
        .limit(50)
    )
    sessions = list(sessions_result.scalars().all())
    
    return {
        "user_id": user_id,
        "username": user.username,
        "period": {
            "start": cutoff_time.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
        },
        "summary": {
            "total_hands": total_hands,
            "total_sessions": len(sessions),
            "net_profit": total_profit,
            "total_rake": total_rake,
            "vpip_pct": vpip_pct,
            "pfr_pct": pfr_pct,
            "af": af,
        },
        "hourly_stats": [
            {
                "hour_start": s.hour_start.isoformat() if s.hour_start else None,
                "hands_played": s.hands_played,
                "net_profit": s.net_profit,
                "vpip_count": s.vpip_count,
                "pfr_count": s.pfr_count,
            }
            for s in hourly_stats
        ],
        "recent_sessions": [
            {
                "session_id": s.id,
                "table_id": s.table_id,
                "session_start": s.session_start.isoformat() if s.session_start else None,
                "session_end": s.session_end.isoformat() if s.session_end else None,
                "buy_in": s.buy_in,
                "cash_out": s.cash_out,
                "net": s.net,
                "hands_played": s.hands_played,
            }
            for s in sessions
        ],
    }


# ==================== Anomaly Endpoints ====================

@analytics_admin_router.get("/anomalies")
async def get_anomalies(
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query("open", description="Filter by status"),
    limit: int = Query(100, ge=1, le=500),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get anomaly alerts.
    
    Returns detected anomalies including big pots, timeout surges,
    VPIP/PFR mismatches, and rapid action patterns.
    """
    query = select(AnomalyAlert).order_by(AnomalyAlert.created_at.desc())
    
    if alert_type:
        query = query.where(AnomalyAlert.alert_type == alert_type)
    
    if severity:
        query = query.where(AnomalyAlert.severity == severity)
    
    if status:
        query = query.where(AnomalyAlert.status == status)
    
    query = query.limit(limit)
    
    result = await db.execute(query)
    alerts = list(result.scalars().all())
    
    return {
        "count": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "table_id": a.table_id,
                "user_id": a.user_id,
                "hand_id": a.hand_id,
                "message": a.message,
                "metadata": a.metadata or {},
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            }
            for a in alerts
        ],
    }


@analytics_admin_router.post("/anomalies/{alert_id}/review")
async def review_anomaly(
    alert_id: int,
    new_status: str = Query(..., description="New status (reviewed or dismissed)"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mark an anomaly alert as reviewed or dismissed.
    
    Updates the alert status and records review timestamp.
    """
    result = await db.execute(
        select(AnomalyAlert).where(AnomalyAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if new_status not in ["reviewed", "dismissed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    alert.status = new_status
    alert.reviewed_at = datetime.now(timezone.utc)
    # TODO: Get actual admin user_id from auth
    alert.reviewed_by = 1
    
    await db.commit()
    
    return {
        "alert_id": alert_id,
        "new_status": new_status,
        "reviewed_at": alert.reviewed_at.isoformat(),
    }


@analytics_admin_router.post("/anomalies/scan")
async def scan_for_anomalies(
    table_id: Optional[int] = Query(None, description="Scan specific table"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger anomaly scan.
    
    Scans tables for suspicious patterns and creates alerts.
    """
    redis_client = await get_redis_client()
    redis_analytics = await get_redis_analytics(redis_client)
    detector = OutlierDetector(db, redis_analytics)
    
    if table_id:
        alerts = await detector.scan_table_for_anomalies(table_id)
    else:
        alerts = await detector.scan_all_active_tables()
    
    await db.commit()
    
    return {
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "alerts_created": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "table_id": a.table_id,
                "message": a.message,
            }
            for a in alerts
        ],
    }


# ==================== Leaderboard Endpoints ====================

@analytics_admin_router.get("/leaderboards")
async def get_leaderboards(
    leaderboard_type: str = Query("daily", description="Leaderboard type"),
    variant: Optional[str] = Query(None, description="Filter by variant"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard snapshots.
    
    Returns top players ranked by performance metrics.
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
    
    return {
        "leaderboard_type": leaderboard_type,
        "variant": snapshot.variant,
        "snapshot_time": snapshot.snapshot_time.isoformat() if snapshot.snapshot_time else None,
        "rankings": snapshot.rankings or [],
    }


# ==================== Phase 4: Hand Drill-Down Endpoints ====================

@analytics_admin_router.get("/tables/{table_id}/hands")
async def get_table_hands(
    table_id: int,
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[int] = Query(None, description="Hand ID cursor for pagination"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get hand summaries for a table.
    
    Admin-only endpoint. Returns paginated hand summaries with cursor-based pagination.
    """
    from telegram_poker_bot.shared.models import Hand
    
    query = select(Hand).where(Hand.table_id == table_id)
    
    if cursor:
        query = query.where(Hand.id < cursor)
    
    query = query.order_by(Hand.id.desc()).limit(limit)
    
    result = await db.execute(query)
    hands = result.scalars().all()
    
    # Get hand analytics for detailed info
    hand_ids = [h.id for h in hands]
    analytics_result = await db.execute(
        select(HandAnalytics).where(HandAnalytics.hand_id.in_(hand_ids))
    )
    analytics_by_hand_id = {a.hand_id: a for a in analytics_result.scalars().all()}
    
    hands_data = []
    for hand in hands:
        analytics = analytics_by_hand_id.get(hand.id)
        hands_data.append({
            "hand_id": hand.id,
            "hand_no": hand.hand_no,
            "table_id": hand.table_id,
            "created_at": hand.created_at.isoformat() if hand.created_at else None,
            "pot_total": analytics.total_pot if analytics else 0,
            "rake": analytics.rake if analytics else 0,
            "went_to_showdown": analytics.went_to_showdown if analytics else False,
        })
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="view_table_hands",
        resource_type="table",
        resource_id=table_id,
    )
    await db.commit()
    
    next_cursor = hands[-1].id if hands else None
    
    return {
        "hands": hands_data,
        "count": len(hands_data),
        "next_cursor": next_cursor,
        "has_more": len(hands) == limit,
    }


@analytics_admin_router.get("/hands/{hand_id}")
async def get_hand_details(
    hand_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed hand information including action timeline.
    
    Admin-only endpoint. Returns complete hand history with actions and results.
    """
    from telegram_poker_bot.shared.models import Hand, HandHistoryEvent
    
    # Get hand
    hand_result = await db.execute(
        select(Hand).where(Hand.id == hand_id)
    )
    hand = hand_result.scalar_one_or_none()
    
    if not hand:
        raise HTTPException(status_code=404, detail="Hand not found")
    
    # Get hand analytics
    analytics_result = await db.execute(
        select(HandAnalytics).where(HandAnalytics.hand_id == hand_id)
    )
    analytics = analytics_result.scalar_one_or_none()
    
    # Get action timeline
    events_result = await db.execute(
        select(HandHistoryEvent)
        .where(HandHistoryEvent.hand_id == hand_id)
        .order_by(HandHistoryEvent.sequence.asc())
    )
    events = events_result.scalars().all()
    
    # Log admin query
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="view_hand_details",
        resource_type="hand",
        resource_id=hand_id,
    )
    await db.commit()
    
    return {
        "hand_id": hand.id,
        "hand_no": hand.hand_no,
        "table_id": hand.table_id,
        "started_at": hand.started_at.isoformat() if hand.started_at else None,
        "ended_at": hand.ended_at.isoformat() if hand.ended_at else None,
        "analytics": {
            "pot_total": analytics.total_pot if analytics else 0,
            "rake": analytics.rake if analytics else 0,
            "board_cards": analytics.board_cards if analytics else [],
            "went_to_showdown": analytics.went_to_showdown if analytics else False,
            "winner_user_ids": analytics.winner_user_ids if analytics else [],
        } if analytics else None,
        "events": [
            {
                "sequence": e.sequence,
                "street": e.street,
                "action_type": e.action_type,
                "actor_user_id": e.actor_user_id,
                "amount": e.amount,
                "pot_size": e.pot_size,
                "board_cards": e.board_cards,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


# ==================== Phase 4: Enhanced Anomaly Management ====================

@analytics_admin_router.post("/anomalies/{anomaly_id}/ack")
async def acknowledge_anomaly(
    anomaly_id: int,
    notes: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge an anomaly alert.
    
    Admin-only endpoint. Marks anomaly as acknowledged but not resolved.
    """
    result = await db.execute(
        select(AnomalyAlert).where(AnomalyAlert.id == anomaly_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    alert.status = "acknowledged"
    alert.reviewed_at = datetime.now(timezone.utc)
    alert.reviewed_by = current_user.user_id
    
    # Log admin action
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="anomaly_acknowledged",
        resource_type="anomaly",
        resource_id=anomaly_id,
        details=notes,
    )
    
    await db.commit()
    
    return {
        "anomaly_id": anomaly_id,
        "status": "acknowledged",
        "reviewed_at": alert.reviewed_at.isoformat(),
        "reviewed_by": current_user.user_id,
    }


@analytics_admin_router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: int,
    resolution: str = Query(..., description="Resolution notes"),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resolve an anomaly alert.
    
    Admin-only endpoint. Marks anomaly as resolved with resolution notes.
    """
    result = await db.execute(
        select(AnomalyAlert).where(AnomalyAlert.id == anomaly_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    alert.status = "resolved"
    alert.reviewed_at = datetime.now(timezone.utc)
    alert.reviewed_by = current_user.user_id
    
    # Update metadata with resolution
    if not alert.alert_metadata:
        alert.alert_metadata = {}
    alert.alert_metadata["resolution"] = resolution
    alert.alert_metadata["resolved_by"] = current_user.user_id
    alert.alert_metadata["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    # Log admin action
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="anomaly_resolved",
        resource_type="anomaly",
        resource_id=anomaly_id,
        details=resolution,
    )
    
    await db.commit()
    
    return {
        "anomaly_id": anomaly_id,
        "status": "resolved",
        "reviewed_at": alert.reviewed_at.isoformat(),
        "reviewed_by": current_user.user_id,
        "resolution": resolution,
    }


# ==================== Phase 4: Export API ====================

@analytics_admin_router.post("/export")
async def create_export_job(
    export_request: ExportRequest,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create an export job for analytics data.
    
    Admin-only endpoint. Creates an async job to export data in requested format.
    Supports: hourly_aggregates, hand_summaries, player_sessions, anomalies.
    """
    # Create export job
    job = AnalyticsJob(
        job_type=f"export_{export_request.export_type}",
        status="queued",
        params={
            "export_type": export_request.export_type,
            "format": export_request.format,
            "time_range": {
                "start": export_request.time_range.start.isoformat() if export_request.time_range else None,
                "end": export_request.time_range.end.isoformat() if export_request.time_range else None,
            } if export_request.time_range else None,
            "filters": export_request.filters or {},
            "requested_by": current_user.user_id,
        },
    )
    db.add(job)
    await db.flush()
    
    # Log admin action
    jwt_service = get_jwt_auth_service()
    await jwt_service.log_admin_action(
        db,
        admin_user_id=current_user.user_id,
        action_type="export_job_created",
        resource_type="export_job",
        resource_id=job.id,
        details=f"Export type: {export_request.export_type}, format: {export_request.format}",
    )
    
    await db.commit()
    
    logger.info(
        "Export job created",
        job_id=job.id,
        export_type=export_request.export_type,
        user_id=current_user.user_id,
    )
    
    return {
        "job_id": job.id,
        "export_type": export_request.export_type,
        "status": "queued",
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }



@analytics_admin_router.get("/export/{job_id}")
async def get_export_job_status(
    job_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get export job status and download URL.
    
    Admin-only endpoint. Returns job status and download URL if completed.
    """
    result = await db.execute(
        select(AnalyticsJob).where(AnalyticsJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    # Check if user is authorized to view this job
    if job.params and job.params.get("requested_by") != current_user.user_id:
        if not current_user.is_admin():
            raise HTTPException(status_code=403, detail="Not authorized to view this job")
    
    download_url = None
    if job.status == "completed" and job.params:
        # In production, this should be a signed S3 URL or similar
        download_url = f"/api/admin/analytics/export/{job_id}/download"
    
    return {
        "job_id": job.id,
        "status": job.status,
        "export_type": job.params.get("export_type") if job.params else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "download_url": download_url,
        "error": job.error_message if job.status == "failed" else None,
    }
