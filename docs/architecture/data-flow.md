# Data Flow and Lifecycle

This document describes the data flows and lifecycle management across the poker bot system.

## Table Lifecycle

### Creation to Teardown

The complete lifecycle of a poker table from creation to teardown:

**1. Table Creation**
- Admin or system initiates table creation
- Table template selected for game configuration
- Database record created with template reference
- Runtime initializes PokerKit state from template
- Waitlist initialized if configured
- Table status set to WAITING
- Table appears in lobby feed

**2. Waitlist Phase**
- Users discover table in lobby
- Join requests add users to waitlist queue
- FIFO ordering maintained strictly
- Minimum player threshold monitored
- Users can view waitlist position
- Notifications sent for position changes

**3. Seating Transition**
- Minimum players threshold reached
- System begins seating process
- Players moved from waitlist to seats in order
- Starting stacks assigned from template
- Seats marked as occupied
- Table status transitions to ACTIVE
- All players notified of seating

**4. Gameplay Phase**
- First hand automatically dealt
- Blinds and antes posted per template
- Cards dealt to all active players
- Action rotation begins
- Players submit actions in turn
- State updates after each action
- Hand progresses through streets

**5. Hand Completion**
- Final street completes or early winner
- Showdown and winner determination
- Pot awarded to winner(s)
- Statistics updated for all players
- Brief inter-hand waiting period
- Next hand automatically initiated

**6. Continuous Play**
- Hands repeat in continuous loop
- Players can leave between hands
- New players join from waitlist if space
- Sitout management for inactive players
- Minimum player count maintained

**7. Teardown Conditions**
- All players leave voluntarily
- Admin manually closes table
- Expiring table TTL reached
- Minimum players not maintained
- System shutdown initiated

**8. Final Cleanup**
- Final game state persisted
- Table status set to ENDED
- All WebSocket connections closed
- Analytics final snapshot captured
- Waitlist cleared and logged
- Resources released

## User Lifecycle

### Registration to Active Play

The journey of a user from first interaction to active gameplay:

**1. Initial Registration**
- User opens Telegram mini app or messages bot
- Telegram authentication data provided
- Backend validates Telegram credentials
- User record created or retrieved
- Wallet initialized if feature enabled
- Language preference set
- Welcome message and tutorial

**2. Mini App Access**
- User launches mini app from bot
- Frontend validates session
- Initial data loaded from backend
- Lobby and tables displayed
- User profile accessible

**3. Table Discovery**
- User browses lobby in mini app or bot
- Active and waiting tables listed
- Filters applied for variant or stakes
- Table details viewed on selection
- Join button or command available

**4. Joining Process**
- User requests to join specific table
- Backend validates capacity and permissions
- User added to waitlist if seats full
- Waitlist position communicated
- Seating occurs when space available

**5. Game Participation**
- WebSocket connection established
- Initial table state synchronized
- Cards and game state displayed
- Action prompts shown when turn
- Actions submitted via UI or bot
- Results and updates received real-time

**6. Between Hands**
- Hand completion shown with results
- Statistics updated in profile
- Brief waiting period before next hand
- Option to leave or continue
- New players may join

**7. Leaving Table**
- User requests to leave
- Leave processed between hands
- Seat marked as empty
- WebSocket disconnected
- Session cleaned up
- Returns to lobby

**8. Profile and Stats**
- User views profile anytime
- Statistics aggregated from all hands
- Transaction history if wallet enabled
- Language and preferences editable
- Invite link for referrals

## Admin Lifecycle

### Analytics to Insights to Action

The admin workflow for monitoring and managing the system:

**1. Analytics Monitoring**
- Admin accesses analytics dashboard
- Real-time table snapshots viewed
- Hourly aggregates displayed
- System-wide summary available
- Historical data queried with date range

**2. Pattern Detection**
- Analytics engine runs periodically
- Table snapshots analyzed for patterns
- Anomalies detected and flagged
- Trends identified and categorized
- Severity assigned to findings

**3. Insight Generation**
- Insights created from detected patterns
- High traffic tables flagged
- Low engagement noted
- Rapid player changes detected
- Waitlist surges identified
- Inactivity patterns logged

**4. Insight Delivery**
- Insights pushed to admin channels
- Telegram notifications for critical items
- Webhook delivery for integrations
- Logging for all insight types
- Dashboard display with filtering

**5. Table Inspection**
- Admin selects specific table for detail
- Current game state retrieved
- Player list and seats shown
- Waitlist viewed if applicable
- Action history available
- Statistics for table sessions

**6. Administrative Actions**
- Close problematic tables
- Adjust table configurations
- Manage waitlists manually
- Review user reports
- Export analytics data

## Hand Processing Flow

### From Deal to Completion

The detailed flow of a single poker hand:

**1. Hand Initialization**
- Runtime detects ready state
- New hand number assigned
- PokerKit state created
- Player positions determined
- Button and blind positions set

**2. Blind and Ante Collection**
- Small blind posted automatically
- Big blind posted automatically
- Antes collected if configured
- Initial pot established
- Stacks reduced accordingly

**3. Card Dealing**
- Hole cards dealt to each player
- Cards persisted in database
- State broadcast to players
- Each player sees own cards only
- Dealer position indicated

**4. Pre-Flop Action**
- Action starts left of big blind
- Current player prompted for action
- Allowed actions determined
- Action submitted and validated
- State updated and broadcast
- Next player prompted

**5. Flop Dealing**
- Betting round completes
- Burn card removed
- Three community cards dealt
- Board state updated
- All players notified
- New betting round begins

**6. Turn and River**
- Similar flow for each street
- Burn and deal single card
- Board updated incrementally
- Action rounds complete
- Pot grows with each bet
- Players can fold or continue

**7. Showdown**
- Final betting completes
- Active hands revealed
- Hand rankings evaluated
- Winner(s) determined
- Pot split if necessary
- Results broadcast to all

**8. Hand Completion**
- Pot awarded to winner(s)
- Chip movements recorded
- Statistics calculated
- Hand history stored
- State persisted to database
- Inter-hand period begins

**9. Next Hand Preparation**
- Button position advanced
- Eliminated players removed
- New players seated from waitlist
- Stacks validated
- Ready for next hand

## Analytics Collection Flow

### Snapshot to Insights

The flow of analytics data from collection to delivery:

**1. Snapshot Collection Trigger**
- Background scheduler activates
- Collection interval reached
- Active tables queried from database
- Snapshot process initiated

**2. Data Extraction**
- Current table states retrieved
- Player counts extracted
- Status flags captured
- Waitlist sizes recorded
- Metadata compiled
- Timestamp assigned

**3. Snapshot Storage**
- Snapshot record created
- Data stored in snapshots table
- Indexed by table and time
- No game state modification
- Collection logged for monitoring

**4. Hourly Aggregation Trigger**
- Scheduler reaches hour boundary
- Tables with activity identified
- Snapshots from past hour queried
- Aggregation process begins

**5. Metric Calculation**
- Average player count computed
- Maximum players determined
- Activity duration calculated
- Total hands counted if available
- Additional metrics derived

**6. Aggregate Storage**
- Hourly stats record created or updated
- Data stored in hourly stats table
- Unique constraint on table and hour
- Previous data overwritten if regenerated
- Aggregation logged

**7. Insight Generation Trigger**
- Scheduled run or manual request
- Recent data time window specified
- Snapshots and hourly stats queried
- Analysis engine invoked

**8. Pattern Analysis**
- Data analyzed for anomalies
- Thresholds compared
- Patterns categorized by type
- Severity assigned based on rules
- Structured insights created

**9. Insight Delivery**
- Insights formatted for channels
- Logging channel writes to logs
- Telegram channel sends messages
- Webhook channel posts to endpoints
- Delivery results tracked

**10. Admin Consumption**
- Admin views insights dashboard
- Insights filtered by severity or type
- Details expanded on selection
- Historical insights browsed
- Actions taken based on insights

## WebSocket Event Flow

### Real-Time Updates

The flow of real-time events through WebSocket connections:

**1. Connection Establishment**
- Client requests WebSocket connection
- Backend validates authentication
- Connection upgraded to WebSocket protocol
- Client subscribed to relevant channels
- Initial state sent to client

**2. State Update Events**
- Game state changes in runtime
- Update event created
- Event broadcast to table channel
- All connected clients receive update
- UIs update to reflect new state

**3. Action Required Events**
- Player turn detected
- Action required event created
- Event sent to specific player connection
- Allowed actions included
- UI prompts player for action

**4. Action Performed Events**
- Player submits action
- Action validated and executed
- Action performed event created
- Broadcast to all table subscribers
- Other players see action result

**5. Hand Completion Events**
- Hand reaches completion
- Results calculated
- Hand finished event created
- Broadcast with winner and amounts
- All players notified simultaneously

**6. Lobby Update Events**
- Table status changes
- Lobby update event created
- Broadcast to lobby subscribers
- Table lists refreshed
- New tables or status shown

**7. Disconnection Handling**
- Client connection lost
- Server detects disconnect
- Session marked for cleanup
- Resources released
- Reconnection logic on client

## Related Documentation

- [System Overview](./overview.md) - Complete architecture
- [Component Interactions](./components.md) - Integration details
- [Runtime Documentation](../runtime/README.md) - Game processing details
- [Analytics Documentation](../analytics/README.md) - Analytics system details
