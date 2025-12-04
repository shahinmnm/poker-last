"""Admin analytics API routes - Extended analytics endpoints for Phase 3.

Provides comprehensive analytics endpoints for admin dashboard including:
- Real-time table metrics
- Player statistics
- Anomaly alerts
- Performance heatmaps
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
    HourlyTableStats,
    HourlyPlayerStats,
    LeaderboardSnapshot,
    AnomalyAlert,
    Table,
    User,
)
from telegram_poker_bot.game_core.manager import get_redis_client
from telegram_poker_bot.shared.services.redis_analytics import get_redis_analytics
from telegram_poker_bot.shared.services.outlier_detector import OutlierDetector

logger = get_logger(__name__)

# Router for extended analytics
analytics_admin_router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])


# ==================== Request/Response Models ====================

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


class PlayerStatsResponse(BaseModel):
    """Player statistics summary."""
    user_id: int
    username: Optional[str]
    total_hands: int
    total_sessions: int
    net_profit: int
    vpip_pct: float
    pfr_pct: float
    af: Optional[float]
    bb100: Optional[float]


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


# ==================== Helper Functions ====================

async def verify_admin_access() -> bool:
    """Verify admin access (placeholder - implement proper auth)."""
    # TODO: Implement actual admin verification
    return True


# ==================== Real-Time Metrics Endpoints ====================

@analytics_admin_router.get("/tables/{table_id}/live")
async def get_table_live_metrics(
    table_id: int,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time metrics for a specific table from Redis.
    
    Returns live counters including hand count, pot sum, active seats,
    waitlist count, aggression metrics, and performance indicators.
    """
    redis_client = await get_redis_client()
    redis_analytics = await get_redis_analytics(redis_client)
    
    # Get all metrics in one call
    metrics = await redis_analytics.get_all_table_metrics(table_id)
    
    return {
        "table_id": table_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
    }


@analytics_admin_router.get("/tables/live")
async def get_all_tables_live_metrics(
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time metrics for all active tables.
    
    Returns aggregated view of all active tables with their current metrics.
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
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": len(tables_metrics),
        "tables": tables_metrics,
    }


# ==================== Table Analytics Endpoints ====================

@analytics_admin_router.get("/tables/{table_id}/stats")
async def get_table_stats(
    table_id: int,
    hours: int = Query(default=24, ge=1, le=168, description="Hours of data to retrieve"),
    is_admin: bool = Depends(verify_admin_access),
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
            func.avg(func.cast(HandAnalytics.multiway, type_=type(1))).label("multiway_freq"),
            func.avg(func.cast(HandAnalytics.went_to_showdown, type_=type(1))).label("showdown_freq"),
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
    is_admin: bool = Depends(verify_admin_access),
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
    is_admin: bool = Depends(verify_admin_access),
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
    is_admin: bool = Depends(verify_admin_access),
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
    is_admin: bool = Depends(verify_admin_access),
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
    is_admin: bool = Depends(verify_admin_access),
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
