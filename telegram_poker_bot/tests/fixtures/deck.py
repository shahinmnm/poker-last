"""Seeded deck and card utilities for deterministic testing."""

import random
from typing import List, Optional, Tuple
from pokerkit import Card, Rank, Suit


# Rank mapping
RANK_MAP = {
    '2': Rank.DEUCE,
    '3': Rank.TREY,
    '4': Rank.FOUR,
    '5': Rank.FIVE,
    '6': Rank.SIX,
    '7': Rank.SEVEN,
    '8': Rank.EIGHT,
    '9': Rank.NINE,
    'T': Rank.TEN,
    'J': Rank.JACK,
    'Q': Rank.QUEEN,
    'K': Rank.KING,
    'A': Rank.ACE,
}

# Suit mapping
SUIT_MAP = {
    'c': Suit.CLUB,
    'd': Suit.DIAMOND,
    'h': Suit.HEART,
    's': Suit.SPADE,
}


class SeededDeck:
    """A deck with seeded randomness for deterministic tests.
    
    This allows tests to be reproducible while still using realistic
    card distributions.
    """
    
    def __init__(self, seed: int = 42):
        """Initialize a seeded deck.
        
        Args:
            seed: Random seed for reproducibility
        """
        self.seed = seed
        self.rng = random.Random(seed)
        self.reset()
    
    def reset(self):
        """Reset the deck to a fresh shuffled state."""
        self.rng.seed(self.seed)
        self.cards = self._create_standard_deck()
        self.rng.shuffle(self.cards)
    
    def _create_standard_deck(self) -> List[Card]:
        """Create a standard 52-card deck."""
        ranks = "23456789TJQKA"
        suits = "cdhs"  # clubs, diamonds, hearts, spades
        cards = []
        for suit_char in suits:
            for rank_char in ranks:
                rank = RANK_MAP[rank_char]
                suit = SUIT_MAP[suit_char]
                cards.append(Card(rank, suit))
        return cards
    
    def deal(self, n: int = 1) -> List[Card]:
        """Deal n cards from the deck.
        
        Args:
            n: Number of cards to deal
            
        Returns:
            List of dealt cards
        """
        if n > len(self.cards):
            raise ValueError(f"Cannot deal {n} cards from deck with {len(self.cards)} cards")
        dealt = self.cards[:n]
        self.cards = self.cards[n:]
        return dealt
    
    def deal_one(self) -> Card:
        """Deal a single card."""
        return self.deal(1)[0]
    
    def peek(self, n: int = 1) -> List[Card]:
        """Peek at the next n cards without removing them.
        
        Args:
            n: Number of cards to peek at
            
        Returns:
            List of peeked cards
        """
        return self.cards[:n]
    
    def remaining(self) -> int:
        """Get number of cards remaining in deck."""
        return len(self.cards)


def create_deterministic_deck(
    seed: int = 42,
    preset_cards: Optional[List[Tuple[str, str]]] = None
) -> SeededDeck:
    """Create a deterministic deck for testing.
    
    Args:
        seed: Random seed
        preset_cards: Optional list of (rank, suit) tuples to place on top of deck.
                     Example: [('A', 'h'), ('K', 'h')]
        
    Returns:
        SeededDeck instance
    """
    deck = SeededDeck(seed)
    
    if preset_cards:
        # Remove preset cards from deck
        preset_card_objs = []
        for rank_char, suit_char in preset_cards:
            rank = RANK_MAP[rank_char.upper()]
            suit = SUIT_MAP[suit_char.lower()]
            card = Card(rank, suit)
            preset_card_objs.append(card)
        
        # Filter out preset cards from deck
        deck.cards = [c for c in deck.cards if c not in preset_card_objs]
        # Place preset cards on top
        deck.cards = preset_card_objs + deck.cards
    
    return deck


def create_royal_flush_scenario(suit: str = "h") -> List[Tuple[str, str]]:
    """Create a preset for royal flush scenario.
    
    Args:
        suit: Suit for the royal flush (h/d/c/s)
        
    Returns:
        List of (rank, suit) tuples for royal flush
    """
    return [("A", suit), ("K", suit), ("Q", suit), ("J", suit), ("T", suit)]


def create_nut_hand_scenario(variant: str = "nlhe") -> List[Tuple[str, str]]:
    """Create a preset for nut hand scenario for a variant.
    
    Args:
        variant: Poker variant (nlhe, plo, draw, stud)
        
    Returns:
        List of (rank, suit) tuples for nut hand
    """
    if variant == "nlhe":
        # Pocket aces
        return [("A", "h"), ("A", "s"), ("K", "h"), ("K", "d"), ("Q", "h")]
    elif variant == "plo":
        # AAAKK double suited
        return [("A", "h"), ("A", "s"), ("A", "d"), ("K", "h"), ("K", "s")]
    elif variant == "draw":
        # Royal flush
        return create_royal_flush_scenario()
    elif variant == "stud":
        # Rolled up aces
        return [("A", "h"), ("A", "s"), ("A", "d")]
    else:
        return [("A", "h"), ("A", "s")]
