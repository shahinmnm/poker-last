"""Abstract interface for poker engine adapters.

This module defines the contract that all poker engine adapters must implement.
It allows the poker-last application to work with different poker engines
(PokerKit, PokerLib, or custom implementations) through a unified API.

Design Philosophy:
- Frontend as pure presentation layer
- Backend as authoritative source of truth
- Event-driven architecture for real-time updates
- Engine-agnostic game orchestration
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime


class GameEventType(Enum):
    """Normalized game event types for frontend consumption."""
    
    # Game lifecycle
    GAME_STARTED = "game_started"
    GAME_FINISHED = "game_finished"
    
    # Round lifecycle
    ROUND_STARTED = "round_started"
    ROUND_FINISHED = "round_finished"
    
    # Street transitions
    STREET_CHANGED = "street_changed"
    
    # Card dealing
    HOLE_CARDS_DEALT = "hole_cards_dealt"
    BOARD_CARDS_DEALT = "board_cards_dealt"
    
    # Player actions
    PLAYER_FOLDED = "player_folded"
    PLAYER_CHECKED = "player_checked"
    PLAYER_CALLED = "player_called"
    PLAYER_BET = "player_bet"
    PLAYER_RAISED = "player_raised"
    PLAYER_ALL_IN = "player_all_in"
    
    # Blinds
    SMALL_BLIND_POSTED = "small_blind_posted"
    BIG_BLIND_POSTED = "big_blind_posted"
    
    # Pot management
    POT_UPDATED = "pot_updated"
    
    # Showdown
    CARDS_REVEALED = "cards_revealed"
    WINNER_DECLARED = "winner_declared"
    
    # Player state
    PLAYER_TURN = "player_turn"
    PLAYER_STACK_UPDATED = "player_stack_updated"


@dataclass
class GameEvent:
    """Normalized game event for frontend consumption.
    
    All poker engines must translate their internal events to this format.
    This ensures the frontend can work with any engine implementation.
    """
    
    type: GameEventType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = field(default_factory=dict)
    player_id: Optional[int] = None
    is_private: bool = False  # Private events only sent to specific player
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'type': self.type.value,
            'timestamp': self.timestamp.isoformat(),
            'data': self.data,
            'player_id': self.player_id,
            'is_private': self.is_private,
        }


@dataclass
class PlayerAction:
    """Represents a player action request."""
    
    player_index: int
    action_type: str  # 'fold', 'check', 'call', 'bet', 'raise'
    amount: Optional[int] = None  # For bet/raise actions
    
    def __post_init__(self):
        """Validate action."""
        valid_actions = {'fold', 'check', 'call', 'bet', 'raise'}
        if self.action_type not in valid_actions:
            raise ValueError(f"Invalid action type: {self.action_type}")
        
        if self.action_type in {'bet', 'raise'} and self.amount is None:
            raise ValueError(f"{self.action_type} requires amount")


@dataclass
class GameState:
    """Normalized game state representation."""
    
    # Table info
    table_id: str
    player_count: int
    
    # Players
    players: List[Dict[str, Any]]  # List of player states
    
    # Game state
    street: str  # 'preflop', 'flop', 'turn', 'river'
    board_cards: List[str]
    pot: int
    side_pots: List[Dict[str, Any]]
    
    # Current action
    current_player_index: Optional[int]
    legal_actions: List[str]
    min_bet: int
    max_bet: int
    
    # Round info
    dealer_position: int
    small_blind: int
    big_blind: int
    
    # Status
    is_hand_complete: bool
    winners: List[Dict[str, Any]]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'table_id': self.table_id,
            'player_count': self.player_count,
            'players': self.players,
            'street': self.street,
            'board_cards': self.board_cards,
            'pot': self.pot,
            'side_pots': self.side_pots,
            'current_player_index': self.current_player_index,
            'legal_actions': self.legal_actions,
            'min_bet': self.min_bet,
            'max_bet': self.max_bet,
            'dealer_position': self.dealer_position,
            'small_blind': self.small_blind,
            'big_blind': self.big_blind,
            'is_hand_complete': self.is_hand_complete,
            'winners': self.winners,
        }


class IPokerEngine(ABC):
    """Abstract interface for poker engine adapters.
    
    All poker engine implementations (PokerKit, PokerLib, custom) must
    implement this interface. This allows the game orchestration layer
    to work with any engine through a unified API.
    
    Design Principles:
    1. Event-driven: All state changes emit events
    2. Immutable: Actions return new events, don't mutate external state
    3. Validated: Engine validates all actions internally
    4. Serializable: State can be persisted and restored
    5. Type-safe: Clear interfaces with type hints
    """
    
    # =========================================================================
    # Lifecycle Management
    # =========================================================================
    
    @abstractmethod
    def __init__(
        self,
        table_id: str,
        player_count: int,
        starting_stacks: List[int],
        small_blind: int = 25,
        big_blind: int = 50,
        **kwargs
    ):
        """Initialize poker engine.
        
        Args:
            table_id: Unique table identifier
            player_count: Number of players (2-8)
            starting_stacks: Starting chip stacks for each player
            small_blind: Small blind amount
            big_blind: Big blind amount
            **kwargs: Engine-specific configuration
        """
        pass
    
    @classmethod
    @abstractmethod
    def from_state_dict(cls, state_dict: Dict[str, Any]) -> "IPokerEngine":
        """Restore engine from serialized state.
        
        Args:
            state_dict: Serialized state dictionary
            
        Returns:
            Restored engine instance
        """
        pass
    
    @abstractmethod
    def to_state_dict(self) -> Dict[str, Any]:
        """Serialize engine state to dictionary.
        
        Returns:
            Serialized state that can be persisted to database
        """
        pass
    
    # =========================================================================
    # Player Actions
    # =========================================================================
    
    @abstractmethod
    def fold(self, player_index: int) -> List[GameEvent]:
        """Player folds.
        
        Args:
            player_index: Player index (0-based)
            
        Returns:
            List of game events triggered by this action
            
        Raises:
            ValueError: If action is illegal
        """
        pass
    
    @abstractmethod
    def check_or_call(self, player_index: int) -> List[GameEvent]:
        """Player checks or calls.
        
        Args:
            player_index: Player index (0-based)
            
        Returns:
            List of game events triggered by this action
            
        Raises:
            ValueError: If action is illegal
        """
        pass
    
    @abstractmethod
    def bet_or_raise(self, player_index: int, amount: int) -> List[GameEvent]:
        """Player bets or raises.
        
        Args:
            player_index: Player index (0-based)
            amount: Bet/raise amount
            
        Returns:
            List of game events triggered by this action
            
        Raises:
            ValueError: If action is illegal or amount invalid
        """
        pass
    
    # =========================================================================
    # Game State Queries
    # =========================================================================
    
    @abstractmethod
    def get_game_state(self) -> GameState:
        """Get current normalized game state.
        
        Returns:
            Current game state for frontend consumption
        """
        pass
    
    @abstractmethod
    def get_legal_actions(self, player_index: int) -> List[str]:
        """Get legal actions for a player.
        
        Args:
            player_index: Player index (0-based)
            
        Returns:
            List of legal action types: ['fold', 'check', 'call', 'bet', 'raise']
        """
        pass
    
    @abstractmethod
    def get_betting_range(self, player_index: int) -> Tuple[int, int]:
        """Get min/max betting amounts for a player.
        
        Args:
            player_index: Player index (0-based)
            
        Returns:
            Tuple of (min_bet, max_bet)
        """
        pass
    
    # =========================================================================
    # Event Management
    # =========================================================================
    
    @abstractmethod
    def get_pending_events(self) -> List[GameEvent]:
        """Get pending events since last call.
        
        This is the primary mechanism for real-time updates.
        Events are consumed and cleared when retrieved.
        
        Returns:
            List of game events to broadcast to clients
        """
        pass
    
    @abstractmethod
    def clear_events(self) -> None:
        """Clear all pending events.
        
        Useful for cleanup or when events are processed elsewhere.
        """
        pass
    
    # =========================================================================
    # Player State
    # =========================================================================
    
    @abstractmethod
    def get_player_stack(self, player_index: int) -> int:
        """Get player's current stack.
        
        Args:
            player_index: Player index (0-based)
            
        Returns:
            Current chip count
        """
        pass
    
    @abstractmethod
    def get_player_cards(self, player_index: int) -> List[str]:
        """Get player's hole cards.
        
        Args:
            player_index: Player index (0-based)
            
        Returns:
            List of card strings (e.g., ['Ac', 'Kd'])
            Returns empty list if cards are hidden/folded
        """
        pass
    
    # =========================================================================
    # Board State
    # =========================================================================
    
    @abstractmethod
    def get_board_cards(self) -> List[str]:
        """Get board cards.
        
        Returns:
            List of card strings (e.g., ['Ah', 'Kd', 'Qc'])
        """
        pass
    
    @abstractmethod
    def get_street(self) -> str:
        """Get current street.
        
        Returns:
            Street name: 'preflop', 'flop', 'turn', or 'river'
        """
        pass
    
    # =========================================================================
    # Pot Management
    # =========================================================================
    
    @abstractmethod
    def get_pot_total(self) -> int:
        """Get total pot amount.
        
        Returns:
            Total chips in all pots (main + side pots)
        """
        pass
    
    @abstractmethod
    def get_pots(self) -> List[Dict[str, Any]]:
        """Get all pots (main + side pots).
        
        Returns:
            List of pot dictionaries with structure:
            {
                'pot_index': int,
                'amount': int,
                'player_indices': List[int]
            }
        """
        pass
    
    # =========================================================================
    # Hand Completion
    # =========================================================================
    
    @abstractmethod
    def is_hand_complete(self) -> bool:
        """Check if current hand is complete.
        
        Returns:
            True if hand is finished and winners determined
        """
        pass
    
    @abstractmethod
    def get_winners(self) -> List[Dict[str, Any]]:
        """Get hand winners.
        
        Returns:
            List of winner dictionaries with structure:
            {
                'player_index': int,
                'pot_index': int,
                'amount': int,
                'hand_name': str,
                'hand_cards': List[str]
            }
        """
        pass
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    @abstractmethod
    def get_current_player(self) -> Optional[int]:
        """Get current player index (whose turn it is).
        
        Returns:
            Player index or None if no action required
        """
        pass
    
    @abstractmethod
    def validate_action(self, action: PlayerAction) -> bool:
        """Validate if an action is legal.
        
        Args:
            action: Player action to validate
            
        Returns:
            True if action is legal, False otherwise
        """
        pass
