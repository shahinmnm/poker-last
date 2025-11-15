# Design System & UI/UX Refactor - Poker Mini App

## Current Architecture Summary

### Frontend Stack
- **Framework**: React 18.2 with TypeScript 5.2
- **Build Tool**: Vite 5.0
- **Routing**: React Router DOM v6.20 with nested routes
- **Styling**: Tailwind CSS 3.3 + CSS Custom Properties
- **Theming**: Custom ThemeProvider with dark/light modes
- **Internationalization**: react-i18next with English and Farsi (RTL support)
- **API Communication**: Axios + custom apiClient + WebSocket for real-time updates
- **State Management**: Local component state (Zustand available but minimal usage)

### File Structure
```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── SectionHeader.tsx
│   │   └── SegmentedControl.tsx
│   ├── MainLayout.tsx   # App shell with header + bottom nav
│   ├── LanguageSelector.tsx
│   └── Toast.tsx
├── pages/               # Route pages
│   ├── Home.tsx         # Dashboard/welcome
│   ├── Lobby.tsx        # Browse public tables
│   ├── CreateGame.tsx   # Table creation form
│   ├── Table.tsx        # Active table view
│   ├── Settings.tsx
│   ├── Profile.tsx
│   ├── Stats.tsx
│   └── ...
├── providers/           # Context providers
│   ├── ThemeProvider.tsx
│   └── LocalizationProvider.tsx
├── services/            # API services
│   └── tables.ts
└── utils/
    ├── apiClient.ts
    └── cn.ts
```

### Routing Structure
- `/` - Home (quick actions, stats, menu cards)
- `/lobby` - Public tables list + my tables
- `/games/create` - Table creation (with ?visibility=public|private param)
- `/table/:tableId` - Active table view
- `/profile`, `/wallet`, `/settings`, etc.

### Current Design System

#### Colors (CSS Variables)
**Dark Mode** (default):
- `--app-background`: Radial gradient (dark blue/navy)
- `--surface-base`: rgba(16, 20, 31, 0.92)
- `--surface-overlay`: rgba(25, 31, 47, 0.78)
- `--surface-border`: rgba(255, 255, 255, 0.08)
- `--text-primary`: #f5f7ff
- `--text-muted`: rgba(199, 207, 232, 0.72)
- `--accent-start`: #5b8dff (blue)
- `--accent-end`: #a855f7 (purple)
- `--accent-soft`: rgba(91, 141, 255, 0.45)

**Light Mode**:
- `--app-background`: Radial gradient (light blue/gray)
- `--surface-base`: rgba(255, 255, 255, 0.95)
- `--text-primary`: #0f172a
- `--accent-start`: #2563eb
- (similar tokens but adjusted for light background)

#### Typography
- Font: Inter, with system fallbacks
- Current heading sizes are too large on mobile (text-2xl becomes 2+ lines)
- No dedicated Farsi font defined yet
- Tracking/letter-spacing used for uppercase labels

#### Components
- **Card**: `.app-card` with glass morphism, rounded corners (26px), gradient accent line
- **Button**: `.app-button` with variants (primary, secondary, ghost) and sizes (md, lg)
- **SegmentedControl**: Pill-style toggle for Private/Public selection
- **Bottom Nav**: Fixed navigation with 5 items (Home, Lobby, Create, Wallet, Profile)

## UX/UI Problems Identified

### 1. Table Creation Flow Issues
**Problem**: Multiple confusing entry points
- Home page has two buttons: "Public Game" and "Private Game" - both go to `/games/create` with different query params
- Lobby page has "Create table" link
- Separate "Create Game" page in bottom nav
- Users don't understand the difference between private and public

**Impact**: Confusion about where to create a table and what visibility means

### 2. Theme Inconsistency
**Problem**: Not all pages use design tokens
- Settings page uses hardcoded Tailwind classes like `bg-white dark:bg-gray-800` instead of `var(--surface-base)`
- Light mode may accidentally show dark-themed elements
- Some components ignore the theme context

**Impact**: Jarring experience when switching themes or visiting different pages

### 3. Typography Issues
**Problem**: Text sizing and wrapping
- Page titles use `text-2xl` which wraps to 2 lines on mobile (320-375px width)
- Farsi text uses same font as English, causing readability issues
- No responsive typography scale
- Farsi titles overflow containers due to different character widths

**Impact**: Unprofessional appearance, especially on mobile devices used by most Telegram users

### 4. Button & Color Inconsistency
**Problem**: Too many ad-hoc button styles
- Some buttons use `app-button`, others use Tailwind classes directly
- No "glow" variant for emphasized CTAs
- Inconsistent hover states

**Impact**: No clear visual hierarchy for primary actions

### 5. Table Status Visibility
**Problem**: Low-contrast status indicators
- Status badges use subtle colors that blend into card backgrounds
- "Running", "Waiting", "You are the host" text is hard to notice
- No icons or visual accents

**Impact**: Users miss important status information

### 6. Game Start & Host Controls
**Problem**: Missing or broken functionality
- Start game button disables but game doesn't start
- No minimum player validation (need 2+ players)
- Host cannot delete a table
- No confirmation dialogs for destructive actions

**Impact**: Frustrated users, stuck tables, bad UX

### 7. Icon Alignment
**Problem**: Settings gear icon not centered
- Icon appears slightly off-center in the button
- Touch target might be too small

**Impact**: Minor visual polish issue

## Target Architecture & Design Direction

### Design Reference Inspiration
Taking cues from:
- **Dev Boost Starters** template: Clean cards, strong hierarchy, modern spacing
- **Figma/Screenshot reference**: Dark glassy aesthetic, rounded cards, gradient accents, bottom nav

### Core Principles
1. **Consistency**: One design language across all pages
2. **Clarity**: Make table visibility, status, and actions obvious
3. **Mobile-first**: Optimize for Telegram's mobile users
4. **Theming**: Perfect dark/light mode with no leakage
5. **Accessibility**: Touch targets, contrast, RTL support
6. **Performance**: Keep it fast, minimal re-renders

### Enhanced Design System

#### Typography Scale
```css
/* English */
--font-display: 'Inter', system-ui;
--text-xs: 0.75rem;      /* 12px - labels, captions */
--text-sm: 0.875rem;     /* 14px - body, descriptions */
--text-base: 1rem;       /* 16px - primary body */
--text-lg: 1.125rem;     /* 18px - card headings */
--text-xl: 1.25rem;      /* 20px - section titles (mobile) */
--text-2xl: 1.5rem;      /* 24px - page titles (mobile) */
--text-3xl: 1.875rem;    /* 30px - page titles (desktop) */

/* Farsi - use a web font with proper metrics */
--font-farsi: 'Vazirmatn', 'Inter', system-ui;
/* Increase line-height for Farsi: 1.7 vs 1.5 */
```

#### Component Additions Needed
1. **Badge Component**: For status, visibility, role indicators
2. **GlowButton**: Primary button with stronger emphasis
3. **ConfirmDialog**: For delete table, leave game, etc.
4. **StatusIndicator**: Colored dot + text for table state
5. **TableCard**: Standardized table summary card

#### Layout Patterns
- **Page Container**: max-w-4xl centered, consistent padding
- **Section Spacing**: 6-7 units between major sections
- **Card Grid**: responsive grid for menu items, table lists
- **Form Layout**: Consistent field spacing, clear labels

### Unified Table Creation UX

**New Flow**:
1. Single "Create Table" button on Home and Lobby pages
2. Opens `/games/create` (no query params needed)
3. Form includes:
   - Table name (optional, generates default)
   - Visibility toggle: Private ↔ Public (with clear explanations)
   - Stakes: Small blind, Big blind
   - Max players (2-9)
   - Starting stack
   - Auto-seat host checkbox
4. On success:
   - Show table ID, invite code (if private)
   - "Open Table" button
   - "Share Invite" button (if private)
   - "Back to Lobby" link

**Visibility Explanations**:
- **Private**: Only people with the invite link can join. Not shown in lobby.
- **Public**: Anyone can find and join this table in the lobby.

### Table Page Enhancements

**Status & Info**:
- Large, colorful status badge at top (Running, Waiting, Starting)
- "You are the host" badge (if applicable)
- "Seated at position X" badge (if seated)
- Player count with progress indicator
- Clear blinds and stack info

**Host Controls** (visible only to host):
- "Start Game" button:
  - Disabled if < 2 players (with tooltip: "Need at least 2 players")
  - Shows loading spinner when clicked
  - On success: updates table status to Running
  - On error: shows toast with message
- "Delete Table" button (secondary, destructive):
  - Opens confirmation dialog: "Are you sure? This cannot be undone."
  - On confirm: deletes table, redirects to lobby
  - Shows toast on error

**Player Actions**:
- "Take Seat" button (if not seated and seats available)
- "Leave Table" button (if seated)
- Loading states for all actions

### Theme Fixes

**Settings Page Refactor**:
- Replace all `bg-white dark:bg-gray-800` with `bg-[color:var(--surface-base)]`
- Use consistent card styling: `.app-card`
- Use Button component instead of custom classes
- Test in both light and dark modes

**Light Mode Polish**:
- Verify no "dark" styling appears in light mode
- Check contrast ratios for all text
- Test gradient backgrounds

### RTL/Farsi Support

**Font Loading**:
```css
@import url('https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css');
```

**Typography Classes**:
```tsx
<h1 className="text-xl sm:text-2xl font-semibold [font-family:var(--font-farsi)]">
  {t('title')}
</h1>
```

**Layout Adjustments**:
- Use logical properties: `padding-inline`, `margin-inline-start`
- Test icon placement in RTL
- Verify bottom nav stays correct

## Implementation Plan

### Phase 1: Foundation
1. Add Farsi font support to index.css
2. Enhance typography scale with responsive tokens
3. Create Badge component
4. Add "glow" button variant

### Phase 2: Pages Refactor
1. Settings page: Use design tokens consistently
2. Lobby page: Enhance table cards with new Badge component
3. CreateGame page: Clarify visibility toggle UI
4. Table page: Add host controls, fix start button

### Phase 3: Table Creation Flow
1. Update Home page CTAs to single "Create Table"
2. Remove visibility query param logic (move to state)
3. Test end-to-end flow

### Phase 4: Testing
1. Test dark mode on all pages
2. Test light mode on all pages
3. Test Farsi locale + RTL
4. Test on mobile viewports (320px, 375px, 414px)
5. Screenshot major changes

### Phase 5: Polish
1. Fix icon alignment
2. Add micro-interactions
3. Verify accessibility (touch targets, focus states)
4. Final smoke test

## Success Metrics
- ✅ Single, clear table creation flow
- ✅ Consistent theming across all pages
- ✅ No text wrapping issues on mobile
- ✅ Farsi text renders beautifully
- ✅ Table status is immediately obvious
- ✅ Host can delete tables safely
- ✅ Start game enforces rules (2+ players)
- ✅ All buttons use consistent styles
- ✅ Settings gear icon is centered

## Next Steps
1. Review this document with stakeholders
2. Create components in order of dependency
3. Refactor pages one at a time
4. Test incrementally
5. Document any deviations from plan
