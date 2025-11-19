"""PokerLib adapter implementation.

This adapter wraps the kuco23/pokerlib library to implement the IPokerEngine
interface, allowing it to work seamlessly with the poker-last application.
"""

from typing import Any, Dict, List, Optional, Tuple
from collections import deque

from telegram_poker_bot.engine_adapter.interface import (
    IPokerEngine,
    GameEvent,
    GameEventType,
    GameState,
    PlayerAction,
)
from telegram_poker_bot.engine_adapter.translator import GameEventTranslator
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


class PokerLibAdapter(IPokerEngine):
    """Adapter for PokerLib engine.
    
    This adapter provides a clean integration between pokerlib's event-driven
    architecture and the poker-last application's unified interface.
    
    Design Notes:
    - PokerLib uses a message queue system (public_out_queue, private_out_queue)
    - We translate these to normalized GameEvents
    - The Table and Round classes manage state internally
    - We provide a clean API over pokerlib's Input/Output ID system
    """
    
    def __init__(
        self,
        table_id: str,
        player_count: int,
        starting_stacks: List[int],
        small_blind: int = 25,
        big_blind: int = 50,
        **kwargs
    ):
        """Initialize PokerLib adapter.
        
        Args:
            table_id: Unique table identifier
            player_count: Number of players (2-8)
            starting_stacks: Starting chip stacks for each player
            small_blind: Small blind amount
            big_blind: Big blind amount
            **kwargs: Additional configuration (unused)
        """
        if player_count < 2 or player_count > 8:
            raise ValueError(f"Player count must be between 2 and 8, got {player_count}")
        
        if len(starting_stacks) != player_count:
            raise ValueError(
                f"Starting stacks length ({len(starting_stacks)}) "
                f"must match player_count ({player_count})"
            )
        
        # Store configuration
        self.table_id = table_id
        self.player_count = player_count
        self.starting_stacks = starting_stacks
        self.small_blind = small_blind
        self.big_blind = big_blind
        
        # Import pokerlib (lazy import to avoid dependency if using PokerKit)
        try:
            from pokerlib import Table, Player, PlayerSeats
            from pokerlib.enums import (
                TablePublicInId,
                RoundPublicInId,
            )
        except ImportError:
            raise ImportError(
                "pokerlib is required for PokerLibAdapter. "
                "Install with: pip install pokerlib"
            )
        
        self._Table = Table
        self._Player = Player
        self._PlayerSeats = PlayerSeats
        self._TablePublicInId = TablePublicInId
        self._RoundPublicInId = RoundPublicInId
        
        # Create table with custom output handling
        self.table = self._create_table()
        self.players = self._create_players(starting_stacks)
        self._seat_players()
        
        # Event queue for translated events
        self._event_queue = deque()
        
        # Start first round
        self._start_round()
        
        logger.info(
            "PokerLib engine initialized",
            table_id=table_id,
            player_count=player_count,
            small_blind=small_blind,
            big_blind=big_blind,
        )
    
    def _create_table(self):
        """Create custom table with event capturing."""
        
        class CustomTable(self._Table):
            """Custom table that captures output events."""
            
            def __init__(inner_self, *args, **kwargs):
                inner_self.adapter = self  # Reference to outer adapter
                super().__init__(*args, **kwargs)
            
            def publicOut(inner_self, out_id, **kwargs):
                """Capture public output events."""
                # Create mock output object
                from collections import namedtuple
                PublicOut = namedtuple('PublicOut', ['id', 'data'])
                output = PublicOut(id=out_id, data=kwargs)
                
                # Translate and queue event
                event = GameEventTranslator.from_pokerlib_output(output)
                self._event_queue.append(event)
            
            def privateOut(inner_self, player_id, out_id, **kwargs):
                """Capture private output events."""
                # Create mock output object
                from collections import namedtuple
                PrivateOut = namedtuple('PrivateOut', ['player_id', 'id', 'data'])
                output = PrivateOut(player_id=player_id, id=out_id, data=kwargs)
                
                # Translate and queue event
                event = GameEventTranslator.from_pokerlib_output(output)
                self._event_queue.append(event)
        
        # Create table instance
        seats = self._PlayerSeats([None] * self.player_count)
        return CustomTable(
            _id=self.table_id,
            seats=seats,
            buyin=min(self.starting_stacks),  # Use minimum as buyin
            small_blind=self.small_blind,
            big_blind=self.big_blind,
        )
    
    def _create_players(self, starting_stacks: List[int]) -> List[Any]:
        """Create player objects.
        
        Args:
            starting_stacks: Starting chip stacks
            
        Returns:
            List of Player objects
        """
        players = []
        for i, stack in enumerate(starting_stacks):
            player = self._Player(
                table_id=self.table_id,
                _id=i,
                name=f"Player{i}",
                money=stack,
            )
            players.append(player)
        return players
    
    def _seat_players(self):
        """Seat all players at the table."""
        for i, player in enumerate(self.players):
            self.table += (player, i)
    
    def _start_round(self):
        """Start a new poker round."""
        round_id = 0  # Simple counter, could be more sophisticated
        self.table.publicIn(
            self.players[0].id,
            self._TablePublicInId.STARTROUND,
            round_id=round_id
        )
    
    # =========================================================================
    # IPokerEngine Implementation
    # =========================================================================
    
    @classmethod
    def from_state_dict(cls, state_dict: Dict[str, Any]) -> "PokerLibAdapter":
        """Restore adapter from serialized state.
        
        Note: Full state restoration for PokerLib is complex as it doesn't
        have built-in serialization. This is a simplified implementation.
        """
        adapter = cls(
            table_id=state_dict["table_id"],
            player_count=state_dict["player_count"],
            starting_stacks=state_dict["starting_stacks"],
            small_blind=state_dict["small_blind"],
            big_blind=state_dict["big_blind"],
        )
        
        # TODO: Restore round state by replaying actions
        # This requires storing action history in state_dict
        
        return adapter
    
    def to_state_dict(self) -> Dict[str, Any]:
        """Serialize adapter state to dictionary."""
        return {
            "table_id": self.table_id,
            "player_count": self.player_count,
            "starting_stacks": self.starting_stacks,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "money": p.money,
                    "stake": p.stake,
                    "is_folded": p.is_folded,
                    "is_all_in": p.is_all_in,
                }
                for p in self.players
            ],
            "board": getattr(self.table.round, 'board', []) if self.table.round else [],
            "pot": sum(getattr(self.table.round, 'pot_size', [0, 0, 0, 0])) if self.table.round else 0,
        }
    
    def fold(self, player_index: int) -> List[GameEvent]:
        """Player folds."""
        player = self.players[player_index]
        
        if not self.table.round:
            raise ValueError("No active round")
        
        self.table.round.publicIn(
            player.id,
            self._RoundPublicInId.FOLD
        )
        
        return self.get_pending_events()
    
    def check_or_call(self, player_index: int) -> List[GameEvent]:
        """Player checks or calls."""
        player = self.players[player_index]
        
        if not self.table.round:
            raise ValueError("No active round")
        
        # Determine if check or call
        to_call = self.table.round.to_call if hasattr(self.table.round, 'to_call') else 0
        
        if to_call == 0:
            action = self._RoundPublicInId.CHECK
        else:
            action = self._RoundPublicInId.CALL
        
        self.table.round.publicIn(player.id, action)
        
        return self.get_pending_events()
    
    def bet_or_raise(self, player_index: int, amount: int) -> List[GameEvent]:
        """Player bets or raises."""
        player = self.players[player_index]
        
        if not self.table.round:
            raise ValueError("No active round")
        
        # PokerLib uses raise_by parameter
        to_call = self.table.round.to_call if hasattr(self.table.round, 'to_call') else 0
        raise_by = amount - to_call
        
        if raise_by < 0:
            raise ValueError(f"Invalid raise amount: {amount} (to_call: {to_call})")
        
        self.table.round.publicIn(
            player.id,
            self._RoundPublicInId.RAISE,
            raise_by=raise_by
        )
        
        return self.get_pending_events()
    
    def get_game_state(self) -> GameState:
        """Get current normalized game state."""
        if not self.table.round:
            # No active round
            return GameState(
                table_id=self.table_id,
                player_count=self.player_count,
                players=[
                    {
                        'player_index': p.id,
                        'name': p.name,
                        'stack': p.money,
                        'is_folded': False,
                        'is_all_in': False,
                    }
                    for p in self.players
                ],
                street='preflop',
                board_cards=[],
                pot=0,
                side_pots=[],
                current_player_index=None,
                legal_actions=[],
                min_bet=self.big_blind,
                max_bet=0,
                dealer_position=self.table.button,
                small_blind=self.small_blind,
                big_blind=self.big_blind,
                is_hand_complete=True,
                winners=[],
            )
        
        round_obj = self.table.round
        
        # Get current street
        turn_map = {0: 'preflop', 1: 'flop', 2: 'turn', 3: 'river'}
        street = turn_map.get(int(round_obj.turn), 'preflop')
        
        # Get board cards
        board_cards = [
            GameEventTranslator.card_tuple_to_str(card)
            for card in round_obj.board
        ]
        
        # Get current player
        current_player_index = None
        if hasattr(round_obj, 'current_player'):
            current_player_index = round_obj.current_player.id
        
        # Get legal actions
        legal_actions = []
        if current_player_index is not None:
            legal_actions = self.get_legal_actions(current_player_index)
        
        return GameState(
            table_id=self.table_id,
            player_count=self.player_count,
            players=[
                {
                    'player_index': p.id,
                    'name': p.name,
                    'stack': p.money,
                    'is_folded': p.is_folded,
                    'is_all_in': p.is_all_in,
                    'stake': p.stake,
                }
                for p in self.players
            ],
            street=street,
            board_cards=board_cards,
            pot=sum(round_obj.pot_size),
            side_pots=[],  # PokerLib doesn't expose side pots directly
            current_player_index=current_player_index,
            legal_actions=legal_actions,
            min_bet=self.big_blind,
            max_bet=self.players[current_player_index].money if current_player_index is not None else 0,
            dealer_position=self.table.button,
            small_blind=self.small_blind,
            big_blind=self.big_blind,
            is_hand_complete=round_obj.finished if hasattr(round_obj, 'finished') else False,
            winners=self.get_winners() if round_obj.finished else [],
        )
    
    def get_legal_actions(self, player_index: int) -> List[str]:
        """Get legal actions for a player."""
        if not self.table.round:
            return []
        
        actions = ['fold']
        
        round_obj = self.table.round
        player = self.players[player_index]
        
        # Check if it's player's turn
        if hasattr(round_obj, 'current_player') and round_obj.current_player.id != player.id:
            return []
        
        # Determine available actions
        to_call = round_obj.to_call if hasattr(round_obj, 'to_call') else 0
        
        if to_call == 0:
            actions.append('check')
        else:
            if player.money >= to_call:
                actions.append('call')
        
        if player.money > to_call:
            actions.append('bet')
            actions.append('raise')
        
        return actions
    
    def get_betting_range(self, player_index: int) -> Tuple[int, int]:
        """Get min/max betting amounts for a player."""
        player = self.players[player_index]
        return (self.big_blind, player.money)
    
    def get_pending_events(self) -> List[GameEvent]:
        """Get pending events since last call."""
        events = list(self._event_queue)
        self._event_queue.clear()
        return events
    
    def clear_events(self) -> None:
        """Clear all pending events."""
        self._event_queue.clear()
    
    def get_player_stack(self, player_index: int) -> int:
        """Get player's current stack."""
        return self.players[player_index].money
    
    def get_player_cards(self, player_index: int) -> List[str]:
        """Get player's hole cards."""
        player = self.players[player_index]
        
        if not hasattr(player, 'cards') or not player.cards:
            return []
        
        return [
            GameEventTranslator.card_tuple_to_str(card)
            for card in player.cards
        ]
    
    def get_board_cards(self) -> List[str]:
        """Get board cards."""
        if not self.table.round or not hasattr(self.table.round, 'board'):
            return []
        
        return [
            GameEventTranslator.card_tuple_to_str(card)
            for card in self.table.round.board
        ]
    
    def get_street(self) -> str:
        """Get current street."""
        if not self.table.round:
            return 'preflop'
        
        turn_map = {0: 'preflop', 1: 'flop', 2: 'turn', 3: 'river'}
        return turn_map.get(int(self.table.round.turn), 'preflop')
    
    def get_pot_total(self) -> int:
        """Get total pot amount."""
        if not self.table.round:
            return 0
        
        return sum(self.table.round.pot_size)
    
    def get_pots(self) -> List[Dict[str, Any]]:
        """Get all pots (main + side pots)."""
        if not self.table.round:
            return []
        
        # PokerLib doesn't separate pots explicitly
        # Return main pot only
        return [
            {
                'pot_index': 0,
                'amount': sum(self.table.round.pot_size),
                'player_indices': [
                    p.id for p in self.players if not p.is_folded
                ],
            }
        ]
    
    def is_hand_complete(self) -> bool:
        """Check if current hand is complete."""
        if not self.table.round:
            return True
        
        return getattr(self.table.round, 'finished', False)
    
    def get_winners(self) -> List[Dict[str, Any]]:
        """Get hand winners."""
        if not self.table.round or not self.table.round.finished:
            return []
        
        # Winners are determined during round completion
        # We need to track them from events
        # For now, return empty list
        # TODO: Implement winner tracking
        return []
    
    def get_current_player(self) -> Optional[int]:
        """Get current player index."""
        if not self.table.round:
            return None
        
        if hasattr(self.table.round, 'current_player'):
            return self.table.round.current_player.id
        
        return None
    
    def validate_action(self, action: PlayerAction) -> bool:
        """Validate if an action is legal."""
        legal_actions = self.get_legal_actions(action.player_index)
        return action.action_type in legal_actions
