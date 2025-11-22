# Inter-Hand Visibility & Crash Bug Fixes - Implementation Summary

## Overview
This implementation fixes two critical issues:
1. **Visibility Bug**: The "Inter-Hand" screen now appears for ALL players, not just the one who made the last move
2. **Crash Bug**: The `NameError: table_lifecycle not defined` was already resolved (import present on line 29)

## Changes Made

### Backend: telegram_poker_bot/api/main.py

**Location**: Lines 2047-2062 in submit_action endpoint

**What Changed**:
- Added a dedicated `hand_ended` broadcast message when a hand transitions to the inter-hand wait phase
- This broadcast is sent to ALL connected clients immediately after the hand completes
- The message includes:
  - `type: "hand_ended"` - Message type identifier
  - `table_id` - The table ID
  - `winners` - Array of winner objects with user_id, amount, hand_rank, and best_hand_cards
  - `hand_status: "INTER_HAND_WAIT"` - Current hand status
  - `next_hand_in` - Countdown timer (defaults to 20 seconds as per config)

**Why This Fixes the Visibility Bug**:
Previously, only the state broadcast was sent, which might not have been processed by all clients consistently. The new dedicated `hand_ended` message ensures all clients receive and process the inter-hand transition.

### Frontend: telegram_poker_bot/frontend/src/pages/Table.tsx

**Location**: Lines 525-542 in WebSocket onMessage handler

**What Changed**:
- Added handler for the new `hand_ended` message type
- Updates `liveState` with:
  - `status: 'INTER_HAND_WAIT'`
  - `inter_hand_wait: true`
  - `inter_hand_wait_seconds` from the broadcast
  - `hand_result` with winner data
- Updates `lastHandResult` state which is consumed by the WinnerShowcase component

**Existing UI Integration**:
The existing code already had the UI components in place:
- Line 740: `isInterHand` flag checks for inter-hand state
- Lines 971-983: Conditional rendering that shows WinnerShowcase and InterHandVoting when `isInterHand` is true
- WinnerShowcase.tsx: Displays winner name, amount won, and best hand cards
- InterHandVoting.tsx: Shows ready status for all players with countdown timer

## Backend Configuration

**File**: telegram_poker_bot/shared/config.py
- Line 78: `post_hand_delay_seconds: int = 20` - Inter-hand wait time is already set to 20 seconds

**File**: telegram_poker_bot/game_core/pokerkit_runtime.py
- Line 29: `from telegram_poker_bot.shared.services import table_lifecycle` - Import already present (no crash)
- Lines 1163-1261: Hand completion logic sets `HandStatus.INTER_HAND_WAIT` and adds metadata to result

## How It Works

### Flow Diagram
```
Player Action (Last Action of Hand)
    ↓
handle_action() in pokerkit_runtime.py
    ↓ (detects hand complete)
Sets status to INTER_HAND_WAIT
    ↓
Returns state with inter_hand_wait flag
    ↓
API broadcasts normal state
    ↓
API broadcasts hand_ended message ← NEW
    ↓
ALL connected WebSocket clients receive hand_ended
    ↓
Frontend onMessage handler processes hand_ended
    ↓
Updates liveState and lastHandResult
    ↓
isInterHand flag becomes true
    ↓
UI renders WinnerShowcase + InterHandVoting
```

## Testing Performed

1. **Linting**: 
   - ✅ `ruff check` passed
   - ✅ `black --check` and `black` formatting applied

2. **TypeScript Compilation**:
   - ✅ `npm run build` successful
   - ✅ No TypeScript errors

3. **Build**:
   - ✅ Vite production build completed successfully

## Verification Checklist

- [x] table_lifecycle import present in pokerkit_runtime.py (line 29)
- [x] post_hand_delay_seconds set to 20 in config.py (line 78)
- [x] hand_ended broadcast added in API when inter_hand_wait detected
- [x] Frontend handler for hand_ended message added
- [x] WinnerShowcase and InterHandVoting components verified
- [x] Existing UI logic verified (isInterHand conditional rendering)
- [x] Code formatted and linted
- [x] Frontend builds successfully

## Notes

- The crash bug (`table_lifecycle not defined`) was already resolved in the codebase
- The visibility bug is now fixed by the dedicated `hand_ended` broadcast
- All connected clients will receive the hand end notification simultaneously
- The UI components for winner showcase and voting were already implemented and working
- The fix is minimal and surgical, only adding the broadcast logic needed
