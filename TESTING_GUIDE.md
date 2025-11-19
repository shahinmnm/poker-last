# Testing Guide: Poker Mini-App UX Improvements

## Prerequisites

1. **Database Migration**
   ```bash
   cd /home/runner/work/poker-last/poker-last
   alembic upgrade head
   ```
   This will add `expires_at` and `invite_code` columns to the tables.

2. **Frontend Build**
   ```bash
   cd telegram_poker_bot/frontend
   npm install
   npm run build
   ```

3. **Start Services**
   - Backend API server
   - Telegram bot (optional for full functionality)
   - PostgreSQL database
   - Redis (optional, for caching)

## Test Scenarios

### 1. Table Expiration (10 Minutes)

**Test Case 1.1: New Table Creation**
1. Create a new table (public or private)
2. Verify the table appears in lobby
3. Open table details
4. Verify countdown timer shows ~10:00 (10 minutes)
5. Expected: Timer counts down in real-time

**Test Case 1.2: Countdown Display**
1. Create a table
2. Go to lobby
3. Expected: Small countdown badge shows on table row (e.g., "9:45")
4. Wait 30 seconds
5. Expected: Countdown updates (e.g., "9:15")

**Test Case 1.3: Expiring Soon Warning**
1. Manually set a table's `expires_at` to 90 seconds from now:
   ```sql
   UPDATE tables SET expires_at = NOW() + INTERVAL '90 seconds' WHERE id = <table_id>;
   ```
2. Refresh lobby
3. Expected: Table row has red/glassy background
4. Expected: Countdown shows in red badge

**Test Case 1.4: Table Expiration**
1. Manually set a table's `expires_at` to 5 seconds ago:
   ```sql
   UPDATE tables SET expires_at = NOW() - INTERVAL '5 seconds' WHERE id = <table_id>;
   ```
2. Refresh lobby
3. Expected: Table no longer appears in lobby
4. Try to access table directly via URL
5. Expected: Table still loads (until you add additional checks)

**Test Case 1.5: Auto-Navigation on Expiry**
1. Be viewing a table that's about to expire
2. Wait for countdown to hit 0:00
3. Expected: Toast message "Table has expired"
4. Expected: Auto-navigate to lobby after 2 seconds

### 2. Invite Codes for Private Tables

**Test Case 2.1: Private Table Creation**
1. Create a new private table
2. Check database:
   ```sql
   SELECT id, invite_code, expires_at FROM tables WHERE id = <table_id>;
   ```
3. Expected: `invite_code` is a 6-character code (e.g., "A3B7C9")
4. Expected: Code uses only uppercase letters and digits (excluding O, 0, I, 1)

**Test Case 2.2: Invite Code Display**
1. Create a private table as creator
2. Navigate to table view
3. Expected: "Invite Friends" card is visible
4. Expected: Shows invite code in large, monospace font
5. Expected: "Copy" button is present

**Test Case 2.3: Copy Functionality**
1. View private table as creator
2. Click "Copy" button
3. Paste into a text editor
4. Expected: Clipboard contains the 6-character invite code
5. Expected: Toast message "Invite code copied!"

**Test Case 2.4: Privacy - Invite Code Hidden from Non-Creators**
1. Create private table as User A
2. Join table as User B
3. View table as User B
4. Expected: "Invite Friends" card is NOT visible
5. Expected: User B cannot see the invite code

**Test Case 2.5: Public Tables Have No Invite Code**
1. Create a public table
2. Navigate to table view
3. Expected: "Invite Friends" card is NOT visible
4. Check database:
   ```sql
   SELECT invite_code FROM tables WHERE id = <table_id>;
   ```
5. Expected: `invite_code` is NULL for public tables

### 3. Compact Design

**Test Case 3.1: Table Row Height**
1. Open lobby with multiple tables
2. Measure table row height (browser dev tools)
3. Expected: Rows are approximately 60-70px tall (down from ~90px)
4. Expected: More tables visible without scrolling

**Test Case 3.2: Badge Sizes**
1. View lobby
2. Inspect status badges ("RUNNING", "WAITING", etc.)
3. Expected: Font size is 9px
4. Expected: Badges are compact with minimal padding

**Test Case 3.3: Header Compactness**
1. View any page
2. Measure header height
3. Expected: Header is noticeably smaller
4. Expected: Title font is reduced
5. Expected: Settings icon is smaller

**Test Case 3.4: Bottom Navigation**
1. View bottom navigation bar
2. Expected: Font size is 11px or smaller
3. Expected: Icons and labels are compact
4. Expected: Less vertical space used

### 4. Visual Improvements

**Test Case 4.1: Private Table Lock Icon**
1. Create a private table
2. View in lobby
3. Expected: Visibility badge shows "🔒 Private"
4. Expected: Lock icon is visible before text

**Test Case 4.2: Active Bottom Nav Tab**
1. Navigate to different pages
2. Observe bottom navigation
3. Expected: Active tab has gradient background
4. Expected: Active tab has visible glow/shadow effect
5. Expected: Clear visual difference from inactive tabs

**Test Case 4.3: Glassy Red Warning**
1. Create table expiring in < 2 minutes (see Test Case 1.3)
2. View in lobby
3. Expected: Table card has semi-transparent red background
4. Expected: Border has reddish tint
5. Expected: Still readable and professional

### 5. Integration Tests

**Test Case 5.1: Create → Join → Expire Flow**
1. User A creates private table
2. User A copies invite code
3. User B joins using seat button
4. Wait for expiration warning (< 2 min)
5. Expected: Both users see red warning
6. Wait for full expiration
7. Expected: Table disappears from lobby for both users

**Test Case 5.2: Multiple Tables Ordering**
1. Create 3 tables with different expiration times:
   - Table A: expires in 2 minutes
   - Table B: expires in 8 minutes
   - Table C: expires in 5 minutes
2. View lobby
3. Expected: Tables ordered by expiration: A, C, B
4. Expected: Table A has red background

**Test Case 5.3: Mobile Viewport**
1. Open in browser dev tools
2. Set viewport to 375px width (iPhone SE)
3. Expected: All elements fit without horizontal scroll
4. Expected: Compact design shows more content
5. Expected: Touch targets are still adequate size

### 6. Edge Cases

**Test Case 6.1: Table Without Expiration**
1. Manually create table with NULL expires_at:
   ```sql
   INSERT INTO tables (mode, status, is_public, expires_at) 
   VALUES ('anonymous', 'waiting', true, NULL);
   ```
2. View in lobby
3. Expected: Table appears normally
4. Expected: No countdown shown
5. Expected: No red warning

**Test Case 6.2: Very Long Table Name**
1. Create table with 50+ character name
2. View in lobby
3. Expected: Name truncates with ellipsis (...)
4. Expected: Layout doesn't break

**Test Case 6.3: Rapid Page Navigation**
1. Create table
2. Navigate: Lobby → Table → Lobby → Table (repeat quickly)
3. Expected: Countdown timers work correctly
4. Expected: No memory leaks or duplicate timers
5. Expected: Timers cleanup on unmount

**Test Case 6.4: Expired Table Direct Access**
1. Get URL of expired table
2. Try to access directly
3. Current: Table still loads (expiration only affects listing)
4. Future: Could show "expired" message

## Performance Tests

**Test 1: Countdown Render Performance**
1. Open lobby with 20+ tables
2. All tables have countdowns
3. Expected: Smooth 60fps scrolling
4. Expected: No janky updates

**Test 2: Database Query Performance**
1. Create 100+ tables
2. Refresh lobby
3. Check query time (should be < 100ms)
4. Expected: Expired tables filtered efficiently

## Accessibility Tests

**Test 1: Keyboard Navigation**
1. Use Tab key to navigate
2. Expected: All interactive elements focusable
3. Expected: Visible focus indicators

**Test 2: Screen Reader**
1. Enable screen reader (VoiceOver/NVDA)
2. Navigate lobby
3. Expected: Countdown times announced
4. Expected: "Private" tables clearly labeled

**Test 3: Color Contrast**
1. Use contrast checker tool
2. Check red warning text on background
3. Expected: Meets WCAG AA standards (4.5:1 for text)

## Regression Tests

**Test 1: Existing Table Actions**
1. Join table
2. Leave table
3. Start table (as host)
4. Delete table (as host)
5. Expected: All actions work as before

**Test 2: WebSocket Updates**
1. Open table in two browsers
2. User A takes action
3. Expected: User B sees update

**Test 3: Existing Workflows**
1. Group game invites
2. Public table browsing
3. Player stats
4. Expected: All work without issues

## SQL Queries for Testing

```sql
-- List all tables with expiration info
SELECT id, invite_code, expires_at, created_at, 
       expires_at - NOW() as time_remaining,
       is_public
FROM tables
ORDER BY expires_at ASC;

-- Find tables expiring soon
SELECT id, invite_code,
       EXTRACT(EPOCH FROM (expires_at - NOW()))/60 as minutes_remaining
FROM tables
WHERE expires_at IS NOT NULL
  AND expires_at > NOW()
  AND expires_at < NOW() + INTERVAL '2 minutes';

-- Find expired tables
SELECT id, expires_at
FROM tables
WHERE expires_at < NOW()
  AND status != 'ended';

-- Check invite code uniqueness
SELECT invite_code, COUNT(*) 
FROM tables 
WHERE invite_code IS NOT NULL
GROUP BY invite_code
HAVING COUNT(*) > 1;
```

## Browser Testing

Test in:
- Chrome/Edge (desktop)
- Firefox (desktop)
- Safari (desktop)
- Chrome (Android)
- Safari (iOS)

## Known Limitations

1. Expired tables can still be accessed directly (not filtered in get_table endpoint)
2. Countdown timers don't sync perfectly across tabs (each tab has own interval)
3. Very short expiration times (< 30s) might not trigger warning color
4. Invite code join flow not implemented yet (separate feature)

## Success Criteria

✅ All test cases pass
✅ No console errors
✅ Smooth 60fps performance
✅ Accessible to keyboard/screen reader users
✅ Works on mobile viewports
✅ No regression in existing features
