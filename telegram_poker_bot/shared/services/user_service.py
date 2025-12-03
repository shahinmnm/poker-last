"""User profile and statistics service."""

from __future__ import annotations

from typing import Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, joinedload

from telegram_poker_bot.shared.models import (
    User,
    Seat,
    Table,
    Hand,
    Action,
    TableStatus,
    UserPokerStats,
    TableTemplateType,
)
from telegram_poker_bot.shared.services.table_service import (
    get_template_config,
    get_table_currency_type,
)


def _resolve_is_public(table: Table) -> bool:
    """Determine whether a table should be treated as public."""

    if table.is_public is not None:
        return bool(table.is_public)

    template_type = getattr(getattr(table, "template", None), "table_type", None)
    return template_type != TableTemplateType.PRIVATE


async def get_user_stats_from_aggregated(
    db: AsyncSession, user_id: int
) -> Dict[str, Any]:
    """
    Get user statistics from pre-aggregated UserPokerStats table.

    This is the optimized version that fetches from the UserPokerStats table
    instead of running heavy aggregation queries at runtime.

    Returns a structure compatible with the original get_user_stats for backwards compatibility,
    but with additional VPIP and PFR metrics.

    Returns:
        Dict containing:
        - hands_played: Total hands played (alias for total_hands)
        - wins: Total hands won
        - win_rate: Win percentage
        - vpip: Voluntarily Put $ In Pot percentage
        - pfr: Pre-Flop Raise percentage
        - total_winnings: Total chips won
        - best_hand_rank: Best hand achieved
        - tables_played: 0 (not tracked in aggregated stats)
        - total_profit: Same as total_winnings for now
        - biggest_pot: 0 (not tracked in aggregated stats)
        - current_streak: 0 (not tracked in aggregated stats)
        - first_game_date: None (not tracked in aggregated stats)
    """
    result = await db.execute(
        select(UserPokerStats).where(UserPokerStats.user_id == user_id)
    )
    stats = result.scalar_one_or_none()

    if not stats:
        return {
            "hands_played": 0,
            "wins": 0,
            "win_rate": 0.0,
            "vpip": 0.0,
            "pfr": 0.0,
            "total_winnings": 0,
            "best_hand_rank": None,
            "tables_played": 0,
            "total_profit": 0,
            "biggest_pot": 0,
            "current_streak": 0,
            "first_game_date": None,
        }

    # Calculate percentages
    win_rate = (stats.wins / stats.total_hands * 100) if stats.total_hands > 0 else 0.0
    vpip = (
        (stats.vpip_count / stats.total_hands * 100) if stats.total_hands > 0 else 0.0
    )
    pfr = (stats.pfr_count / stats.total_hands * 100) if stats.total_hands > 0 else 0.0

    return {
        "hands_played": stats.total_hands,  # Backwards compatible field name
        "wins": stats.wins,
        "win_rate": round(win_rate, 2),
        "vpip": round(vpip, 2),
        "pfr": round(pfr, 2),
        "total_winnings": stats.total_winnings,
        "best_hand_rank": stats.best_hand_rank,
        # Legacy fields - not tracked in aggregated stats
        "tables_played": 0,
        "total_profit": stats.total_winnings,  # Approximate with total_winnings
        "biggest_pot": 0,
        "current_streak": 0,
        "first_game_date": None,
    }


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
    result = await db.execute(select(Seat).where(Seat.user_id == user_id))
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
        select(func.count(Action.id)).where(Action.user_id == user_id)
    )
    hands_played = result.scalar() or 0

    # Calculate profit/loss (difference between starting chips and final chips)
    total_profit = 0
    for seat in seats:
        if seat.left_at:  # Only count completed sessions
            # Starting chips from config
            starting_chips = 10000  # TODO: Get from table config
            final_chips = seat.chips
            total_profit += final_chips - starting_chips

    # Get user's custom stats blob if exists
    result = await db.execute(select(User).where(User.id == user_id))
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


async def get_active_tables(db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    """
    Get list of active tables user is currently seated at.

    Returns list of table info dicts.
    """
    ActiveSeat = aliased(Seat)

    result = await db.execute(
        select(Table, ActiveSeat)
        .options(joinedload(Table.template))
        .join(ActiveSeat, Table.id == ActiveSeat.table_id)
        .where(
            ActiveSeat.user_id == user_id,
            ActiveSeat.left_at.is_(None),
            Table.status.in_([TableStatus.WAITING, TableStatus.ACTIVE]),
        )
        .order_by(ActiveSeat.joined_at.desc(), Table.created_at.desc())
    )

    rows = result.all()
    if not rows:
        return []

    table_ids = [table.id for table, _ in rows]

    seat_counts_result = await db.execute(
        select(Seat.table_id, func.count(Seat.id))
        .where(
            Seat.table_id.in_(table_ids),
            Seat.left_at.is_(None),
        )
        .group_by(Seat.table_id)
    )
    seat_counts = {table_id: count for table_id, count in seat_counts_result.all()}

    creator_ids = set()
    for table, _ in rows:
        if table.creator_user_id:
            creator_ids.add(table.creator_user_id)

    creator_map = {}
    if creator_ids:
        creator_result = await db.execute(select(User).where(User.id.in_(creator_ids)))
        creator_map = {user.id: user for user in creator_result.scalars()}

    tables_data = []
    for table, seat in rows:
        config = get_template_config(table)
        creator_user_id = table.creator_user_id
        host_user = creator_map.get(creator_user_id) if creator_user_id else None
        host_info = None
        if host_user:
            host_info = {
                "user_id": host_user.id,
                "username": host_user.username,
                "display_name": host_user.username or f"Player #{host_user.id}",
            }

        is_public = _resolve_is_public(table)
        player_count = seat_counts.get(table.id, 0)
        max_players = config.get("max_players", 8)
        starting_stack = config.get("starting_stack", 10000)

        tables_data.append(
            {
                "table_id": table.id,
                "mode": table.mode.value,
                "status": table.status.value,
                "player_count": player_count,
                "max_players": max_players,
                "small_blind": config.get("small_blind", 25),
                "big_blind": config.get("big_blind", 50),
                "starting_stack": starting_stack,
                "table_name": config.get("table_name", f"Table #{table.id}"),
                "host": host_info,
                "created_at": (
                    table.created_at.isoformat() if table.created_at else None
                ),
                "updated_at": (
                    table.updated_at.isoformat() if table.updated_at else None
                ),
                "is_public": is_public,
                "visibility": "public" if is_public else "private",
                "viewer": {
                    "is_seated": True,
                    "seat_position": seat.position,
                    "chips": seat.chips,
                    "joined_at": seat.joined_at.isoformat() if seat.joined_at else None,
                    "is_creator": creator_user_id == user_id,
                },
            }
        )

    return tables_data


async def get_recent_games(
    db: AsyncSession, user_id: int, limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get user's recent game history.

    Rule E: History visibility only after deletion/completion
    - Only shows tables with status ENDED or EXPIRED
    - Active/waiting tables do not appear in history

    Returns list of completed games with results.
    """
    result = await db.execute(
        select(Table, Seat)
        .options(joinedload(Table.template))
        .join(Seat, Table.id == Seat.table_id)
        .where(
            Seat.user_id == user_id,
            Seat.left_at.isnot(None),  # Completed sessions
            Table.status.in_(
                [TableStatus.ENDED, TableStatus.EXPIRED]
            ),  # Only completed/expired tables
        )
        .order_by(Seat.left_at.desc())
        .limit(limit)
    )

    games = []
    for table, seat in result.all():
        config = get_template_config(table)
        starting_chips = config.get("starting_stack", 10000)
        profit = seat.chips - starting_chips

        games.append(
            {
                "table_id": table.id,
                "mode": table.mode.value,
                "status": table.status.value,
                "joined_at": seat.joined_at.isoformat() if seat.joined_at else None,
                "left_at": seat.left_at.isoformat() if seat.left_at else None,
                "starting_chips": starting_chips,
                "ending_chips": seat.chips,
                "profit": profit,
                "small_blind": config.get("small_blind", 25),
                "big_blind": config.get("big_blind", 50),
                "table_name": config.get("table_name", f"Table #{table.id}"),
            }
        )

    return games


async def update_user_language(
    db: AsyncSession, user_id: int, language_code: str
) -> User:
    """
    Update user's preferred language.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    user.language = language_code
    await db.flush()
    return user


async def apply_hand_result_to_wallets_and_stats(
    db: AsyncSession,
    hand: Hand,
    table: Table,
    seats: List[Seat],
    hand_result: Dict[str, Any],
) -> None:
    """
    Apply hand result to user wallets and stats.

    This function:
    1. Ensures all affected users have wallets
    2. Computes profit/loss for each user based on chip changes
    3. Updates wallet balances using wallet_service
    4. Creates transaction records
    5. Updates user stats

    Args:
        db: Database session
        hand: The completed Hand record
        table: The Table record
        seats: List of Seat records for players in the hand
        hand_result: Hand result dict with winners info (post-rake amounts)
    """
    from telegram_poker_bot.shared.services.wallet_service import record_game_win

    currency_type = get_table_currency_type(table)

    # Get all winners from hand_result
    winners = hand_result.get("winners", [])
    winner_user_ids = {w["user_id"] for w in winners}
    winner_amounts = {w["user_id"]: w["amount"] for w in winners}

    # For each seat, determine their profit/loss
    for seat in seats:
        user_id = seat.user_id

        # Calculate profit/loss for this specific hand
        # Winner amounts represent chips won in this hand (already post-rake)
        hand_profit = winner_amounts.get(user_id, 0)

        # Use wallet_service to record game wins
        if hand_profit > 0:
            await record_game_win(
                db=db,
                user_id=user_id,
                amount=hand_profit,
                hand_id=hand.id,
                table_id=table.id,
                currency_type=currency_type,
                reference_id=f"hand_{hand.hand_no}",
            )

    # Update user stats for all participants
    for seat in seats:
        user_id = seat.user_id

        # Get current stats
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            continue

        stats_blob = user.stats_blob or {}

        # Increment hands played
        stats_blob["hands_played"] = stats_blob.get("hands_played", 0) + 1

        # Update win count if user won
        if user_id in winner_user_ids:
            stats_blob["hands_won"] = stats_blob.get("hands_won", 0) + 1
            hand_profit = winner_amounts.get(user_id, 0)

            # Update total profit
            stats_blob["total_profit"] = stats_blob.get("total_profit", 0) + hand_profit

            # Update biggest pot
            if hand_profit > stats_blob.get("biggest_pot", 0):
                stats_blob["biggest_pot"] = hand_profit

            # Update winning streak
            current_streak = stats_blob.get("current_streak", 0)
            if current_streak >= 0:
                stats_blob["current_streak"] = current_streak + 1
            else:
                stats_blob["current_streak"] = 1
        else:
            # Lost hand - update losing streak
            current_streak = stats_blob.get("current_streak", 0)
            if current_streak <= 0:
                stats_blob["current_streak"] = current_streak - 1
            else:
                stats_blob["current_streak"] = -1

        # Calculate win rate
        hands_played = stats_blob.get("hands_played", 1)
        hands_won = stats_blob.get("hands_won", 0)
        stats_blob["win_rate"] = (
            (hands_won / hands_played * 100) if hands_played > 0 else 0.0
        )

        # Save updated stats
        user.stats_blob = stats_blob

    await db.flush()
