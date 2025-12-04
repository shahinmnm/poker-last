"""Hand scenario generators for testing."""

from typing import Dict, List, Optional, Any
from .deck import SeededDeck, create_deterministic_deck


def create_simple_hand(variant: str = "no_limit_texas_holdem", seed: int = 42) -> Dict[str, Any]:
    """Create a simple hand scenario that goes to showdown.
    
    This generates a straightforward hand with no complex logic,
    useful for basic functionality testing.
    
    Args:
        variant: Poker variant
        seed: Random seed for reproducibility
        
    Returns:
        Dictionary with hand scenario data
    """
    deck = create_deterministic_deck(seed)
    
    if variant == "no_limit_texas_holdem":
        return {
            "variant": variant,
            "players": 2,
            "hole_cards": [
                deck.deal(2),  # Player 1
                deck.deal(2),  # Player 2
            ],
            "board": deck.deal(5),  # All community cards
            "actions": [
                {"player": 0, "action": "call", "amount": 50},
                {"player": 1, "action": "check"},
                # Flop
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
                # Turn
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
                # River
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
            ],
            "expected_winner": None,  # Determined by hand evaluation
        }
    
    elif variant == "pot_limit_omaha":
        return {
            "variant": variant,
            "players": 2,
            "hole_cards": [
                deck.deal(4),  # Player 1
                deck.deal(4),  # Player 2
            ],
            "board": deck.deal(5),
            "actions": [
                {"player": 0, "action": "call", "amount": 50},
                {"player": 1, "action": "check"},
                # Continue to showdown with checks
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
            ],
            "expected_winner": None,
        }
    
    elif variant == "five_card_draw":
        return {
            "variant": variant,
            "players": 2,
            "hole_cards": [
                deck.deal(5),  # Player 1
                deck.deal(5),  # Player 2
            ],
            "actions": [
                {"player": 0, "action": "call", "amount": 50},
                {"player": 1, "action": "check"},
                # Draw round
                {"player": 0, "action": "draw", "cards": [0]},  # Replace first card
                {"player": 1, "action": "stand_pat"},
                # Second betting round
                {"player": 0, "action": "check"},
                {"player": 1, "action": "check"},
            ],
            "draw_cards": [
                deck.deal(1),  # Replacement for player 1
            ],
            "expected_winner": None,
        }
    
    else:
        raise ValueError(f"Simple hand not implemented for variant: {variant}")


def create_complex_hand(variant: str = "no_limit_texas_holdem", seed: int = 100) -> Dict[str, Any]:
    """Create a complex hand that exercises advanced rules.
    
    This includes:
    - Multiple raises
    - Side pots (if multiple players)
    - Variant-specific rules (pot-limit sizing, draw limits, etc.)
    
    Args:
        variant: Poker variant
        seed: Random seed for reproducibility
        
    Returns:
        Dictionary with complex hand scenario data
    """
    deck = create_deterministic_deck(seed)
    
    if variant == "no_limit_texas_holdem":
        return {
            "variant": variant,
            "players": 4,
            "stacks": [5000, 3000, 5000, 2000],
            "hole_cards": [
                deck.deal(2),  # Player 1
                deck.deal(2),  # Player 2
                deck.deal(2),  # Player 3
                deck.deal(2),  # Player 4
            ],
            "board": deck.deal(5),
            "actions": [
                # Preflop with raises
                {"player": 0, "action": "raise", "amount": 150},
                {"player": 1, "action": "raise", "amount": 450},  # 3-bet
                {"player": 2, "action": "fold"},
                {"player": 3, "action": "call", "amount": 450},
                {"player": 0, "action": "call", "amount": 450},
                # Flop
                {"player": 0, "action": "check"},
                {"player": 1, "action": "bet", "amount": 600},
                {"player": 3, "action": "raise", "amount": 1550},  # All-in
                {"player": 0, "action": "call", "amount": 1550},
                {"player": 1, "action": "call", "amount": 1550},
                # Turn (side pot)
                {"player": 0, "action": "check"},
                {"player": 1, "action": "bet", "amount": 1000},
                {"player": 0, "action": "fold"},
            ],
            "expected_pots": [
                {"amount": 4650, "eligible": [1, 3]},  # Main pot
                {"amount": 1000, "eligible": [1]},      # Side pot
            ],
        }
    
    elif variant == "pot_limit_omaha":
        return {
            "variant": variant,
            "players": 3,
            "stacks": [5000, 5000, 5000],
            "hole_cards": [
                deck.deal(4),
                deck.deal(4),
                deck.deal(4),
            ],
            "board": deck.deal(5),
            "actions": [
                # Preflop with pot-limit raises
                {"player": 0, "action": "raise", "amount": 150},
                {"player": 1, "action": "pot"},  # Pot-sized raise
                {"player": 2, "action": "fold"},
                {"player": 0, "action": "call"},
                # Flop
                {"player": 0, "action": "check"},
                {"player": 1, "action": "pot"},
                {"player": 0, "action": "call"},
                # Turn
                {"player": 0, "action": "check"},
                {"player": 1, "action": "pot"},
                {"player": 0, "action": "fold"},
            ],
        }
    
    elif variant == "deuce_to_seven_triple_draw":
        return {
            "variant": variant,
            "players": 3,
            "stacks": [5000, 5000, 5000],
            "hole_cards": [
                deck.deal(5),
                deck.deal(5),
                deck.deal(5),
            ],
            "actions": [
                # First draw
                {"player": 0, "action": "call", "amount": 50},
                {"player": 1, "action": "raise", "amount": 100},
                {"player": 2, "action": "call", "amount": 100},
                {"player": 0, "action": "call", "amount": 100},
                # Draw 1
                {"player": 0, "action": "draw", "cards": [0, 1, 2]},
                {"player": 1, "action": "draw", "cards": [0]},
                {"player": 2, "action": "stand_pat"},
                # Betting round 2
                {"player": 0, "action": "check"},
                {"player": 1, "action": "bet", "amount": 100},
                {"player": 2, "action": "raise", "amount": 200},
                {"player": 0, "action": "fold"},
                {"player": 1, "action": "call", "amount": 200},
                # Draw 2
                {"player": 1, "action": "draw", "cards": [0]},
                {"player": 2, "action": "stand_pat"},
                # Betting round 3
                {"player": 1, "action": "check"},
                {"player": 2, "action": "bet", "amount": 200},
                {"player": 1, "action": "call", "amount": 200},
                # Draw 3
                {"player": 1, "action": "stand_pat"},
                {"player": 2, "action": "stand_pat"},
                # Final betting
                {"player": 1, "action": "check"},
                {"player": 2, "action": "check"},
            ],
        }
    
    else:
        raise ValueError(f"Complex hand not implemented for variant: {variant}")


def create_edge_case_hand(
    case_type: str,
    variant: str = "no_limit_texas_holdem"
) -> Dict[str, Any]:
    """Create a hand scenario for edge case testing.
    
    Edge cases include:
    - illegal_raise: Invalid raise sizing
    - invalid_discard: Wrong number of cards discarded
    - out_of_turn: Player acts out of turn
    - exceed_draw_limit: Too many cards drawn
    - timeout: Player times out
    
    Args:
        case_type: Type of edge case
        variant: Poker variant
        
    Returns:
        Dictionary with edge case scenario
    """
    scenarios = {
        "illegal_raise": {
            "variant": variant,
            "players": 2,
            "actions": [
                {"player": 0, "action": "raise", "amount": 25},  # Below min raise
                # Should be rejected
            ],
            "expected_error": "Invalid raise amount",
        },
        "invalid_discard": {
            "variant": "five_card_draw",
            "players": 2,
            "actions": [
                {"player": 0, "action": "call", "amount": 50},
                {"player": 1, "action": "check"},
                {"player": 0, "action": "draw", "cards": [0, 1, 2, 3, 4, 5]},  # Too many
                # Should be rejected
            ],
            "expected_error": "Invalid draw count",
        },
        "out_of_turn": {
            "variant": variant,
            "players": 2,
            "actions": [
                {"player": 1, "action": "check"},  # Player 1 acts when player 0 should act
                # Should be rejected
            ],
            "expected_error": "Not your turn",
        },
        "timeout": {
            "variant": variant,
            "players": 2,
            "actions": [
                # Simulate timeout by not providing action within deadline
                {"player": 0, "action": "timeout"},
                # Should auto-fold
            ],
            "expected_result": "auto_fold",
        },
    }
    
    if case_type not in scenarios:
        raise ValueError(f"Unknown edge case type: {case_type}")
    
    return scenarios[case_type]
