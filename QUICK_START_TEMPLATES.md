# Quick Start: Adding New Table Templates

This is a quick reference for adding new poker table templates to the system.

## TL;DR

1. Edit `templates/pokerTableTemplates.json`
2. Add your template JSON
3. Run `docker-compose up -d --build`
4. Tables appear in lobby automatically ✨

## Minimal Template Example

```json
{
  "name": "My Custom Table",
  "backend": {
    "template_name": "My Custom Table",
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
    "turn_timeout_seconds": 30,
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
      "felt_pattern": "classic",
      "accent_color": "#2ee59d",
      "ui_color_mode": "dark"
    },
    "timers": {
      "avatar_ring": true,
      "ring_color": "#2ee59d",
      "ring_thickness": 3
    },
    "icons": {
      "table_icon": "🃏",
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
    "max_tables": 2,
    "on_startup_repair": true
  }
}
```

## Key Fields to Customize

### Backend (Game Rules)
- `name` - Must be unique!
- `small_blind` / `big_blind` - Blind levels in chips
- `starting_stack` - Starting chips for players
- `max_players` - Number of seats (2-8)
- `buy_in_min` / `buy_in_max` - Buy-in range

### UI Schema (Appearance)
- `theme.table_color` - Table background color (hex)
- `theme.accent_color` - Highlight color (hex)
- `icons.table_icon` - Emoji for the table
- `icons.stake_label` - Display text for stakes

### Auto-Create (Lobby Behavior)
- `enabled` - Set to `true` to auto-create tables
- `min_tables` - How many tables to maintain
- `max_tables` - Maximum tables to create
- `on_startup_repair` - Create on app startup

## Common Game Variants

```
no_limit_texas_holdem    - No-Limit Hold'em
pot_limit_omaha          - Pot-Limit Omaha
no_limit_short_deck_holdem - Short Deck (6+)
```

## Validation Checklist

Before deploying:

- [ ] Template name is unique
- [ ] JSON is valid (`python3 -m json.tool templates/pokerTableTemplates.json`)
- [ ] `small_blind < big_blind`
- [ ] `buy_in_min <= starting_stack <= buy_in_max`
- [ ] `max_players` matches `ui_schema.layout.seat_count`
- [ ] `auto_create` config is present
- [ ] `game_variant` is valid (see above)

## Testing Locally

```bash
# 1. Validate JSON
python3 -m json.tool templates/pokerTableTemplates.json

# 2. Rebuild containers
docker-compose down
docker-compose up -d --build

# 3. Check import logs
docker-compose logs template_import

# 4. Verify templates in DB
docker-compose exec postgres psql -U pokerbot -d pokerbot \
  -c "SELECT name, table_type FROM table_templates;"

# 5. Check tables were created
docker-compose exec postgres psql -U pokerbot -d pokerbot \
  -c "SELECT id, template_id, status FROM tables WHERE is_auto_generated = true;"

# 6. Test lobby API
curl http://localhost:8000/api/tables?lobby_persistent=true
```

## Troubleshooting

### Templates not importing?
- Check logs: `docker-compose logs template_import`
- Validate JSON syntax
- Ensure file is in `templates/` directory

### Tables not appearing in lobby?
- Check `auto_create.enabled = true`
- Check `auto_create.on_startup_repair = true`
- View API logs: `docker-compose logs api | grep AUTO-CREATE`
- Verify in DB: `SELECT * FROM tables WHERE is_auto_generated = true;`

### Template name conflict?
- Change the `name` field to something unique
- Or: The import will update the existing template (this is safe!)

## More Information

See `TABLE_TEMPLATE_SYSTEM_GUIDE.md` for complete documentation.
