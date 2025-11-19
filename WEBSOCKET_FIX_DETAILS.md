# WebSocket Disconnection Fix - Technical Details

## Problem Analysis

### Symptoms
- WebSocket connections to `/ws/{table_id}` were disconnecting and reconnecting every few seconds
- Server logs showed: "WebSocket client disconnected normally" followed immediately by reconnection
- Cards didn't appear reliably after game start
- UI flickered during reconnection loops
- Players couldn't act after pre-flop due to connection instability

### Root Cause Identified

The WebSocket disconnection was caused by unnecessary recreation of callback dependencies in the React component:

1. **`fetchTable` and `fetchLiveState` dependency chain**:
   - Both callbacks included `initData` in their dependency arrays
   - `initData` from Telegram SDK can change during the session
   - When `initData` changed, both callbacks were recreated
   - This caused `onMessage` callback to be recreated (it depends on `fetchTable`)
   - While the `useTableWebSocket` hook uses refs to avoid reconnecting on callback changes, the frequent callback recreation could cause timing issues and re-renders

2. **React Hook Dependencies**:
   ```typescript
   // BEFORE (problematic):
   const fetchTable = useCallback(async () => {
     // ... uses initData directly
   }, [initData, tableId, t])  // ← initData changes = callback recreates
   
   // WebSocket hook:
   onMessage: useCallback((payload) => {
     fetchTable()  // ← depends on fetchTable
   }, [fetchTable])  // ← recreates when fetchTable changes
   ```

### Why Lobby → Table Worked Better Than Refresh

Both flows should have been identical since they both navigate to `/table/:id`. The perceived difference was due to:
- Timing: Rapid reconnections during page load could miss initial state broadcasts
- State race conditions: HTTP requests and WebSocket messages arriving in unpredictable order
- The reconnection loop interfering with initial state loading

## Solution Implemented

### Changes to `telegram_poker_bot/frontend/src/pages/Table.tsx`

1. **Added `useRef` for `initData`** to decouple it from callback dependencies:
   ```typescript
   // Store initData in a ref that doesn't trigger re-renders
   const initDataRef = useRef(initData)
   useEffect(() => {
     initDataRef.current = initData
   }, [initData])
   ```

2. **Updated `fetchTable` to use ref**:
   ```typescript
   // BEFORE:
   const fetchTable = useCallback(async () => {
     const data = await apiFetch<TableDetails>(`/tables/${tableId}`, {
       initData: initData ?? undefined,  // ← direct dependency
     })
   }, [initData, tableId, t])  // ← recreates when initData changes

   // AFTER:
   const fetchTable = useCallback(async () => {
     const data = await apiFetch<TableDetails>(`/tables/${tableId}`, {
       initData: initDataRef.current ?? undefined,  // ← via ref
     })
   }, [tableId, t])  // ← stable dependencies
   ```

3. **Updated `fetchLiveState` similarly**:
   ```typescript
   const fetchLiveState = useCallback(async () => {
     const data = await apiFetch<LiveTableState>(`/tables/${tableId}/state`, {
       initData: initDataRef.current ?? undefined,
     })
   }, [tableId])  // ← removed initData dependency
   ```

4. **Added ESLint suppressions** with explanatory comments for intentional dependency omissions

### Changes to `telegram_poker_bot/frontend/src/hooks/useTableWebSocket.ts`

1. **Added ESLint suppression** for the connection effect:
   ```typescript
   useEffect(() => {
     if (enabled) {
       connect()
     }
     return () => {
       cleanup()
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [tableId, enabled])  // Only reconnect when tableId or enabled changes
   ```

2. **Added explanatory comment** about why `connect` and `cleanup` don't need to be in the dependency array (they have the same dependencies as the effect itself)

## Technical Details

### Why useRef Pattern Works

The `useRef` pattern breaks the dependency chain without losing reactivity:

1. **Reactivity preserved**: When `initData` changes, the ref is updated via its own effect
2. **Callbacks stable**: `fetchTable` and `fetchLiveState` don't recreate when `initData` changes
3. **Latest value used**: The ref always contains the most recent `initData` when the API call is made
4. **No reconnections**: WebSocket callbacks remain stable, preventing reconnection loops

### WebSocket Connection Lifecycle (After Fix)

1. **On mount** (`tableId` becomes available):
   - `fetchTable()` and `fetchLiveState()` fetch initial state via HTTP
   - `useTableWebSocket` hook creates WebSocket connection
   - WebSocket opens and sends ping/pong heartbeat every 25-30 seconds

2. **During gameplay**:
   - WebSocket receives `table_state` updates → `onStateChange` updates React state
   - WebSocket receives `action`/`player_joined`/`player_left` → `onMessage` calls `fetchTable()`
   - Connection remains stable (no reconnections)

3. **On unmount** or `tableId` change:
   - Cleanup function closes WebSocket connection
   - "WebSocket client disconnected normally" log appears (expected)

### Backend WebSocket Handler (No Changes Needed)

The backend implementation was already correct:
- Accepts connections and maintains them
- Sends periodic pings every 30 seconds
- Handles pong responses from client
- Broadcasts state updates to all connected clients
- Only closes on explicit disconnect or error

## Expected Behavior After Fix

✅ **Stable Connection**:
- WebSocket connects once when entering table page
- Stays connected for entire table session
- Only disconnects on navigation away or page close

✅ **Reliable State Updates**:
- Initial state loads via HTTP on page load
- Game state updates arrive via WebSocket in real-time
- No flickering or missing cards

✅ **Consistent Experience**:
- Page refresh works same as Lobby → Table navigation
- Both flows properly initialize and show cards
- Actions work reliably throughout hand

✅ **Clean Logs**:
- No repeated "client disconnected normally" messages
- Disconnection only logged when user actually leaves table

## Testing Recommendations

### Manual Testing
1. Open table page directly via URL (e.g., `/table/7`)
2. Verify WebSocket connects and stays connected (check browser DevTools)
3. Start a game - verify cards appear immediately
4. Play through a hand - verify actions work without reconnections
5. Refresh page - verify cards still show and connection is stable
6. Navigate to Lobby and back - verify same stable behavior

### DevTools Verification
```javascript
// Browser console - check WebSocket status:
// Should show exactly 1 WebSocket connection to /ws/{table_id}
// Connection should remain in "OPEN" state (readyState = 1)
```

### Server Log Verification
```
# Should see on connection:
WebSocket /ws/7 [accepted]
WebSocket connected table_id=7

# Should NOT see repeated disconnection/reconnection during gameplay

# Should only see on navigation away:
WebSocket client disconnected normally table_id=7
WebSocket disconnected table_id=7
WebSocket connection closed table_id=7
```

## Related Files

- `telegram_poker_bot/frontend/src/pages/Table.tsx` - Main table component
- `telegram_poker_bot/frontend/src/hooks/useTableWebSocket.ts` - WebSocket hook
- `telegram_poker_bot/api/main.py` - Backend WebSocket endpoint (no changes)

## Future Improvements

While the current fix addresses the immediate issue, potential enhancements could include:

1. **Optimistic UI updates**: Update UI immediately on action, then confirm via WebSocket
2. **Exponential backoff tuning**: Adjust reconnection delays based on network conditions
3. **Connection status UI**: More prominent indicator when WebSocket is reconnecting
4. **State reconciliation**: Handle edge cases where HTTP and WebSocket state diverge
5. **Heartbeat monitoring**: Alert user if ping/pong fails repeatedly
