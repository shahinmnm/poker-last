# Bot Overview

This document provides a high-level overview of the Telegram bot service.

## Bot Purpose

The bot provides an alternative text-based interface to the poker system for users who prefer Telegram over the web mini app.

## Architecture

### Component Structure

**Handler Layer**
Command handlers process text commands, callback handlers manage button clicks, routing logic directs to appropriate handler, error handlers catch and log exceptions.

**Service Layer**
API client communicates with backend, WebSocket client for real-time updates, session manager tracks active connections, localization service for multilingual text.

**Integration Layer**
Backend API for all operations, WebSocket for game updates, Telegram API for sending messages, Redis for session caching.

## Message Flow

### User Sends Command
Telegram forwards to webhook, bot validates signature, command extracted and parsed, routed to handler, handler processes request.

### Handler Processes
Calls backend API if needed, generates response text and keyboard, localizes text to user language, sends message to user.

### User Clicks Button
Callback query received, button data extracted, routed to callback handler, action executed, message updated with new content.

### Real-Time Update
WebSocket receives event, event type determines handler, message generated for user, sent via bot API, user sees update immediately.

## Session Management

### Session Creation
User joins table via bot, session created in manager, WebSocket connection established, event listener started, user receives initial state.

### Session Lifecycle
One active session per user, session tracks table and connection, actions routed through session, state kept synchronized, cleanup on disconnect.

### Session Cleanup
User leaves table, WebSocket disconnected, session removed from manager, resources released, user returns to lobby.

## Multilingual Support

### Language Selection
User chooses language via settings, preference stored in database, all subsequent messages in chosen language, inline keyboards also localized.

### Text Generation
Template strings defined per language, parameters substituted dynamically, fallback to English if translation missing, consistent formatting across languages.

## Related Documentation

- [Commands](./commands.md) - Command details
- [Webhooks](./webhooks.md) - Webhook handling
- [Sessions](./sessions.md) - Session management
- [Backend API](../backend/api-overview.md) - API integration
