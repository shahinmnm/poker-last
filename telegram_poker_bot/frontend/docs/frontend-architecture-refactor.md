# Frontend Architecture Refactor - Analysis

## Current Structure

### Key Directories
- **src/pages/**: All page components (Home, Lobby, CreateGame, Table, Settings, Stats, Profile, Wallet, Help, GroupInvite, GroupJoin, JoinGame)
- **src/components/**: Shared components
  - `MainLayout.tsx`: Main app layout with header and bottom navigation
  - `ui/`: Reusable UI components (Button, Card, Badge, SectionHeader, SegmentedControl)
  - `LanguageSelector.tsx`, `Toast.tsx`
- **src/providers/**: Context providers (ThemeProvider, LocalizationProvider)
- **src/hooks/**: Custom hooks (useTelegram)
- **src/services/**: API services
- **src/utils/**: Utility functions
- **src/i18n/**: Internationalization setup
- **src/locales/**: Translation files

### Current Routing
App uses React Router with:
- Main layout wrapping most pages (Home, Lobby, Games, Profile, Wallet, Settings, Help, Group pages)
- Table page rendered outside main layout (`/table/:tableId`)

### Current Theme System
**GOOD FOUNDATION ALREADY EXISTS:**

1. **CSS Variables** (`src/index.css`):
   - Already has comprehensive theme tokens:
     - `--app-background`, `--surface-base`, `--surface-overlay`, `--surface-border`
     - `--text-primary`, `--text-muted`
     - `--accent-start`, `--accent-end`, `--accent-soft`
     - `--shadow-elevated`, `--shadow-button`, `--shadow-glow`
     - `--nav-background`, `--nav-border`
   - Dark/Light mode via `[data-theme]` attribute
   - Farsi font support via `--font-farsi`

2. **Tailwind Config** (`tailwind.config.js`):
   - Basic setup with `darkMode: 'media'`
   - No extended theme tokens yet

3. **ThemeProvider** (`src/providers/ThemeProvider.tsx`):
   - Manages theme mode (light/dark)
   - Syncs with Telegram color scheme
   - Persists to localStorage
   - Applies `data-theme` attribute

4. **UI Components** (already exist but need enhancements):
   - **Button** (`src/components/ui/Button.tsx`): Has variants (primary, secondary, ghost), sizes (md, lg), glow option
   - **Card** (`src/components/ui/Card.tsx`): Has variants (surface, overlay), padding options
   - **Badge** (`src/components/ui/Badge.tsx`): Has variants (primary, secondary, success, warning, info, muted), sizes
   - **SectionHeader** (`src/components/ui/SectionHeader.tsx`): Simple title/subtitle/action layout
   - **SegmentedControl**: Already exists for tab-like selection

### Current Issues

1. **Missing Components**:
   - No dedicated `PageHeader` component (pages use raw `<h1>` with inconsistent styling)
   - No `danger` variant for Button (delete actions use ghost + custom text color)
   - No unified app shell (MainLayout is good but Table page bypasses it)

2. **Inconsistent Usage**:
   - Table page doesn't use MainLayout (has its own back button implementation)
   - Some pages use raw `<h1>` tags instead of consistent header component
   - Button sizes not always consistent across pages

3. **Missing Logic Features**:
   - No minimum 2-player check clearly visible in Table page start button
   - Delete table functionality exists but uses confirmation in inline component
   - Table.tsx is 600+ lines - could benefit from component extraction

4. **Typography**:
   - No explicit text utility classes defined
   - Relies on inline Tailwind classes like `text-xl`, `text-2xl`
   - No clear type scale definition

5. **Farsi/RTL Support**:
   - Font defined but line-height could be optimized
   - No explicit RTL layout testing visible

## Current Pages Mapping

### Routes with MainLayout:
- `/` - **Home**: Hero section, stats, primary actions (create game), menu cards, how it works
- `/lobby` - **Lobby**: My tables section, available tables section, refresh functionality
- `/games/create` - **CreateGame**: Form for creating new table (visibility, blinds, stack, players)
- `/games/join` - **JoinGame**: Join by code
- `/group/invite` - **GroupInvite**: Group invitation flow
- `/group/join/:gameId?` - **GroupJoin**: Join via group link
- `/profile` - **Profile**: User profile
- `/profile/stats` - **Stats**: User statistics
- `/wallet` - **Wallet**: Wallet management
- `/settings` - **Settings**: Language, theme toggle, notifications
- `/help` - **Help**: Help page

### Routes without MainLayout:
- `/table/:tableId` - **Table**: In-game table view with players, actions (sit, leave, start, delete)

## Strengths
✅ Good CSS variable foundation for theming
✅ Existing Button, Card, Badge components with variants
✅ ThemeProvider working well
✅ Consistent use of components in most pages
✅ Clean separation of concerns (pages, components, services)
✅ Farsi font already integrated

## Issues to Address

### Critical
1. **Add PageHeader component** for consistent page titles across all pages
2. **Add `danger` variant to Button** for destructive actions
3. **Add `sm` size to Button** for compact actions
4. **Unify Table page into MainLayout** - remove custom back button, use AppShell
5. **Enforce minimum 2 players for start game** - make it visually clear with disabled state + message
6. **Extract table delete confirmation** into reusable Modal component

### Important
7. **Define typography scale** in Tailwind config and create utility classes
8. **Optimize Farsi line-height** and test RTL layouts
9. **Create unified spacing** tokens in Tailwind config
10. **Document theme tokens** and usage patterns

### Nice to Have
11. **Extract large Table.tsx** into smaller components
12. **Add loading states** consistency across pages
13. **Add error states** consistency across pages

## Refactor Plan

### Phase 1: Enhance Design System (STEP 1-2)
- [x] Analyze current structure
- [ ] Update Tailwind config with semantic color tokens
- [ ] Define typography scale
- [ ] Add `sm` size and `danger` variant to Button
- [ ] Create PageHeader component
- [ ] Create reusable Modal component (for delete confirmation)

### Phase 2: Unify Layout (STEP 3)
- [ ] Make Table page use MainLayout
- [ ] Ensure all pages use PageHeader instead of raw headers

### Phase 3: Fix Game Logic (STEP 5)
- [ ] Enhance start game button with minimum 2 player check
- [ ] Improve delete table flow with Modal

### Phase 4: Cleanup (STEP 6)
- [ ] Remove unused code
- [ ] Document design system
- [ ] Verify Farsi/RTL support
- [ ] Test light/dark mode across all screens

## Notes
- The existing codebase is actually quite well-structured
- Main work needed is:
  1. Adding missing variants/components
  2. Unifying Table page into MainLayout
  3. Improving game logic visibility
  4. Documentation
- This is more of a refinement than a complete refactor
