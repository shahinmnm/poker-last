"""Hand analytics processor for persisting hand-level summaries.

Processes completed hands and stores compact analytics summaries
for player performance tracking and historical analysis.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    HandAnalytics,
    PlayerSession,
    Hand,
    Action,
    ActionType,
    Seat,
    Table,
    TableTemplate,
    CurrencyType,
    User,
)

logger = get_logger(__name__)


class HandAnalyticsProcessor:
    """Process completed hands and persist analytics summaries."""
    
    @staticmethod
    async def process_hand(
        db: AsyncSession,
        hand_id: int,
    ) -> Optional[HandAnalytics]:
        """Process a completed hand and create analytics record.
        
        Args:
            db: Database session
            hand_id: ID of the completed hand
            
        Returns:
            Created HandAnalytics record or None if hand not found
        """
        # Get hand with related data
        result = await db.execute(
            select(Hand)
            .where(Hand.id == hand_id)
        )
        hand = result.scalar_one_or_none()
        
        if not hand:
            logger.warning("Hand not found for analytics", hand_id=hand_id)
            return None
        
        # Get table and template
        table_result = await db.execute(
            select(Table, TableTemplate)
            .join(TableTemplate, Table.template_id == TableTemplate.id)
            .where(Table.id == hand.table_id)
        )
        table_row = table_result.one_or_none()
        
        if not table_row:
            logger.warning("Table not found for hand", hand_id=hand_id, table_id=hand.table_id)
            return None
        
        table, template = table_row
        
        # Get all actions for this hand
        actions_result = await db.execute(
            select(Action)
            .where(Action.hand_id == hand_id)
            .order_by(Action.created_at)
        )
        actions = list(actions_result.scalars().all())
        
        # Get seats at the time of this hand
        seats_result = await db.execute(
            select(Seat)
            .where(Seat.table_id == hand.table_id)
        )
        seats = list(seats_result.scalars().all())
        
        # Calculate analytics metrics
        analytics_data = await HandAnalyticsProcessor._calculate_hand_metrics(
            hand, table, template, actions, seats
        )
        
        # Create analytics record
        hand_analytics = HandAnalytics(
            table_id=hand.table_id,
            hand_id=hand_id,
            template_id=template.id,
            hand_no=hand.hand_no,
            variant=analytics_data["variant"],
            stakes=analytics_data["stakes"],
            currency=analytics_data["currency"],
            players_in_hand=analytics_data["players_in_hand"],
            positions=analytics_data["positions"],
            button_seat=analytics_data.get("button_seat"),
            sb_seat=analytics_data.get("sb_seat"),
            bb_seat=analytics_data.get("bb_seat"),
            vpip_mask=analytics_data["vpip_mask"],
            pfr_mask=analytics_data["pfr_mask"],
            actions_count=analytics_data["actions_count"],
            aggression_factor=analytics_data.get("aggression_factor"),
            total_pot=analytics_data["total_pot"],
            rake=analytics_data["rake"],
            multiway=analytics_data["multiway"],
            went_to_showdown=analytics_data["went_to_showdown"],
            showdown_count=analytics_data["showdown_count"],
            winners=analytics_data.get("winners"),
            timeouts=analytics_data["timeouts"],
            autofolds=analytics_data["autofolds"],
            player_deltas=analytics_data.get("player_deltas"),
        )
        
        db.add(hand_analytics)
        await db.flush()
        
        logger.info(
            "Created hand analytics",
            hand_id=hand_id,
            table_id=hand.table_id,
            players=analytics_data["players_in_hand"],
        )
        
        return hand_analytics
    
    @staticmethod
    async def _calculate_hand_metrics(
        hand: Hand,
        table: Table,
        template: TableTemplate,
        actions: List[Action],
        seats: List[Seat],
    ) -> Dict[str, Any]:
        """Calculate all metrics for a hand.
        
        Args:
            hand: Hand record
            table: Table record
            template: TableTemplate record
            actions: List of actions in the hand
            seats: List of seats at the table
            
        Returns:
            Dict with calculated metrics
        """
        # Extract template config
        config = template.config_json or {}
        variant = config.get("variant", "no_limit_texas_holdem")
        small_blind = config.get("small_blind", 25)
        big_blind = config.get("big_blind", 50)
        stakes = f"{small_blind}/{big_blind}"
        
        # Determine currency type from template
        currency = CurrencyType.PLAY  # Default
        if config.get("currency_type"):
            try:
                currency = CurrencyType(config["currency_type"])
            except ValueError:
                pass
        
        # Count active players (not left)
        active_seats = [s for s in seats if s.left_at is None]
        players_in_hand = len(active_seats)
        
        # Build positions map
        positions = {seat.user_id: seat.position for seat in active_seats}
        
        # Calculate VPIP and PFR masks
        vpip_mask = {}
        pfr_mask = {}
        
        for seat in active_seats:
            user_id = seat.user_id
            
            # VPIP: Did player voluntarily put money in pot?
            vpip = any(
                a.user_id == user_id and a.type in [ActionType.BET, ActionType.CALL, ActionType.RAISE]
                for a in actions
            )
            vpip_mask[user_id] = vpip
            
            # PFR: Did player raise preflop?
            # Note: Simplified - ideally we'd track street per action
            pfr = any(
                a.user_id == user_id and a.type == ActionType.RAISE
                for a in actions
            )
            pfr_mask[user_id] = pfr
        
        # Count actions
        actions_count = len(actions)
        
        # Calculate aggression factor
        bets = sum(1 for a in actions if a.type == ActionType.BET)
        raises = sum(1 for a in actions if a.type == ActionType.RAISE)
        calls = sum(1 for a in actions if a.type == ActionType.CALL)
        
        aggression_factor = None
        if calls > 0:
            aggression_factor = (bets + raises) / calls
        
        # Calculate total pot (sum of all bets/raises/calls)
        total_pot = sum(a.amount for a in actions if a.type in [ActionType.BET, ActionType.RAISE, ActionType.CALL])
        
        # Estimate rake (typically 5% up to a cap)
        rake = min(int(total_pot * 0.05), big_blind * 3)
        
        # Multiway: Did 3+ players see the flop?
        # Simplified: Check if 3+ players took voluntary actions
        active_players = len(set(a.user_id for a in actions if a.type != ActionType.FOLD))
        multiway = active_players >= 3
        
        # Showdown tracking (simplified - would need street tracking)
        went_to_showdown = hand.status.value == "showdown" if hand.status else False
        showdown_count = 1 if went_to_showdown else 0
        
        # Timeouts and autofolds (would need timeout tracking in Action)
        timeouts = 0
        autofolds = 0
        
        # Winners (would need pot distribution data)
        winners = None
        
        # Player deltas (would need before/after stack tracking)
        player_deltas = None
        
        # Button/blind positions (would need dealer button tracking)
        button_seat = None
        sb_seat = None
        bb_seat = None
        
        return {
            "variant": variant,
            "stakes": stakes,
            "currency": currency,
            "players_in_hand": players_in_hand,
            "positions": positions,
            "button_seat": button_seat,
            "sb_seat": sb_seat,
            "bb_seat": bb_seat,
            "vpip_mask": vpip_mask,
            "pfr_mask": pfr_mask,
            "actions_count": actions_count,
            "aggression_factor": aggression_factor,
            "total_pot": total_pot,
            "rake": rake,
            "multiway": multiway,
            "went_to_showdown": went_to_showdown,
            "showdown_count": showdown_count,
            "winners": winners,
            "timeouts": timeouts,
            "autofolds": autofolds,
            "player_deltas": player_deltas,
        }
    
    @staticmethod
    async def update_player_session(
        db: AsyncSession,
        user_id: int,
        table_id: int,
        hand_analytics: HandAnalytics,
    ):
        """Update player session stats with completed hand data.
        
        Args:
            db: Database session
            user_id: User ID
            table_id: Table ID
            hand_analytics: HandAnalytics record for the completed hand
        """
        # Get or create active session
        session_result = await db.execute(
            select(PlayerSession)
            .where(
                PlayerSession.user_id == user_id,
                PlayerSession.table_id == table_id,
                PlayerSession.session_end.is_(None),  # Active session
            )
            .order_by(PlayerSession.session_start.desc())
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            logger.warning(
                "No active session found for player",
                user_id=user_id,
                table_id=table_id,
            )
            return
        
        # Update session stats
        session.hands_played += 1
        
        if hand_analytics.vpip_mask and hand_analytics.vpip_mask.get(user_id):
            session.vpip_count += 1
        
        if hand_analytics.pfr_mask and hand_analytics.pfr_mask.get(user_id):
            session.pfr_count += 1
        
        # Update aggression factor components
        # (This is simplified - ideally we'd track per-player actions)
        
        session.timeouts += hand_analytics.timeouts
        
        await db.flush()
        
        logger.debug(
            "Updated player session",
            user_id=user_id,
            table_id=table_id,
            session_id=session.id,
        )
    
    @staticmethod
    async def create_player_session(
        db: AsyncSession,
        user_id: int,
        table_id: int,
        template_id: int,
        buy_in: int,
    ) -> PlayerSession:
        """Create a new player session when joining a table.
        
        Args:
            db: Database session
            user_id: User ID
            table_id: Table ID
            template_id: Template ID
            buy_in: Buy-in amount
            
        Returns:
            Created PlayerSession record
        """
        session = PlayerSession(
            user_id=user_id,
            table_id=table_id,
            template_id=template_id,
            buy_in=buy_in,
        )
        
        db.add(session)
        await db.flush()
        
        logger.info(
            "Created player session",
            user_id=user_id,
            table_id=table_id,
            buy_in=buy_in,
        )
        
        return session
    
    @staticmethod
    async def end_player_session(
        db: AsyncSession,
        user_id: int,
        table_id: int,
        cash_out: int,
    ):
        """End a player session when leaving a table.
        
        Args:
            db: Database session
            user_id: User ID
            table_id: Table ID
            cash_out: Cash-out amount
        """
        # Get active session
        session_result = await db.execute(
            select(PlayerSession)
            .where(
                PlayerSession.user_id == user_id,
                PlayerSession.table_id == table_id,
                PlayerSession.session_end.is_(None),
            )
            .order_by(PlayerSession.session_start.desc())
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            logger.warning(
                "No active session to end",
                user_id=user_id,
                table_id=table_id,
            )
            return
        
        # End session
        session.session_end = datetime.now(timezone.utc)
        session.cash_out = cash_out
        session.net = cash_out - session.buy_in
        
        await db.flush()
        
        logger.info(
            "Ended player session",
            user_id=user_id,
            table_id=table_id,
            session_id=session.id,
            net=session.net,
        )
