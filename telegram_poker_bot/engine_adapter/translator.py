"""Event translation layer for poker engines.

This module provides utilities to translate engine-specific events
into normalized GameEvents that the frontend can consume.
"""

from typing import Any, Dict, List
from telegram_poker_bot.engine_adapter.interface import GameEvent, GameEventType


class GameEventTranslator:
    """Translates engine-specific events to normalized GameEvents.
    
    This class serves as the bridge between different poker engine
    implementations and the unified event system used by the frontend.
    """
    
    # =========================================================================
    # PokerKit Translation
    # =========================================================================
    
    @staticmethod
    def from_pokerkit_operation(operation: Any, state: Any) -> List[GameEvent]:
        """Convert PokerKit operation to GameEvent(s).
        
        Args:
            operation: PokerKit Operation object
            state: Current PokerKit State object
            
        Returns:
            List of GameEvents (may be multiple events per operation)
        """
        from pokerkit.state import (
            Folding,
            CheckingOrCalling,
            CompletionBettingOrRaisingTo,
        )
        
        events = []
        
        # Determine operation type and create corresponding events
        if isinstance(operation, Folding):
            events.append(GameEvent(
                type=GameEventType.PLAYER_FOLDED,
                player_id=operation.player_index,
                data={
                    'player_index': operation.player_index,
                }
            ))
            
        elif isinstance(operation, CheckingOrCalling):
            # Determine if check or call based on amount
            amount = getattr(operation, 'amount', 0)
            
            if amount == 0:
                events.append(GameEvent(
                    type=GameEventType.PLAYER_CHECKED,
                    player_id=operation.player_index,
                    data={
                        'player_index': operation.player_index,
                    }
                ))
            else:
                events.append(GameEvent(
                    type=GameEventType.PLAYER_CALLED,
                    player_id=operation.player_index,
                    data={
                        'player_index': operation.player_index,
                        'amount': amount,
                    }
                ))
                
        elif isinstance(operation, CompletionBettingOrRaisingTo):
            amount = operation.amount
            
            # Determine if all-in
            player_stack = state.stacks[operation.player_index]
            is_all_in = player_stack == 0
            
            if is_all_in:
                events.append(GameEvent(
                    type=GameEventType.PLAYER_ALL_IN,
                    player_id=operation.player_index,
                    data={
                        'player_index': operation.player_index,
                        'amount': amount,
                    }
                ))
            else:
                events.append(GameEvent(
                    type=GameEventType.PLAYER_RAISED,
                    player_id=operation.player_index,
                    data={
                        'player_index': operation.player_index,
                        'amount': amount,
                    }
                ))
        
        # Add pot update event
        events.append(GameEvent(
            type=GameEventType.POT_UPDATED,
            data={
                'pot': sum(pot.amount for pot in state.pots),
                'side_pots': [
                    {
                        'pot_index': idx,
                        'amount': pot.amount,
                        'player_indices': list(pot.player_indices),
                    }
                    for idx, pot in enumerate(state.pots)
                ]
            }
        ))
        
        return events
    
    # =========================================================================
    # PokerLib Translation
    # =========================================================================
    
    @staticmethod
    def from_pokerlib_output(output: Any) -> GameEvent:
        """Convert PokerLib output message to GameEvent.
        
        Args:
            output: PokerLib Round.PublicOut or Round.PrivateOut
            
        Returns:
            Normalized GameEvent
        """
        from pokerlib.enums import RoundPublicOutId, RoundPrivateOutId
        
        # Handle private outputs
        if hasattr(output, 'player_id'):
            return GameEventTranslator._from_pokerlib_private(output)
        
        # Handle public outputs
        return GameEventTranslator._from_pokerlib_public(output)
    
    @staticmethod
    def _from_pokerlib_private(output: Any) -> GameEvent:
        """Convert PokerLib private output to GameEvent.
        
        Args:
            output: PokerLib Round.PrivateOut
            
        Returns:
            Normalized GameEvent
        """
        from pokerlib.enums import RoundPrivateOutId
        
        if output.id == RoundPrivateOutId.DEALTCARDS:
            return GameEvent(
                type=GameEventType.HOLE_CARDS_DEALT,
                player_id=output.player_id,
                is_private=True,
                data={
                    'player_id': output.player_id,
                    'cards': [
                        f"{GameEventTranslator._rank_to_str(card[0])}"
                        f"{GameEventTranslator._suit_to_str(card[1])}"
                        for card in output.data.get('cards', [])
                    ]
                }
            )
        
        # Default unknown event
        return GameEvent(
            type=GameEventType.GAME_STARTED,  # Placeholder
            player_id=output.player_id,
            is_private=True,
            data=output.data
        )
    
    @staticmethod
    def _from_pokerlib_public(output: Any) -> GameEvent:
        """Convert PokerLib public output to GameEvent.
        
        Args:
            output: PokerLib Round.PublicOut
            
        Returns:
            Normalized GameEvent
        """
        from pokerlib.enums import RoundPublicOutId
        
        event_map = {
            RoundPublicOutId.NEWROUND: GameEventType.ROUND_STARTED,
            RoundPublicOutId.NEWTURN: GameEventType.STREET_CHANGED,
            RoundPublicOutId.SMALLBLIND: GameEventType.SMALL_BLIND_POSTED,
            RoundPublicOutId.BIGBLIND: GameEventType.BIG_BLIND_POSTED,
            RoundPublicOutId.PLAYERCHECK: GameEventType.PLAYER_CHECKED,
            RoundPublicOutId.PLAYERCALL: GameEventType.PLAYER_CALLED,
            RoundPublicOutId.PLAYERFOLD: GameEventType.PLAYER_FOLDED,
            RoundPublicOutId.PLAYERRAISE: GameEventType.PLAYER_RAISED,
            RoundPublicOutId.PLAYERISALLIN: GameEventType.PLAYER_ALL_IN,
            RoundPublicOutId.PLAYERWENTALLIN: GameEventType.PLAYER_ALL_IN,
            RoundPublicOutId.PLAYERREVEALCARDS: GameEventType.CARDS_REVEALED,
            RoundPublicOutId.PLAYERMUCKCARDS: GameEventType.CARDS_REVEALED,
            RoundPublicOutId.DECLAREPREMATUREWINNER: GameEventType.WINNER_DECLARED,
            RoundPublicOutId.DECLAREFINISHEDWINNER: GameEventType.WINNER_DECLARED,
            RoundPublicOutId.ROUNDFINISHED: GameEventType.ROUND_FINISHED,
            RoundPublicOutId.ROUNDCLOSED: GameEventType.GAME_FINISHED,
        }
        
        event_type = event_map.get(output.id, GameEventType.GAME_STARTED)
        
        # Process special cases
        data = dict(output.data)
        
        # Convert board cards if present
        if 'board' in data:
            data['board'] = [
                f"{GameEventTranslator._rank_to_str(card[0])}"
                f"{GameEventTranslator._suit_to_str(card[1])}"
                for card in data['board']
            ]
        
        # Convert cards if present
        if 'cards' in data:
            data['cards'] = [
                f"{GameEventTranslator._rank_to_str(card[0])}"
                f"{GameEventTranslator._suit_to_str(card[1])}"
                for card in data['cards']
            ]
        
        # Convert turn enum to string
        if 'turn' in data:
            turn_map = {
                0: 'preflop',
                1: 'flop',
                2: 'turn',
                3: 'river'
            }
            data['street'] = turn_map.get(int(data['turn']), 'preflop')
            del data['turn']
        
        return GameEvent(
            type=event_type,
            player_id=data.get('player_id'),
            data=data
        )
    
    # =========================================================================
    # Card Conversion Utilities
    # =========================================================================
    
    @staticmethod
    def _rank_to_str(rank: int) -> str:
        """Convert rank enum to string.
        
        Args:
            rank: Rank enum value (0-12)
            
        Returns:
            Rank string ('2'-'A')
        """
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
        return ranks[rank] if 0 <= rank < 13 else '?'
    
    @staticmethod
    def _suit_to_str(suit: int) -> str:
        """Convert suit enum to string.
        
        Args:
            suit: Suit enum value (0-3)
            
        Returns:
            Suit string ('s', 'c', 'd', 'h')
        """
        suits = ['s', 'c', 'd', 'h']
        return suits[suit] if 0 <= suit < 4 else '?'
    
    @staticmethod
    def _str_to_rank(rank_str: str) -> int:
        """Convert rank string to enum.
        
        Args:
            rank_str: Rank string ('2'-'A')
            
        Returns:
            Rank enum value (0-12)
        """
        ranks = {'2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
                 '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12}
        return ranks.get(rank_str.upper(), 0)
    
    @staticmethod
    def _str_to_suit(suit_str: str) -> int:
        """Convert suit string to enum.
        
        Args:
            suit_str: Suit string ('s', 'c', 'd', 'h')
            
        Returns:
            Suit enum value (0-3)
        """
        suits = {'s': 0, 'c': 1, 'd': 2, 'h': 3}
        return suits.get(suit_str.lower(), 0)
    
    @staticmethod
    def card_str_to_tuple(card: str) -> tuple:
        """Convert card string to (rank, suit) tuple.
        
        Args:
            card: Card string (e.g., 'Ac', 'Kd')
            
        Returns:
            Tuple of (rank, suit) integers
        """
        if len(card) != 2:
            raise ValueError(f"Invalid card format: {card}")
        
        rank = GameEventTranslator._str_to_rank(card[0])
        suit = GameEventTranslator._str_to_suit(card[1])
        return (rank, suit)
    
    @staticmethod
    def card_tuple_to_str(card: tuple) -> str:
        """Convert (rank, suit) tuple to card string.
        
        Args:
            card: Tuple of (rank, suit) integers
            
        Returns:
            Card string (e.g., 'Ac', 'Kd')
        """
        rank, suit = card
        return (
            f"{GameEventTranslator._rank_to_str(rank)}"
            f"{GameEventTranslator._suit_to_str(suit)}"
        )
