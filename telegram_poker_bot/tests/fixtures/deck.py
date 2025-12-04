"""Seeded deck and card utilities for deterministic testing."""

import random
from typing import List, Optional
from pokerkit import Card


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
        return [Card(f"{rank}{suit}") for suit in suits for rank in ranks]
    
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
    preset_cards: Optional[List[str]] = None
) -> SeededDeck:
    """Create a deterministic deck for testing.
    
    Args:
        seed: Random seed
        preset_cards: Optional list of card strings to place on top of deck
        
    Returns:
        SeededDeck instance
    """
    deck = SeededDeck(seed)
    
    if preset_cards:
        # Remove preset cards from deck
        preset_card_objs = [Card(c) for c in preset_cards]
        deck.cards = [c for c in deck.cards if c not in preset_card_objs]
        # Place preset cards on top
        deck.cards = preset_card_objs + deck.cards
    
    return deck


def create_royal_flush_scenario(suit: str = "h") -> List[str]:
    """Create a preset for royal flush scenario.
    
    Args:
        suit: Suit for the royal flush (h/d/c/s)
        
    Returns:
        List of card strings for royal flush
    """
    return [f"A{suit}", f"K{suit}", f"Q{suit}", f"J{suit}", f"T{suit}"]


def create_nut_hand_scenario(variant: str = "nlhe") -> List[str]:
    """Create a preset for nut hand scenario for a variant.
    
    Args:
        variant: Poker variant (nlhe, plo, draw, stud)
        
    Returns:
        List of card strings for nut hand
    """
    if variant == "nlhe":
        # Pocket aces
        return ["Ah", "As", "Kh", "Kd", "Qh"]
    elif variant == "plo":
        # AAAKK double suited
        return ["Ah", "As", "Ad", "Kh", "Ks"]
    elif variant == "draw":
        # Royal flush
        return create_royal_flush_scenario()
    elif variant == "stud":
        # Rolled up aces
        return ["Ah", "As", "Ad"]
    else:
        return ["Ah", "As"]
