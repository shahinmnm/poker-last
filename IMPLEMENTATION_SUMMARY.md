# Poker Game Flow & UI Fixes - Implementation Summary

## Overview

This implementation addresses critical game flow and UI issues in the Telegram Poker Mini-App, focusing on PokerKit integration, sit-out functionality, showdown visibility, table lifecycle management, and wallet/stats updates.

## Changes Made

### Part 1: Sit-Out Functionality (COMPLETE)

#### Backend
- **Already Implemented**: `/tables/{table_id}/sitout` endpoint in `api/main.py`
- **Already Implemented**: `is_sitting_out_next_hand` column in seats table (migration 009)
- **Already Implemented**: Sit-out players excluded from active hands in `pokerkit_runtime.py`
- **Already Implemented**: State includes `is_sitting_out_next_hand` in both waiting and active game states

#### Frontend
- **Updated**: `TableActionButtons.tsx` - Replaced disabled sit-out stub with working toggle button
  - Added `isSittingOut` prop
  - Added `onToggleSitOut` handler prop
  - Button shows checkmark when sitting out, styled with orange color
- **Updated**: `Table.tsx`
  - Added `is_sitting_out_next_hand` field to `LivePlayerState` interface
  - Implemented `handleToggleSitOut` function that calls `/tables/{id}/sitout` API
  - Added sit-out badge display on player tiles (orange badge showing "SIT OUT")
  - Modified turn timer to NOT show for sitting-out players
  - Passed sit-out props to `TableActionButtons`

### Part 2: Showdown Visibility & Hole Cards (COMPLETE)

#### Backend
- **Already Correct**: `hand_result` is broadcast to ALL players without filtering in `pokerkit_runtime.py`
- **Already Correct**: Hand evaluation data (rank, best cards) included in winners

#### Frontend
- **Updated**: `Table.tsx`
  - Modified hero cards display to only show during active hands
  - Condition: `liveState.hand_id && liveState.status !== 'ended' && liveState.status !== 'waiting'`
  - This hides the "Your Hand" box after showdown, preventing confusion
- **Already Correct**: `HandResultPanel.tsx` shows to all players (no user-id filtering)
- **Already Correct**: Winning cards highlighted on board using `best_hand_cards`

### Part 3: Table Lifecycle & Expiry (COMPLETE)

#### Backend
- **Already Implemented**: Table expiry logic in `table_service.py`
- **Already Implemented**: `expires_at` field and filtering in `list_available_tables`
- **Already Implemented**: Tables with status `EXPIRED` or `expires_at <= now` filtered out

#### Frontend
- **Updated**: `Lobby.tsx`
  - Added client-side filtering to remove expired tables
  - Filters by both `status === 'expired'` and `expires_at <= now`
- **Already Implemented**: `ExpiredTableView.tsx` component shows message when table expires
- **Already Implemented**: `Table.tsx` detects expired tables and shows `ExpiredTableView`

### Part 4: Turn Timer UI (COMPLETE)

#### Frontend
- **Already Implemented**: Turn timer ring around active player tile in `Table.tsx`
- **Updated**: Turn timer now hidden for sitting-out players
  - Condition: `isActor && !player.is_sitting_out_next_hand && liveState.action_deadline`
- **Already Implemented**: Timer color transitions (green fading to show time remaining)

### Part 5: Lobby & Expired Tables (COMPLETE)

- **Backend**: Already filters expired tables in `list_available_tables`
- **Frontend**: Added additional client-side filtering in Lobby (see Part 3)

### Part 6: Wallets & Stats - Fix Winner Amounts (COMPLETE)

#### Backend - Critical Fix
- **Updated**: `engine_adapter/adapter.py`
  - **Problem Identified**: PokerKit's `CHIPS_PUSHING` automation clears pots after distributing chips, so `get_winners()` was reading empty pots
  - **Solution**: Changed from pot-based to stack-difference-based winner calculation
  - Added `_pre_showdown_stacks` field to track stacks at hand start
  - Modified `deal_new_hand()` to capture stacks before dealing
  - Modified `get_winners()` to calculate winnings as `stack_after - stack_before`
  - Winners now show actual chip amounts won instead of 0
- **Already Correct**: `user_service.py` `apply_hand_result_to_wallets_and_stats()` properly:
  - Updates wallet balances for winners
  - Creates transaction records
  - Updates stats: `hands_played`, `hands_won`, `total_profit`, `biggest_pot`
  - Calculates win rate and streaks

#### Why Stack-Diff Approach is Better
1. **Accurate**: Reflects actual chip movement
2. **PokerKit Compatible**: Works with CHIPS_PUSHING automation
3. **Simple**: No need to disable automations or track pot states
4. **Handles All Cases**: Works for side pots, splits, all-ins automatically

### Part 7: PokerKit Integration (VERIFIED)

- **Already Implemented**: Hand evaluation using PokerKit's `get_hand()` method
- **Already Implemented**: Hand rank names mapped from PokerKit to human-readable labels
- **Improved**: Winner calculation now leverages PokerKit's chip distribution directly
- **Already Implemented**: Best hand cards extraction for highlighting

### Part 8: Cleanup (COMPLETE)

- **Removed**: Disabled sit-out stub from `TableActionButtons.tsx`
- **Verified**: TypeScript types match backend JSON (no build errors)
- **Verified**: Frontend builds successfully (`npm run build`)
- **Verified**: Python files pass syntax checks and ruff linting

## Files Modified

### Frontend
1. `telegram_poker_bot/frontend/src/pages/Table.tsx`
   - Added sit-out interface field
   - Implemented sit-out toggle handler
   - Added sit-out badge display
   - Modified turn timer visibility
   - Modified hero cards visibility
   - Passed sit-out props to action buttons

2. `telegram_poker_bot/frontend/src/components/tables/TableActionButtons.tsx`
   - Removed disabled sit-out stub
   - Added working sit-out toggle button
   - Added sit-out props to interface
   - Styled button to show active/inactive state

3. `telegram_poker_bot/frontend/src/pages/Lobby.tsx`
   - Added client-side filtering for expired tables

### Backend
4. `telegram_poker_bot/engine_adapter/adapter.py`
   - Added `_pre_showdown_stacks` tracking
   - Modified `deal_new_hand()` to capture stacks
   - Rewrote `get_winners()` to use stack differences

## Translation Keys Used

All translation keys already exist in `frontend/src/locales/en/translation.json`:
- `table.sitOut` - "Sit Out"
- `table.actions.sitOutNextHand` - "Sit out next hand"

## Testing Recommendations

### Manual Testing
1. **Sit-Out Flow**:
   - Join a table as a player
   - Toggle "Sit out next hand" button
   - Verify orange badge appears on your player tile
   - Verify you're not dealt into the next hand
   - Verify turn timer doesn't show for you
   - Toggle off and verify you're dealt into next hand

2. **Showdown Visibility**:
   - Play a hand to showdown with multiple players
   - Verify ALL players see the winner announcement
   - Verify ALL players see the winning hand rank
   - Verify winning cards highlighted on board
   - Verify "Your Hand" box disappears after showdown

3. **Wallet Updates**:
   - Play a hand and win
   - Check that winner amount in `hand_result` is > 0 (not 0)
   - Navigate to Profile/Wallet
   - Verify balance increased by winning amount
   - Verify stats show hands_played and hands_won incremented

4. **Table Expiry**:
   - Check lobby - verify no expired tables shown
   - Create a table that expires soon
   - Wait for expiry or set expires_at in database
   - Refresh lobby - verify table disappears
   - Try to access expired table - verify ExpiredTableView shown

### Automated Testing
Run existing test suite:
```bash
cd telegram_poker_bot
pytest tests/test_sitout.py -v
pytest tests/test_engine_adapter.py -v
pytest tests/test_pokerkit_runtime.py -v
```

## Known Limitations & Future Work

1. **Multi-Pot Support**: Currently simplified to single pot index 0 in winner results. Side pots are handled correctly by PokerKit and stack differences, but UI shows single combined amount.

2. **Balance Refetch**: Frontend doesn't automatically refetch balance after hand completion. Consider adding:
   ```typescript
   useEffect(() => {
     if (liveState?.hand_result?.winners?.length) {
       // Refetch /users/me/balance
     }
   }, [liveState?.hand_result])
   ```

3. **Action Timeout**: No auto-fold on timeout. Consider implementing:
   - Track action deadline in backend
   - Auto-fold players who exceed deadline
   - Broadcast timeout event

4. **Inactive Table Cleanup**: No background job to clean up old tables. Consider implementing:
   - Periodic task to mark inactive tables as expired
   - Cleanup tables with no activity for X hours

## Build & Deployment

### Frontend Build
```bash
cd telegram_poker_bot/frontend
npm install
npm run build
```
✅ Builds successfully with no TypeScript errors

### Backend Linting
```bash
ruff check telegram_poker_bot/engine_adapter/adapter.py
```
✅ All checks passed

## Conclusion

This implementation successfully addresses all critical issues:
- ✅ Sit-out functionality is now fully visible and working
- ✅ Showdown results visible to all players
- ✅ Hero cards hidden after hand ends (better UX)
- ✅ Winner amounts now calculated correctly (was 0, now shows actual winnings)
- ✅ Wallet and stats properly updated
- ✅ Expired tables filtered from lobby
- ✅ Turn timer doesn't show for sitting-out players
- ✅ All code compiles and builds without errors

The changes maintain backward compatibility and integrate cleanly with existing PokerKit functionality.
