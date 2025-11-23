# Arena UI Components - Implementation Documentation

## Overview

This document describes the implementation of two immersive arena UI components for the Telegram Mini App poker game:

1. **ActionDock** - Context-aware player action buttons
2. **PlayerAvatarHUD** - Compact avatar with expandable info panels

Both components follow a dark glassmorphism visual style with Framer Motion animations, designed for a fixed viewport poker arena with no scrolling.

## Components

### 1. ActionDock Component

**Location:** `src/components/tables/ActionDock.tsx`

#### Features

- ✅ Appears at the start of each hand with fade-in + slide-up animation
- ✅ Staggered button animations (sequential slide-up/scale-in)
- ✅ Hides at end of hand with fade-out + scale-down
- ✅ Ghost pulse effect after hide (~300ms blur pulse)
- ✅ Glassmorphic dark styling with emerald gradients for primary actions
- ✅ Neon glow effects on primary action buttons
- ✅ Tap-friendly design (min 44px height)
- ✅ Responsive hover/tap animations

#### Props

```typescript
interface ActionDockProps {
  /** Whether a hand is currently active */
  isHandActive: boolean
  /** Available actions for the current player */
  availableActions: ActionType[]
  /** Callback when an action is selected */
  onActionSelect: (action: ActionType) => void
  /** Amount to call (for display on call button) */
  callAmount?: number
  /** Whether actions are currently disabled (e.g., not player's turn) */
  disabled?: boolean
}

type ActionType = 'fold' | 'call' | 'check' | 'raise' | 'allin'
```

#### Styling

- **Container:** `bg-white/10 backdrop-blur-md rounded-2xl border border-white/10`
- **Position:** Fixed bottom-center with `bottom-4` offset
- **Shadow:** Custom `box-shadow: 0 0 40px rgba(0,0,0,0.7)`
- **Primary Actions (Call, Raise, All-in):**
  - Emerald gradient: `bg-gradient-to-r from-emerald-400 to-emerald-500`
  - Text: `text-slate-900`
  - Neon glow: `shadow-[0_0_20px_rgba(16,185,129,0.3)]`
  - Hover glow: `shadow-[0_0_30px_rgba(16,185,129,0.5)]`
- **Secondary Actions (Fold, Check):**
  - Gray glass: `bg-slate-800/70 text-slate-100`
  - Border: `border-white/10`

#### Animations

**Dock Entrance:**
```typescript
initial={{ opacity: 0, y: 40, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 20, scale: 0.9 }}
transition={{ duration: 0.3, ease: 'easeOut' }}
```

**Button Stagger:**
```typescript
initial={{ opacity: 0, y: 10, scale: 0.9 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
transition={{ duration: 0.2, delay: index * 0.05, ease: 'easeOut' }}
```

**Ghost Pulse:**
- Appears after dock hides
- 300ms fade-in, holds at 40% opacity, then fades out over 300ms
- Emerald blur effect: `bg-emerald-300/10 blur-xl`

#### Usage Example

```tsx
import ActionDock from './components/tables/ActionDock'

function PokerTable() {
  const [isHandActive, setIsHandActive] = useState(true)
  
  const handleAction = (action: string) => {
    console.log('Player action:', action)
    // Send action to backend
  }

  return (
    <div className="fixed inset-0">
      {/* Table content */}
      
      <ActionDock
        isHandActive={isHandActive}
        availableActions={['fold', 'call', 'raise', 'allin']}
        onActionSelect={handleAction}
        callAmount={200}
        disabled={!isPlayerTurn}
      />
    </div>
  )
}
```

---

### 2. PlayerAvatarHUD Component

**Location:** `src/components/tables/PlayerAvatarHUD.tsx`

#### Features

- ✅ Compact avatar size (52px diameter, ~60-70% smaller than original)
- ✅ Circular timer ring for turn indication
- ✅ Tap to open floating glass info panel
- ✅ Click outside to close panel
- ✅ Turn pulse animation (scale + opacity loop)
- ✅ Dealer/Winner badge indicators
- ✅ Position-aware info panel placement (top/bottom/left/right)
- ✅ Smooth entrance/exit animations with ease-out-back easing
- ✅ Glassmorphic info panel with proper typography

#### Props

```typescript
interface PlayerAvatarHUDProps {
  player: Player
  positionHint?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

interface Player {
  id: string
  username: string
  initials: string
  avatarUrl?: string
  chips: number
  lastAction?: string
  status: 'WAITING' | 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'OUT'
  isDealer: boolean
  isCurrentTurn: boolean
  turnProgress?: number // 0..1
  isWinner?: boolean
}
```

#### Styling

**Avatar:**
- Size: 52px diameter
- Background: `bg-slate-900/80`
- Border: `border border-white/10`
- Timer ring stroke: 3px width
- Ring colors based on progress:
  - > 50%: `#34d399` (emerald-400)
  - 20-50%: `#fbbf24` (amber-400)
  - < 20%: `#ef4444` (red-500)

**Glow Effects:**
- Winner: `rgba(251, 191, 36, 0.7)` (gold)
- Dealer: `rgba(59, 130, 246, 0.7)` (blue)
- Current turn: `rgba(52, 211, 153, 0.7)` (emerald)

**Info Panel:**
- Background: `bg-slate-800/40 backdrop-blur-md`
- Border: `border-white/10`
- Shadow: `0 20px 60px rgba(0,0,0,0.75)`
- Width: 192px (w-48)
- Typography:
  - Labels: `text-[10px] uppercase tracking-[0.16em] text-slate-300/80`
  - Values: `text-sm text-white`
  - Chips: `font-mono text-xs text-emerald-200`

#### Animations

**Turn Pulse:**
```typescript
animate={{
  scale: [1, 1.05, 1],
  opacity: [1, 0.9, 1],
}}
transition={{
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut',
}}
```

**Info Panel Entrance:**
```typescript
initial={{
  opacity: 0,
  scale: 0.9,
  x: /* offset based on positionHint */,
  y: /* offset based on positionHint */,
}}
animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
transition={{
  duration: 0.25,
  ease: [0.175, 0.885, 0.32, 1.275], // ease-out-back
}}
```

**Info Panel Exit:**
```typescript
exit={{
  opacity: 0,
  scale: 0.95,
  x: /* slight offset toward avatar */,
  y: /* slight offset toward avatar */,
}}
```

#### Usage Example

```tsx
import PlayerAvatarHUD from './components/tables/PlayerAvatarHUD'

function PokerTable() {
  const player = {
    id: '1',
    username: 'John Doe',
    initials: 'JD',
    chips: 5000,
    lastAction: 'Raised 200',
    status: 'ACTIVE',
    isDealer: true,
    isCurrentTurn: true,
    turnProgress: 0.7,
  }

  return (
    <div className="fixed inset-0">
      {/* Position at top of table */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2">
        <PlayerAvatarHUD 
          player={player} 
          positionHint="bottom" 
        />
      </div>
    </div>
  )
}
```

---

### 3. useClickOutside Hook

**Location:** `src/hooks/useClickOutside.ts`

A custom React hook for detecting clicks outside of a referenced element. Used by PlayerAvatarHUD to close the info panel when clicking outside.

#### Usage

```typescript
import { useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'

function Component() {
  const ref = useRef<HTMLDivElement>(null)
  
  useClickOutside(ref, () => {
    console.log('Clicked outside')
    // Close panel, etc.
  })
  
  return <div ref={ref}>Content</div>
}
```

---

## Demo Page

**Location:** `src/pages/ArenaUIDemo.tsx`

A demonstration page showing both components in action with:
- Interactive hand start/stop controls
- 5 player avatars positioned around a virtual table
- Live action dock with all action types
- Simulated turn indicators and dealer/winner badges
- Center pot display for context

**Access:** Navigate to `/demo/arena-ui` in the application.

---

## Technical Stack

- **React 18.2.0** - Functional components with hooks
- **TypeScript 5.2.2** - Full type safety
- **Tailwind CSS 3.3.6** - Utility-first styling
- **Framer Motion 11+** - Smooth animations (newly installed)

---

## Design Principles

### Immersive Arena Feel
- No blocking modals
- All UI feels "in-scene" over poker felt background
- Fixed viewport with no scrolling
- Dark glassmorphism for depth

### Mobile-First Design
- Tap-friendly (44px minimum tap targets)
- Responsive layout
- High contrast for readability
- Optimized for Telegram Mini App constraints

### Visual Hierarchy
- Emerald green for primary actions (poker theme)
- Gold/amber for pot and chips
- White/light text on dark glass backgrounds
- Subtle animations that don't distract from gameplay

### Accessibility
- High contrast ratios
- Clear labels with uppercase tracking
- Visual feedback on all interactions
- Keyboard-friendly (where applicable)

---

## Integration Guide

### Adding to Table.tsx

To integrate these components into the main table view:

1. **Import the components:**
```typescript
import ActionDock from '../components/tables/ActionDock'
import PlayerAvatarHUD from '../components/tables/PlayerAvatarHUD'
```

2. **Track hand state:**
```typescript
const [isHandActive, setIsHandActive] = useState(false)

// Update based on WebSocket events
useEffect(() => {
  if (gameState?.hand_active) {
    setIsHandActive(true)
  } else {
    setIsHandActive(false)
  }
}, [gameState?.hand_active])
```

3. **Map players to HUD format:**
```typescript
const hudPlayers = players.map(p => ({
  id: p.user_id.toString(),
  username: p.username || 'Unknown',
  initials: getInitials(p.username),
  chips: p.stack,
  lastAction: p.lastAction,
  status: p.in_hand ? 'ACTIVE' : 'FOLDED',
  isDealer: p.is_button,
  isCurrentTurn: p.user_id === currentPlayerTurn,
  turnProgress: p.turnProgress,
}))
```

4. **Render components:**
```tsx
{/* Player avatars */}
{hudPlayers.map((player, index) => (
  <PlayerAvatarHUD
    key={player.id}
    player={player}
    positionHint={getPositionHint(index, hudPlayers.length)}
  />
))}

{/* Action dock */}
<ActionDock
  isHandActive={isHandActive}
  availableActions={getAvailableActions()}
  onActionSelect={handlePlayerAction}
  callAmount={amountToCall}
  disabled={!isPlayerTurn}
/>
```

---

## File Structure

```
telegram_poker_bot/frontend/src/
├── components/
│   └── tables/
│       ├── ActionDock.tsx          # Action dock component
│       └── PlayerAvatarHUD.tsx     # Player avatar HUD component
├── hooks/
│   └── useClickOutside.ts          # Click outside detection hook
└── pages/
    └── ArenaUIDemo.tsx             # Demo/showcase page
```

---

## Browser Support

- Modern browsers with ES6+ support
- Chrome 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Performance Considerations

- Framer Motion animations are GPU-accelerated
- Click outside handler uses event delegation
- Components use React.memo where appropriate
- Minimal re-renders through proper state management
- Animations can be disabled via `prefers-reduced-motion` media query

---

## Future Enhancements

Potential improvements:
- [ ] Sound effects on actions
- [ ] Haptic feedback on mobile
- [ ] More action types (bet presets, quick actions)
- [ ] Avatar customization
- [ ] Emote/reaction system
- [ ] Action history display
- [ ] Statistics in player panel

---

## License

Part of the PokerKit Telegram Mini App - MIT License
