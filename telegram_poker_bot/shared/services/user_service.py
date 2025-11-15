"""User profile and statistics service."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import (
    User,
    Seat,
    Table,
    Hand,
    Action,
    ActionType,
    TableStatus,
    Wallet,
)


async def get_user_stats(db: AsyncSession, user_id: int) -> Dict[str, Any]:
    """
    Get comprehensive user statistics.
    
    Returns:
        Dict containing:
        - hands_played: Total hands played
        - tables_played: Total tables participated in
        - total_profit: Profit/loss across all tables
        - biggest_pot: Largest pot won
        - win_rate: Percentage of hands won
        - current_streak: Current winning/losing streak
    """
    # Get all seats for this user
    result = await db.execute(
        select(Seat).where(Seat.user_id == user_id)
    )
    seats = result.scalars().all()
    
    if not seats:
        return {
            "hands_played": 0,
            "tables_played": 0,
            "total_profit": 0,
            "biggest_pot": 0,
            "win_rate": 0.0,
            "current_streak": 0,
            "first_game_date": None,
        }
    
    # Count tables
    table_ids = set(seat.table_id for seat in seats)
    tables_played = len(table_ids)
    
    # Count hands played (actions taken)
    result = await db.execute(
        select(func.count(Action.id))
        .where(Action.user_id == user_id)
    )
    hands_played = result.scalar() or 0
    
    # Calculate profit/loss (difference between starting chips and final chips)
    total_profit = 0
    for seat in seats:
        if seat.left_at:  # Only count completed sessions
            # Starting chips from config
            starting_chips = 10000  # TODO: Get from table config
            final_chips = seat.chips
            total_profit += (final_chips - starting_chips)
    
    # Get user's custom stats blob if exists
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    stats_blob = (user.stats_blob or {}) if user else {}
    
    # Get first game date (earliest seat join)
    first_game_date = None
    if seats:
        first_seat = min(seats, key=lambda s: s.joined_at)
        first_game_date = first_seat.joined_at
    
    return {
        "hands_played": hands_played,
        "tables_played": tables_played,
        "total_profit": total_profit,
        "biggest_pot": stats_blob.get("biggest_pot", 0),
        "win_rate": stats_blob.get("win_rate", 0.0),
        "current_streak": stats_blob.get("current_streak", 0),
        "first_game_date": first_game_date,
    }


async def get_user_balance(db: AsyncSession, user_id: int) -> int:
    """
    Get user's chip balance from wallet.
    
    Returns chips available for play.
    """
    result = await db.execute(
        select(Wallet).where(Wallet.user_id == user_id)
    )
    wallet = result.scalar_one_or_none()
    
    if wallet:
        return wallet.balance
    
    # Default starting balance if no wallet exists yet
    return 10000


async def ensure_wallet(db: AsyncSession, user_id: int) -> Wallet:
    """
    Ensure user has a wallet record with default balance.
    """
    result = await db.execute(
        select(Wallet).where(Wallet.user_id == user_id)
    )
    wallet = result.scalar_one_or_none()
    
    if wallet:
        return wallet
    
    # Create wallet with default balance
    wallet = Wallet(
        user_id=user_id,
        balance=10000,  # Default starting chips
    )
    db.add(wallet)
    await db.flush()
    return wallet


async def get_active_tables(db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    """
    Get list of active tables user is currently seated at.
    
    Returns list of table info dicts.
    """
    result = await db.execute(
        select(Table, Seat)
        .join(Seat, Table.id == Seat.table_id)
        .where(
            Seat.user_id == user_id,
            Seat.left_at.is_(None),  # Still seated
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE])
        )
    )
    
    tables_data = []
    for table, seat in result.all():
        # Count players at this table
        player_count_result = await db.execute(
            select(func.count(Seat.id))
            .where(Seat.table_id == table.id, Seat.left_at.is_(None))
        )
        player_count = player_count_result.scalar() or 0
        
        config = table.config_json or {}
        
        tables_data.append({
            "table_id": table.id,
            "mode": table.mode.value,
            "status": table.status.value,
            "player_count": player_count,
            "max_players": config.get("max_players", 8),
            "small_blind": config.get("small_blind", 25),
            "big_blind": config.get("big_blind", 50),
            "chips": seat.chips,
            "position": seat.position,
            "joined_at": seat.joined_at.isoformat(),
        })
    
    return tables_data


async def get_recent_games(
    db: AsyncSession,
    user_id: int,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get user's recent game history.
    
    Returns list of completed games with results.
    """
    result = await db.execute(
        select(Table, Seat)
        .join(Seat, Table.id == Seat.table_id)
        .where(
            Seat.user_id == user_id,
            Seat.left_at.isnot(None),  # Completed sessions
        )
        .order_by(Seat.left_at.desc())
        .limit(limit)
    )
    
    games = []
    for table, seat in result.all():
        config = table.config_json or {}
        starting_chips = config.get("starting_stack", 10000)
        profit = seat.chips - starting_chips
        
        games.append({
            "table_id": table.id,
            "mode": table.mode.value,
            "joined_at": seat.joined_at.isoformat(),
            "left_at": seat.left_at.isoformat(),
            "starting_chips": starting_chips,
            "ending_chips": seat.chips,
            "profit": profit,
            "small_blind": config.get("small_blind", 25),
            "big_blind": config.get("big_blind", 50),
        })
    
    return games


async def update_user_language(
    db: AsyncSession,
    user_id: int,
    language_code: str
) -> User:
    """
    Update user's preferred language.
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one()
    user.language = language_code
    await db.flush()
    return user
