# Command System

High-level overview of the bot command system.

## Available Commands

### Navigation Commands
Start command launches main menu, menu command shows navigation options, lobby command displays active tables, help command shows usage information.

### User Commands
Profile command shows user information, stats command displays game statistics, invite command generates referral link, language command changes interface language.

### Table Commands
Table command views specific table details, join commands add user to table, leave commands remove from table, action commands submit gameplay actions.

## Command Handling

### Command Routing
Commands parsed from message text, routed to appropriate handler function, parameters extracted if present, handler executes operation, response generated and sent.

### Inline Keyboards
Commands can generate inline keyboards, buttons provide quick actions, callbacks handled separately, state maintained across interactions.

## Related Documentation

- [Bot Overview](./overview.md) - Bot architecture
- [Webhooks](./webhooks.md) - Webhook handling
- [Backend API](../backend/api-overview.md) - API calls
