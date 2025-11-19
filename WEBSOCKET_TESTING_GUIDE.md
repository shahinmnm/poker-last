# WebSocket Fix - Deployment & Testing Guide

## Quick Start

### For Developers

1. **Pull the changes:**
   ```bash
   git checkout copilot/fix-websocket-disconnections
   ```

2. **Backend - No additional dependencies needed:**
   - Changes are in `telegram_poker_bot/api/main.py`
   - Only uses built-in `asyncio` module
   - Compatible with existing FastAPI/Uvicorn setup

3. **Frontend - Rebuild the app:**
   ```bash
   cd telegram_poker_bot/frontend
   npm install  # If dependencies changed
   npm run build
   ```

4. **Restart the services:**
   ```bash
   # Docker deployment
   make update
   
   # Or manual restart
   docker-compose down
   docker-compose up -d
   ```

## What Changed

### Files Modified
- `telegram_poker_bot/api/main.py` - Backend WebSocket endpoint
- `telegram_poker_bot/frontend/src/pages/Table.tsx` - Table component
- `telegram_poker_bot/frontend/src/hooks/useTableWebSocket.ts` (NEW) - WebSocket hook
- `telegram_poker_bot/frontend/src/components/ui/ConnectionStatus.tsx` (NEW) - Status indicator

### No Breaking Changes
- All existing API endpoints remain unchanged
- Database schema unchanged
- No new environment variables required
- Backward compatible with existing clients

## Testing Checklist

### 1. Basic Connection Test
- [ ] Open a table in the web app
- [ ] Verify "Connected" status shows (green dot)
- [ ] Leave the page open for 2+ minutes
- [ ] Connection should stay alive (no reconnects)

### 2. Network Resilience Test
- [ ] Open a table
- [ ] Wait for "Connected" status
- [ ] Disconnect network briefly (5-10 seconds)
- [ ] Reconnect network
- [ ] Should see "Connecting..." then "Connected"
- [ ] Game state should resume normally

### 3. Multiple Players Test
- [ ] Have 2+ players join the same table
- [ ] Start the game
- [ ] Take actions (check, call, raise, fold)
- [ ] All players should see updates immediately
- [ ] No "user not seated" errors
- [ ] No blinking/flickering

### 4. Long Session Test
- [ ] Start a game with 2+ players
- [ ] Play multiple hands (10+ minutes)
- [ ] WebSocket should stay connected
- [ ] No disconnects during gameplay
- [ ] All actions processed correctly

### 5. Browser Tab Test
- [ ] Open table in one tab
- [ ] Switch to another tab for 2+ minutes
- [ ] Return to poker tab
- [ ] Connection should still be active
- [ ] State should be current

### 6. Connection Status Indicator Test
- [ ] Verify status indicator appears on table page
- [ ] Green dot when connected
- [ ] Amber pulsing dot when connecting
- [ ] Gray dot when disconnected
- [ ] Appropriate text labels

## Monitoring

### Backend Logs to Watch For

**Good Signs:**
```
[INFO] WebSocket connected, table_id=X
[DEBUG] Received pong from client, table_id=X
[INFO] WebSocket connection closed, table_id=X (after normal disconnect)
```

**Potential Issues:**
```
[WARNING] WebSocket receive error (continuing), table_id=X
[ERROR] WebSocket fatal error, table_id=X
```

### Frontend Console Logs

**Good Signs:**
```
[WebSocket] Connected to table X
WebSocket connected to table X
```

**Reconnection (Expected for Network Issues):**
```
[WebSocket] Disconnected from table X code: 1006
[WebSocket] Reconnecting in 1000ms (attempt 1)
[WebSocket] Connected to table X
```

**Bad Signs (Should Not Happen):**
```
[WebSocket] Failed to create connection: ...
[WebSocket] Cannot send message: socket not connected (repeatedly)
```

## Performance Metrics

### Expected Behavior

| Metric | Target | Notes |
|--------|--------|-------|
| Connection Duration | Entire game session | Should not disconnect during play |
| Reconnection Time | < 5 seconds | After network interruption |
| Ping Interval | 30 seconds (server) | Server sends ping |
| Pong Interval | 25 seconds (client) | Client sends pong |
| Reconnect Attempts | Unlimited with backoff | Until manual disconnect |
| Max Backoff Delay | 30 seconds | Exponential: 1s, 2s, 4s, 8s, 16s, 30s |

### Known Limits

- **Uvicorn WebSocket Timeout:** Disabled by ping/pong
- **Browser Tab Throttling:** Should not affect connection (ping/pong keeps alive)
- **Mobile Network Changes:** Will trigger reconnect (expected)
- **Server Restart:** Will close all connections (expected)

## Troubleshooting

### Issue: Connection keeps disconnecting

**Check:**
1. Backend logs for errors
2. Frontend console for WebSocket errors
3. Network stability
4. Server resources (CPU, memory)

**Fix:**
- Ensure server ping task is running
- Check for firewall/proxy issues
- Verify WebSocket upgrade headers

### Issue: Reconnection loop

**Check:**
1. Server availability
2. Table still exists
3. WebSocket endpoint accessible

**Fix:**
- Check backend logs for errors
- Verify table not deleted/expired
- Check network/CORS settings

### Issue: State not updating

**Check:**
1. Connection status indicator
2. Browser console for errors
3. Network tab for WebSocket frames

**Fix:**
- Refresh the page
- Check if connection is actually open
- Verify backend is broadcasting events

### Issue: Multiple connections

**Check:**
1. Frontend console for duplicate "Connected" messages
2. Backend logs for multiple connections from same client

**Fix:**
- This should NOT happen with the new implementation
- If it does, check for multiple Table components rendering
- Check React DevTools for component re-renders

## Rollback Plan

If issues arise in production:

1. **Immediate Rollback:**
   ```bash
   git checkout main
   make update
   ```

2. **Gradual Rollback:**
   - Only backend: Revert `api/main.py` changes
   - Only frontend: Revert to old Table.tsx
   - Keep documentation for future reference

## Success Criteria

The fix is successful when:
- ✓ No WebSocket disconnects during normal gameplay
- ✓ Connection survives 2+ minute idle periods
- ✓ Automatic reconnection works after network issues
- ✓ No UI blinking or flickering
- ✓ All player actions processed correctly
- ✓ No "user not seated" errors during game
- ✓ State updates are immediate and consistent

## Next Steps After Testing

1. **Monitor Production Logs**
   - Watch for unexpected errors
   - Track reconnection frequency
   - Monitor connection duration

2. **Gather User Feedback**
   - Improved stability?
   - Any remaining issues?
   - Performance perception

3. **Consider Enhancements**
   - Connection quality metrics
   - Latency monitoring
   - Offline mode/action queueing

## Support

For issues or questions:
1. Check logs first (backend and frontend console)
2. Review `WEBSOCKET_FIX_DOCUMENTATION.md` for technical details
3. Check validation script: `python /tmp/validate_websocket.py`
4. Open GitHub issue with logs and reproduction steps

---

**Version:** 1.0.0
**Last Updated:** 2025-11-19
**Author:** GitHub Copilot Agent
