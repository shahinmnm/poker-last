"""Game core service - table orchestration, matchmaking, timers."""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from enum import Enum

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from telegram_poker_bot.shared.models import (
    User,
    Table,
    Seat,
    Hand,
    Action,
    Pot,
    Message,
    GameMode,
    TableStatus,
    HandStatus,
    ActionType,
)
from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.engine_adapter import PokerEngineAdapter
from pokerkit import Mode

settings = get_settings()
logger = get_logger(__name__)


class MatchmakingPool:
    """
    Matchmaking pool manager using Redis.
    
    Design Note:
    - Stores user IDs in Redis sorted set with timestamp
    - Automatically expires entries after TTL
    - Matches players when minimum threshold met
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.pool_key = "matchmaking:pool"
        self.ttl = settings.matchmaking_pool_ttl
    
    async def add_player(self, user_id: int, prefs: Dict = None):
        """Add player to matchmaking pool."""
        score = datetime.now().timestamp()
        prefs_json = json.dumps(prefs or {})
        await self.redis.zadd(self.pool_key, {f"{user_id}:{prefs_json}": score})
        await self.redis.expire(self.pool_key, self.ttl)
        logger.info("Player added to matchmaking", user_id=user_id)
    
    async def remove_player(self, user_id: int):
        """Remove player from matchmaking pool."""
        # Remove all entries for this user
        members = await self.redis.zrange(self.pool_key, 0, -1)
        for member in members:
            if member.decode().startswith(f"{user_id}:"):
                await self.redis.zrem(self.pool_key, member)
        logger.info("Player removed from matchmaking", user_id=user_id)
    
    async def get_waiting_players(self, min_players: int = 2) -> List[int]:
        """Get list of waiting players (if enough for a match)."""
        members = await self.redis.zrange(self.pool_key, 0, min_players - 1)
        if len(members) >= min_players:
            user_ids = [int(m.decode().split(":")[0]) for m in members]
            return user_ids
        return []
    
    async def clear_expired(self):
        """Clear expired entries from pool."""
        cutoff = (datetime.now() - timedelta(seconds=self.ttl)).timestamp()
        await self.redis.zremrangebyscore(self.pool_key, 0, cutoff)


class TableManager:
    """
    Table manager - orchestrates game tables.
    
    Design Note:
    - Manages table lifecycle (creation, starting, ending)
    - Handles seat management
    - Coordinates with PokerKit engine via adapter
    - Updates anchor messages for state changes
    """
    
    def __init__(self, db: AsyncSession, redis_client: redis.Redis):
        self.db = db
        self.redis = redis_client
        self.active_tables: Dict[int, Dict] = {}  # table_id -> table_state
    
    async def create_table(
        self,
        mode: GameMode,
        user_ids: List[int],
        group_id: Optional[int] = None,
    ) -> Table:
        """
        Create a new table.
        
        Design Note:
        - Creates table record in DB
        - Creates seats for all players
        - Initializes PokerKit engine adapter
        - Stores table state in memory for fast access
        """
        # Create table record
        creator_user_id = user_ids[0] if user_ids else None
        table = Table(
            mode=mode,
            group_id=group_id,
            status=TableStatus.WAITING,
            creator_user_id=creator_user_id,
            is_public=False,
            config_json={
                "starting_stack": settings.default_starting_stack,
                "small_blind": settings.small_blind,
                "big_blind": settings.big_blind,
                "creator_user_id": creator_user_id,
                "is_private": True,
                "visibility": "private",
            },
        )
        self.db.add(table)
        await self.db.flush()
        
        # Create seats
        starting_stack = settings.default_starting_stack
        for position, user_id in enumerate(user_ids):
            seat = Seat(
                table_id=table.id,
                user_id=user_id,
                position=position,
                chips=starting_stack,
            )
            self.db.add(seat)
        
        await self.db.commit()
        
        # Initialize engine adapter
        engine = PokerEngineAdapter(
            player_count=len(user_ids),
            starting_stacks=[starting_stack] * len(user_ids),
            small_blind=settings.small_blind,
            big_blind=settings.big_blind,
            mode=Mode.TOURNAMENT,
        )
        
        # Store table state
        self.active_tables[table.id] = {
            "table": table,
            "engine": engine,
            "user_ids": user_ids,
            "current_player": 0,
        }
        
        logger.info("Table created", table_id=table.id, mode=mode.value, players=len(user_ids))
        
        return table
    
    async def start_hand(self, table_id: int) -> Hand:
        """
        Start a new hand.
        
        Design Note:
        - Creates hand record
        - Deals hole cards via engine
        - Posts blinds automatically
        - Updates table status
        """
        table_state = self.active_tables.get(table_id)
        if not table_state:
            raise ValueError(f"Table {table_id} not found")
        
        table = table_state["table"]
        engine = table_state["engine"]
        
        # Get hand number
        result = await self.db.execute(
            select(Hand).where(Hand.table_id == table_id).order_by(Hand.hand_no.desc())
        )
        last_hand = result.scalar_one_or_none()
        hand_no = (last_hand.hand_no + 1) if last_hand else 1
        
        # Create hand record
        hand = Hand(
            table_id=table_id,
            hand_no=hand_no,
            status=HandStatus.PREFLOP,
            engine_state_json=engine.to_state_dict(),
        )
        self.db.add(hand)
        await self.db.flush()
        
        # Deal hole cards (simplified - in real game, shuffle and deal randomly)
        # TODO: Implement proper card shuffling and dealing
        for player_idx in range(engine.player_count):
            # Placeholder - would use actual shuffled deck
            cards = ["Ac", "Kd"]  # Placeholder cards
            engine.deal_hole_cards(player_idx, cards)
        
        # Update hand status
        hand.engine_state_json = engine.to_state_dict()
        hand.status = HandStatus.PREFLOP
        
        # Update table status
        table.status = TableStatus.ACTIVE
        
        await self.db.commit()
        
        logger.info("Hand started", table_id=table_id, hand_no=hand_no)
        
        return hand
    
    async def process_action(
        self,
        table_id: int,
        user_id: int,
        action_type: ActionType,
        amount: Optional[int] = None,
    ) -> Action:
        """
        Process player action.
        
        Design Note:
        - Validates action is legal
        - Applies action to engine
        - Records action in database
        - Checks if hand is complete
        - Updates anchor message
        """
        table_state = self.active_tables.get(table_id)
        if not table_state:
            raise ValueError(f"Table {table_id} not found")
        
        engine = table_state["engine"]
        
        # Find player index
        player_index = table_state["user_ids"].index(user_id)
        
        # Get current hand
        result = await self.db.execute(
            select(Hand).where(Hand.table_id == table_id).order_by(Hand.hand_no.desc())
        )
        hand = result.scalar_one()
        
        # Process action
        if action_type == ActionType.FOLD:
            engine.fold(player_index)
        elif action_type == ActionType.CHECK:
            engine.check_or_call(player_index)
        elif action_type == ActionType.CALL:
            engine.check_or_call(player_index)
        elif action_type == ActionType.BET or action_type == ActionType.RAISE:
            if amount is None:
                raise ValueError("Amount required for bet/raise")
            engine.bet_or_raise(player_index, amount)
        elif action_type == ActionType.ALL_IN:
            stack = engine.get_player_stack(player_index)
            engine.bet_or_raise(player_index, stack)
        else:
            raise ValueError(f"Unknown action type: {action_type}")
        
        # Record action
        action = Action(
            hand_id=hand.id,
            user_id=user_id,
            type=action_type,
            amount=amount or 0,
        )
        self.db.add(action)
        
        # Update hand state
        hand.engine_state_json = engine.to_state_dict()
        
        # Check if hand complete
        if engine.is_hand_complete():
            await self._end_hand(table_id, hand)
        
        await self.db.commit()
        
        logger.info(
            "Action processed",
            table_id=table_id,
            user_id=user_id,
            action_type=action_type.value,
            amount=amount,
        )
        
        return action
    
    async def _end_hand(self, table_id: int, hand: Hand):
        """End hand and distribute pots."""
        table_state = self.active_tables.get(table_id)
        if not table_state:
            return
        
        engine = table_state["engine"]
        
        # Get winners and pots
        pots = engine.get_pots()
        winners = engine.get_winners()
        
        # Record pots
        for pot_data in pots:
            pot = Pot(
                hand_id=hand.id,
                pot_index=pot_data["pot_index"],
                size=pot_data["amount"],
            )
            self.db.add(pot)
        
        # Update hand status
        hand.status = HandStatus.ENDED
        hand.ended_at = datetime.now()
        
        # Update table status
        table_state["table"].status = TableStatus.WAITING
        
        logger.info("Hand ended", table_id=table_id, hand_id=hand.id, pots=len(pots))


# Global matchmaking pool instance
_redis_client: Optional[redis.Redis] = None
_matchmaking_pool: Optional[MatchmakingPool] = None


async def get_redis_client() -> redis.Redis:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = await redis.from_url(settings.redis_url_computed)
    return _redis_client


async def get_matchmaking_pool() -> MatchmakingPool:
    """Get matchmaking pool instance."""
    global _matchmaking_pool
    if _matchmaking_pool is None:
        redis_client = await get_redis_client()
        _matchmaking_pool = MatchmakingPool(redis_client)
    return _matchmaking_pool
