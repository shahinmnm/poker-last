# Poker Table UI Components

This directory contains the redesigned poker table UI components for the Telegram Mini App. These components implement a modern, glassmorphism-based design with animations and proper state management.

## Design System

### Design Tokens
All components use the centralized design token system located in `/design/tokens.ts`. This includes:
- Colors (backgrounds, glass surfaces, state colors)
- Typography (font sizes, weights, families)
- Spacing (consistent spacing scale)
- Border radii
- Effects (blur, shadows, glows)
- Animation timings and easings
- Layout configurations (polar coordinates for seat positioning)

### Animations
Animation keyframes are defined in `/design/animations.css` and include:
- Turn ring glow pulse
- Card dealing and reveal
- Chip movement
- Seat enter/appear
- Empty seat pulse
- Pot grow
- Winner glow

## Components

### Seat
**File:** `Seat.tsx`

A reusable poker seat component with multiple variants.

**Variants:**
- `hero` - The current player (always at bottom center)
- `active` - Active players in the hand
- `waiting` - Players waiting for next hand
- `folded` - Players who have folded
- `empty` - Empty seat (joinable)
- `offline` - Offline players

**Features:**
- Circular glass card design
- Avatar with initials fallback
- Player name and chip stack display
- Position labels (BTN, SB, BB)
- Status pills (FOLD, ALL-IN, SITTING OUT, OFFLINE)
- Turn ring animation for active player
- Gradient border for hero
- "YOU" label for hero

**Usage:**
```tsx
<Seat
  variant="hero"
  name="Player Name"
  chipStack={5000}
  seatNumber={0}
  positionLabel="BTN"
  statusPill="ALL-IN"
  isMyTurn={true}
  size="mobile"
/>
```

### BetPill
**File:** `BetPill.tsx`

Displays the current bet amount for a player, positioned closer to the table center.

**Features:**
- Glass pill design
- Chip icon (FontAwesome)
- Formatted amount display

**Usage:**
```tsx
<BetPill amount={250} />
```

### TableRing
**File:** `TableRing.tsx`

The outer glowing ring and inner table surface providing the stadium-shaped table.

**Features:**
- Gradient stroke
- Glowing effect
- Inner dark surface
- Stadium/elliptical shape

**Usage:**
```tsx
<TableRing>
  {/* Table content */}
</TableRing>
```

### PotDisplay
**File:** `PotDisplay.tsx`

Shows the main pot and optional side pots with orange/red gradient background.

**Features:**
- Main pot with prominent display
- Side pots with labels
- Gradient background
- Glow effect
- Grow animation on update

**Usage:**
```tsx
<PotDisplay
  mainPot={1500}
  sidePots={[
    { amount: 200, label: 'Side Pot 1' },
    { amount: 100, label: 'Side Pot 2' },
  ]}
/>
```

### CommunityCards
**File:** `CommunityCards.tsx`

Displays flop, turn, and river cards with placeholders and reveal animations.

**Features:**
- 5 card slots
- Placeholder cards before dealing
- Staggered reveal animation (120ms delay)
- Card highlighting for winning hands
- Auto-resets on new hand

**Usage:**
```tsx
<CommunityCards
  cards={['Ah', 'Kd', 'Qc', 'Jh', 'Ts']}
  highlightedCards={['Ah', 'Kd', 'Qc']}
  maxCards={5}
/>
```

### TableLayout
**File:** `TableLayout.tsx`

The main table layout container with blue glassmorphism background.

**Features:**
- 4:3 aspect ratio container
- Blue gradient background with radial glow
- Position: relative for polar coordinates
- Responsive design
- Organized layers (infoPill, players, board, hero, action, overlays)

**Usage:**
```tsx
<TableLayout
  infoPill={<TableInfoComponent />}
  board={<BoardAndPotComponent />}
  players={<PlayerRingComponent />}
  hero={<HeroSeatComponent />}
  action={<ActionBarComponent />}
  overlays={<ModalsAndOverlays />}
/>
```

### PlayerRing
**File:** `PlayerRing.tsx`

Positions players using polar coordinates, ensuring hero is always at bottom center.

**Features:**
- Polar coordinate positioning
- Automatic rotation (hero always at 6 o'clock)
- Supports 2-8 player tables
- Pre-configured layouts for heads-up and 6-max
- Smooth transitions

**Usage:**
```tsx
<PlayerRing
  players={playerEntries}
  slotCount={6}
  heroSeatIndex={0}
/>
```

### ActionBar
**File:** `ActionBar.tsx`

Enhanced action bar with proper color semantics and bet slider.

**Features:**
- FOLD: neutral/dark styling
- CHECK/CALL: primary blue
- BET/RAISE: CTA orange/red gradient
- Bet slider with quick-bet buttons (1/2 pot, pot, max)
- Disabled states
- Hover effects

**Usage:**
```tsx
<ActionBar
  allowedActions={[
    { action_type: 'fold' },
    { action_type: 'call', amount: 200 },
    { action_type: 'raise', min_amount: 400, max_amount: 5000 },
  ]}
  onAction={handleAction}
  isProcessing={false}
  potSize={650}
  myStack={5000}
  isMyTurn={true}
/>
```

## Demo Page

Visit `/demo/table` to see all components in action with interactive controls.

**Demo Features:**
- Switch between 6-max and heads-up layouts
- Change active player
- View different seat states
- Interactive bet slider
- Live component updates

## Integration Notes

### With Existing Table Page

The new components are designed to work alongside the existing table components. To integrate:

1. Import the new components:
```tsx
import {
  TableLayout,
  PlayerRing,
  Seat,
  BetPill,
  PotDisplay,
  CommunityCards,
  ActionBar,
} from '@/components/poker'
```

2. Replace existing layout with `TableLayout`
3. Use `PlayerRing` to position seats
4. Wrap player components with the new `Seat` component
5. Add `BetPill` near each player showing current bet
6. Replace pot/board display with `PotDisplay` and `CommunityCards`
7. Use the enhanced `ActionBar` for hero actions

### Animation Triggers

Animations are triggered by CSS classes and component state changes:
- **Turn ring**: Activates when `isMyTurn={true}` on a `Seat`
- **Card reveal**: Automatically staggers when `cards` prop changes
- **Seat enter**: Plays on mount with CSS class
- **Pot grow**: Plays when pot amount changes

### Performance

Components are optimized for low-end Telegram clients:
- Minimal box-shadows during animations
- Controlled blur usage
- CSS-based animations (GPU accelerated)
- Memoized calculations
- Efficient re-renders

## Styling

All components use:
- Design tokens from `/design/tokens.ts`
- TailwindCSS utility classes
- Inline styles for dynamic values
- CSS custom properties where appropriate

## Browser Support

Compatible with:
- Modern mobile browsers (iOS Safari 14+, Chrome 90+)
- Telegram Mini App WebView
- Desktop browsers for development

## Future Enhancements

Potential improvements:
- Optional BetSlider component with neon track
- Advanced chip movement animations (parabolic trajectories)
- Sound effects integration
- Haptic feedback for mobile
- Dark/light theme variants
- Accessibility improvements (ARIA labels, keyboard navigation)
