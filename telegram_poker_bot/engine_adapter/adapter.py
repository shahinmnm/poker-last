"""PokerKit engine adapter - clean API wrapper for PokerKit."""

import random
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

from pokerkit import Automation, Mode, NoLimitTexasHoldem, State
from pokerkit.state import Folding, Operation

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)

RANKS = "23456789TJQKA"
SUITS = "shdc"


class PokerEngineAdapter:
    """High-level adapter that wraps PokerKit ``State`` for NLH."""

    def __init__(
        self,
        player_count: int,
        starting_stacks: List[int],
        small_blind: int,
        big_blind: int,
        mode: Mode = Mode.TOURNAMENT,
        button_index: Optional[int] = None,
        game_class: type = NoLimitTexasHoldem,
        *,
        automations: Optional[tuple] = None,
        raw_antes: int = 0,
        raw_blinds_or_straddles: Optional[Tuple[int, int]] = None,
        min_bet: Optional[int] = None,
        bring_in: Optional[int] = None,
    ):
        if player_count < 2 or player_count > 8:
            raise ValueError("Player count must be between 2 and 8")

        if len(starting_stacks) != player_count:
            raise ValueError("starting_stacks length must match player_count")

        self.player_count = player_count
        self.starting_stacks = starting_stacks
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.mode = mode
        self._deck: List[str] = []
        self._pre_showdown_stacks: Optional[List[int]] = None
        self.game_class = game_class
        self.raw_antes = raw_antes
        self.raw_blinds_or_straddles = (
            tuple(raw_blinds_or_straddles)
            if raw_blinds_or_straddles is not None
            else (small_blind, big_blind)
        )
        self.min_bet = min_bet if min_bet is not None else big_blind
        self.bring_in = bring_in

        if button_index is None or not (0 <= button_index < player_count):
            if button_index is not None and not (0 <= button_index < player_count):
                logger.warning(
                    "Invalid button_index provided, defaulting to 0",
                    provided_button_index=button_index,
                    player_count=player_count,
                )
            button_index = 0

        self.button_index = button_index

        automations_tuple = automations or (
            Automation.ANTE_POSTING,
            Automation.BET_COLLECTION,
            Automation.BLIND_OR_STRADDLE_POSTING,
            Automation.CARD_BURNING,
            Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
            Automation.HAND_KILLING,
            Automation.CHIPS_PUSHING,
            Automation.CHIPS_PULLING,
        )

        state_kwargs = {
            "automations": automations_tuple,
            "ante_trimming_status": True,
            "raw_antes": self.raw_antes,
            "raw_blinds_or_straddles": self.raw_blinds_or_straddles,
            "min_bet": self.min_bet,
            "raw_starting_stacks": starting_stacks,
            "player_count": player_count,
            "mode": mode,
        }

        if self.bring_in is not None:
            state_kwargs["bring_in"] = self.bring_in

        self.state: State = self.game_class.create_state(**state_kwargs)

        logger.info(
            "Poker engine initialized",
            player_count=player_count,
            small_blind=small_blind,
            big_blind=big_blind,
            mode=mode.value,
            button_index=self.button_index,
            game_class=getattr(self.game_class, "__name__", str(self.game_class)),
        )

    def deal_new_hand(self) -> None:
        """Shuffle and deal a fresh hand to all active players."""
        available_cards = list(self.state.get_dealable_cards())
        random.shuffle(available_cards)
        self._pre_showdown_stacks = list(self.state.stacks)

        for player_idx in range(self.player_count):
            if self.state.stacks[player_idx] <= 0:
                continue
            if len(available_cards) < 2:
                raise ValueError("Not enough cards available to deal hole cards")
            card_strings = [repr(available_cards.pop()) for _ in range(2)]
            cards = "".join(card_strings)
            self.state.deal_hole(cards)
            logger.debug("Dealt hole cards", player_index=player_idx, cards=cards)

        # Persist remaining deck order derived from PokerKit's dealable cards
        self._deck = [repr(card) for card in available_cards]

        logger.info(
            "New hand dealt",
            players=self.player_count,
            button_index=self.button_index,
            deck_remaining=len(self._deck),
        )

    def deal_flop(self) -> None:
        self._deal_board_cards(3, "flop")

    def deal_turn(self) -> None:
        self._deal_board_cards(1, "turn")

    def deal_river(self) -> None:
        self._deal_board_cards(1, "river")

    def _deal_board_cards(self, count: int, street: str) -> None:
        if len(self._deck) < count:
            # Fall back to current dealable set to avoid illegal manual dealing
            available_cards = list(self.state.get_dealable_cards())
            random.shuffle(available_cards)
            self._deck.extend(repr(card) for card in available_cards)

        if len(self._deck) < count:
            raise ValueError(f"Not enough cards in deck to deal {street}")

        cards = "".join(self._deck.pop() for _ in range(count))
        self.state.deal_board(cards)
        logger.debug("Dealt board", street=street, cards=cards)

    def to_full_state(
        self, viewer_player_index: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Serialize complete game state to dictionary with proper card visibility.
        """
        actor_index = self.state.actor_index
        is_showdown = not self.state.status

        players: List[Dict[str, Any]] = []
        for i in range(self.player_count):
            is_button = i == self.button_index
            is_small_blind = False
            is_big_blind = False

            if self.state.street_index == 0 and self.state.bets:
                player_bet = self.state.bets[i]
                is_small_blind = player_bet == self.small_blind
                is_big_blind = player_bet == self.big_blind

            hole_cards: List[str] = []
            if getattr(self.state, "hole_cards", None) and i < len(
                self.state.hole_cards
            ):
                player_cards = self.state.hole_cards[i]
                if player_cards and (is_showdown or viewer_player_index == i):
                    hole_cards = [repr(card) for card in player_cards]

            is_folded = (
                hasattr(self.state, "player_indices")
                and i not in self.state.player_indices
            )
            is_all_in = self.state.stacks[i] == 0 and self.state.bets[i] > 0

            players.append(
                {
                    "player_index": i,
                    "stack": self.state.stacks[i],
                    "bet": self.state.bets[i],
                    "hole_cards": hole_cards,
                    "is_folded": is_folded,
                    "is_all_in": is_all_in,
                    "is_button": is_button,
                    "is_small_blind": is_small_blind,
                    "is_big_blind": is_big_blind,
                }
            )

        board_cards: List[str] = []
        if self.state.board_cards:
            for card_list in self.state.board_cards:
                if card_list:
                    board_cards.append(repr(card_list[0]))

        pots_iterable = list(self.state.pots)
        pots = [
            {
                "pot_index": idx,
                "amount": pot.amount,
                "player_indices": list(pot.player_indices),
            }
            for idx, pot in enumerate(pots_iterable)
        ]

        street_names = ["preflop", "flop", "turn", "river"]
        street_index = (
            self.state.street_index if self.state.street_index is not None else -1
        )
        street_name = (
            "showdown"
            if not self.state.status
            else street_names[street_index]
            if 0 <= street_index < len(street_names)
            else "preflop"
        )

        allowed_actions: Dict[str, Any] = {}
        if actor_index is not None and (
            viewer_player_index is None or viewer_player_index == actor_index
        ):
            allowed_actions = self._get_allowed_actions_for_player(actor_index)

        total_pot = sum(p["amount"] for p in pots) + sum(self.state.bets)

        return {
            "status": "active" if self.state.status else "complete",
            "street": street_name,
            "current_actor_index": actor_index,
            "players": players,
            "board_cards": board_cards,
            "pots": pots,
            "total_pot": total_pot,
            "allowed_actions": allowed_actions,
        }

    def _get_allowed_actions_for_player(self, player_index: int) -> Dict[str, Any]:
        if player_index != self.state.actor_index:
            return {}

        actions: Dict[str, Any] = {}
        current_bet = max(self.state.bets) if self.state.bets else 0
        player_bet = self.state.bets[player_index]
        call_amount = max(current_bet - player_bet, 0)

        # PokerKit guards against folding when call_amount == 0 (tournament mode).
        # We still want to expose a voluntary fold on the player's turn so the UI
        # never hides the button. The fold operation handler performs a safe
        # fallback if PokerKit raises the "no reason to fold" error.
        can_check_call = self.state.can_check_or_call()
        can_fold = (
            self.state.actor_index is not None
            and self.state.actor_index == player_index
            and self.state.statuses[player_index]
        ) or self.state.can_fold()
        actions["can_fold"] = can_fold
        actions["can_check"] = can_check_call and call_amount == 0
        actions["can_call"] = can_check_call and call_amount > 0
        actions["call_amount"] = call_amount if actions["can_call"] else 0

        can_bet_raise = self.state.can_complete_bet_or_raise_to()
        min_raise_to = self.state.min_completion_betting_or_raising_to_amount
        max_raise_to = self.state.max_completion_betting_or_raising_to_amount

        actions["can_bet"] = can_bet_raise and current_bet == 0
        actions["can_raise"] = can_bet_raise and current_bet > 0
        actions["min_raise_to"] = min_raise_to if min_raise_to is not None else 0
        actions["max_raise_to"] = (
            max_raise_to
            if max_raise_to is not None
            else self.state.stacks[player_index] + player_bet
        )

        pot_total = sum(pot.amount for pot in self.state.pots) + sum(
            self.state.bets
        )
        actions["current_pot"] = pot_total
        actions["player_stack"] = self.state.stacks[player_index]

        return actions

    def _auto_advance_streets(self) -> None:
        """Automatically advance the board when no players remain to act."""

        while self.state.status and not self.state.actor_indices:
            board_count = sum(len(cards) for cards in self.state.board_cards)
            street_index = self.state.street_index

            if street_index is None:
                break

            if street_index == 0 and board_count < 3:
                self.deal_flop()
                continue
            if street_index == 1 and board_count < 3:
                self.deal_flop()
                continue
            if street_index == 2 and board_count < 4:
                self.deal_turn()
                continue
            if street_index == 3 and board_count < 5:
                self.deal_river()
                continue

            # If board is complete and still no actors, the hand should end
            if board_count >= 5:
                break
            else:
                break

    def fold(self) -> Operation:
        """Fold for the current actor, raising on illegal attempts."""
        if self.state.actor_index is None:
            raise ValueError("Cannot fold: no actor")

        forced_player_index: Optional[int] = None
        try:
            operation = self.state.fold()
        except ValueError as exc:
            # PokerKit disallows folding when call_amount == 0 in tournaments.
            # For UX parity we still honor a voluntary fold by bypassing the guard.
            message = str(exc)
            if "no reason for this player to fold" not in message.lower():
                raise

            player_index = self.state.actor_index
            assert player_index is not None

            # Replicate PokerKit's fold mechanics without the verification guard.
            player_index = self.state._pop_actor_index()
            assert self.state.stacks[player_index]
            self.state._muck_hole_cards(player_index)
            operation = Folding(player_index)
            self.state._update_betting(operation)
            forced_player_index = player_index

            logger.warning(
                "Forced fold despite PokerKit guard",
                player_index=player_index,
                call_amount=max(self.state.bets) - self.state.bets[player_index],
            )

        actor_for_log = forced_player_index
        if actor_for_log is None:
            actor_for_log = (
                operation.player_index
                if hasattr(operation, "player_index")
                else self.state.actor_index
            )

        logger.info("Player folded", player_index=actor_for_log)
        # Auto-advance streets if needed
        self._auto_advance_streets()
        return operation

    def check_or_call(self) -> Operation:
        """Check or call for the current actor, validating legality."""
        if not self.state.can_check_or_call():
            raise ValueError("Cannot check/call at this time")

        operation = self.state.check_or_call()
        actor_idx = (
            operation.player_index if hasattr(operation, "player_index") else None
        )
        amount = operation.amount if hasattr(operation, "amount") else 0
        action_name = "checked" if amount == 0 else f"called {amount}"
        logger.info(f"Player {action_name}", player_index=actor_idx, amount=amount)
        # Auto-advance streets if needed
        self._auto_advance_streets()
        return operation

    def bet_or_raise(self, amount: int) -> Operation:
        """Bet or raise to the provided total amount for the current actor."""

        min_amt = self.state.min_completion_betting_or_raising_to_amount
        max_amt = self.state.max_completion_betting_or_raising_to_amount

        if not self.state.can_complete_bet_or_raise_to(amount):
            raise ValueError(
                f"Cannot bet/raise to {amount}. Allowed range: {min_amt} to {max_amt}"
            )

        operation = self.state.complete_bet_or_raise_to(amount)
        actor_idx = (
            operation.player_index if hasattr(operation, "player_index") else None
        )
        logger.info("Player bet/raised", player_index=actor_idx, amount=amount)
        self._auto_advance_streets()
        return operation

    def is_hand_complete(self) -> bool:
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

        pots = list(self.state.pots)
        total_pot_amount = sum(pot.amount for pot in pots)
        calculated_pot = max(total_won, total_lost)

        # If PokerKit pot tracking lags behind stack deltas, normalize locally
        # for consistency checks without mutating PokerKit Pot objects (which are
        # immutable for amount).
        if calculated_pot and abs(total_pot_amount - calculated_pot) > 1:
            total_pot_amount = calculated_pot

        if abs(total_won - total_lost) > 1 or abs(total_won - total_pot_amount) > 1:
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
                total_pot=total_pot_amount,
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
        pots_snapshot = list(self.state.pots)
        serialized_pots = [
            {
                "amount": pot.amount,
                "player_indices": list(pot.player_indices),
            }
            for pot in pots_snapshot
        ]

        # Build complete state dictionary
        persistence_state = {
            # Configuration
            "player_count": self.player_count,
            "starting_stacks": self.starting_stacks,
            "pre_showdown_stacks": self._pre_showdown_stacks,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "mode": self.mode.value,
            "raw_antes": self.raw_antes,
            "raw_blinds_or_straddles": list(self.raw_blinds_or_straddles),
            "min_bet": self.min_bet,
            "bring_in": self.bring_in,
            # Current game state from PokerKit
            "stacks": list(self.state.stacks),
            "bets": list(self.state.bets),
            "hole_cards": serialized_hole_cards,
            "board_cards": serialized_board_cards,
            "pots": serialized_pots,
            "button_index": self.button_index,  # Use our tracked button_index
            "street_index": self.state.street_index,
            # NOTE: player_indices and actor_index are included for debugging/logging
            # but are SKIPPED during restoration (they are read-only PokerKit properties)
            "player_indices": (
                list(self.state.player_indices)
                if hasattr(self.state, "player_indices")
                else list(range(self.player_count))
            ),
            "actor_index": self.state.actor_index,
            "actor_indices": list(self.state.actor_indices),
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
        game state including hole cards, board cards, bets, button_index, and deck.

        Args:
            data: Persisted state dictionary from to_persistence_state()

        Returns:
            Reconstructed PokerEngineAdapter instance
        """
        # Create a new adapter instance with button_index from persisted state
        mode = Mode(data["mode"]) if isinstance(data["mode"], str) else data["mode"]
        button_index = data.get("button_index", 0)

        raw_blinds = data.get("raw_blinds_or_straddles")
        if raw_blinds is not None:
            if isinstance(raw_blinds, list):
                raw_blinds = tuple(raw_blinds)
            try:
                raw_blinds = (int(raw_blinds[0]), int(raw_blinds[1]))
            except Exception:
                raw_blinds = None

        adapter = cls(
            player_count=data["player_count"],
            starting_stacks=data["starting_stacks"],
            small_blind=data["small_blind"],
            big_blind=data["big_blind"],
            mode=mode,
            button_index=button_index,
            raw_antes=data.get("raw_antes", data.get("ante", 0)),
            raw_blinds_or_straddles=raw_blinds,
            min_bet=data.get("min_bet"),
            bring_in=data.get("bring_in"),
        )

        # Restore deck state
        adapter._deck = data.get("deck", [])

        # Restore pre-showdown stacks if available
        if data.get("pre_showdown_stacks") is not None:
            adapter._pre_showdown_stacks = list(data["pre_showdown_stacks"])
        else:
            adapter._pre_showdown_stacks = list(data.get("starting_stacks", []))

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

        if data.get("pots"):
            for idx, pot_data in enumerate(data["pots"]):
                if idx < len(adapter.state.pots):
                    adapter.state.pots[idx].amount = pot_data.get(
                        "amount", adapter.state.pots[idx].amount
                    )
                    adapter.state.pots[idx].player_indices = tuple(
                        pot_data.get("player_indices", adapter.state.pots[idx].player_indices)
                    )

        # NOTE: The following PokerKit State properties are READ-ONLY and cannot
        # be set directly. They are computed dynamically by PokerKit based on
        # the game state. Attempting to set them causes:
        #   "property 'player_indices' ... has no setter" crash
        #
        # Read-only properties that MUST be ignored during restore:
        #   - player_indices: Calculated from active players
        #   - actor_index: Calculated from actor_indices deque
        #   - hand_type_indices, street_indices, board_indices
        #   - pot_amounts, total_pot_amount, pot_count
        #   - street (the string name, not street_index)
        #   - can_act, can_check_or_call, can_fold
        #
        # Settable properties that CAN be restored:
        #   - street_index, actor_indices, status, stacks, bets

        if data.get("street_index") is not None:
            adapter.state.street_index = data["street_index"]

        # SKIP: player_indices is a read-only property calculated by PokerKit
        # if data.get("player_indices") is not None:
        #     adapter.state.player_indices = tuple(data["player_indices"])

        if data.get("actor_indices") is not None:
            adapter.state.actor_indices = deque(data["actor_indices"])

        # SKIP: actor_index is a read-only property (derived from actor_indices)
        # if data.get("actor_index") is not None:
        #     adapter.state.actor_index = data["actor_index"]

        if data.get("status") is not None:
            adapter.state.status = data["status"]

        logger.info(
            "Engine restored from persistence",
            player_count=adapter.player_count,
            street_index=data.get("street_index"),
            status=data.get("status"),
            button_index=adapter.button_index,
        )

        return adapter
