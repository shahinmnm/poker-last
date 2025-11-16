# Frontend Design System Guide

## Overview
This document describes the unified design system for the Telegram Poker Mini-App frontend. All UI components and pages must follow these guidelines to maintain consistency across dark and light modes, support Farsi/RTL, and provide a cohesive user experience.

## Theme Tokens

### CSS Variables
All styling uses CSS variables defined in `src/index.css`. These automatically adapt for light and dark modes via the `[data-theme]` attribute.

#### Colors
```css
--app-background        /* Main gradient background */
--surface-base          /* Primary surface color for cards */
--surface-overlay       /* Secondary surface for nested elements */
--surface-border        /* Border color for cards and inputs */
--text-primary          /* Main text color */
--text-muted            /* Secondary/muted text */
--accent-start          /* Primary accent color (gradient start) */
--accent-end            /* Primary accent color (gradient end) */
--accent-soft           /* Soft/transparent accent for backgrounds */
--danger                /* Danger/destructive action color */
--danger-hover          /* Danger hover state */
--danger-soft           /* Soft danger background */
```

#### Shadows
```css
--shadow-elevated       /* Card shadow */
--shadow-button         /* Button shadow */
--shadow-glow           /* Glow effect for primary CTAs */
```

#### Typography
```css
--font-display          /* Primary font family */
--font-farsi            /* Farsi-optimized font family */
```

### Tailwind Extensions
Extended colors in `tailwind.config.js`:
- `bg` - App background
- `surface.DEFAULT` - Primary surface
- `surface.muted` - Muted surface
- `surface.border` - Border color
- `accent.DEFAULT` - Accent color
- `accent.end` - Accent gradient end
- `accent.soft` - Soft accent
- `text.DEFAULT` - Primary text
- `text.muted` - Muted text

## Typography Scale

Use these utility classes for consistent text sizing:

```css
.text-page-title      /* Page titles: text-xl sm:text-2xl font-semibold */
.text-section-title   /* Section titles: text-lg sm:text-xl font-semibold */
.text-body            /* Body text: text-sm sm:text-base */
.text-caption         /* Captions: text-xs sm:text-sm */
```

## Core UI Components

### Button (`components/ui/Button.tsx`)

**Variants:**
- `primary` - Main call-to-action (gradient, shadow, glow option)
- `secondary` - Secondary actions (subtle background, border)
- `ghost` - Minimal actions (transparent)
- `danger` - Destructive actions (red background)

**Sizes:**
- `sm` - Compact (0.5rem × 1.2rem padding, 0.875rem text)
- `md` - Default (0.65rem × 1.6rem padding, 0.95rem text)
- `lg` - Large (0.85rem × 1.85rem padding, 1.05rem text)

**Props:**
- `block?: boolean` - Full width
- `glow?: boolean` - Add glow effect (primary only)
- `disabled?: boolean` - Disabled state

**Usage:**
```tsx
// Primary CTA with glow
<Button variant="primary" size="lg" glow>
  Start Game
</Button>

// Secondary action
<Button variant="secondary" size="md">
  Cancel
</Button>

// Dangerous action
<Button variant="danger" size="md">
  Delete Table
</Button>

// Ghost/minimal
<Button variant="ghost" size="sm">
  Clear
</Button>
```

### Card (`components/ui/Card.tsx`)

**Variants:**
- `surface` - Default card with gradient accent line
- `overlay` - Muted overlay variant for nested cards

**Padding:**
- `sm` - p-4 sm:p-5
- `md` - p-6 sm:p-7 (default)
- `lg` - p-7 sm:p-8

**Usage:**
```tsx
<Card>
  {/* Content */}
</Card>

<Card variant="overlay" padding="sm">
  {/* Nested content */}
</Card>
```

### Badge (`components/ui/Badge.tsx`)

**Variants:**
- `primary` - Accent gradient
- `secondary` - Soft accent background
- `success` - Green (for "Running", "Ready")
- `warning` - Amber (for warnings)
- `info` - Blue (for "You are host")
- `muted` - Subtle gray

**Sizes:**
- `sm` - px-2 py-0.5 text-[10px]
- `md` - px-3 py-1 text-xs (default)

**Usage:**
```tsx
<Badge variant="success" size="md">Running</Badge>
<Badge variant="info">You are host</Badge>
<Badge variant="muted">Private</Badge>
```

### PageHeader (`components/ui/PageHeader.tsx`)

Consistent page headers with optional icon and right action.

**Props:**
- `title: ReactNode` - Page title
- `subtitle?: ReactNode` - Optional subtitle
- `icon?: ReactNode` - Optional emoji/icon
- `rightAction?: ReactNode` - Optional right-side action

**Usage:**
```tsx
<PageHeader
  title={t('settings.title')}
  icon="⚙️"
/>

<PageHeader
  title={t('lobby.title')}
  subtitle={t('menu.lobby.description')}
/>
```

### SectionHeader (`components/ui/SectionHeader.tsx`)

Headers for sections within a page/card.

**Props:**
- `title: ReactNode`
- `subtitle?: ReactNode`
- `action?: ReactNode` - Right-aligned action

**Usage:**
```tsx
<SectionHeader
  title={t('lobby.myTables.title')}
  subtitle={t('lobby.myTables.subtitle')}
  action={
    <Button variant="ghost" size="md" onClick={refresh}>
      Refresh
    </Button>
  }
/>
```

### Modal (`components/ui/Modal.tsx`)

Reusable modal for confirmations and dialogs.

**Props:**
- `isOpen: boolean`
- `onClose: () => void`
- `title: ReactNode`
- `description?: ReactNode`
- `children?: ReactNode` - Custom content
- `confirmLabel?: string`
- `cancelLabel?: string`
- `onConfirm?: () => void`
- `confirmVariant?: 'primary' | 'danger'`
- `confirmDisabled?: boolean`

**Usage:**
```tsx
<Modal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  title={t('table.confirmDelete.message')}
  description={t('table.confirmDelete.warning')}
  confirmLabel={t('table.confirmDelete.confirm')}
  cancelLabel={t('table.confirmDelete.cancel')}
  onConfirm={handleDelete}
  confirmVariant="danger"
/>
```

## Layout System

### MainLayout (`components/MainLayout.tsx`)

All pages are wrapped in MainLayout which provides:
- **Top header**: App title, language selector, settings link
- **Main content area**: Responsive padding, centered max-width
- **Bottom navigation**: Home, Lobby, Create, Wallet, Profile

Pages automatically inherit proper spacing and navigation.

## Page Structure

Every page should follow this pattern:

```tsx
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function MyPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        icon="🎮"
      />

      <Card>
        {/* Content */}
      </Card>

      <Card>
        {/* More content */}
      </Card>
    </div>
  )
}
```

## Color Usage Guidelines

### When to use each variant

**Buttons:**
- `primary` - Main CTAs (Create Game, Start Game, Join)
- `primary + glow` - Critical CTAs that should stand out
- `secondary` - Alternative actions (Cancel, Leave, Refresh)
- `ghost` - Tertiary/minimal actions (Clear, View)
- `danger` - Destructive actions (Delete Table)

**Badges:**
- `success` - Positive states (Running, Waiting, Ready)
- `info` - User-specific info (You are host, You are seated)
- `muted` - Neutral info (Private, Public, visibility)
- `warning` - Warnings (not currently used but available)

## Dark/Light Mode

Theme is managed by `ThemeProvider`:
- Syncs with Telegram's color scheme
- Persists to localStorage
- All CSS variables adapt automatically
- No need for manual dark mode classes

To toggle programmatically:
```tsx
const { mode, setMode } = useTheme()
setMode('dark') // or 'light'
```

## Farsi/RTL Support

Farsi text automatically uses `--font-farsi` via CSS:
```css
:lang(fa), [lang="fa"], [dir="rtl"] {
  font-family: var(--font-farsi);
  line-height: 1.7;
}
```

Set `dir="rtl"` on elements when needed. The design system handles proper text direction and spacing.

## Spacing

Use consistent Tailwind spacing utilities:
- `space-y-6` - Between major page sections
- `space-y-4` - Between card sections
- `space-y-3` - Between related items
- `gap-3`, `gap-4` - For flex/grid gaps
- `p-4`, `p-5`, `p-6` - Card padding (use Card component props instead)

## Responsive Design

The app is mobile-first. Use responsive utilities:
- `sm:text-2xl` - Larger text on wider screens
- `sm:flex-row` - Switch to row layout on tablet+
- `sm:grid-cols-2` - Multi-column grids on wider screens

Max content width is `max-w-4xl` (applied by MainLayout).

## Do's and Don'ts

### ✅ Do
- Use CSS variables for all colors
- Use Button/Card/Badge components consistently
- Use PageHeader for all page titles
- Use typography utilities (text-page-title, etc.)
- Keep pages inside `<div className="space-y-6">`
- Use Modal for confirmations

### ❌ Don't
- Hardcode colors (e.g., `bg-blue-500`, `text-gray-600`)
- Create custom button styles inline
- Use raw `<h1>` tags for page titles
- Mix Card styling with custom backgrounds
- Create page-specific layout wrappers
- Use inline confirmation UI (use Modal)

## Testing Checklist

When creating/updating a page:
1. ✅ Uses PageHeader for title
2. ✅ Uses Card for content blocks
3. ✅ Uses Button variants consistently
4. ✅ Badges for status indicators
5. ✅ Works in dark mode
6. ✅ Works in light mode
7. ✅ Responsive on mobile
8. ✅ Typography uses utility classes
9. ✅ Colors use CSS variables
10. ✅ No hardcoded theme-specific styles

## Examples

See these pages for reference:
- **Settings** - Simple form with PageHeader and Card
- **Lobby** - Complex page with PageHeader, SectionHeader, multiple Cards
- **CreateGame** - Form with validation, PageHeader, SegmentedControl
- **Table** - Modal usage, badges, status indicators, danger button
- **Help** - Multiple Cards with consistent styling
- **JoinGame** - Form inputs, recent items, badges

## Migration Notes

When refactoring old pages:
1. Replace custom headers with `<PageHeader>`
2. Replace `<section>` or custom divs with `<Card>`
3. Replace inline `<button>` with `<Button>` component
4. Replace custom badge/tag styling with `<Badge>`
5. Update text classes to use typography utilities
6. Remove hardcoded colors, use CSS variables instead
7. Test in both light and dark modes
