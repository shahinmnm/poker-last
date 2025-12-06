# Poker Table Template System - Complete Guide

## Overview

This poker application uses a **template-based table creation system** where table configurations are defined in JSON files and automatically imported into the database when the application starts. This makes it easy to add new table types without code changes.

## Architecture

### Workflow

```
1. Add JSON template → 2. Container rebuild → 3. Auto-import → 4. Auto-create tables → 5. Tables appear in lobby
```

### Components

1. **JSON Templates** (`templates/` directory)
   - Define table configurations (backend rules, UI styling, auto-creation settings)
   - One or more JSON files containing template definitions

2. **Import Script** (`scripts/import_templates_on_startup.py`)
   - Runs automatically on container startup (after migrations)
   - Imports/updates templates from JSON files into the database
   - Idempotent: safe to run multiple times

3. **Database** (`table_templates` table)
   - Stores template configurations
   - Templates are referenced by tables via `template_id`

4. **Auto-Creation Service** (`services/table_auto_creator.py`)
   - Creates lobby tables based on template `auto_create` configuration
   - Runs on API startup
   - Maintains minimum number of tables for each template

5. **API Endpoints** (`/api/tables`)
   - Lists available tables in the lobby
   - Filters by status, mode, scope (public/private)

## Template JSON Structure

### Complete Template Example

```json
{
  "name": "NLHE 6-Max Micro",
  "backend": {
    "template_name": "NLHE 6-Max Micro",
    "game_type": "cash",
    "game_variant": "no_limit_texas_holdem",
    "small_blind": 10,
    "big_blind": 20,
    "starting_stack": 2000,
    "max_players": 6,
    "min_players": 2,
    "ante": 0,
    "bring_in": null,
    "rake_percentage": 0.05,
    "rake_cap": 200,
    "currency_type": "REAL",
    "turn_timeout_seconds": 25,
    "table_speed": "normal",
    "buy_in_min": 400,
    "buy_in_max": 4000,
    "board_count": 1,
    "hole_dealing_count": 2,
    "board_dealing_count": 5,
    "hand_types": ["high"],
    "allow_invite_code": true
  },
  "ui_schema": {
    "layout": {
      "type": "ring",
      "seat_count": 6,
      "radius": 150,
      "avatar_size": 52,
      "card_scale": 1
    },
    "theme": {
      "table_color": "#0a5b3c",
      "felt_pattern": "micro-knit",
      "accent_color": "#2ee59d",
      "ui_color_mode": "dark"
    },
    "timers": {
      "avatar_ring": true,
      "ring_color": "#2ee59d",
      "ring_thickness": 3
    },
    "icons": {
      "table_icon": "♠️",
      "stake_label": "$0.10/$0.20",
      "variant_badge": "NLHE"
    },
    "rules_display": {
      "show_blinds": true,
      "show_speed": true,
      "show_buyin": true
    }
  },
  "auto_create": {
    "enabled": true,
    "min_tables": 1,
    "max_tables": 3,
    "on_startup_repair": true
  }
}
```

### Field Descriptions

#### Top-Level Fields

- **name**: Human-readable template name (must be unique)

#### Backend Configuration

- **template_name**: Internal template identifier
- **game_type**: `"cash"` or `"tournament"` (maps to CASH_GAME/TOURNAMENT)
- **game_variant**: Poker variant (see Game Variants below)
- **small_blind**: Small blind amount (in chips)
- **big_blind**: Big blind amount (in chips)
- **starting_stack**: Starting chip stack for players
- **max_players**: Maximum seats at table (2-8)
- **min_players**: Minimum players to start game
- **ante**: Ante amount (0 for no ante)
- **bring_in**: Bring-in amount (null if not applicable)
- **rake_percentage**: Rake as decimal (0.05 = 5%)
- **rake_cap**: Maximum rake per hand (in chips)
- **currency_type**: `"REAL"` or `"PLAY"`
- **turn_timeout_seconds**: Time limit for player actions
- **table_speed**: `"normal"`, `"fast"`, or `"hyper"`
- **buy_in_min**: Minimum buy-in (in chips)
- **buy_in_max**: Maximum buy-in (in chips)
- **board_count**: Number of boards (usually 1)
- **hole_dealing_count**: Cards dealt to each player (2 for Hold'em, 4 for Omaha)
- **board_dealing_count**: Community cards (5 for Hold'em/Omaha)
- **hand_types**: Array of hand types (usually `["high"]`)
- **allow_invite_code**: Whether private invites are allowed

#### UI Schema Configuration

- **layout.type**: Table shape (`"ring"`, `"oval"`, `"double-board"`)
- **layout.seat_count**: Number of seats (matches max_players)
- **layout.radius**: Visual radius of table
- **layout.avatar_size**: Player avatar size
- **layout.card_scale**: Card size multiplier

- **theme.table_color**: Background color (hex)
- **theme.felt_pattern**: Felt texture name
- **theme.accent_color**: Accent color (hex)
- **theme.ui_color_mode**: `"dark"` or `"light"`

- **timers.avatar_ring**: Show timer ring around avatars
- **timers.ring_color**: Timer ring color (hex)
- **timers.ring_thickness**: Timer ring thickness (pixels)

- **icons.table_icon**: Emoji or icon for table
- **icons.stake_label**: Display label for stakes
- **icons.variant_badge**: Game variant badge text

- **rules_display.show_blinds**: Show blind levels
- **rules_display.show_speed**: Show table speed
- **rules_display.show_buyin**: Show buy-in range

#### Auto-Create Configuration

- **enabled**: Whether to auto-create tables from this template
- **min_tables**: Minimum number of tables to maintain in lobby
- **max_tables**: Maximum number of tables to create
- **on_startup_repair**: Create tables on application startup

### Game Variants

Supported `game_variant` values:
- `no_limit_texas_holdem` - No-Limit Texas Hold'em
- `pot_limit_omaha` - Pot-Limit Omaha
- `no_limit_short_deck_holdem` - Short Deck (6+ Hold'em)

## How to Add New Templates

### Step 1: Create or Edit JSON File

Add your template to `templates/pokerTableTemplates.json` or create a new JSON file in the `templates/` directory.

**Important**: 
- Template names must be unique
- If a template with the same name exists, it will be updated
- You can have multiple JSON files in the templates directory

### Step 2: Validate JSON

Ensure your JSON is valid:

```bash
python3 -m json.tool templates/pokerTableTemplates.json
```

### Step 3: Rebuild Containers

The template import happens automatically on container startup:

```bash
docker-compose down
docker-compose up -d --build
```

Or use the Makefile:

```bash
make rebuild
```

### Step 4: Verify Import

Check the logs to confirm templates were imported:

```bash
docker-compose logs template_import
```

You should see output like:

```
TEMPLATE IMPORT: Starting template import process
Found 6 JSON template file(s)
[1/6] ✅ Created: NLHE 6-Max Micro
[2/6] ✅ Updated: NLHE 9-Max Micro
...
TEMPLATE IMPORT: Complete
  Created: 4
  Updated: 2
  Failed:  0
  Total:   6
```

### Step 5: Verify Tables in Lobby

Check that tables were auto-created:

```bash
# API endpoint
curl http://localhost:8000/api/tables?lobby_persistent=true

# Or check logs
docker-compose logs api | grep "STARTUP AUTO-CREATE"
```

## Container Startup Sequence

```
1. postgres (database starts)
2. redis (cache starts)
3. migrations (run database migrations)
4. template_import (import templates from JSON) ← NEW
5. api (starts API server, runs auto-create logic)
6. bot (starts Telegram bot)
```

## Manual Template Import

If you need to import templates without restarting containers:

```bash
# From inside the container
docker-compose exec api python scripts/import_templates_on_startup.py

# Or from host
python scripts/import_templates_on_startup.py
```

## Auto-Creation Behavior

When `auto_create.enabled = true` and `on_startup_repair = true`:

1. **On container startup**: API checks each template
2. **Counts existing tables**: Only auto-generated tables for that template
3. **Calculates deficit**: `min_tables - existing_count`
4. **Creates missing tables**: Up to `max_tables` limit
5. **Tables appear in lobby**: With status "waiting" or "active"

### Auto-Create Fields

- **enabled**: Master switch for auto-creation
- **min_tables**: Always maintain at least this many tables
- **max_tables**: Never create more than this many tables
- **on_startup_repair**: Run auto-creation on app startup

## Troubleshooting

### Templates not importing

1. Check JSON syntax: `python3 -m json.tool templates/your_file.json`
2. Check container logs: `docker-compose logs template_import`
3. Verify file location: Templates must be in `templates/` directory
4. Check file extension: Must be `.json`

### Tables not appearing in lobby

1. Verify auto_create config in template
2. Check API startup logs: `docker-compose logs api | grep AUTO-CREATE`
3. Verify template was imported: Check `template_import` logs
4. Check database: `SELECT * FROM table_templates;`
5. Check if tables exist: `SELECT * FROM tables WHERE is_auto_generated = true;`

### Template already exists error

This is normal! The import script updates existing templates. If you see this, your template was successfully updated.

## Database Schema

### table_templates table

```sql
CREATE TABLE table_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  table_type tabletemplatetype NOT NULL,
  has_waitlist BOOLEAN NOT NULL DEFAULT FALSE,
  config_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### tables table

```sql
CREATE TABLE tables (
  id INTEGER PRIMARY KEY,
  template_id UUID REFERENCES table_templates(id),
  is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  lobby_persistent BOOLEAN NOT NULL DEFAULT FALSE,
  status tablestatus NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  -- ... other fields
);
```

## Example: Adding a New Limit Hold'em Template

```json
{
  "name": "Limit Holdem 8-Max",
  "backend": {
    "template_name": "Limit Holdem 8-Max",
    "game_type": "cash",
    "game_variant": "limit_texas_holdem",
    "small_blind": 50,
    "big_blind": 100,
    "starting_stack": 10000,
    "max_players": 8,
    "min_players": 2,
    "ante": 0,
    "bring_in": null,
    "rake_percentage": 0.05,
    "rake_cap": 300,
    "currency_type": "REAL",
    "turn_timeout_seconds": 30,
    "table_speed": "normal",
    "buy_in_min": 2000,
    "buy_in_max": 20000,
    "board_count": 1,
    "hole_dealing_count": 2,
    "board_dealing_count": 5,
    "hand_types": ["high"],
    "allow_invite_code": true
  },
  "ui_schema": {
    "layout": {
      "type": "oval",
      "seat_count": 8,
      "radius": 160,
      "avatar_size": 50,
      "card_scale": 1.0
    },
    "theme": {
      "table_color": "#1a472a",
      "felt_pattern": "classic",
      "accent_color": "#ffd700",
      "ui_color_mode": "dark"
    },
    "timers": {
      "avatar_ring": true,
      "ring_color": "#ffd700",
      "ring_thickness": 3
    },
    "icons": {
      "table_icon": "💎",
      "stake_label": "$0.50/$1 Limit",
      "variant_badge": "LHE"
    },
    "rules_display": {
      "show_blinds": true,
      "show_speed": true,
      "show_buyin": true
    }
  },
  "auto_create": {
    "enabled": true,
    "min_tables": 1,
    "max_tables": 2,
    "on_startup_repair": true
  }
}
```

## Best Practices

1. **Unique Names**: Always use unique template names
2. **Sensible Limits**: Set reasonable `min_tables` and `max_tables`
3. **Test Locally**: Test new templates in development first
4. **Version Control**: Commit template JSON files to git
5. **Documentation**: Document custom fields or special configurations
6. **Validation**: Always validate JSON before deploying

## Summary

The table template system provides a **declarative, code-free way** to define and deploy new poker table types. By simply adding or editing JSON files and rebuilding containers, new tables automatically appear in the lobby with full configuration and styling.
