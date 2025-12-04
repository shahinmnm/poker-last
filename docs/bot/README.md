# Telegram Bot Documentation

This section covers the Telegram bot service that provides an alternative interface to the poker system.

## Contents

- [Bot Overview](./overview.md) - Bot architecture and design
- [Command System](./commands.md) - Command handlers and routing
- [Webhooks](./webhooks.md) - Webhook handling and validation
- [Session Management](./sessions.md) - User session tracking

## Bot Architecture

The bot service provides:

### Webhook Handler
Receives updates from Telegram, validates webhook signatures, routes to appropriate handlers.

### Command System
Processes text commands, manages inline keyboard interactions, handles callback queries, supports multilingual responses.

### Session Management
Tracks active table sessions per user, manages WebSocket connections, handles reconnection logic, cleans up resources.

### Menu Navigation
Multi-level inline keyboard menus, dynamic button generation, context-aware navigation, state persistence.

## Technology Stack

- **python-telegram-bot**: Telegram Bot API wrapper
- **FastAPI**: Webhook HTTP server
- **WebSocket Client**: Real-time game updates
- **Async/Await**: Non-blocking operations throughout

## Key Features

### Real-Time Gameplay
WebSocket connections for instant updates, action prompts with inline buttons, fallback to polling if WebSocket unavailable, auto-reconnection with backoff.

### Multilingual Support
English and Farsi/Persian languages, user preference persistence, dynamic text generation, parameter substitution.

### Menu System
Main menu for navigation, profile and statistics access, lobby browsing, wallet operations, settings and preferences.

### Anti-Flood Protection
Rate limiting per user, configurable request limits, automatic violation tracking, graceful handling of exceeded limits.

## Related Documentation

- [Architecture](../architecture/overview.md) - System architecture
- [Backend API](../backend/api-overview.md) - API integration
- [Frontend](../frontend/overview.md) - Alternative interface
