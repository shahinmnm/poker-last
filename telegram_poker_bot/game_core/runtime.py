"""Lightweight runtime manager for table play loops."""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    ActionType,
    Seat,
    Table,
)


logger = get_logger(__name__)


RANK_ORDER = "23456789TJQKA"
SUITS = "shdc"


class HandStage(str, Enum):
    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"
    COMPLETE = "complete"


@dataclass
class PlayerState:
    user_id: int
    seat: int
    stack: int
    display_name: Optional[str] = None
    bet: int = 0
    folded: bool = False
    all_in: bool = False
    acted: bool = False
    cards: List[str] = field(default_factory=list)
    is_button: bool = False
    is_small_blind: bool = False
    is_big_blind: bool = False

    def reset_for_street(self) -> None:
        self.bet = 0
        self.acted = False


@dataclass
class HandState:
    table_id: int
    hand_no: int
    small_blind: int
    big_blind: int
    stage: HandStage = HandStage.PREFLOP
    board: List[str] = field(default_factory=list)
    pot: int = 0
    current_bet: int = 0
    min_raise: int = 0
    players: List[PlayerState] = field(default_factory=list)
    deck: List[str] = field(default_factory=list)
    current_actor: Optional[int] = None
    button_index: int = 0
    last_action: Optional[Dict] = None
    deadline: Optional[datetime] = None

    def active_players(self) -> List[PlayerState]:
        return [p for p in self.players if not p.folded and (p.stack > 0 or p.bet > 0)]

    def next_actor_index(self, start_from: Optional[int] = None) -> Optional[int]:
        if not self.players:
            return None
        index = start_from if start_from is not None else self.current_actor
        if index is None:
            return None
        for _ in range(len(self.players)):
            index = (index + 1) % len(self.players)
            candidate = self.players[index]
            if not candidate.folded and not candidate.all_in:
                return index
        return None


class TableRuntime:
    """Runtime state container for a single table."""

    def __init__(self, table: Table, seats: List[Seat]):
        self.table = table
        self.seats = sorted(seats, key=lambda s: s.position)
        self.hand_no = 0
        self.hand_state: Optional[HandState] = None
        self.button_index = 0

    def _build_deck(self) -> List[str]:
        deck = [f"{rank}{suit}" for rank in RANK_ORDER for suit in SUITS]
        random.shuffle(deck)
        return deck

    def _assign_blinds(self, hand: HandState) -> None:
        player_count = len(hand.players)
        if player_count < 2:
            return
        sb_index = (hand.button_index + 1) % player_count
        bb_index = (hand.button_index + 2) % player_count

        for idx, player in enumerate(hand.players):
            player.is_button = idx == hand.button_index
            player.is_small_blind = idx == sb_index
            player.is_big_blind = idx == bb_index

        sb_player = hand.players[sb_index]
        bb_player = hand.players[bb_index]

        sb_post = min(hand.small_blind, sb_player.stack)
        bb_post = min(hand.big_blind, bb_player.stack)
        sb_player.stack -= sb_post
        bb_player.stack -= bb_post
        sb_player.bet = sb_post
        bb_player.bet = bb_post
        hand.pot = sb_post + bb_post
        hand.current_bet = bb_post
        hand.min_raise = hand.big_blind
        hand.current_actor = hand.next_actor_index(bb_index)

    def _deal_private_cards(self, hand: HandState) -> None:
        for player in hand.players:
            player.cards = [hand.deck.pop(), hand.deck.pop()]

    def _reveal_board(self, hand: HandState, count: int) -> None:
        for _ in range(count):
            if hand.deck:
                hand.board.append(hand.deck.pop())

    def _is_betting_round_complete(self, hand: HandState) -> bool:
        for player in hand.players:
            if player.folded or player.all_in:
                continue
            if player.bet != hand.current_bet:
                return False
            if not player.acted:
                return False
        return True

    def _score_player(self, player: PlayerState, board: List[str]) -> int:
        cards = player.cards + board
        ranks = [RANK_ORDER.index(card[0]) for card in cards]
        return max(ranks) if ranks else 0

    def _award_pot(self, hand: HandState) -> Dict[str, List[Dict]]:
        active = [p for p in hand.players if not p.folded]
        if not active:
            return {"winners": []}
        scores = {p.user_id: self._score_player(p, hand.board) for p in active}
        best_score = max(scores.values())
        winners = [p for p in active if scores[p.user_id] == best_score]
        share = hand.pot // len(winners)
        for player in winners:
            player.stack += share
        return {
            "winners": [
                {"user_id": p.user_id, "amount": share, "hand_score": scores[p.user_id]}
                for p in winners
            ]
        }

    def _advance_stage(self, hand: HandState) -> Optional[Dict[str, List[Dict]]]:
        for player in hand.players:
            hand.pot += player.bet
            player.bet = 0
            player.acted = False

        hand.current_bet = 0
        hand.min_raise = hand.big_blind

        if hand.stage == HandStage.PREFLOP:
            self._reveal_board(hand, 3)
            hand.stage = HandStage.FLOP
        elif hand.stage == HandStage.FLOP:
            self._reveal_board(hand, 1)
            hand.stage = HandStage.TURN
        elif hand.stage == HandStage.TURN:
            self._reveal_board(hand, 1)
            hand.stage = HandStage.RIVER
        elif hand.stage == HandStage.RIVER:
            hand.stage = HandStage.SHOWDOWN
        elif hand.stage == HandStage.SHOWDOWN:
            hand.stage = HandStage.COMPLETE
        else:
            hand.stage = HandStage.COMPLETE

        if hand.stage == HandStage.SHOWDOWN:
            result = self._award_pot(hand)
            hand.stage = HandStage.COMPLETE
            hand.current_actor = None
            return result

        hand.current_actor = hand.next_actor_index(hand.button_index)
        return None

    def start_hand(self, small_blind: int, big_blind: int) -> HandState:
        self.hand_no += 1
        hand = HandState(
            table_id=self.table.id,
            hand_no=self.hand_no,
            small_blind=small_blind,
            big_blind=big_blind,
            deck=self._build_deck(),
            button_index=self.button_index,
        )
        hand.players = [
            PlayerState(
                user_id=seat.user_id,
                seat=seat.position,
                stack=seat.chips,
                display_name=seat.user.username if seat.user else None,
            )
            for seat in self.seats
            if seat.left_at is None
        ]
        self._deal_private_cards(hand)
        self._assign_blinds(hand)
        hand.deadline = datetime.now(timezone.utc) + timedelta(seconds=25)
        self.hand_state = hand
        logger.info("Hand started", table_id=self.table.id, hand_no=self.hand_no)
        return hand

    def handle_action(self, user_id: int, action: ActionType, amount: Optional[int] = None) -> Dict:
        if not self.hand_state:
            raise ValueError("No active hand")
        hand = self.hand_state
        actor_index = next((i for i, p in enumerate(hand.players) if p.user_id == user_id), None)
        if actor_index is None:
            raise ValueError("Player not seated")
        if hand.current_actor is not None and actor_index != hand.current_actor:
            raise ValueError("Not your turn")

        player = hand.players[actor_index]
        amount_to_call = max(hand.current_bet - player.bet, 0)

        if action == ActionType.FOLD:
            player.folded = True
            player.acted = True
            hand.last_action = {"type": "fold", "user_id": user_id}
        elif action in (ActionType.CHECK, ActionType.CALL):
            if amount_to_call > 0 and player.stack < amount_to_call:
                raise ValueError("Insufficient chips to call")
            if amount_to_call > 0:
                player.stack -= amount_to_call
                player.bet += amount_to_call
            player.acted = True
            hand.last_action = {
                "type": "call" if amount_to_call else "check",
                "user_id": user_id,
                "amount": amount_to_call,
            }
        elif action in (ActionType.BET, ActionType.RAISE, ActionType.ALL_IN):
            target = amount or player.stack
            target = min(target, player.stack + player.bet)
            if target <= hand.current_bet:
                raise ValueError("Bet must exceed current bet")
            contribution = target - player.bet
            if contribution > player.stack:
                raise ValueError("Insufficient chips")
            player.stack -= contribution
            player.bet = target
            player.acted = True
            hand.current_bet = target
            hand.min_raise = max(hand.min_raise, contribution)
            hand.last_action = {
                "type": "bet" if action == ActionType.BET else "raise",
                "user_id": user_id,
                "amount": contribution,
            }
            if player.stack == 0:
                player.all_in = True
        else:
            raise ValueError("Unsupported action")

        next_actor = hand.next_actor_index(actor_index)
        if next_actor is None or self._is_betting_round_complete(hand):
            if hand.stage == HandStage.SHOWDOWN or not hand.active_players():
                result = self._award_pot(hand)
                hand.stage = HandStage.COMPLETE
                hand.current_actor = None
                return {"state": hand, "result": result}
            stage_result = self._advance_stage(hand)
            hand.deadline = datetime.now(timezone.utc) + timedelta(seconds=25)
            if stage_result:
                return {"state": hand, "result": stage_result}
        else:
            hand.current_actor = next_actor
            hand.deadline = datetime.now(timezone.utc) + timedelta(seconds=25)

        return {"state": hand, "result": None}

    def to_payload(self, viewer_user_id: Optional[int] = None) -> Dict:
        hand = self.hand_state
        return {
            "type": "table_state",
            "table_id": self.table.id,
            "hand_id": hand.hand_no if hand else None,
            "status": (hand.stage.value if hand else "waiting"),
            "street": hand.stage.value if hand else None,
            "board": hand.board if hand else [],
            "pot": hand.pot if hand else 0,
            "current_bet": hand.current_bet if hand else 0,
            "min_raise": hand.min_raise if hand else 0,
            "current_actor": hand.players[hand.current_actor].user_id if hand and hand.current_actor is not None else None,
            "action_deadline": hand.deadline.isoformat() if hand and hand.deadline else None,
            "players": [
                {
                    "user_id": p.user_id,
                    "seat": p.seat,
                    "stack": p.stack,
                    "bet": p.bet,
                    "in_hand": not p.folded,
                    "is_button": p.is_button,
                    "is_small_blind": p.is_small_blind,
                    "is_big_blind": p.is_big_blind,
                    "acted": p.acted,
                    "display_name": p.display_name,
                }
                for p in (hand.players if hand else [])
            ],
            "hero": None
            if not hand or viewer_user_id is None
            else {
                "user_id": viewer_user_id,
                "cards": next((p.cards for p in hand.players if p.user_id == viewer_user_id), []),
            },
            "last_action": hand.last_action if hand else None,
        }


class TableRuntimeManager:
    """Registry for table runtimes."""

    def __init__(self):
        self._tables: Dict[int, TableRuntime] = {}
        self._lock = asyncio.Lock()

    async def ensure_table(self, db: AsyncSession, table_id: int) -> TableRuntime:
        async with self._lock:
            runtime = self._tables.get(table_id)
            if runtime:
                return runtime
            result = await db.execute(select(Table).where(Table.id == table_id))
            table = result.scalar_one_or_none()
            if not table:
                raise ValueError("Table not found")
            seats_result = await db.execute(
                select(Seat).where(Seat.table_id == table_id, Seat.left_at.is_(None)).order_by(Seat.position)
            )
            seats = seats_result.scalars().all()
            runtime = TableRuntime(table, seats)
            self._tables[table_id] = runtime
            return runtime

    async def start_game(self, db: AsyncSession, table_id: int) -> Dict:
        runtime = await self.ensure_table(db, table_id)
        config = runtime.table.config_json or {}
        small_blind = config.get("small_blind", 25)
        big_blind = config.get("big_blind", 50)
        hand = runtime.start_hand(small_blind, big_blind)
        return runtime.to_payload()

    async def handle_action(
        self,
        db: AsyncSession,
        table_id: int,
        user_id: int,
        action: ActionType,
        amount: Optional[int],
        viewer_user_id: Optional[int] = None,
    ) -> Dict:
        runtime = await self.ensure_table(db, table_id)
        result = runtime.handle_action(user_id, action, amount)
        payload = runtime.to_payload(viewer_user_id)
        if result.get("result"):
            payload["hand_result"] = result["result"]
        return payload

    async def get_state(self, db: AsyncSession, table_id: int, viewer_user_id: Optional[int]) -> Dict:
        runtime = await self.ensure_table(db, table_id)
        return runtime.to_payload(viewer_user_id)


_runtime_manager = TableRuntimeManager()


def get_runtime_manager() -> TableRuntimeManager:
    return _runtime_manager

