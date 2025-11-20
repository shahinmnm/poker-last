"""User profile and statistics service."""

from __future__ import annotations

from typing import Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from telegram_poker_bot.shared.models import (
    User,
    Seat,
    Table,
    Hand,
    Action,
    TableStatus,
    Wallet,
)


def _resolve_is_public(table: Table) -> bool:
    """Determine whether a table should be treated as public."""

    if table.is_public is not None:
        return bool(table.is_public)

    config = table.config_json or {}
    raw_private = config.get("is_private")
    if isinstance(raw_private, bool):
        return not raw_private
    if isinstance(raw_private, (int, float)):
        return not bool(raw_private)
    if isinstance(raw_private, str):
        normalized = raw_private.strip().lower()
        if normalized in {"true", "1", "yes", "y", "private"}:
            return False
        if normalized in {"false", "0", "no", "n", "public"}:
            return True

    visibility = config.get("visibility")
    if isinstance(visibility, str):
        normalized_visibility = visibility.strip().lower()
        if normalized_visibility == "private":
            return False
        if normalized_visibility == "public":
            return True

    return True


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


async def get_user_balance(db: AsyncSession, user_id: int) -> int:
    """
    Get user's chip balance from wallet.

    Returns chips available for play.
    """
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()

    if wallet:
        return wallet.balance

    # Default starting balance if no wallet exists yet
    return 10000


async def ensure_wallet(db: AsyncSession, user_id: int) -> Wallet:
    """
    Ensure user has a wallet record with default balance.
    """
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
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
    ActiveSeat = aliased(Seat)

    result = await db.execute(
        select(Table, ActiveSeat)
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
        config = table.config_json or {}
        creator_user_id = table.creator_user_id or config.get("creator_user_id")
        if creator_user_id:
            creator_ids.add(creator_user_id)

    creator_map = {}
    if creator_ids:
        creator_result = await db.execute(select(User).where(User.id.in_(creator_ids)))
        creator_map = {user.id: user for user in creator_result.scalars()}

    tables_data = []
    for table, seat in rows:
        config = table.config_json or {}
        creator_user_id = table.creator_user_id or config.get("creator_user_id")
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

        games.append(
            {
                "table_id": table.id,
                "mode": table.mode.value,
                "joined_at": seat.joined_at.isoformat(),
                "left_at": seat.left_at.isoformat(),
                "starting_chips": starting_chips,
                "ending_chips": seat.chips,
                "profit": profit,
                "small_blind": config.get("small_blind", 25),
                "big_blind": config.get("big_blind", 50),
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
    3. Updates wallet balances
    4. Creates transaction records
    5. Updates user stats

    Args:
        db: Database session
        hand: The completed Hand record
        table: The Table record
        seats: List of Seat records for players in the hand
        hand_result: Hand result dict with winners info
    """
    from telegram_poker_bot.shared.models import Transaction

    # Get all winners from hand_result
    winners = hand_result.get("winners", [])
    winner_user_ids = {w["user_id"] for w in winners}
    winner_amounts = {w["user_id"]: w["amount"] for w in winners}

    # For each seat, determine their profit/loss
    for seat in seats:
        user_id = seat.user_id

        # Ensure wallet exists
        wallet = await ensure_wallet(db, user_id)

        # Calculate profit/loss for this specific hand
        # Winner amounts represent chips won in this hand
        hand_profit = winner_amounts.get(user_id, 0)

        # Note: We don't track contributions per hand easily, so we'll use
        # a simpler approach: winners get their winnings added, losers get nothing
        # This means wallets reflect cumulative session profit, not hand-by-hand

        # For now, we'll only apply positive winnings to wallet
        if hand_profit > 0:
            wallet.balance += hand_profit

            # Create transaction record
            transaction = Transaction(
                user_id=user_id,
                type="game_payout",
                amount=hand_profit,
                status="completed",
                metadata_json={
                    "table_id": table.id,
                    "hand_id": hand.id,
                    "hand_no": hand.hand_no,
                },
            )
            db.add(transaction)

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
