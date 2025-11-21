"""PokerKit engine adapter - clean API wrapper for PokerKit."""

import random
from typing import Any, Dict, List, Optional

from pokerkit import (
    Automation,
    Mode,
    NoLimitTexasHoldem,
    State,
)
from pokerkit.state import (
    Operation,
)

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)

# Standard 52-card deck
RANKS = "23456789TJQKA"
SUITS = "shdc"  # spades, hearts, diamonds, clubs


class PokerEngineAdapter:
    """
    Adapter for PokerKit engine.

    Design Note:
    - This adapter provides a clean, bot-friendly API over PokerKit's State API
    - Handles serialization/deserialization of game state for persistence
    - Validates actions before passing to engine
    - Provides convenient methods for common operations
    - ALL poker rules and game progression live in PokerKit
    """

    def __init__(
        self,
        player_count: int,
        starting_stacks: List[int],
        small_blind: int = 25,
        big_blind: int = 50,
        mode: Mode = Mode.TOURNAMENT,
        button_index: Optional[int] = None,
    ):
        """
        Initialize a new poker game state.

        Args:
            player_count: Number of players (2-8)
            starting_stacks: Starting chip stacks for each player
            small_blind: Small blind amount
            big_blind: Big blind amount
            mode: Tournament or cash game mode
            button_index: Optional initial button position (for hand rotation)
        """
        if player_count < 2 or player_count > 8:
            raise ValueError(
                f"Player count must be between 2 and 8, got {player_count}"
            )

        if len(starting_stacks) != player_count:
            raise ValueError(
                f"Starting stacks length ({len(starting_stacks)}) must match player_count ({player_count})"
            )

        self.player_count = player_count
        self.starting_stacks = starting_stacks
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.mode = mode
        self._deck: List[str] = []
        self._pre_showdown_stacks: Optional[List[int]] = None

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

        # Set button index if provided (for hand rotation)
        # Note: PokerKit sets button_index internally, but we can override it
        # after the state is created by modifying the internal attribute
        if button_index is not None and 0 <= button_index < player_count:
            # We'll set this after dealing cards to ensure proper initialization
            self._initial_button_index = button_index
        else:
            self._initial_button_index = None

        logger.info(
            "Poker engine initialized",
            player_count=player_count,
            small_blind=small_blind,
            big_blind=big_blind,
            mode=mode.value,
            button_index=button_index,
        )

    def _create_shuffled_deck(self) -> List[str]:
        """Create and shuffle a standard 52-card deck."""
        deck = [f"{rank}{suit}" for rank in RANKS for suit in SUITS]
        random.shuffle(deck)
        return deck

    def deal_new_hand(self) -> None:
        """
        Deal a new hand - shuffle deck and deal hole cards to all players.

        This method:
        1. Creates a fresh shuffled deck
        2. Deals 2 hole cards to each player via PokerKit
        3. Stores remaining deck for future board dealing
        4. Applies initial button index if provided (for hand rotation)
        5. Captures pre-showdown stacks for winner calculation
        """
        self._deck = self._create_shuffled_deck()

        # Capture stacks before the hand starts
        self._pre_showdown_stacks = list(self.state.stacks)

        # Deal 2 hole cards to each player
        for player_idx in range(self.player_count):
            if self.state.stacks[player_idx] > 0:  # Only deal to players with chips
                card1 = self._deck.pop()
                card2 = self._deck.pop()
                cards = card1 + card2
                self.state.deal_hole(cards)
                logger.debug(f"Dealt hole cards to player {player_idx}")

        # Apply button index rotation if this is not the first hand
        if self._initial_button_index is not None:
            # After hole cards are dealt, PokerKit has initialized button_index
            # We can now override it for proper rotation
            if hasattr(self.state, "_button_index"):
                self.state._button_index = self._initial_button_index
                logger.debug(
                    f"Set button index to {self._initial_button_index} for hand rotation"
                )

        logger.info("New hand dealt", players=self.player_count)

    def deal_flop(self) -> None:
        """Deal the flop (3 community cards)."""
        if len(self._deck) < 3:
            raise ValueError("Not enough cards in deck to deal flop")
        cards = self._deck.pop() + self._deck.pop() + self._deck.pop()
        self.state.deal_board(cards)
        logger.debug(f"Dealt flop: {cards}")

    def deal_turn(self) -> None:
        """Deal the turn (1 community card)."""
        if len(self._deck) < 1:
            raise ValueError("Not enough cards in deck to deal turn")
        card = self._deck.pop()
        self.state.deal_board(card)
        logger.debug(f"Dealt turn: {card}")

    def deal_river(self) -> None:
        """Deal the river (1 community card)."""
        if len(self._deck) < 1:
            raise ValueError("Not enough cards in deck to deal river")
        card = self._deck.pop()
        self.state.deal_board(card)
        logger.debug(f"Dealt river: {card}")

    def to_full_state(
        self, viewer_player_index: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Serialize complete game state to dictionary with proper card visibility.

        This is the SINGLE SOURCE OF TRUTH for table state that the frontend consumes.

        Args:
            viewer_player_index: Index of the viewing player (for card visibility)

        Returns:
            Complete state dict with:
            - Game status and current street
            - Player states (stacks, bets, positions)
            - Board cards
            - Pots
            - Allowed actions for current player
            - Card visibility based on game state and viewer
        """
        # Get current actor
        actor_index = self.state.actor_index

        # Determine if we're in showdown or hand is complete
        is_showdown = (
            self.state.street_index is not None
            and (
                str(self.state.street).lower() == "river"
                and not self.state.actor_indices
            )
            or not self.state.status
        )

        # Build player states
        players = []
        for i in range(self.player_count):
            # Determine button, SB, BB positions
            is_button = (
                i == self.state.button_index
                if hasattr(self.state, "button_index")
                else False
            )
            is_small_blind = False
            is_big_blind = False

            # For No Limit Texas Hold'em with 2+ players
            if self.player_count >= 2:
                sb_index = (
                    (self.state.button_index + 1) % self.player_count
                    if hasattr(self.state, "button_index")
                    else None
                )
                bb_index = (
                    (self.state.button_index + 2) % self.player_count
                    if hasattr(self.state, "button_index")
                    else None
                )
                is_small_blind = i == sb_index if sb_index is not None else False
                is_big_blind = i == bb_index if bb_index is not None else False

            # Get hole cards - only visible to viewer or at showdown
            hole_cards = []
            if (
                hasattr(self.state, "hole_cards")
                and self.state.hole_cards
                and i < len(self.state.hole_cards)
            ):
                player_cards = self.state.hole_cards[i]
                if player_cards:
                    if i == viewer_player_index or is_showdown:
                        # Show actual cards - use repr() for short format like "Ah" instead of "ACE OF HEARTS (Ah)"
                        hole_cards = [repr(card) for card in player_cards]
                    elif viewer_player_index is not None and i != viewer_player_index:
                        # Hide other players' cards before showdown
                        hole_cards = []

            # Check if player is folded (no longer in active players)
            is_folded = (
                i not in self.state.player_indices
                if hasattr(self.state, "player_indices")
                else False
            )

            # Check if all-in
            is_all_in = self.state.stacks[i] == 0 and self.state.bets[i] > 0

            player_state = {
                "player_index": i,
                "stack": self.state.stacks[i],
                "bet": self.state.bets[i],
                "hole_cards": hole_cards,
                "is_folded": is_folded,
                "is_all_in": is_all_in,
                "is_button": is_button,
                "is_small_blind": is_small_blind,
                "is_big_blind": is_big_blind,
                "is_actor": i == actor_index,
            }
            players.append(player_state)

        # Get board cards - use repr() for short format like "Ah" instead of "ACE OF HEARTS (Ah)"
        # Note: board_cards is a list of lists, where each inner list contains a single Card
        board_cards = []
        if self.state.board_cards:
            for card_list in self.state.board_cards:
                if card_list and len(card_list) > 0:
                    board_cards.append(repr(card_list[0]))

        # Get pots
        pots = [
            {
                "pot_index": idx,
                "amount": pot.amount,
                "player_indices": list(pot.player_indices),
            }
            for idx, pot in enumerate(self.state.pots)
        ]

        # Calculate total pot
        total_pot = sum(pot["amount"] for pot in pots) + sum(self.state.bets)

        # Get street name using street_index (0=preflop, 1=flop, 2=turn, 3=river)
        street_names = ["preflop", "flop", "turn", "river"]
        street_index = (
            self.state.street_index if self.state.street_index is not None else -1
        )
        street_name = (
            street_names[street_index]
            if 0 <= street_index < len(street_names)
            else "unknown"
        )

        # Get allowed actions for current actor
        allowed_actions = {}
        if actor_index is not None and viewer_player_index == actor_index:
            allowed_actions = self._get_allowed_actions_for_player(actor_index)

        state_dict = {
            # Game state
            "status": "active" if self.state.status else "complete",
            "street": street_name,
            # Current action
            "current_actor_index": actor_index,
            "allowed_actions": allowed_actions,
            # Players
            "players": players,
            # Community cards
            "board_cards": board_cards,
            # Pots
            "pots": pots,
            "total_pot": total_pot,
            # Configuration (for reference)
            "player_count": self.player_count,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
        }

        return state_dict

    def _get_allowed_actions_for_player(self, player_index: int) -> Dict[str, Any]:
        """
        Get allowed actions for a specific player based on PokerKit state.

        Returns dict with:
        - can_fold: bool
        - can_check: bool
        - can_call: bool
        - call_amount: int
        - can_bet: bool
        - can_raise: bool
        - min_raise_to: int
        - max_raise_to: int
        - current_pot: int (total pot for betting presets)
        - player_stack: int (current stack for all-in calculations)
        """
        if player_index != self.state.actor_index:
            return {}

        actions = {}

        actions["can_fold"] = self.state.can_fold()

        can_check_call = self.state.can_check_or_call()
        current_bet = max(self.state.bets) if self.state.bets else 0
        player_bet = self.state.bets[player_index]
        call_amount = current_bet - player_bet

        actions["can_check"] = can_check_call and call_amount == 0
        actions["can_call"] = can_check_call and call_amount > 0
        actions["call_amount"] = call_amount if actions["can_call"] else 0

        can_bet_raise = self.state.can_complete_bet_or_raise_to()
        actions["can_bet"] = can_bet_raise and current_bet == 0
        actions["can_raise"] = can_bet_raise and current_bet > 0

        if can_bet_raise:
            min_amount = self.state.min_completion_betting_or_raising_to_amount
            max_amount = self.state.max_completion_betting_or_raising_to_amount
            actions["min_raise_to"] = (
                min_amount if min_amount is not None else self.big_blind
            )
            actions["max_raise_to"] = (
                max_amount
                if max_amount is not None
                else self.state.stacks[player_index] + player_bet
            )
        else:
            actions["min_raise_to"] = 0
            actions["max_raise_to"] = 0

        pot_total = sum(pot.amount for pot in self.state.pots) + sum(self.state.bets)
        actions["current_pot"] = pot_total
        actions["player_stack"] = self.state.stacks[player_index]

        return actions

    def fold(self) -> Operation:
        """
        Player folds.

        Note: PokerKit automatically knows which player should act (actor_index).
        """
        if not self.state.can_fold():
            raise ValueError("Cannot fold at this time")

        operation = self.state.fold()
        logger.info("Player folded", player_index=self.state.actor_index)
        return operation

    def check_or_call(self) -> Operation:
        """
        Player checks or calls.

        Note: PokerKit automatically determines if this is a check or call.
        """
        if not self.state.can_check_or_call():
            raise ValueError("Cannot check/call at this time")

        operation = self.state.check_or_call()
        actor_idx = (
            operation.player_index if hasattr(operation, "player_index") else None
        )
        amount = operation.amount if hasattr(operation, "amount") else 0
        action_name = "checked" if amount == 0 else f"called {amount}"
        logger.info(f"Player {action_name}", player_index=actor_idx, amount=amount)
        return operation

    def bet_or_raise(self, amount: int) -> Operation:
        """
        Player bets or raises to a specific amount.

        Args:
            amount: Total amount to bet/raise to (not the additional amount)

        Note: PokerKit validates the amount is within allowed range.
        """
        if not self.state.can_complete_bet_or_raise_to(amount):
            min_amt = self.state.min_completion_betting_or_raising_to_amount
            max_amt = self.state.max_completion_betting_or_raising_to_amount
            raise ValueError(
                f"Cannot bet/raise to {amount}. "
                f"Allowed range: {min_amt} to {max_amt}"
            )

        operation = self.state.complete_bet_or_raise_to(amount)
        actor_idx = (
            operation.player_index if hasattr(operation, "player_index") else None
        )
        logger.info("Player bet/raised", player_index=actor_idx, amount=amount)
        return operation

    def is_hand_complete(self) -> bool:
        """
        Check if hand is complete (game over).

        Returns True when:
        - All players except one have folded, OR
        - Showdown is complete and chips have been distributed
        """
        return not self.state.status

    def get_winners(self) -> List[Dict[str, Any]]:
        """
        Get hand winners after hand completion with enriched showdown information.

        Returns list of winners with their winnings calculated from stack changes:
        - pot_index: Always 0 (main pot) for simplicity
        - player_index: Index of winning player
        - amount: Amount won (stack increase from start of hand)
        - hand_score: Numeric hand strength (higher = stronger)
        - hand_rank: Symbolic hand rank name (e.g., "flush", "two_pair")
        - best_hand_cards: List of 5 cards forming the best hand

        This should only be called after is_hand_complete() returns True.
        """
        if self.state.status:
            logger.warning("get_winners called while hand still active")
            return []

        if self._pre_showdown_stacks is None:
            logger.warning(
                "get_winners called but pre-showdown stacks not captured - "
                "deal_new_hand may not have been called properly"
            )
            return []

        winners = []
        total_won = 0
        total_lost = 0

        for player_idx in range(self.player_count):
            stack_before = self._pre_showdown_stacks[player_idx]
            stack_after = self.state.stacks[player_idx]
            stack_change = stack_after - stack_before

            if stack_change > 0:
                total_won += stack_change
            elif stack_change < 0:
                total_lost += abs(stack_change)

            if stack_change > 0:
                hand_data = self._get_player_hand_data(player_idx)

                winners.append(
                    {
                        "pot_index": 0,
                        "player_index": player_idx,
                        "amount": stack_change,
                        "hand_score": hand_data["hand_score"],
                        "hand_rank": hand_data["hand_rank"],
                        "best_hand_cards": hand_data["best_hand_cards"],
                    }
                )

        winners.sort(key=lambda w: w["amount"], reverse=True)

        if abs(total_won - total_lost) > 1:
            pots_breakdown = [
                {
                    "pot_index": idx,
                    "amount": pot.amount,
                    "eligible_players": list(pot.player_indices),
                }
                for idx, pot in enumerate(self.state.pots)
            ]

            logger.warning(
                "Pot integrity check failed - total winnings do not match total losses",
                total_won=total_won,
                total_lost=total_lost,
                difference=total_won - total_lost,
                stacks_before=self._pre_showdown_stacks,
                stacks_after=list(self.state.stacks),
                winners_list=[
                    {
                        "player_index": w["player_index"],
                        "amount": w["amount"],
                        "hand_rank": w["hand_rank"],
                    }
                    for w in winners
                ],
                pots=pots_breakdown,
                player_count=self.player_count,
            )

        return winners

    def _get_player_hand_data(self, player_index: int) -> Dict[str, Any]:
        """
        Get hand evaluation data for a specific player.

        Returns:
            Dict with hand_score, hand_rank, and best_hand_cards
        """
        try:
            # Get the player's best hand (board_index=0, hand_type_index=0 for high hand)
            hand = self.state.get_hand(player_index, 0, 0)

            if hand is None:
                # Player mucked or folded - return default values
                return {
                    "hand_score": 0,
                    "hand_rank": "folded",
                    "best_hand_cards": [],
                }

            # Get hand entry for ranking and label
            entry = hand.lookup.get_entry(hand.cards)

            # Map Label enum to symbolic names
            label_to_rank = {
                "High card": "high_card",
                "One pair": "pair",
                "Two pair": "two_pair",
                "Three of a kind": "three_of_a_kind",
                "Straight": "straight",
                "Flush": "flush",
                "Full house": "full_house",
                "Four of a kind": "four_of_a_kind",
                "Straight flush": "straight_flush",
            }

            hand_rank = label_to_rank.get(entry.label.value, "unknown")

            # entry.index is the hand strength (lower index = stronger hand in PokerKit)
            # Invert it so higher score = stronger hand
            # PokerKit uses index where 0 = best hand, so we invert it
            # For a 5-card hand, max index is around 7462 for high card
            # We'll use a large number minus index to get ascending scores
            hand_score = 10000 - entry.index

            # Get the 5 cards that form the best hand
            best_hand_cards = [repr(card) for card in hand.cards]

            return {
                "hand_score": hand_score,
                "hand_rank": hand_rank,
                "best_hand_cards": best_hand_cards,
            }

        except Exception as e:
            logger.error(
                "Failed to evaluate hand for player",
                player_index=player_index,
                error=str(e),
            )
            # Return default values on error
            return {
                "hand_score": 0,
                "hand_rank": "unknown",
                "best_hand_cards": [],
            }

    def to_persistence_state(self) -> Dict[str, Any]:
        """
        Return a JSON-serializable dict that fully captures the PokerKit State
        and can be used to reconstruct the engine later.

        This format is stable and does not include viewer-specific hiding of cards.
        It stores the complete game state including all hole cards and the deck.

        Returns:
            Dictionary with complete engine state for DB persistence
        """
        # Serialize hole cards (all players' cards, not hidden)
        serialized_hole_cards = []
        if hasattr(self.state, "hole_cards") and self.state.hole_cards:
            for player_cards in self.state.hole_cards:
                if player_cards:
                    # Convert Card objects to string representation
                    serialized_hole_cards.append([repr(card) for card in player_cards])
                else:
                    serialized_hole_cards.append([])

        # Serialize board cards
        serialized_board_cards = []
        if self.state.board_cards:
            for card_list in self.state.board_cards:
                if card_list and len(card_list) > 0:
                    serialized_board_cards.append(repr(card_list[0]))

        # Serialize pots
        serialized_pots = [
            {
                "amount": pot.amount,
                "player_indices": list(pot.player_indices),
            }
            for pot in self.state.pots
        ]

        # Build complete state dictionary
        persistence_state = {
            # Configuration
            "player_count": self.player_count,
            "starting_stacks": self.starting_stacks,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "mode": self.mode.value,
            # Current game state from PokerKit
            "stacks": list(self.state.stacks),
            "bets": list(self.state.bets),
            "hole_cards": serialized_hole_cards,
            "board_cards": serialized_board_cards,
            "pots": serialized_pots,
            "button_index": (
                self.state.button_index if hasattr(self.state, "button_index") else 0
            ),
            "street_index": self.state.street_index,
            "player_indices": (
                list(self.state.player_indices)
                if hasattr(self.state, "player_indices")
                else list(range(self.player_count))
            ),
            "actor_index": self.state.actor_index,
            "status": bool(self.state.status),
            # Deck state
            "deck": self._deck,
        }

        return persistence_state

    @classmethod
    def from_persistence_state(cls, data: Dict[str, Any]) -> "PokerEngineAdapter":
        """
        Reconstruct a PokerEngineAdapter from a persisted state dict.

        This is the reverse of to_persistence_state() and restores the complete
        game state including hole cards, board cards, bets, and deck.

        Args:
            data: Persisted state dictionary from to_persistence_state()

        Returns:
            Reconstructed PokerEngineAdapter instance
        """
        # Create a new adapter instance
        mode = Mode(data["mode"]) if isinstance(data["mode"], str) else data["mode"]
        adapter = cls(
            player_count=data["player_count"],
            starting_stacks=data["starting_stacks"],
            small_blind=data["small_blind"],
            big_blind=data["big_blind"],
            mode=mode,
        )

        # Restore deck state
        adapter._deck = data.get("deck", [])

        # Restore hole cards
        if data.get("hole_cards"):
            for player_idx, cards in enumerate(data["hole_cards"]):
                if cards and player_idx < adapter.player_count:
                    # Deal hole cards to this player
                    cards_str = "".join(cards)
                    adapter.state.deal_hole(cards_str)

        # Restore board cards
        if data.get("board_cards"):
            board_str = "".join(data["board_cards"])
            if board_str:
                adapter.state.deal_board(board_str)

        # Restore stacks and bets
        if data.get("stacks"):
            for idx, stack in enumerate(data["stacks"]):
                if idx < len(adapter.state.stacks):
                    adapter.state.stacks[idx] = stack

        if data.get("bets"):
            for idx, bet in enumerate(data["bets"]):
                if idx < len(adapter.state.bets):
                    adapter.state.bets[idx] = bet

        logger.info(
            "Engine restored from persistence",
            player_count=adapter.player_count,
            street_index=data.get("street_index"),
            status=data.get("status"),
        )

        return adapter
