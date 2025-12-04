# Phase 5: Frontend Sync & Realtime UI Architecture - Migration Guide

## Overview

Phase 5 implements a complete rewrite of the frontend synchronization layer and table UI components according to the Template-Driven Poker Engine specification. All new components are located in:

- `/src/components/table-new/` - New table components
- `/src/components/lobby-new/` - New lobby components  
- `/src/hooks/useTableSync.ts` - New table sync hook
- `/src/hooks/useLobbySync.ts` - New lobby sync hook
- `/src/services/WebSocketManager.ts` - New WebSocket manager
- `/src/types/normalized.ts` - Normalized state types

## Architecture Changes

### 1. State Management (NEW)

**Old Approach:**
- Used `useTableWebSocket` hook
- Mixed state management between hook and component
- Client-side calculations for actions
- Variant-specific heuristics

**New Approach:**
- `useTableSync()` provides normalized state from backend
- `WebSocketManager` handles connection, heartbeat, and resync
- Zero client-side logic - everything from backend
- Schema version tracking with mismatch detection

### 2. Table State (NEW)

**Old Type:** `TableState` from `src/types/game.ts`
```typescript
interface TableState {
  type: 'table_state'
  table_id: number
  hand_id: number | null
  status: TableStatus
  street: string | null
  board: string[]
  // ... mixed fields, variant-specific
}
```

**New Type:** `NormalizedTableState` from `src/types/normalized.ts`
```typescript
interface NormalizedTableState {
  variant_id: string
  current_street: string | null
  round_number: number | null
  community_cards: Card[]
  max_cards_per_player: number
  seat_map: Seat[]
  legal_actions: LegalAction[]
  action_deadline: number | null // epoch ms
  table_metadata: TableMetadata
  schema_version?: string
  table_version?: number
  event_seq?: number
}
```

### 3. WebSocket Sync (NEW)

**Old:** `useTableWebSocket` in `src/hooks/useTableWebSocket.ts`
- Basic ping/pong
- No snapshot/delta handling
- No sequence tracking
- No schema versioning

**New:** `WebSocketManager` + `useTableSync`
- Automatic snapshot on connect
- Delta merging with sequence validation
- Schema version mismatch detection → hard reload
- Table version mismatch → request snapshot
- Exponential backoff reconnection

### 4. Action Panel (NEW)

**Old:** Various action components with client-side logic
- Calculated legal actions on frontend
- Variant-specific button logic
- Mixed bet/raise sizing

**New:** `ActionPanel` component (100% backend-driven)
- Shows/hides buttons based on `legal_actions[]` only
- Raise slider uses `min_amount`, `max_amount` from backend
- Call button shows exact `call_amount`
- Presets from backend (½ pot, pot, min-raise)
- Zero client-side calculations

### 5. Card Rendering (NEW)

**Old:** `PlayingCard` component
- Mixed card representation
- No hidden card support
- No variant-specific rendering

**New:** `CardRenderer` + specialized renderers
- `CardRenderer`: SVG-based rendering with PNG fallback
- `StudRenderer`: Separates face-up/face-down cards
- `DrawRenderer`: Discard phase UI
- Hidden cards: `{hidden: true}` or `"XX"`
- Strict security: only self sees actual hole cards

### 6. Timer (NEW)

**Old:** Various timer implementations with client-side countdown

**New:** `CircularTimer`
- Synced to `action_deadline` (epoch ms) from backend
- No client-side turn timeout logic
- Visual progress circle
- Pulse animation when < 25% time remaining

### 7. Lobby (NEW)

**Old:** Basic table listing

**New:** `LobbyView` + `LobbyRow`
- WebSocket `/ws/lobby` for incremental updates
- Periodic REST refresh (25s)
- Standardized metadata display:
  - template_name
  - variant, stakes
  - player_count/max_players
  - waitlist_count
  - uptime/expiration
  - table_type (public/private/persistent/sng)
  - invite-only tag

## Migration Steps

### Step 1: Backend Changes (Required First)

The backend must implement:

1. **GET /api/tables/{id}/status** - Return `NormalizedTableState`
2. **WebSocket snapshot** - Send full state on connect
3. **WebSocket deltas** - Include `schema_version`, `table_version`, `event_seq`
4. **Legal actions** - Send complete `LegalAction[]` with amounts
5. **Action deadline** - Send epoch ms timestamp
6. **Schema versioning** - Track and send `schema_version`

### Step 2: Gradual Frontend Migration

1. **Test new components** with compatible backend
2. **Update routes** to use new `TableView`
3. **Update lobby** to use new `LobbyView`
4. **Remove legacy code** (see below)
5. **Test thoroughly** on mobile and desktop

### Step 3: Legacy Code to Remove

Once new components are fully integrated and tested:

#### Files to Delete:
- `src/hooks/useTableWebSocket.ts` (replaced by `useTableSync`)
- `src/hooks/useTableActions.ts` (client-side action logic)
- `src/components/table/ActionBar.tsx` (old action panel)
- `src/components/table/PlayerCircularTimer.tsx` (old timer)
- `src/components/PlayerRectTimer.tsx` (legacy timer)
- `src/utils/tableRules.ts` (client-side rule calculations)
- `src/utils/gameVariant.ts` (variant heuristics - keep only type definitions)

#### Code to Remove from `src/pages/Table.tsx`:
- All client-side action legality checks
- All variant-specific rendering logic
- Old timer calculations
- Inferred state calculations
- Legacy allowed_actions parsing

#### Types to Deprecate in `src/types/game.ts`:
- `TableState` (use `NormalizedTableState`)
- `AllowedActionsPayload` (old format)
- `TablePlayerState` (use `Seat` from normalized types)

## Animation System

New animation framework in `src/services/AnimationManager.ts`:

```typescript
// Usage
const { startAnimation, cancelAnimation, cancelAllAnimations } = useAnimations()

// Start animation
startAnimation({
  id: 'card-1',
  type: 'card_slide',
  target: 'seat-0',
  duration: 500,
  from: { x: 0, y: 0 },
  to: { x: 100, y: 50 }
})

// Cancel on reconnect
cancelAllAnimations()
```

Supported animations:
- `card_slide` - Card movement
- `card_flip` - Card reveal
- `bet_movement` - Chip movement
- `pot_collection` - Pot collection
- `win_highlight` - Winner highlight
- `timeout_pulse` - Timeout warning

All animations auto-cancel on:
- Reconnection
- Snapshot request
- Schema version mismatch

## Mobile Responsiveness

Styles in `src/styles/mobile.css`:

- **Portrait mode**: Stacked layout, full-width action panel
- **Landscape mode**: Horizontal optimization, compact heights
- **Small screens (<375px)**: Ultra-compact seat/card sizes
- **Touch targets**: Minimum 44px for buttons/tappable areas
- **Safe areas**: Support for notched devices (iPhone X+)

## Error Handling

### Schema Version Mismatch
```typescript
// Detected in WebSocketManager
if (message.schema_version !== expectedSchemaVersion) {
  // Triggers hard reload
  window.location.reload()
}
```

### Table Version Mismatch
```typescript
// Soft reload - requests fresh snapshot
if (message.table_version !== expectedTableVersion) {
  requestSnapshot()
}
```

### Sequence Mismatch
```typescript
// Detects missed deltas
if (message.event_seq !== expectedSeq + 1) {
  requestSnapshot()
}
```

## Security: Hole Card Visibility

**Critical Requirement:** Backend must NEVER send actual hole cards for other players.

Self seat:
```typescript
{
  hole_cards: [
    { rank: 'A', suit: 's' },
    { rank: 'K', suit: 'h' }
  ]
}
```

Other seats:
```typescript
{
  hole_cards: [
    { hidden: true },
    { hidden: true }
  ]
}
```

Frontend never infers or displays card ranks/suits for hidden cards.

## Testing Checklist

- [ ] Connect to table via WebSocket
- [ ] Receive snapshot on connect
- [ ] Receive deltas during gameplay
- [ ] Handle reconnection after disconnect
- [ ] Schema version mismatch triggers reload
- [ ] Table version mismatch requests snapshot
- [ ] Action panel shows correct buttons
- [ ] Raise slider uses backend min/max
- [ ] Timer syncs to action_deadline
- [ ] Cards render correctly (SVG + fallback)
- [ ] Hidden cards show as "XX"
- [ ] Lobby updates via WebSocket
- [ ] Lobby refreshes every 25s
- [ ] Mobile portrait layout works
- [ ] Mobile landscape layout works
- [ ] Touch targets are >=44px
- [ ] Safe area insets work on iPhone
- [ ] Animations play correctly
- [ ] Animations cancel on reconnect

## Known Limitations

1. **Backend Changes Required**: This frontend implementation requires corresponding backend changes to provide normalized state
2. **User Authentication**: Current implementation needs integration with auth context to identify self seat
3. **Pot Display**: Pot rendering needs enhancement for multi-pot scenarios
4. **Hand Results**: Showdown UI needs more detail display
5. **Inter-hand States**: Need UI for inter-hand waiting periods

## Next Steps

1. **Backend Implementation**: Implement normalized state endpoint
2. **Integration Testing**: Test with real backend
3. **Remove Legacy**: Delete old components after verification
4. **Documentation**: Update component documentation
5. **Performance**: Profile and optimize rendering
6. **Accessibility**: Add ARIA labels and keyboard navigation
7. **Internationalization**: Add i18n support to new components

## Component API Reference

### TableView

```typescript
import { TableView } from '@/components/table-new/TableView'

// No props - uses URL param for tableId
<TableView />
```

### ActionPanel

```typescript
import ActionPanel from '@/components/table-new/ActionPanel'

<ActionPanel
  legalActions={state.legal_actions}
  onAction={(action, amount) => sendAction(action, amount)}
  currency="REAL" // or "PLAY"
/>
```

### Seat

```typescript
import Seat from '@/components/table-new/Seat'

<Seat
  seat={seatData}
  actionDeadline={actionDeadline}
  currency="PLAY"
  onClick={() => handleSeatClick()}
/>
```

### LobbyView

```typescript
import { LobbyView } from '@/components/lobby-new/LobbyView'

<LobbyView
  onTableClick={(tableId) => navigate(`/table/${tableId}`)}
/>
```

## Questions & Support

For questions about this migration, refer to:
- `PHASE_5_IMPLEMENTATION.md` (this file)
- `src/types/normalized.ts` (type definitions)
- `src/services/WebSocketManager.ts` (sync logic)
- Problem statement in original GitHub issue
