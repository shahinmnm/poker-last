"""Admin-only API routes for analytics and insights."""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    TableSnapshot,
    HourlyTableStats,
    Table,
    TableStatus,
)
from telegram_poker_bot.shared.services.insights_engine import get_insights_engine
from telegram_poker_bot.shared.services.insights_delivery import (
    InsightsDeliveryService,
    LoggingChannel,
)

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
    snapshots = result.scalars().all()
    
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
    stats = result.scalars().all()
    
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
        stats = result.scalars().all()
        
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
        snapshots = result.scalars().all()
        
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
