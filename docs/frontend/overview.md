# Frontend Overview

High-level overview of the React mini app frontend.

## Purpose

Provides web-based interface for poker gameplay, accessible via Telegram mini app launcher.

## Architecture

### Component Hierarchy
App root with routing, page components for views, table components for gameplay, shared UI components, admin dashboard components.

### State Management
Local state with useState and useReducer, API state with custom hooks, WebSocket state for real-time data, context for global state.

### Routing
React Router for navigation, protected routes for authenticated users, admin routes for elevated access, dynamic routing based on table ID.

## Key Features

### Variant-Aware Display
UI adapts to game variant, hole cards display supports 2-5 cards, community cards shown when applicable, draw poker discard interface, variant-specific indicators.

### Real-Time Updates
WebSocket connection per table, lobby feed for table list, instant action notifications, state synchronization, fallback polling if needed.

### Admin Dashboard
Analytics data visualization, insights feed display, table inspection interface, real-time monitoring, filtering and sorting.

## Related Documentation

- [Variants](./variants.md) - Variant support
- [API Integration](./api-integration.md) - Backend calls
- [WebSockets](./websockets.md) - Real-time events
