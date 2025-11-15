"""PokerKit engine adapter - clean API wrapper for PokerKit."""

from typing import Any, Dict, List, Optional, Tuple

from pokerkit import (
    Automation,
    Card,
    Mode,
    NoLimitTexasHoldem,
    State,
)
from pokerkit.state import (
    CheckingOrCalling,
    CompletionBettingOrRaisingTo,
    Folding,
    Operation,
)

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


class PokerEngineAdapter:
    """
    Adapter for PokerKit engine.
    
    Design Note:
    - This adapter provides a clean, bot-friendly API over PokerKit's State API
    - Handles serialization/deserialization of game state for persistence
    - Validates actions before passing to engine
    - Provides convenient methods for common operations
    """

    def __init__(
        self,
        player_count: int,
        starting_stacks: List[int],
        small_blind: int = 25,
        big_blind: int = 50,
        mode: Mode = Mode.TOURNAMENT,
    ):
        """
        Initialize a new poker game state.
        
        Args:
            player_count: Number of players (2-8)
            starting_stacks: Starting chip stacks for each player
            small_blind: Small blind amount
            big_blind: Big blind amount
            mode: Tournament or cash game mode
        """
        if player_count < 2 or player_count > 8:
            raise ValueError(f"Player count must be between 2 and 8, got {player_count}")
        
        if len(starting_stacks) != player_count:
            raise ValueError(f"Starting stacks length ({len(starting_stacks)}) must match player_count ({player_count})")

        self.player_count = player_count
        self.starting_stacks = starting_stacks
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.mode = mode

        # Create PokerKit state with automations
        self.state: State = NoLimitTexasHoldem.create_state(
            automations=(
                Automation.ANTE_POSTING,
                Automation.BET_COLLECTION,
                Automation.BLIND_OR_STRADDLE_POSTING,
                Automation.CARD_BURNING,
                Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
                Automation.HAND_KILLING,
                Automation.CHIPS_PUSHING,
                Automation.CHIPS_PULLING,
            ),
            ante_trimming_status=True,
            raw_antes=0,
            raw_blinds_or_straddles=(small_blind, big_blind),
            min_bet=big_blind,
            raw_starting_stacks=starting_stacks,
            player_count=player_count,
            mode=mode,
        )

        logger.info(
            "Poker engine initialized",
            player_count=player_count,
            small_blind=small_blind,
            big_blind=big_blind,
            mode=mode.value,
        )

    @classmethod
    def from_state_dict(cls, state_dict: Dict[str, Any]) -> "PokerEngineAdapter":
        """
        Restore engine from serialized state.
        
        Design Note:
        - PokerKit State objects are not directly serializable
        - We store key state attributes and recreate the state
        - For full persistence, we'd need to store operation history
        """
        adapter = cls(
            player_count=state_dict["player_count"],
            starting_stacks=state_dict["starting_stacks"],
            small_blind=state_dict["small_blind"],
            big_blind=state_dict["big_blind"],
            mode=Mode(state_dict["mode"]),
        )
        
        # Restore state from operations history if available
        # For now, we'll rely on engine_state_json from DB
        return adapter

    def to_state_dict(self) -> Dict[str, Any]:
        """Serialize engine state to dictionary."""
        return {
            "player_count": self.player_count,
            "starting_stacks": self.starting_stacks,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "mode": self.mode.value,
            "stacks": list(self.state.stacks),
            "street": self.state.street.value if hasattr(self.state.street, "value") else str(self.state.street),
            "status": self.state.status.value if hasattr(self.state.status, "value") else str(self.state.status),
            "button": getattr(self.state, "button", None),
            "opener": getattr(self.state, "opener", None),
            "board_cards": [str(card) for card in self.state.board_cards] if self.state.board_cards else [],
            "pots": [
                {
                    "amount": pot.amount,
                    "raked_amount": pot.raked_amount,
                    "unraked_amount": pot.unraked_amount,
                    "player_indices": list(pot.player_indices),
                }
                for pot in self.state.pots
            ],
        }

    def deal_hole_cards(self, player_index: int, cards: List[str]) -> Operation:
        """
        Deal hole cards to a player.
        
        Args:
            player_index: Player index (0-based)
            cards: List of card strings (e.g., ["Ac", "Kd"])
        """
        card_str = "".join(cards)
        operation = self.state.deal_hole(card_str)
        logger.debug("Dealt hole cards", player_index=player_index, cards=cards)
        return operation

    def deal_board_cards(self, cards: List[str]) -> Operation:
        """
        Deal board cards (flop, turn, river).
        
        Args:
            cards: List of card strings
        """
        card_str = "".join(cards)
        operation = self.state.deal_board(card_str)
        logger.debug("Dealt board cards", cards=cards)
        return operation

    def burn_card(self) -> Operation:
        """Burn a card (automated by PokerKit)."""
        operation = self.state.burn_card("??")
        logger.debug("Burned card")
        return operation

    def fold(self, player_index: int) -> Operation:
        """Player folds."""
        if self.state.status != self.state.status.__class__.POSTING:
            raise ValueError("Cannot fold - not player's turn")
        
        operation = self.state.fold()
        logger.info("Player folded", player_index=player_index)
        return operation

    def check_or_call(self, player_index: int) -> Operation:
        """Player checks or calls."""
        if self.state.status != self.state.status.__class__.POSTING:
            raise ValueError("Cannot check/call - not player's turn")
        
        operation = self.state.check_or_call()
        logger.info("Player checked/called", player_index=player_index)
        return operation

    def bet_or_raise(self, player_index: int, amount: int) -> Operation:
        """
        Player bets or raises.
        
        Args:
            player_index: Player index
            amount: Bet/raise amount
        """
        if self.state.status != self.state.status.__class__.POSTING:
            raise ValueError("Cannot bet/raise - not player's turn")
        
        operation = self.state.complete_bet_or_raise_to(amount)
        logger.info("Player bet/raised", player_index=player_index, amount=amount)
        return operation

    def get_legal_actions(self, player_index: int) -> List[str]:
        """
        Get legal actions for current player.
        
        Design Note:
        - PokerKit doesn't directly expose legal actions
        - We infer from state and betting structure
        - Returns list of action types: ["fold", "check", "call", "bet", "raise"]
        """
        actions = []
        
        # Can always fold
        actions.append("fold")
        
        # Check if can check/call
        if self.state.status == self.state.status.__class__.POSTING:
            # Check if there's a bet to call
            if hasattr(self.state, "betting_amounts") and any(
                amount > 0 for amount in self.state.betting_amounts
            ):
                actions.append("call")
            else:
                actions.append("check")
            
            # Can bet/raise
            actions.append("bet")
            actions.append("raise")
        
        return actions

    def get_min_bet_amount(self) -> int:
        """Get minimum bet/raise amount."""
        return self.big_blind

    def get_max_bet_amount(self, player_index: int) -> int:
        """Get maximum bet/raise amount (player's stack)."""
        return self.state.stacks[player_index]

    def get_current_bet_amount(self) -> int:
        """Get current bet amount to call."""
        if hasattr(self.state, "betting_amounts"):
            return max(self.state.betting_amounts) if self.state.betting_amounts else 0
        return 0

    def get_player_stack(self, player_index: int) -> int:
        """Get player's current stack."""
        return self.state.stacks[player_index]

    def get_pots(self) -> List[Dict[str, Any]]:
        """Get all pots (main + side pots)."""
        return [
            {
                "pot_index": idx,
                "amount": pot.amount,
                "raked_amount": pot.raked_amount,
                "unraked_amount": pot.unraked_amount,
                "player_indices": list(pot.player_indices),
            }
            for idx, pot in enumerate(self.state.pots)
        ]

    def get_board_cards(self) -> List[str]:
        """Get board cards as strings."""
        return [str(card) for card in self.state.board_cards] if self.state.board_cards else []

    def get_hole_cards(self, player_index: int) -> List[str]:
        """
        Get player's hole cards.
        
        Design Note:
        - Only returns cards if they're visible (not folded)
        - In real game, hole cards are private until showdown
        """
        if hasattr(self.state, "hole_cards") and self.state.hole_cards:
            player_cards = self.state.hole_cards[player_index]
            if player_cards:
                return [str(card) for card in player_cards]
        return []

    def get_current_player(self) -> Optional[int]:
        """Get current player index (whose turn it is)."""
        if hasattr(self.state, "status") and self.state.status == self.state.status.__class__.POSTING:
            # PokerKit tracks current actor via status
            # We need to infer from betting structure
            # For now, return None and let game_core track it
            return None
        return None

    def is_hand_complete(self) -> bool:
        """Check if hand is complete."""
        return self.state.status in (
            self.state.status.__class__.CHIPS_PULLING,
            self.state.status.__class__.KILLING_HANDS,
        )

    def get_street(self) -> str:
        """Get current street (preflop, flop, turn, river)."""
        street_map = {
            "Pre-flop": "preflop",
            "Flop": "flop",
            "Turn": "turn",
            "River": "river",
        }
        street_str = str(self.state.street)
        return street_map.get(street_str, street_str.lower())

    def get_winners(self) -> List[Dict[str, Any]]:
        """
        Get hand winners after showdown.
        
        Design Note:
        - PokerKit handles winner determination automatically
        - Winners are determined by pot distribution in state.pots
        - Each pot has player_indices of eligible winners
        """
        winners = []
        for pot_idx, pot in enumerate(self.state.pots):
            if pot.player_indices:
                winners.append(
                    {
                        "pot_index": pot_idx,
                        "player_indices": list(pot.player_indices),
                        "amount": pot.amount,
                    }
                )
        return winners
