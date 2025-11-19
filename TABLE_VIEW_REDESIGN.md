# Table View Redesign & Action Endpoint Fix

## Overview
This document explains the changes made to fix the table action endpoint 404 error and redesign the Table View UI for better user experience.

---

## 1. Critical Bug Fix: Action Endpoint Mismatch

### The Problem
When players tried to make poker actions (fold, check, call, bet, raise), the frontend was sending requests to `/tables/{table_id}/action` (singular), but the backend was expecting `/tables/{table_id}/actions` (plural). This caused HTTP 404 errors, preventing any gameplay actions from being processed.

**Backend logs showed:**
```
POST /tables/24/action HTTP/1.1" 404 Not Found
```

### The Solution
**File**: `telegram_poker_bot/frontend/src/pages/Table.tsx`

Changed line 353 from:
```typescript
const state = await apiFetch<LiveTableState>(`/tables/${tableId}/action`, {
```

To:
```typescript
const state = await apiFetch<LiveTableState>(`/tables/${tableId}/actions`, {
```

### Backend Route Details
**File**: `telegram_poker_bot/api/main.py` (line 1245)

```python
@api_app.post("/tables/{table_id}/actions")
async def submit_action(
    table_id: int,
    action: ActionRequest,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Submit a poker action."""
    # Verify user authentication
    # Process action type: fold, check, call, bet, raise, all_in
    # Update game state via runtime manager
    # Broadcast updated state to all WebSocket connections
```

### Supported Action Types
The backend accepts these action types (case-sensitive):
- `fold` - Fold your hand
- `check` - Check (when no bet to call)
- `call` - Call the current bet
- `bet` - Make a bet
- `raise` - Raise the current bet
- `all_in` - Not currently used (handled as raise with full stack)

**Note**: The frontend sends `raise` with the full amount (stack + bet) when the All-In button is clicked.

---

## 2. Table View UI Redesign

### Goals
1. **Reduce visual clutter** - Make text smaller and more professional
2. **Improve information density** - Show more game state in less space
3. **Better visual hierarchy** - Make important info stand out
4. **Maintain i18n support** - All text still uses translation keys
5. **Optimize for mobile** - Better fit for Telegram mini-app viewport

### Changes Made

#### A. Typography & Sizing

**Before → After:**
- Page spacing: `space-y-6` → `space-y-4`
- Game status title: `text-xl` → `text-base`
- Section headers: `text-lg` → `text-sm`
- Meta labels: `text-xs` → `text-[10px]`
- Action header: `text-sm` → `text-xs`
- Button labels: Unchanged (still readable)

#### B. Card Rendering

**Before:**
- Large cards: `w-14 h-20 text-xl`
- Small cards: `w-10 h-14 text-base`

**After:**
- Large cards: `w-12 h-16 text-lg`
- Medium cards: `w-9 h-12 text-sm` (new)
- Small cards: `w-7 h-10 text-xs`

Community cards now use medium size for better balance.

#### C. Game State Card Layout

**Structure:**
```
┌─────────────────────────────────────┐
│ Status Header (compact, 3 columns)  │
│  - Stage | Pot | Blinds              │
├─────────────────────────────────────┤
│ Community Cards (centered)          │
├─────────────────────────────────────┤
│ Players Grid (2-3 columns)          │
│  - Acting player highlighted        │
│  - Hero player subtly highlighted   │
│  - Badges: D, SB, BB                │
├─────────────────────────────────────┤
│ Hero Cards (gradient background)    │
│  - Win/Loss indicator               │
└─────────────────────────────────────┘
```

#### D. Player Cards

**Visual Improvements:**
- Acting player: Green border with glow effect
- Hero player: Blue border with subtle background
- Compact badges: Smaller, better positioned
- Stack and bet display: More compact layout
- Folded indicator: Smaller, less intrusive

#### E. Action Buttons

**Changes:**
- Reduced spacing: `gap-2` → `gap-1.5`
- Smaller header with status indicator
- Turn indicator: Shows green dot (●) when it's your turn
- Maintains button sizes for touch-friendliness

#### F. Other Sections

**Players List:**
- Reduced item height with compact padding
- Smaller fonts for better density
- Preserved badge functionality

**Host Actions:**
- More compact spacing
- Smaller button sizes where appropriate
- Clearer status messages

**Countdown Timer:**
- Reduced font size: `text-2xl` → `text-lg`
- More compact layout

---

## 3. Multi-Language Support

### No Changes Required
All text in the Table View uses the existing i18n system:

```typescript
t('table.actions.fold')
t('table.actions.call', { amount: amountToCall })
t('table.pot', { amount: liveState.pot })
// etc.
```

### Translation Keys Used
All keys are defined in:
- `telegram_poker_bot/frontend/src/locales/en/translation.json`
- `telegram_poker_bot/frontend/src/locales/fa/translation.json`

Key sections:
- `table.actions.*` - Action buttons and controls
- `table.status.*` - Game status labels
- `table.messages.*` - Informational messages
- `table.errors.*` - Error messages
- `table.players.*` - Player list
- `table.meta.*` - Metadata labels

---

## 4. Testing

### Build Test
```bash
cd telegram_poker_bot/frontend
npm install
npm run build
```

**Result**: ✅ Builds successfully without errors

### Runtime Testing (Recommended)

1. **Create a table** (public or private)
2. **Seat 2 players**
3. **Start the game**
4. **Test actions**:
   - Fold
   - Check
   - Call
   - Bet
   - Raise
5. **Verify**:
   - No 404 errors in browser console
   - Game state updates correctly
   - WebSocket broadcasts work
   - UI is compact and readable
   - All text is translated

---

## 5. Backward Compatibility

### Breaking Changes
**None**. This is purely a UI redesign and bug fix.

### API Changes
**None**. The backend route `/tables/{table_id}/actions` already existed; we just fixed the frontend to use it correctly.

---

## 6. Future Improvements

### Recommended Enhancements
1. **Bet sizing slider** - Allow custom bet amounts
2. **Action history log** - Show recent actions in the hand
3. **Player avatars** - Visual identity for players
4. **Animation** - Smooth transitions for card dealing and chip movement
5. **Sound effects** - Optional audio feedback for actions
6. **Time bank indicator** - Visual countdown for action timer
7. **Hand strength indicator** - Optional helper for beginners

### Known Limitations
1. No bet amount customization (uses min raise only)
2. No hand history export
3. No table chat functionality
4. No spectator mode

---

## 7. Files Modified

1. **telegram_poker_bot/frontend/src/pages/Table.tsx**
   - Fixed action endpoint (line 353)
   - Redesigned entire UI layout
   - Reduced font sizes throughout
   - Improved visual hierarchy

2. **telegram_poker_bot/frontend/src/components/tables/TableActionButtons.tsx**
   - Made layout more compact
   - Improved turn indicator
   - Better spacing and sizing

---

## 8. Rollback Instructions

If issues arise, revert commits with:
```bash
git revert <commit-hash>
```

The specific changes can be undone individually:
1. **Action endpoint fix** - Critical, should not be reverted
2. **UI redesign** - Can be reverted if needed without affecting functionality

---

## Summary

✅ **Fixed**: 404 error on poker actions  
✅ **Improved**: Typography and visual hierarchy  
✅ **Reduced**: Font sizes and spacing for better density  
✅ **Maintained**: All i18n support and functionality  
✅ **Tested**: Frontend builds successfully  

The Table View is now more professional, compact, and fully functional.
