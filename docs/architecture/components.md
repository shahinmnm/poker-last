# Component Interactions

This document describes how the major components of the poker bot system interact with each other.

## Component Diagram

The system consists of these primary components:
- Frontend Mini App (React/TypeScript)
- Backend API Service (FastAPI)
- Telegram Bot Service (python-telegram-bot)
- Game Runtime (PokerKit integration)
- Analytics Engine (Background scheduler)
- Data Layer (PostgreSQL + Redis)

## Interaction Patterns

### Frontend → Backend API

The frontend communicates with the backend via REST and WebSocket connections.

**REST API Communication**
- User profile retrieval and updates
- Table listing and filtering
- Join and leave table requests
- Game action submission
- Admin analytics queries
- Insights retrieval

**WebSocket Communication**
- Real-time table state updates
- Lobby feed subscriptions
- Action notifications
- Hand completion events
- Player join/leave notifications

**Authentication Flow**
Frontend provides Telegram init data, backend validates and creates session, subsequent requests include session token, WebSocket connections authenticated on connect.

### Bot Service → Backend API

The bot service acts as an alternative frontend interface.

**User Management**
Bot retrieves user profiles, creates new users on first interaction, updates language preferences, fetches balance and statistics.

**Table Operations**
Bot lists available tables, joins users to tables, submits actions on behalf of users, retrieves current game state, handles leave requests.

**Session Management**
Bot maintains active table sessions, establishes WebSocket connections for real-time updates, tracks one session per user, cleans up on disconnect.

### Backend API → Runtime

The backend delegates game logic to the runtime component.

**Table Initialization**
Backend creates table from template, runtime instantiates PokerKit state, initial seating and stacks configured, table ready for gameplay.

**Hand Processing**
Backend requests new hand start, runtime deals cards and collects blinds, state synchronized to database, ready for player actions.

**Action Handling**
Backend validates action requests, runtime executes action in PokerKit, state updates persisted, results broadcast via WebSocket.

**State Queries**
Backend requests current game state, runtime provides serialized state, state transformed for API responses, sent to connected clients.

### Runtime → PokerKit Engine

The runtime wraps the PokerKit engine with persistence and async handling.

**State Management**
Runtime creates PokerKit state objects, configures automations and rules, maintains state across hands, persists state to database, restores state on reload.

**Action Execution**
Runtime translates API actions to PokerKit methods, executes actions on state object, captures state changes, extracts results and updates.

**Game Flow Control**
Runtime detects hand completion, triggers stat calculations, initiates next hand, manages inter-hand waiting period, handles table teardown.

### Analytics Engine → Database

The analytics system reads table data without affecting gameplay.

**Snapshot Collection**
Scheduler triggers periodic collection, queries current table states, extracts relevant metrics, stores snapshots in database, never modifies game state.

**Hourly Aggregation**
Scheduler runs at hour boundaries, queries snapshots from past hour, calculates aggregate statistics, stores results in hourly stats table, updates existing records if needed.

**Insights Generation**
Scheduler or manual trigger initiates, queries recent snapshots and hourly stats, analyzes patterns and anomalies, generates structured insights, stores or delivers results.

### Backend API → Analytics Engine

The backend provides read-only access to analytics data.

**Admin Endpoints**
Admin requests real-time analytics, backend queries latest snapshots, formats and returns data, no game state modification.

**Historical Queries**
Admin specifies date range, backend retrieves relevant snapshots or hourly stats, applies filters and pagination, returns structured response.

**Insights Delivery**
Admin triggers insight generation, backend invokes analytics engine, insights generated from recent data, results returned or delivered via channels.

## Data Flow Patterns

### User Lifecycle

**Registration Phase**
User opens mini app or starts bot, Telegram auth data provided, backend creates or retrieves user record, wallet initialized if enabled, session established, user redirected to lobby.

**Table Discovery**
User views lobby via frontend or bot, backend queries active tables, applies filters and permissions, returns table list with metadata, user selects table to join.

**Joining Table**
User requests to join table, backend checks capacity and permissions, adds to waitlist if needed, assigns seat when available, WebSocket connection established, initial state sent to user.

**Playing Hands**
User receives action prompt, submits action via frontend or bot, backend validates and forwards to runtime, runtime executes in PokerKit, state update broadcast to all players.

**Leaving Table**
User requests to leave, backend marks seat as empty, notifies other players, WebSocket connection closed, session cleaned up.

### Table Lifecycle

**Creation**
Admin or system creates table, template specified for configuration, database record created, runtime initializes PokerKit state, table appears in lobby.

**Waitlist Phase**
Table in WAITING status, users join waitlist queue, FIFO ordering maintained, seating threshold monitored.

**Seating**
Minimum players reached, users moved from waitlist to seats, starting stacks assigned from template, table transitions to ACTIVE.

**Gameplay Phase**
First hand dealt automatically, players take turns acting, hands complete and new hands begin, state persisted after each action, analytics snapshots collected periodically.

**Inter-Hand Period**
Hand completes and winner determined, stats updated for all players, brief waiting period, next hand automatically dealt, continuous gameplay.

**Teardown**
All players leave or admin closes, final state persisted, table marked as ENDED, analytics final snapshot, waitlist cleared.

### Analytics Lifecycle

**Collection Phase**
Scheduler triggers every few minutes, queries all active/waiting tables, captures lightweight snapshot, stores in snapshots table, no game impact.

**Aggregation Phase**
Scheduler triggers each hour, retrieves snapshots from past hour, computes aggregates per table, stores in hourly stats table, old snapshots cleaned periodically.

**Insights Phase**
Scheduler or manual trigger, analyzes recent data for patterns, detects anomalies and trends, generates structured insights, delivers via configured channels.

**Consumption Phase**
Admin views analytics dashboard, frontend queries backend API, backend retrieves snapshots or hourly stats, data formatted and displayed, insights shown with severity indicators.

## Event Broadcasting

### WebSocket Events

**Table Events**
State updates broadcast to table subscribers, action notifications sent to all players, hand results delivered on completion, player join/leave announced.

**Lobby Events**
Table creation announced to lobby subscribers, table status changes broadcast, player count updates sent, table removal notifications.

**Admin Events**
Insights delivered to admin channels, real-time analytics updates, alert notifications for critical patterns.

## Error Handling Flows

### Request Validation
Frontend sends invalid request, backend validates and rejects, error response with details, frontend displays user message.

### Game State Errors
Runtime detects invalid action, error returned to backend, backend logs and responds, user notified to retry.

### Connection Failures
WebSocket connection drops, client attempts reconnect, fallback to polling if needed, state resynchronized on reconnect.

### Analytics Failures
Snapshot collection fails, error logged but gameplay unaffected, retry on next scheduled run, admin alerted if persistent.

## Related Documentation

- [System Overview](./overview.md) - Complete architecture
- [Data Flow](./data-flow.md) - Detailed lifecycle flows
- [Backend Documentation](../backend/README.md) - API specifications
- [Runtime Documentation](../runtime/README.md) - Game engine details
