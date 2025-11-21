"""PokerKit-driven runtime manager for table play loops.

This module replaces custom poker logic with PokerKit as the single source of truth.
All game rules, card dealing, and pot calculations are handled by PokerKit.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pokerkit import Mode

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    ActionType,
    Hand,
    HandStatus,
    HandHistoryEvent,
    Seat,
    Table,
)
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.engine_adapter import PokerEngineAdapter


logger = get_logger(__name__)
settings = get_settings()


class PokerKitTableRuntime:
    """
    Runtime state container for a single table using PokerKit engine.

    Design:
    - ALL poker logic delegated to PokerKit via adapter
    - No custom dealing, betting, or pot calculation
    - State is serialized from PokerKit for frontend consumption
    - Engine state is persisted to Hand.engine_state_json after each action
    - This class is cached per-process in PokerKitTableRuntimeManager

    Multi-Worker Note:
    - Each worker process maintains its own instance of this class
    - Table and Seat data are refreshed from DB on each operation
    - Engine state is loaded from DB on first access, then kept in memory
    - State changes are persisted back to DB after each action
    """

    def __init__(self, table: Table, seats: List[Seat]):
        self.table = table
        self.seats = sorted(seats, key=lambda s: s.position)
        self.hand_no = 0
        self.engine: Optional[PokerEngineAdapter] = None
        self.user_id_to_player_index: Dict[int, int] = {}
        self.current_hand: Optional[Hand] = None
        self.event_sequence = 0
        self._pending_deal_event: Optional[str] = None
        self.last_hand_result: Optional[Dict[str, Any]] = None

    async def _log_hand_event(
        self,
        db: AsyncSession,
        action_type: str,
        actor_user_id: Optional[int] = None,
        amount: Optional[int] = None,
    ) -> None:
        """
        Log a hand history event to the database.

        Args:
            db: Database session
            action_type: Type of action (e.g., "hand_started", "deal_flop", "bet", "fold")
            actor_user_id: User ID of the player performing the action (None for system events)
            amount: Amount for bet/raise/call actions
        """
        if not self.current_hand or not self.engine:
            return

        # Determine current street
        street_index = self.engine.state.street_index if self.engine.state.street_index is not None else 0
        street_names = ["preflop", "flop", "turn", "river"]
        street = street_names[street_index] if 0 <= street_index < len(street_names) else "showdown"

        # Calculate pot size
        pot_size = sum(pot.amount for pot in self.engine.state.pots) + sum(self.engine.state.bets)

        # Get board cards
        board_cards = []
        if self.engine.state.board_cards:
            for card_list in self.engine.state.board_cards:
                if card_list and len(card_list) > 0:
                    board_cards.append(repr(card_list[0]))

        # Create event
        event = HandHistoryEvent(
            hand_id=self.current_hand.id,
            table_id=self.table.id,
            sequence=self.event_sequence,
            street=street,
            action_type=action_type,
            actor_user_id=actor_user_id,
            amount=amount,
            pot_size=pot_size,
            board_cards=board_cards if board_cards else None,
        )
        db.add(event)
        self.event_sequence += 1

        logger.debug(
            "Logged hand event",
            table_id=self.table.id,
            hand_id=self.current_hand.id,
            sequence=event.sequence,
            action_type=action_type,
            actor_user_id=actor_user_id,
        )

    async def load_or_create_hand(self, db: AsyncSession) -> Hand:
        """
        Load the current active hand or create a new one.

        Query for the latest Hand for this table with status != ENDED.
        If exists, return it. Otherwise, create a new Hand row.

        Args:
            db: Database session

        Returns:
            Current or new Hand record
        """
        # Query for active hand
        result = await db.execute(
            select(Hand)
            .where(Hand.table_id == self.table.id, Hand.status != HandStatus.ENDED)
            .order_by(Hand.hand_no.desc())
            .limit(1)
        )
        hand = result.scalar_one_or_none()

        if hand:
            logger.info(
                "Loaded active hand from DB",
                table_id=self.table.id,
                hand_no=hand.hand_no,
                status=hand.status.value,
            )
            self.current_hand = hand
            return hand

        # Get max hand_no for this table
        max_hand_result = await db.execute(
            select(Hand.hand_no)
            .where(Hand.table_id == self.table.id)
            .order_by(Hand.hand_no.desc())
            .limit(1)
        )
        max_hand_no = max_hand_result.scalar_one_or_none()
        next_hand_no = (max_hand_no or 0) + 1

        # Create new hand
        hand = Hand(
            table_id=self.table.id,
            hand_no=next_hand_no,
            status=HandStatus.PREFLOP,
            engine_state_json={},  # Will be updated after engine init
        )
        db.add(hand)

        logger.info(
            "Created new hand",
            table_id=self.table.id,
            hand_no=next_hand_no,
        )

        self.current_hand = hand
        return hand

    async def start_new_hand(
        self, db: AsyncSession, small_blind: int, big_blind: int
    ) -> Dict[str, Any]:
        """
        Start a new hand using PokerKit engine and persist state to DB.

        Supports multi-hand sessions with proper dealer button rotation.

        Args:
            db: Database session
            small_blind: Small blind amount
            big_blind: Big blind amount

        Returns:
            Initial game state dictionary
        """
        # Load or create Hand row
        hand = await self.load_or_create_hand(db)
        self.hand_no = hand.hand_no
        self.last_hand_result = None

        # Build mapping from user_id to player index
        active_seats = [
            s
            for s in self.seats
            if s.left_at is None and not s.is_sitting_out_next_hand
        ]

        if len(active_seats) < 2:
            raise ValueError("Cannot start hand: fewer than 2 active players")

        self.user_id_to_player_index = {
            seat.user_id: idx for idx, seat in enumerate(active_seats)
        }

        # Get starting stacks (current chips from seats)
        starting_stacks = [seat.chips for seat in active_seats]

        # Determine button index for this hand
        # For multi-hand support, rotate button from previous hand
        button_index = None
        if self.hand_no > 1:
            # Get the previous completed hand to find the button position
            prev_hand_result = await db.execute(
                select(Hand)
                .where(
                    Hand.table_id == self.table.id,
                    Hand.hand_no == self.hand_no - 1,
                    Hand.status == HandStatus.ENDED,
                )
                .limit(1)
            )
            prev_hand = prev_hand_result.scalar_one_or_none()

            if prev_hand and prev_hand.engine_state_json:
                prev_button = prev_hand.engine_state_json.get("button_index", 0)
                # Rotate button clockwise (add 1, modulo player count)
                button_index = (prev_button + 1) % len(active_seats)
                logger.info(
                    "Rotating button for next hand",
                    table_id=self.table.id,
                    hand_no=self.hand_no,
                    prev_button=prev_button,
                    new_button=button_index,
                )

        # Create PokerKit engine with optional button rotation
        self.engine = PokerEngineAdapter(
            player_count=len(active_seats),
            starting_stacks=starting_stacks,
            small_blind=small_blind,
            big_blind=big_blind,
            mode=Mode.TOURNAMENT,
            button_index=button_index,
        )

        # Deal hole cards
        self.engine.deal_new_hand()

        # Reset event sequence for new hand
        self.event_sequence = 0

        # Persist engine state to DB
        hand.engine_state_json = self.engine.to_persistence_state()
        hand.status = HandStatus.PREFLOP
        await db.flush()

        # Log hand started event
        await self._log_hand_event(db, "hand_started")

        logger.info(
            "Hand started with PokerKit and persisted",
            table_id=self.table.id,
            hand_no=self.hand_no,
            players=len(active_seats),
            button_index=button_index,
        )

        # Return initial state
        return self.to_payload()

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
        active_seats = [
            s
            for s in self.seats
            if s.left_at is None and not s.is_sitting_out_next_hand
        ]

        if len(active_seats) < 2:
            raise ValueError("Cannot start hand: fewer than 2 active players")

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

    def _auto_advance_street_and_showdown(self) -> None:
        """
        Automatically advance through streets when betting rounds complete.

        This helper handles:
        - Normal play: preflop -> flop -> turn -> river
        - All-in scenarios: auto-deal remaining community cards

        Called after each player action to ensure proper game progression.
        """
        if not self.engine:
            return

        # Loop while hand is not complete and there's no one to act
        # This handles both normal street progression and all-in run-outs
        while (
            not self.engine.is_hand_complete() and not self.engine.state.actor_indices
        ):
            street_index = self.engine.state.street_index
            if street_index is None:
                break

            # Count current board cards to determine what to deal
            current_board_count = sum(
                len(cards) for cards in self.engine.state.board_cards
            )

            # Deal community cards based on what's missing
            if street_index == 1 and current_board_count == 0:
                # On flop street but no cards dealt yet -> deal flop
                self.engine.deal_flop()
                self._pending_deal_event = "deal_flop"
                logger.debug(
                    "Auto-dealt flop", table_id=self.table.id, hand_no=self.hand_no
                )
            elif street_index == 2 and current_board_count == 3:
                # On turn street but only 3 cards -> deal turn
                self.engine.deal_turn()
                self._pending_deal_event = "deal_turn"
                logger.debug(
                    "Auto-dealt turn", table_id=self.table.id, hand_no=self.hand_no
                )
            elif street_index == 3 and current_board_count == 4:
                # On river street but only 4 cards -> deal river
                self.engine.deal_river()
                self._pending_deal_event = "deal_river"
                logger.debug(
                    "Auto-dealt river", table_id=self.table.id, hand_no=self.hand_no
                )
            else:
                # Either preflop (street_index=0), or cards already dealt, or hand complete
                break

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

        # Auto-advance streets and handle showdown
        self._auto_advance_street_and_showdown()

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
                        "hand_score": w["hand_score"],
                        "hand_rank": w["hand_rank"],
                        "best_hand_cards": w["best_hand_cards"],
                    }
                    for w in winners
                ]
            }
            self.last_hand_result = hand_result
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
            seated_players = []
            for seat in self.seats:
                if seat.left_at is None:
                    seated_players.append(
                        {
                            "user_id": seat.user_id,
                            "seat": seat.position,
                            "stack": seat.chips,
                            "bet": 0,
                            "in_hand": False,
                            "is_button": False,
                            "is_small_blind": False,
                            "is_big_blind": False,
                            "acted": False,
                            "display_name": seat.user.username if seat.user else None,
                            "is_sitting_out_next_hand": seat.is_sitting_out_next_hand,
                        }
                    )

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
                "players": seated_players,
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
                    "acted": not player["is_actor"],
                    "display_name": seat.user.username if seat and seat.user else None,
                    "is_sitting_out_next_hand": (
                        seat.is_sitting_out_next_hand if seat else False
                    ),
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

        # Convert pots to use user_ids instead of player_indices
        pots_with_user_ids = []
        for pot in poker_state.get("pots", []):
            pots_with_user_ids.append(
                {
                    "pot_index": pot["pot_index"],
                    "amount": pot["amount"],
                    "eligible_user_ids": [
                        user_id_by_index[idx]
                        for idx in pot.get("player_indices", [])
                        if idx in user_id_by_index
                    ],
                }
            )

        # Build payload
        payload = {
            "type": "table_state",
            "table_id": self.table.id,
            "hand_id": self.hand_no,
            "status": poker_state["street"],
            "street": poker_state["street"],
            "board": poker_state["board_cards"],
            "pot": poker_state["total_pot"],
            "pots": pots_with_user_ids,
            "current_bet": max(self.engine.state.bets) if self.engine.state.bets else 0,
            "min_raise": poker_state["big_blind"],
            "current_actor": current_actor_user_id,
            "action_deadline": (
                (datetime.now(timezone.utc) + timedelta(seconds=settings.turn_timeout_seconds)).isoformat()
                if current_actor_user_id
                else None
            ),
            "turn_timeout_seconds": settings.turn_timeout_seconds,
            "players": players,
            "hero": (
                {
                    "user_id": viewer_user_id,
                    "cards": hero_cards,
                }
                if viewer_user_id
                else None
            ),
            "last_action": None,
            "allowed_actions": poker_state.get("allowed_actions", {}),
        }

        if self.last_hand_result and (not self.engine or not self.engine.state.status):
            payload["hand_result"] = self.last_hand_result

        return payload


class PokerKitTableRuntimeManager:
    """
    Manager for PokerKit table runtimes with multi-worker safety considerations.

    Design Principles:
    - The database (Hand.engine_state_json) is the SINGLE SOURCE OF TRUTH for engine state
    - Engine state is persisted to DB after each action (in handle_action)
    - _tables cache is a per-process optimization for runtime objects
    - Per-table locks ensure serialized access to DB read/write operations within a process
    - Table and Seat data is ALWAYS refreshed from DB on each operation

    Multi-Worker Behavior:
    - The service CAN run with multiple API workers sharing the same database
    - Each worker maintains its own _tables cache for performance
    - Engine state is loaded from DB when a worker first accesses a table
    - Once loaded, a worker keeps the engine in memory and updates it on each action
    - After each action, state is persisted back to DB (via handle_action)
    - This means: A worker will see the current state once it performs any operation on a table

    Known Limitation:
    - If Worker A handles an action and Worker B hasn't accessed that table yet,
      Worker B will still have stale/no state until it performs an operation.
    - This is acceptable because:
      1. Most requests complete atomically under the per-table lock
      2. WebSocket connections typically stick to one worker (session affinity)
      3. The state converges on the next operation
      4. Complete state restoration from DB is complex and not fully implemented

    For truly stateless multi-worker operation, the engine restoration logic in
    PokerEngineAdapter.from_persistence_state() would need to be enhanced to fully
    reconstruct all internal PokerKit State fields.
    """

    def __init__(self):
        # Per-process cache for runtime objects
        # Contains table metadata and engine state
        self._tables: Dict[int, PokerKitTableRuntime] = {}
        # Per-table locks to serialize operations within this process
        self._locks: Dict[int, asyncio.Lock] = {}

    def _get_lock_for_table(self, table_id: int) -> asyncio.Lock:
        """Get or create a lock for a specific table.

        Args:
            table_id: The table ID to get a lock for

        Returns:
            An asyncio.Lock for the specified table
        """
        lock = self._locks.get(table_id)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[table_id] = lock
        return lock

    async def ensure_table(
        self, db: AsyncSession, table_id: int
    ) -> PokerKitTableRuntime:
        """
        Get or create runtime instance, always refreshing table/seat data from DB.

        This method ensures multi-worker safety by:
        1. ALWAYS fetching fresh Table and Seats from DB
        2. Reusing cached runtime if it exists, or creating new if not
        3. Loading engine state from DB only if runtime.engine is None

        The engine is loaded from DB on first access per worker. Subsequent calls
        reuse the in-memory engine, which is kept in sync via handle_action's persistence.

        Args:
            db: Database session
            table_id: The table ID to load

        Returns:
            PokerKitTableRuntime instance with current table/seat data from DB
        """
        # Always fetch fresh table and seat data from database
        result = await db.execute(select(Table).where(Table.id == table_id))
        table = result.scalar_one_or_none()
        if not table:
            raise ValueError("Table not found")
        seats_result = await db.execute(
            select(Seat)
            .options(selectinload(Seat.user))
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

        # Load engine state from DB if not already loaded in this worker
        # This ensures first access gets DB state, subsequent calls reuse in-memory state
        if runtime.engine is None:
            hand_result = await db.execute(
                select(Hand)
                .where(Hand.table_id == table_id, Hand.status != HandStatus.ENDED)
                .order_by(Hand.hand_no.desc())
                .limit(1)
            )
            hand = hand_result.scalar_one_or_none()

            if hand and hand.engine_state_json:
                # Restore engine from persisted state
                try:
                    runtime.engine = PokerEngineAdapter.from_persistence_state(
                        hand.engine_state_json
                    )
                    runtime.hand_no = hand.hand_no
                    runtime.current_hand = hand

                    # Rebuild user_id_to_player_index mapping
                    active_seats = [s for s in runtime.seats if s.left_at is None]
                    runtime.user_id_to_player_index = {
                        seat.user_id: idx for idx, seat in enumerate(active_seats)
                    }

                    logger.info(
                        "Restored engine from DB",
                        table_id=table_id,
                        hand_no=hand.hand_no,
                        status=hand.status.value,
                    )
                except Exception as e:
                    logger.error(
                        "Failed to restore engine from DB",
                        table_id=table_id,
                        hand_id=hand.id,
                        error=str(e),
                    )
                    # Keep engine as None, will be created on next start_game

        return runtime

    async def start_game(self, db: AsyncSession, table_id: int) -> Dict:
        lock = self._get_lock_for_table(table_id)
        async with lock:
            runtime = await self.ensure_table(db, table_id)
            config = runtime.table.config_json or {}
            small_blind = config.get("small_blind", 25)
            big_blind = config.get("big_blind", 50)

            # Update last_action_at and clear expires_at since game is starting
            runtime.table.last_action_at = datetime.now(timezone.utc)
            runtime.table.expires_at = None  # No fixed expiry after game starts
            await db.flush()

            return await runtime.start_new_hand(db, small_blind, big_blind)

    async def handle_action(
        self,
        db: AsyncSession,
        table_id: int,
        user_id: int,
        action: ActionType,
        amount: Optional[int],
    ) -> Dict:
        lock = self._get_lock_for_table(table_id)
        async with lock:
            runtime = await self.ensure_table(db, table_id)

            # Update last_action_at to track table activity
            runtime.table.last_action_at = datetime.now(timezone.utc)
            await db.flush()

            # Get or load current hand
            if runtime.current_hand is None:
                hand_result = await db.execute(
                    select(Hand)
                    .where(Hand.table_id == table_id, Hand.status != HandStatus.ENDED)
                    .order_by(Hand.hand_no.desc())
                    .limit(1)
                )
                runtime.current_hand = hand_result.scalar_one_or_none()

            if runtime.current_hand is None:
                raise ValueError("No active hand to handle action")

            # Process the action
            result = runtime.handle_action(user_id, action, amount)

            # Log action event if pending deal event
            if hasattr(runtime, '_pending_deal_event') and runtime._pending_deal_event:
                await runtime._log_hand_event(db, runtime._pending_deal_event)
                runtime._pending_deal_event = None

            # Log player action event
            action_type_map = {
                ActionType.FOLD: "fold",
                ActionType.CHECK: "check",
                ActionType.CALL: "call",
                ActionType.BET: "bet",
                ActionType.RAISE: "raise",
                ActionType.ALL_IN: "all_in",
            }
            event_action_type = action_type_map.get(action, str(action.value))
            await runtime._log_hand_event(
                db, event_action_type, actor_user_id=user_id, amount=amount
            )

            # Persist engine state after action
            if runtime.engine is None:
                raise ValueError("Engine not initialized")

            runtime.current_hand.engine_state_json = (
                runtime.engine.to_persistence_state()
            )

            # Update hand status based on result
            if "hand_result" in result:
                runtime.current_hand.status = HandStatus.ENDED
                runtime.current_hand.ended_at = datetime.now(timezone.utc)

                # Apply hand results to wallets and stats
                from telegram_poker_bot.shared.services.user_service import (
                    apply_hand_result_to_wallets_and_stats,
                )

                try:
                    await apply_hand_result_to_wallets_and_stats(
                        db=db,
                        hand=runtime.current_hand,
                        table=runtime.table,
                        seats=runtime.seats,
                        hand_result=result["hand_result"],
                    )
                    logger.info(
                        "Applied hand result to wallets and stats",
                        table_id=table_id,
                        hand_no=runtime.hand_no,
                    )
                except Exception as e:
                    logger.error(
                        "Failed to apply hand result to wallets/stats",
                        table_id=table_id,
                        hand_no=runtime.hand_no,
                        error=str(e),
                    )

                from telegram_poker_bot.shared.models import HandHistory

                board_cards = runtime.engine.state.board_cards if runtime.engine else []
                formatted_board = []
                if board_cards:
                    for card_list in board_cards:
                        if card_list and len(card_list) > 0:
                            formatted_board.append(repr(card_list[0]))

                hand_history_payload = {
                    "hand_no": runtime.hand_no,
                    "board": formatted_board,
                    "winners": [
                        {
                            "user_id": w["user_id"],
                            "amount": w["amount"],
                            "hand_rank": w["hand_rank"],
                            "best_hand_cards": w.get("best_hand_cards", []),
                        }
                        for w in result["hand_result"]["winners"]
                    ],
                    "pot_total": (
                        sum(pot.amount for pot in runtime.engine.state.pots)
                        if runtime.engine
                        else 0
                    ),
                }

                existing_history = await db.execute(
                    select(HandHistory).where(
                        HandHistory.table_id == table_id,
                        HandHistory.hand_no == runtime.hand_no,
                    )
                )
                if not existing_history.scalar_one_or_none():
                    history = HandHistory(
                        table_id=table_id,
                        hand_no=runtime.hand_no,
                        payload_json=hand_history_payload,
                    )
                    db.add(history)
                    logger.info(
                        "Saved hand history",
                        table_id=table_id,
                        hand_no=runtime.hand_no,
                    )

                # Log showdown/hand_ended events
                await runtime._log_hand_event(db, "showdown")
                await runtime._log_hand_event(db, "hand_ended")
            else:
                # Update status based on street
                street = runtime.engine.state.street_index
                if street is not None:
                    street_names = [
                        HandStatus.PREFLOP,
                        HandStatus.FLOP,
                        HandStatus.TURN,
                        HandStatus.RIVER,
                    ]
                    if 0 <= street < len(street_names):
                        runtime.current_hand.status = street_names[street]

            await db.flush()

            logger.info(
                "Action persisted to DB",
                table_id=table_id,
                hand_no=runtime.hand_no,
                user_id=user_id,
                action=action.value,
                hand_status=runtime.current_hand.status.value,
            )

            state = result.get("state", runtime.to_payload(user_id))

            # Add hand_result if present
            if "hand_result" in result:
                state["hand_result"] = result["hand_result"]

            return state

    async def get_state(
        self, db: AsyncSession, table_id: int, viewer_user_id: Optional[int]
    ) -> Dict:
        lock = self._get_lock_for_table(table_id)
        async with lock:
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
