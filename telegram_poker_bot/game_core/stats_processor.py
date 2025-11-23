"""Stats processor service for updating aggregated poker statistics.

This service calculates and updates UserPokerStats after each hand completion.
It runs asynchronously as a background task to avoid blocking the main game flow.
"""

from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    UserPokerStats,
    Hand,
    Action,
    ActionType,
    Seat,
)

logger = get_logger(__name__)


class StatsProcessor:
    """
    Async service for calculating and updating user poker statistics.

    This processor updates the UserPokerStats table immediately after a hand finishes,
    avoiding heavy runtime queries by maintaining pre-aggregated statistics.
    """

    @staticmethod
    async def ensure_user_stats(db: AsyncSession, user_id: int) -> UserPokerStats:
        """
        Ensure user has a UserPokerStats record.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            UserPokerStats record for the user
        """
        result = await db.execute(
            select(UserPokerStats).where(UserPokerStats.user_id == user_id)
        )
        stats = result.scalar_one_or_none()

        if not stats:
            stats = UserPokerStats(user_id=user_id)
            db.add(stats)
            await db.flush()
            logger.info("Created UserPokerStats record", user_id=user_id)

        return stats

    @staticmethod
    async def calculate_vpip(db: AsyncSession, hand: Hand, user_id: int) -> bool:
        """
        Calculate if user voluntarily put money in pot (VPIP).

        VPIP = True if user made any of: bet, call, or raise actions.
        Excludes forced actions (blinds, antes).

        Args:
            db: Database session
            hand: Hand record
            user_id: User ID

        Returns:
            True if user had VPIP in this hand
        """
        result = await db.execute(
            select(Action)
            .where(
                Action.hand_id == hand.id,
                Action.user_id == user_id,
                Action.type.in_([ActionType.BET, ActionType.CALL, ActionType.RAISE]),
            )
            .limit(1)
        )
        action = result.scalar_one_or_none()
        return action is not None

    @staticmethod
    async def calculate_pfr(db: AsyncSession, hand: Hand, user_id: int) -> bool:
        """
        Calculate if user raised pre-flop (PFR).

        PFR = True if user raised during pre-flop phase.

        NOTE: Current implementation is simplified and counts ANY raise as PFR.
        This is an approximation that will be improved when we add street tracking
        to the Action table. For accurate PFR, we need to know which betting round
        (street) each action occurred on.

        TODO: Add street field to Action table for accurate PFR calculation.

        Args:
            db: Database session
            hand: Hand record
            user_id: User ID

        Returns:
            True if user has any RAISE action (simplified approximation)
        """
        # Simplified: check if user has ANY raise action in this hand
        # In production, you'd track street in Action table or use HandHistoryEvent
        result = await db.execute(
            select(Action)
            .where(
                Action.hand_id == hand.id,
                Action.user_id == user_id,
                Action.type == ActionType.RAISE,
            )
            .limit(1)
        )
        action = result.scalar_one_or_none()

        return action is not None

    @staticmethod
    async def update_stats(
        db: AsyncSession,
        hand: Hand,
        hand_result: Dict[str, Any],
        seats: List[Seat],
    ) -> None:
        """
        Update UserPokerStats for all players in a completed hand.

        This is called immediately after hand completion in pokerkit_runtime.py.

        Args:
            db: Database session
            hand: Completed hand record
            hand_result: Hand result dictionary with winners info
            seats: List of seats involved in the hand
        """
        if not hand_result:
            logger.warning(
                "Skipping stats update - no hand result provided",
                hand_id=hand.id,
            )
            return

        winners = hand_result.get("winners", [])
        winner_user_ids = {w["user_id"] for w in winners}

        # Process each player who participated
        for seat in seats:
            if seat.left_at is not None:
                # Skip players who left during the hand
                continue

            user_id = seat.user_id

            try:
                # Ensure stats record exists
                stats = await StatsProcessor.ensure_user_stats(db, user_id)

                # Increment total hands
                stats.total_hands += 1

                # Calculate VPIP (Voluntarily Put $ In Pot)
                has_vpip = await StatsProcessor.calculate_vpip(db, hand, user_id)
                if has_vpip:
                    stats.vpip_count += 1

                # Calculate PFR (Pre-Flop Raise)
                has_pfr = await StatsProcessor.calculate_pfr(db, hand, user_id)
                if has_pfr:
                    stats.pfr_count += 1

                # Update wins and winnings
                if user_id in winner_user_ids:
                    stats.wins += 1

                    # Find winning amount for this user
                    for winner in winners:
                        if winner["user_id"] == user_id:
                            amount = winner.get("amount", 0)
                            stats.total_winnings += amount

                            # Update best hand rank if better
                            hand_rank = winner.get("hand_rank", "")
                            if hand_rank:
                                if (
                                    not stats.best_hand_rank
                                    or StatsProcessor._is_better_hand(
                                        hand_rank, stats.best_hand_rank
                                    )
                                ):
                                    stats.best_hand_rank = hand_rank

                await db.flush()

                logger.info(
                    "Updated user poker stats",
                    user_id=user_id,
                    hand_id=hand.id,
                    total_hands=stats.total_hands,
                    wins=stats.wins,
                    vpip_pct=(
                        stats.vpip_count / stats.total_hands * 100
                        if stats.total_hands > 0
                        else 0
                    ),
                )

            except Exception as e:
                logger.error(
                    "Failed to update stats for user",
                    user_id=user_id,
                    hand_id=hand.id,
                    error=str(e),
                )
                # Don't fail the entire hand completion if stats update fails
                continue

    @staticmethod
    def _is_better_hand(new_rank: str, old_rank: str) -> bool:
        """
        Compare two hand ranks to determine if new rank is better.

        Hand ranks from best to worst:
        - Royal Flush
        - Straight Flush
        - Four of a Kind
        - Full House
        - Flush
        - Straight
        - Three of a Kind
        - Two Pair
        - Pair
        - High Card

        Args:
            new_rank: New hand rank string
            old_rank: Current best hand rank string

        Returns:
            True if new rank is better than old rank
        """
        rank_order = {
            "Royal Flush": 10,
            "Straight Flush": 9,
            "Four of a Kind": 8,
            "Full House": 7,
            "Flush": 6,
            "Straight": 5,
            "Three of a Kind": 4,
            "Two Pair": 3,
            "Two Pairs": 3,  # Alternative naming
            "Pair": 2,
            "One Pair": 2,  # Alternative naming
            "High Card": 1,
        }

        new_score = rank_order.get(new_rank, 0)
        old_score = rank_order.get(old_rank, 0)

        return new_score > old_score
