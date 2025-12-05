#!/usr/bin/env python3
"""
Generate comprehensive poker table templates JSON.
This script creates 35 poker table templates covering all required categories.
"""

import json
import sys
from pathlib import Path


def generate_templates():
    """Generate all poker table templates with backend and UI configurations."""
    templates = []
    
    # 1. Micro Stakes NLHE 6-Max
    templates.append({
        "backend": {
            "template_name": "Micro Stakes NLHE 6-Max",
            "variant_code": "NT",
            "game_type": "cash",
            "description": "Micro stakes no-limit Texas Hold'em cash game for beginners",
            "player_count_min": 2,
            "player_count_max": 6,
            "default_player_count": 6,
            "blinds_or_straddles": [0.01, 0.02],
            "antes": [],
            "bring_in": None,
            "rake_policy": {"type": "percentage", "rate": 0.05, "cap": 0.50},
            "buyin_min": 0.40,
            "buyin_max": 4.00,
            "betting_structure": "no_limit",
            "stack_type": "cash",
            "starting_stack_size": 2.00,
            "time_settings": {"action_time_seconds": 30, "timebank_seconds": 60},
            "table_speed": "normal",
            "allow_auto_rebuy": True,
            "board_count": 1,
            "hole_dealing_count": 2,
            "board_dealing_count": 5,
            "hand_types": ["high"],
            "deck_type": "standard_52",
            "metadata": {"stakes_category": "micro", "recommended_bankroll": 40.00}
        },
        "ui": {
            "display_name": "Micro Stakes 6-Max",
            "ui_icon": "🃏",
            "ui_tags": ["NLHE", "micro", "6-max", "beginner"],
            "theme_color": "#4CAF50",
            "recommended_for": "Perfect for beginners learning poker fundamentals",
            "ui_sort_index": 10,
            "ui_layout": "card-large",
            "is_default_showcase": True,
            "ui_badges": ["Popular", "Beginner Friendly"],
            "ui_group": "Texas Hold'em",
            "ui_blind_label": "$0.01/$0.02",
            "ui_variant_label": "NLHE",
            "ui_player_label": "6-Max",
            "ui_speed_label": "normal",
            "ui_stake_category": "micro",
            "ui_short_description": "The perfect starting point for new players with very low stakes",
            "ui_color_mode": "light",
            "ui_icon_style": "emoji"
        }
    })
    
    # 2. Micro Stakes NLHE 9-Max (Full Ring)
    templates.append({
        "backend": {
            "template_name": "Micro Stakes NLHE 9-Max",
            "variant_code": "NT",
            "game_type": "cash",
            "description": "Full-ring micro stakes no-limit Texas Hold'em",
            "player_count_min": 2,
            "player_count_max": 9,
            "default_player_count": 9,
            "blinds_or_straddles": [0.01, 0.02],
            "antes": [],
            "bring_in": None,
            "rake_policy": {"type": "percentage", "rate": 0.05, "cap": 0.50},
            "buyin_min": 0.40,
            "buyin_max": 4.00,
            "betting_structure": "no_limit",
            "stack_type": "cash",
            "starting_stack_size": 2.00,
            "time_settings": {"action_time_seconds": 30, "timebank_seconds": 60},
            "table_speed": "normal",
            "allow_auto_rebuy": True,
            "board_count": 1,
            "hole_dealing_count": 2,
            "board_dealing_count": 5,
            "hand_types": ["high"],
            "deck_type": "standard_52",
            "metadata": {"stakes_category": "micro", "recommended_bankroll": 40.00}
        },
        "ui": {
            "display_name": "Micro Stakes 9-Max",
            "ui_icon": "🎰",
            "ui_tags": ["NLHE", "micro", "9-max", "full-ring"],
            "theme_color": "#4CAF50",
            "recommended_for": "Best for players who prefer full-ring action",
            "ui_sort_index": 11,
            "ui_layout": "card-large",
            "is_default_showcase": False,
            "ui_badges": ["Full Ring"],
            "ui_group": "Texas Hold'em",
            "ui_blind_label": "$0.01/$0.02",
            "ui_variant_label": "NLHE",
            "ui_player_label": "9-Max",
            "ui_speed_label": "normal",
            "ui_stake_category": "micro",
            "ui_short_description": "Classic full-ring poker with nine players at the table",
            "ui_color_mode": "light",
            "ui_icon_style": "emoji"
        }
    })
    
    return templates


if __name__ == "__main__":
    templates = generate_templates()
    output_path = Path(__file__).parent.parent / "telegram_poker_bot" / "frontend" / "src" / "config" / "pokerTableTemplates.json"
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(templates, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {len(templates)} templates to {output_path}")
