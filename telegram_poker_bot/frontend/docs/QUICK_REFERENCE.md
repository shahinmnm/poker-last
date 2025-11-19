# Quick Reference: Using the New Design System

## Components

### Badge
**Purpose**: Status, role, and visibility indicators

**Import:**
```tsx
import Badge from '../components/ui/Badge'
```

**Usage:**
```tsx
// Status badge (success = green/emerald)
<Badge variant="success" size="md">Running</Badge>

// Role badge (info = blue)
<Badge variant="info" size="md">You're the host</Badge>

// Secondary info (muted = white/transparent)
<Badge variant="muted" size="md">Seated</Badge>

// Small badge in lists
<Badge variant="success" size="sm">Host</Badge>
```

**Variants:**
- `primary` - Gradient accent (use sparingly)
- `secondary` - Soft accent (default, most common)
- `success` - Emerald/green (running, active, positive)
- `warning` - Amber/yellow (warnings, cautions)
- `info` - Blue (informational, roles)
- `muted` - White/transparent (secondary info)

**Sizes:**
- `sm` - Compact (player lists, tight spaces)
- `md` - Default (most use cases)

---

### Button
**Purpose**: All clickable actions

**Import:**
```tsx
import Button from '../components/ui/Button'
```

**Usage:**
```tsx
// Primary button with glow (key CTAs)
<Button variant="primary" size="lg" glow block>
  Create Table
</Button>

// Regular primary button
<Button variant="primary" size="md" onClick={handleClick}>
  Submit
</Button>

// Secondary button
<Button variant="secondary" size="md">
  Cancel
</Button>

// Ghost button (subtle)
<Button variant="ghost" size="md">
  Refresh
</Button>

// Disabled state
<Button variant="primary" disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

**Variants:**
- `primary` - Main action (gradient background)
- `secondary` - Alternative action (subtle background)
- `ghost` - Minimal action (transparent)

**Sizes:**
- `md` - Default (most buttons)
- `lg` - Emphasized actions

**Props:**
- `glow` - Adds enhanced shadow (use for key CTAs)
- `block` - Full width
- `disabled` - Disables button (shows at 50% opacity)

---

### Card
**Purpose**: Content containers

**Import:**
```tsx
import Card from '../components/ui/Card'
```

**Usage:**
```tsx
// Default card
<Card>
  <h2>Title</h2>
  <p>Content</p>
</Card>

// Card with custom padding
<Card padding="lg">
  Content
</Card>
```

**Variants:**
- `surface` - Default (glass effect)
- `overlay` - More transparent

**Padding:**
- `sm` - Compact
- `md` - Default
- `lg` - Spacious

---

## Design Tokens

### Colors
**Always use CSS variables, never hardcoded colors:**

```tsx
// Good ✅
<div className="bg-[color:var(--surface-base)]">
<p className="text-[color:var(--text-primary)]">

// Bad ❌
<div className="bg-white dark:bg-gray-800">
<p className="text-gray-900 dark:text-gray-100">
```

**Available tokens:**
- `--surface-base` - Card backgrounds
- `--surface-overlay` - Overlay backgrounds
- `--surface-border` - Border colors
- `--text-primary` - Main text
- `--text-muted` - Secondary text
- `--accent-start` - Accent color (blue)
- `--accent-end` - Accent color (purple)
- `--accent-soft` - Soft accent background

### Typography
**Mobile-first sizing:**

```tsx
// Page titles - responsive
<h1 className="text-xl font-semibold sm:text-2xl">
  Title
</h1>

// Section titles
<h2 className="text-lg font-semibold">
  Section
</h2>

// Body text
<p className="text-sm text-[color:var(--text-muted)]">
  Description
</p>

// Labels
<span className="text-xs uppercase tracking-[0.2em]">
  Label
</span>
```

**Farsi support:**
```tsx
// Automatically applies Vazirmatn font
<div lang="fa">
  متن فارسی
</div>
```

---

## Common Patterns

### Status Display
```tsx
// Table status
<Badge variant="success">Running</Badge>
<Badge variant="warning">Starting</Badge>
<Badge variant="muted">Waiting</Badge>

// User roles
<Badge variant="info">You're the host</Badge>
<Badge variant="muted">Seated</Badge>
```

### Action Buttons
```tsx
// Primary action with glow
<Button variant="primary" size="lg" glow block onClick={handleCreate}>
  Create Table
</Button>

// Secondary action
<Button variant="secondary" size="md" onClick={handleCancel}>
  Cancel
</Button>

// Destructive action (custom color)
<Button 
  variant="primary" 
  className="bg-red-600 hover:bg-red-700"
  onClick={handleDelete}
>
  Delete
</Button>
```

### Loading States
```tsx
<Button variant="primary" disabled={isLoading}>
  {isLoading ? t('common.loading') : t('action.submit')}
</Button>
```

### Confirmation Dialogs
```tsx
{!showConfirm ? (
  <Button onClick={() => setShowConfirm(true)}>
    Delete
  </Button>
) : (
  <div className="space-y-2 rounded-xl border border-red-400/40 bg-red-500/10 p-3">
    <p className="text-sm font-medium text-red-200">
      {t('confirm.message')}
    </p>
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setShowConfirm(false)}>
        {t('confirm.cancel')}
      </Button>
      <Button variant="primary" onClick={handleConfirm}>
        {t('confirm.confirm')}
      </Button>
    </div>
  </div>
)}
```

---

## Translation Keys

### Table Actions
```typescript
t('table.actions.delete')         // "Delete table"
t('table.actions.start')          // "Start game"
t('table.actions.takeSeat')       // "Take a seat"
t('table.actions.leave')          // "Leave table"
```

### Table Status
```typescript
t('table.labels.youHost')         // "You're the host"
t('table.labels.seated')          // "Seated"
```

### Confirmation
```typescript
t('table.confirmDelete.message')  // "Are you sure...?"
t('table.confirmDelete.warning')  // "This action cannot be undone..."
t('table.confirmDelete.confirm')  // "Delete"
t('table.confirmDelete.cancel')   // "Cancel"
```

### Toast Messages
```typescript
showToast(t('table.toast.deleted'))      // "Table deleted successfully."
showToast(t('table.toast.started'))      // "Game starting now!"
showToast(t('table.errors.deleteFailed')) // Error message
```

---

## Best Practices

### ✅ Do
- Use Badge component for all status/role indicators
- Use Button component for all clickable actions
- Use Card component for content sections
- Use CSS variables for all colors
- Use responsive typography classes
- Add loading states to async actions
- Show toast notifications for user actions
- Validate user input before API calls

### ❌ Don't
- Hardcode colors (use CSS variables)
- Create custom button styles (use Button component)
- Use inline styles for colors
- Forget disabled states on buttons
- Skip loading states
- Ignore mobile responsiveness
- Forget to update translations

---

## Examples from Codebase

### Lobby Page - Table Cards
```tsx
<Badge variant="success" size="md">
  {statusLabel}
</Badge>
{isCreator && (
  <Badge variant="info" size="md">
    {t('lobby.labels.youHost')}
  </Badge>
)}
{isSeated && (
  <Badge variant="muted" size="md">
    {t('lobby.labels.seated')}
  </Badge>
)}
```

### Table Page - Delete Confirmation
```tsx
{!showDeleteConfirm ? (
  <Button
    variant="ghost"
    size="md"
    block
    onClick={() => setShowDeleteConfirm(true)}
    className="text-red-400 hover:text-red-300"
  >
    {t('table.actions.delete')}
  </Button>
) : (
  <div className="space-y-2 rounded-xl border border-red-400/40 bg-red-500/10 p-3">
    <p className="text-sm font-medium text-red-200">
      {t('table.confirmDelete.message')}
    </p>
    <p className="text-xs text-red-300">
      {t('table.confirmDelete.warning')}
    </p>
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="md"
        onClick={() => setShowDeleteConfirm(false)}
        disabled={isDeleting}
        className="flex-1"
      >
        {t('table.confirmDelete.cancel')}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={handleDeleteTable}
        disabled={isDeleting}
        className="flex-1 bg-red-600 hover:bg-red-700"
      >
        {isDeleting ? t('common.loading') : t('table.confirmDelete.confirm')}
      </Button>
    </div>
  </div>
)}
```

### Table Page - Start Game Button
```tsx
<Button
  variant="primary"
  size="lg"
  block
  glow
  onClick={handleStart}
  disabled={!canStart || isStarting}
>
  {isStarting ? t('table.actions.starting') : t('table.actions.start')}
</Button>
{!canStart && missingPlayers > 0 && (
  <p className="text-xs text-[color:var(--text-muted)]">
    {t('table.messages.waitForPlayers', { count: missingPlayers })}
  </p>
)}
```

---

## Need Help?

**Documentation:**
- `docs/DESIGN_SYSTEM.md` - Complete design specification
- `docs/IMPLEMENTATION_SUMMARY.md` - Detailed change log
- `docs/FINAL_REPORT.md` - Executive summary

**Component Files:**
- `src/components/ui/Badge.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`

**Example Pages:**
- `src/pages/Lobby.tsx` - Badge usage examples
- `src/pages/Table.tsx` - Complete design system usage
- `src/pages/Settings.tsx` - Simple card/button examples
