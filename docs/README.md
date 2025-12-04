# Documentation Index

Welcome to the Poker Bot documentation. This documentation system covers the complete architecture, components, and workflows for the Telegram poker bot with PokerKit engine integration.

## Documentation Structure

The documentation is organized into logical domains:

### [Architecture](./architecture/README.md)
High-level system architecture, component interactions, and design decisions.

- [System Overview](./architecture/overview.md)
- [Component Interactions](./architecture/components.md)
- [Data Flow](./architecture/data-flow.md)

### [Backend](./backend/README.md)
FastAPI backend service documentation covering REST APIs, database models, and business logic.

- [API Overview](./backend/api-overview.md)
- [Database Models](./backend/models.md)
- [Services](./backend/services.md)
- [Templates](./backend/templates.md)

### [Bot](./bot/README.md)
Telegram bot service documentation covering webhook handling, commands, and session management.

- [Bot Overview](./bot/overview.md)
- [Command System](./bot/commands.md)
- [Webhooks](./bot/webhooks.md)
- [Session Management](./bot/sessions.md)

### [Frontend](./frontend/README.md)
React/Vite mini app documentation covering UI architecture and API integration.

- [Mini App Overview](./frontend/overview.md)
- [Variant Support](./frontend/variants.md)
- [API Integration](./frontend/api-integration.md)
- [WebSocket Events](./frontend/websockets.md)

### [Runtime](./runtime/README.md)
Game engine runtime documentation covering PokerKit integration and table management.

- [Runtime Overview](./runtime/overview.md)
- [PokerKit Integration](./runtime/pokerkit.md)
- [Table Lifecycle](./runtime/table-lifecycle.md)
- [Hand Processing](./runtime/hand-processing.md)

### [Analytics](./analytics/README.md)
Analytics and insights system documentation.

- [Analytics Overview](./analytics/overview.md)
- [Snapshot System](./analytics/snapshots.md)
- [Hourly Aggregates](./analytics/hourly-stats.md)
- [Insights Engine](./analytics/insights.md)
- [Admin Dashboard](./analytics/admin-dashboard.md)

### [Deployment](./deployment/README.md)
Deployment and operations documentation.

- [Deployment Overview](./deployment/overview.md)
- [Docker Setup](./deployment/docker.md)
- [Database Migrations](./deployment/migrations.md)
- [SSL Configuration](./deployment/ssl.md)
- [Monitoring](./deployment/monitoring.md)

### [Developer Guide](./developer/README.md)
Developer onboarding and contribution guidelines.

- [Getting Started](./developer/getting-started.md)
- [Development Workflow](./developer/workflow.md)
- [Testing Guide](./developer/testing.md)
- [Code Standards](./developer/standards.md)
- [Contributing](./developer/contributing.md)

## Quick Links

- [Getting Started](./developer/getting-started.md) - Set up your development environment
- [Architecture Overview](./architecture/overview.md) - Understand the system design
- [Deployment Guide](./deployment/overview.md) - Deploy to production
- [API Documentation](./backend/api-overview.md) - REST API reference
- [Testing Guide](./developer/testing.md) - Run and write tests

## Documentation Style Guide

All documentation follows these principles:

- **High-Level Focus**: Describe concepts and flows, not implementation details
- **Clear Structure**: Use consistent headings, sections, and formatting
- **Conceptual Explanations**: Explain the "what" and "why", not the "how"
- **No Code Samples**: Keep documentation abstract and maintainable
- **Version Alignment**: All docs reflect the current architecture (Phases 1-6)
- **Modular Organization**: Each document covers a specific domain

## Contributing to Documentation

When updating documentation:

1. Keep descriptions high-level and conceptual
2. Avoid implementation details, code snippets, or configuration values
3. Ensure alignment with current architecture
4. Update related documents when making changes
5. Follow the established structure and style

## Support

For questions or issues:
- Check the relevant documentation section
- Review the [Developer Guide](./developer/README.md)
- See the main [README](../README.md) for quick references
