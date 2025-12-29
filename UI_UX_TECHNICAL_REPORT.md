# Technical + UI/UX Report — Telegram Poker Mini App

**Date:** December 2024  
**Prepared For:** Professional Prompt Engineer  
**Purpose:** Pre-modification analysis for UI/UX improvement instructions

---

## --- PROJECT SUMMARY ---

This is a full-stack Telegram Mini App poker game with a React/Vite frontend, FastAPI backend, and PostgreSQL/Redis data layer. The project is maintained by a non-programmer using AI agents and has gone through 8 development phases including template-driven tables, analytics, variant-aware frontend, and deployment optimization.

The frontend is a mobile-first poker game experience designed to run within Telegram's WebApp container. It supports multiple poker variants (Texas Hold'em, Short Deck, Omaha, Draw), multilingual interface (English/Farsi), and real-time WebSocket communication for gameplay.

---

## --- TECH STACK ---

### Framework & Language
- **Framework:** React 18 with Vite 5
- **Language:** TypeScript (strict mode, tsx components)
- **Bundler:** Vite with React plugin
- **Node Version:** 18+ (per package.json requirements)

### Styling System
- **Primary:** Tailwind CSS 3.3.6
- **Design Tokens:** Custom CSS variables in `design-tokens.css`
- **Additional Styles:** 
  - `index.css` (Tailwind base + component classes)
  - `mobile.css` (responsive breakpoints)
  - `table-layout.css` (poker table specific layout)
  - `animations.css` (keyframes and transitions)
- **Approach:** Hybrid - Tailwind utilities + CSS variables + inline styles for dynamic theming

### State Management
- **Global:** Zustand 4.4.7 (lightweight store)
- **Context Providers:**
  - `TelegramProvider` - Telegram WebApp SDK integration
  - `LocalizationProvider` - i18n with react-i18next
  - `ThemeProvider` - Dark/light mode support
  - `UserDataProvider` - User balance, stats, profile
  - `LayoutProvider` - Bottom nav visibility control
- **Local:** useState, useReducer, useRef for component-level state
- **API State:** Custom hooks (useLobbySync, useTableWebSocket)

### Key Dependencies
- `@telegram-apps/sdk` - Telegram Mini App SDK integration
- `react-router-dom` 6.20 - Routing
- `i18next` + `react-i18next` - Internationalization
- `axios` - HTTP client
- `lucide-react` + `@fortawesome` - Icons
- `canvas-confetti` - Win celebrations
- `clsx` - Conditional classes

---

## --- APP STRUCTURE ---

### Entry Points
- **HTML Entry:** `index.html`
- **JS Entry:** `src/main.tsx` (React root render)
- **App Root:** `src/App.tsx` (Router + Provider tree)

### Routing System
- **Library:** React Router DOM v6
- **Pattern:** Nested routes with `<Outlet />`
- **Main Layout:** `MainLayout.tsx` wraps most routes (header + bottom nav)
- **Key Routes:**
  - `/` → Home page (quick actions, active tables)
  - `/lobby` → Public tables list
  - `/table/:tableId` → Game table (immersive, no nav)
  - `/games/create` → Create new table
  - `/games/join` → Join via code/QR
  - `/profile`, `/wallet`, `/stats` → User pages
  - `/admin/*` → Admin dashboard (protected)

### Main Layout Components
- `MainLayout.tsx` - Header with avatar/balance + bottom navigation
- `PokerFeltBackground.tsx` - Game background gradient
- `AppBackground.tsx` - App-wide background
- `OrientationGuard.tsx` - Landscape mode enforcement overlay

### UI Component Hierarchy
```
App.tsx (Providers)
├── MainLayout.tsx (Header + BottomNav + Outlet)
│   ├── Home.tsx (Quick actions, active tables)
│   ├── LobbyNew.tsx → LobbyView → LobbyRow[]
│   ├── Profile.tsx, Wallet.tsx, Stats.tsx
│   └── Table.tsx (Immersive game view)
│       ├── PokerFeltBackground
│       ├── CommunityBoard (pot, cards)
│       ├── PlayerSeat[] (avatar, cards, timer)
│       └── ActionBar (fold, check, call, raise)
└── AdminDashboard (separate layout)
```

### Component Directories
- `components/ui/` - Reusable primitives (Button, Card, Modal, Badge, etc.)
- `components/table/` - Poker table components
- `components/lobby-new/` - Lobby list components
- `components/background/` - Background renders
- `components/layout/` - Layout utilities (PlaySheet)
- `legacy/ui/table-legacy/` - Older table components still in use

---

## --- CURRENT UI/UX ASSESSMENT ---

### Overall UI Quality Level: **Average to Good**

The application demonstrates a solid foundation with a modern glassmorphism design language, but shows signs of incremental development with some visual inconsistencies and mobile UX gaps.

### Visual Consistency

**Strengths:**
- Unified color palette via CSS design tokens (`--color-accent`, `--color-text`, etc.)
- Consistent glassmorphism aesthetic (semi-transparent backgrounds, subtle borders)
- Good use of gradients for primary actions (emerald gradient CTAs)
- Farsi/RTL support built into the design system

**Weaknesses:**
- Mixing inline styles with Tailwind classes creates maintenance overhead
- Some components use hardcoded color values instead of design tokens
- Legacy components in `legacy/` folder have different styling patterns
- Inconsistent button styling between pages (some use `Button` component, others raw buttons)

### Typography

**Strengths:**
- Font scale defined in design tokens
- Vazirmatn font for Farsi support
- Responsive text sizes (`text-xs sm:text-sm`)

**Weaknesses:**
- Very small base font sizes on mobile (10-12px common)
- Some text truncation without indication
- Line heights may be tight for touch readability

### Spacing & Touch Targets

**Strengths:**
- Mobile-first responsive breakpoints
- Safe area support for notched devices
- Touch-friendly 44px minimum targets in some areas

**Weaknesses:**
- Inconsistent padding/margin values across components
- Some buttons have heights below 44px minimum touch target
- Action bar buttons (fold/check/raise) may be cramped on small screens
- Slider thumb size may be difficult to grab precisely

### Layout Stability

**Strengths:**
- CSS Grid used for tile layouts
- Flexbox for responsive alignment
- Viewport-height based table positioning

**Weaknesses:**
- Percentage-based absolute positioning for seats can cause overlap
- Safe area calculations complex and potentially buggy
- Portrait/landscape transitions may cause layout jumps

### Navigation Clarity

**Strengths:**
- Clear bottom navigation with icons + labels
- "Play" FAB button prominent for main action
- Table page hides nav for immersive experience

**Weaknesses:**
- Back navigation on table page is small (40px) and low contrast
- Menu capsule button requires tap to reveal table info
- No breadcrumbs or clear hierarchy indication

### Poker Table / Game Area

**Strengths:**
- Hero-centric seat rotation (player always at bottom)
- Dynamic seat layout based on player count
- Circular timer around active player
- Card fanning with directional awareness

**Weaknesses:**
- Table oval may be too small on narrow screens
- Pot/board area competes with seat positions
- Action bar may obscure bottom seats
- Winner display timing may be abrupt

---

## --- IDENTIFIED UI/UX PROBLEMS ---

### Layout Issues
- Seat positions use percentage-based absolute positioning which can cause overlap on narrow viewports
- Table oval aspect ratio is fixed, doesn't adapt well to various screen ratios
- Action bar (ActionBar.tsx) is fixed at bottom but may overlap bottom seats
- Header capsule menu dropdown can overflow viewport on small screens
- Portrait mode shows rotation overlay, blocking all content rather than adapting layout

### Typography Issues
- Very small font sizes used throughout (9px, 10px, 11px common)
- Player names truncated at 70px max-width without ellipsis indicator
- Chip counts use shorthand (k, m) but may be unclear to casual players
- Position labels (BTN, SB, BB) use abbreviations that may confuse newcomers
- Action button labels may be too small for quick glance recognition

### Spacing & Sizing Issues
- PlayerSeat component fixed at 86x104px regardless of screen size
- Action bar buttons (fold/check/call) at 40px height, below iOS recommended 44px
- Raise slider thumb is 22px, may be difficult to drag precisely on mobile
- Card sizes (PlayingCard) don't scale with viewport
- Gaps between seats inconsistent (1.5rem hardcoded)

### Interaction / Usability Issues
- No haptic feedback on button presses
- Double-tap protection exists but may feel sluggish
- Raise slider requires precision drag - no preset buttons (1/2 pot, pot, all-in)
- "Sit Here" CTA only appears on hover (mobile needs tap state)
- Empty seat tap target is same size as occupied seats (no visual affordance)
- Stand up/leave toggle uses small text that may be missed
- Inter-hand countdown bar is thin (1.5px) and may not be noticed

### Performance & Animation Issues
- Chip fly animations may cause jank on low-end devices
- Multiple setTimeout timers for turn deadlines could accumulate
- WebSocket reconnection may cause state flicker
- Card reveal animations not clearly defined
- No loading skeleton states - content pops in abruptly

---

## --- CONSTRAINTS & RISKS ---

### Tightly Coupled to Game Logic
- `Table.tsx` is a 2600+ line monolith tightly coupled to:
  - WebSocket message handling
  - Seat assignment logic
  - Turn validation (`TurnContext`)
  - Action submission flow
- PlayerSeat props are deeply tied to game state structure
- ActionBar directly uses `AllowedAction` types from game engine
- Any UI changes to game area require understanding WebSocket message shapes

### High-Risk Areas (Changes May Break Functionality)
- `handleGameAction()` function - action submission with anti-double-tap protection
- `applyIncomingState()` - state merge logic with card caching
- Seat rotation calculation (`rotationOffset`, `normalizedSeats`)
- Turn timer logic (`autoActionTimerRef`, `actionDeadlineMs`)
- Hero card extraction logic (multiple fallback sources)

### Safe Areas for Visual Refactor
- Home page (`Home.tsx`) - Mostly presentational
- Lobby view (`LobbyView.tsx`, `LobbyRow.tsx`) - Table list rendering
- All `components/ui/*` primitives - Button, Card, Badge, Modal
- Design tokens in `design-tokens.css` - Global color/spacing values
- MainLayout header and bottom nav styling
- Profile, Wallet, Stats pages - Mostly static display

### Technical Debt Affecting UI
- Legacy folder (`legacy/ui/`) contains components still actively used
- Mixed styling approaches (Tailwind + CSS variables + inline styles)
- Some components use raw CSS class strings instead of design tokens
- Admin components may have different styling than player-facing pages
- Internationalization keys not consistently organized
- Some hardcoded strings remain untranslated

---

## --- QUESTIONS FOR PROMPT ENGINEER ---

1. **Scope of Changes:** Is the goal purely visual polish (colors, spacing, typography), or can layout structure be changed (e.g., action bar position, seat arrangement)?

2. **Design Reference:** Are there reference poker apps or design systems to match? (PokerStars, WSOP, custom design spec?)

3. **Telegram Constraints:** Should the app remain landscape-only, or should portrait mode have a simplified but functional UI?

4. **Component Preservation:** Should the legacy components (`legacy/ui/`) be refactored into new components, or only styled in place?

5. **Animation Budget:** Are complex animations (chip fly, card deal) acceptable, or should they be minimized for performance?

6. **Touch Target Requirements:** Should all interactive elements meet WCAG 44x44px touch target minimums?

7. **Typography Scale:** What are the minimum acceptable font sizes? Current uses 9-10px which is below accessibility standards.

8. **Color System:** Should the current green/emerald poker theme be preserved, or is a redesign of the color palette acceptable?

9. **Farsi/RTL Priority:** How important is RTL layout correctness versus LTR polish?

10. **Admin vs Player:** Should admin dashboard UI be modernized alongside player-facing UI, or is it out of scope?

11. **Testing Approach:** Are visual regression tests or screenshot comparisons available to validate changes?

12. **Breakpoint Strategy:** Should the app support desktop/tablet views, or remain strictly mobile-focused?

13. **Performance Testing:** What methodology should be used to verify UI changes don't degrade performance? (Lighthouse scores, specific FPS targets?)

14. **Browser Compatibility:** Which browsers/versions must be supported? (Telegram WebView, Chrome, Safari Mobile?)

---

*End of Report*

*This document is intended to be copied verbatim and provided to a professional prompt engineer for creating detailed modification instructions.*
