"""PokerKit-driven runtime manager for table play loops.

This module replaces custom poker logic with PokerKit as the single source of truth.
All game rules, card dealing, and pot calculations are handled by PokerKit.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pokerkit import Mode

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    ActionType,
    Seat,
    Table,
)
from telegram_poker_bot.engine_adapter import PokerEngineAdapter


logger = get_logger(__name__)


class PokerKitTableRuntime:
    """
    Runtime state container for a single table using PokerKit engine.

    Design:
    - ALL poker logic delegated to PokerKit via adapter
    - No custom dealing, betting, or pot calculation
    - State is serialized from PokerKit for frontend consumption
    """

    def __init__(self, table: Table, seats: List[Seat]):
        self.table = table
        self.seats = sorted(seats, key=lambda s: s.position)
        self.hand_no = 0
        self.engine: Optional[PokerEngineAdapter] = None
        self.user_id_to_player_index: Dict[int, int] = {}

    def start_hand(self, small_blind: int, big_blind: int) -> Dict[str, Any]:
        """
        Start a new hand using PokerKit engine.

        Args:
            small_blind: Small blind amount
            big_blind: Big blind amount

        Returns:
            Initial game state dictionary
        """
        self.hand_no += 1

        # Build mapping from user_id to player index
        active_seats = [s for s in self.seats if s.left_at is None]
        self.user_id_to_player_index = {
            seat.user_id: idx for idx, seat in enumerate(active_seats)
        }

        # Get starting stacks
        starting_stacks = [seat.chips for seat in active_seats]

        # Create PokerKit engine
        self.engine = PokerEngineAdapter(
            player_count=len(active_seats),
            starting_stacks=starting_stacks,
            small_blind=small_blind,
            big_blind=big_blind,
            mode=Mode.TOURNAMENT,
        )

        # Deal hole cards
        self.engine.deal_new_hand()

        logger.info(
            "Hand started with PokerKit",
            table_id=self.table.id,
            hand_no=self.hand_no,
            players=len(active_seats),
        )

        # Return initial state
        return self.to_payload()

    def handle_action(
        self, user_id: int, action: ActionType, amount: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Handle player action through PokerKit engine.

        Args:
            user_id: User ID of acting player
            action: Action type (fold, check, call, bet, raise, all_in)
            amount: Bet/raise amount (if applicable)

        Returns:
            Updated game state with optional hand_result if hand complete
        """
        if not self.engine:
            raise ValueError("No active hand")

        # Validate it's this player's turn
        player_index = self.user_id_to_player_index.get(user_id)
        if player_index is None:
            raise ValueError("User not seated")

        actor_index = self.engine.state.actor_index
        if actor_index is None:
            raise ValueError("No player to act")

        if player_index != actor_index:
            raise ValueError("Not your turn")

        # Process action via PokerKit
        if action == ActionType.FOLD:
            self.engine.fold()
        elif action in (ActionType.CHECK, ActionType.CALL):
            self.engine.check_or_call()
        elif action in (ActionType.BET, ActionType.RAISE):
            if amount is None:
                raise ValueError("Amount required for bet/raise")
            self.engine.bet_or_raise(amount)
        elif action == ActionType.ALL_IN:
            # All-in is just a bet/raise to full stack
            player_stack = self.engine.state.stacks[player_index]
            player_bet = self.engine.state.bets[player_index]
            all_in_amount = player_stack + player_bet
            self.engine.bet_or_raise(all_in_amount)
        else:
            raise ValueError(f"Unsupported action: {action}")

        logger.info(
            "Action processed via PokerKit",
            user_id=user_id,
            action=action.value,
            amount=amount,
        )

        # Build response
        result = {"state": self.to_payload()}

        # Check if hand is complete
        if self.engine.is_hand_complete():
            winners = self.engine.get_winners()

            # Convert player indices back to user IDs
            user_id_by_index = {
                idx: uid for uid, idx in self.user_id_to_player_index.items()
            }
            hand_result = {
                "winners": [
                    {
                        "user_id": user_id_by_index[w["player_index"]],
                        "amount": w["amount"],
                        "pot_index": w["pot_index"],
                    }
                    for w in winners
                ]
            }
            result["hand_result"] = hand_result

            logger.info(
                "Hand complete",
                table_id=self.table.id,
                hand_no=self.hand_no,
                winners=hand_result["winners"],
            )

        return result

    def to_payload(self, viewer_user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Serialize table state for frontend consumption.

        Args:
            viewer_user_id: User ID of viewer (for card visibility)

        Returns:
            State dictionary matching frontend expectations
        """
        if not self.engine:
            # No active hand
            return {
                "type": "table_state",
                "table_id": self.table.id,
                "hand_id": None,
                "status": "waiting",
                "street": None,
                "board": [],
                "pot": 0,
                "current_bet": 0,
                "min_raise": 0,
                "current_actor": None,
                "action_deadline": None,
                "players": [],
                "hero": None,
                "last_action": None,
            }

        # Get viewer player index
        viewer_player_index = None
        if viewer_user_id is not None:
            viewer_player_index = self.user_id_to_player_index.get(viewer_user_id)

        # Get full state from PokerKit
        poker_state = self.engine.to_full_state(viewer_player_index)

        # Map player indices to user IDs
        user_id_by_index = {
            idx: uid for uid, idx in self.user_id_to_player_index.items()
        }
        seat_by_user_id = {s.user_id: s for s in self.seats}

        # Build player list
        players = []
        for player in poker_state["players"]:
            player_idx = player["player_index"]
            user_id = user_id_by_index[player_idx]
            seat = seat_by_user_id.get(user_id)

            players.append(
                {
                    "user_id": user_id,
                    "seat": seat.position if seat else player_idx,
                    "stack": player["stack"],
                    "bet": player["bet"],
                    "in_hand": not player["is_folded"],
                    "is_button": player["is_button"],
                    "is_small_blind": player["is_small_blind"],
                    "is_big_blind": player["is_big_blind"],
                    "acted": not player[
                        "is_actor"
                    ],  # If current actor, hasn't acted yet
                    "display_name": seat.user.username if seat and seat.user else None,
                }
            )

        # Get current actor user ID
        actor_index = poker_state.get("current_actor_index")
        current_actor_user_id = None
        if actor_index is not None:
            current_actor_user_id = user_id_by_index.get(actor_index)

        # Get hero cards
        hero_cards = []
        if viewer_player_index is not None:
            viewer_player = poker_state["players"][viewer_player_index]
            hero_cards = viewer_player.get("hole_cards", [])

        # Build payload
        payload = {
            "type": "table_state",
            "table_id": self.table.id,
            "hand_id": self.hand_no,
            "status": poker_state["street"],  # Use street as status
            "street": poker_state["street"],
            "board": poker_state["board_cards"],
            "pot": poker_state["total_pot"],
            "current_bet": max(self.engine.state.bets) if self.engine.state.bets else 0,
            "min_raise": poker_state["big_blind"],  # Simple approximation
            "current_actor": current_actor_user_id,
            "action_deadline": (
                (datetime.now(timezone.utc) + timedelta(seconds=25)).isoformat()
                if current_actor_user_id
                else None
            ),
            "players": players,
            "hero": (
                {
                    "user_id": viewer_user_id,
                    "cards": hero_cards,
                }
                if viewer_user_id
                else None
            ),
            "last_action": None,  # Could track this if needed
        }

        return payload


class PokerKitTableRuntimeManager:
    """Registry for PokerKit table runtimes."""

    def __init__(self):
        self._tables: Dict[int, PokerKitTableRuntime] = {}
        self._lock = asyncio.Lock()

    async def ensure_table(
        self, db: AsyncSession, table_id: int
    ) -> PokerKitTableRuntime:
        async with self._lock:
            # Always fetch fresh table and seat data from database
            result = await db.execute(select(Table).where(Table.id == table_id))
            table = result.scalar_one_or_none()
            if not table:
                raise ValueError("Table not found")
            seats_result = await db.execute(
                select(Seat)
                .where(Seat.table_id == table_id, Seat.left_at.is_(None))
                .order_by(Seat.position)
            )
            seats = seats_result.scalars().all()

            # Update existing runtime or create new one
            runtime = self._tables.get(table_id)
            if runtime:
                # Update existing runtime with fresh data
                runtime.table = table
                runtime.seats = sorted(seats, key=lambda s: s.position)
            else:
                # Create new runtime
                runtime = PokerKitTableRuntime(table, seats)
                self._tables[table_id] = runtime
            return runtime

    async def start_game(self, db: AsyncSession, table_id: int) -> Dict:
        runtime = await self.ensure_table(db, table_id)
        config = runtime.table.config_json or {}
        small_blind = config.get("small_blind", 25)
        big_blind = config.get("big_blind", 50)
        return runtime.start_hand(small_blind, big_blind)

    async def handle_action(
        self,
        db: AsyncSession,
        table_id: int,
        user_id: int,
        action: ActionType,
        amount: Optional[int],
    ) -> Dict:
        runtime = await self.ensure_table(db, table_id)
        result = runtime.handle_action(user_id, action, amount)
        state = result.get("state", runtime.to_payload(user_id))

        # Add hand_result if present
        if "hand_result" in result:
            state["hand_result"] = result["hand_result"]

        return state

    async def get_state(
        self, db: AsyncSession, table_id: int, viewer_user_id: Optional[int]
    ) -> Dict:
        runtime = await self.ensure_table(db, table_id)
        return runtime.to_payload(viewer_user_id)


_pokerkit_runtime_manager = PokerKitTableRuntimeManager()


def get_pokerkit_runtime_manager() -> PokerKitTableRuntimeManager:
    """Get the global PokerKit runtime manager instance."""
    return _pokerkit_runtime_manager


async def refresh_table_runtime(db: AsyncSession, table_id: int) -> None:
    """
    Refresh table runtime by ensuring it exists in the runtime manager.

    This function ensures that a table runtime is loaded and cached
    in the PokerKitTableRuntimeManager. This is called when tables are
    created or modified to ensure the runtime is up-to-date.
    """
    await get_pokerkit_runtime_manager().ensure_table(db, table_id)


def reset_pokerkit_runtime_cache() -> None:
    """Reset the runtime cache (for testing)."""
    global _pokerkit_runtime_manager
    _pokerkit_runtime_manager = PokerKitTableRuntimeManager()
