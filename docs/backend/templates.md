# Table Templates

This document describes the table template system for game configuration.

## Template System Overview

Templates define all game parameters for table creation, eliminating hardcoded values and enabling flexible configuration.

### Design Goals
- Single source of truth for game rules
- Support multiple poker variants
- Enable custom table configurations
- Simplify table creation process
- Facilitate testing and development

## Template Structure

### Core Attributes

**Identification**
Template name and description for user display, unique identifier for system reference, version number for template updates.

**Game Configuration**
Variant identifier (Texas Hold'em, Omaha, etc.), blind structure and levels, starting stack sizes, player count limits.

**Table Behavior**
Table type (persistent or expiring), time-to-live for expiring tables, waitlist enablement, seating rules and thresholds.

**Advanced Rules**
Ante requirements, rake configuration, variant-specific parameters, custom rule flags.

### Configuration JSON

Templates store all game parameters in a JSON configuration field.

**Blind Structure**
Small and big blind amounts, ante amounts if applicable, blind level progression, time between level changes.

**Stack Configuration**
Starting stack for all players, minimum buy-in if applicable, maximum buy-in if applicable, rebuy and add-on rules.

**Player Limits**
Minimum players to start game, maximum players at table, ideal player count, seating threshold for waitlist.

**Expiry Rules**
Table lifetime in hours/days, idle timeout before auto-close, minimum player maintenance, warning periods before closure.

**Rake Settings**
Rake percentage, rake cap amount, no-flop no-drop rule, rake tiers by pot size.

**Variant Parameters**
Hole cards count (2 for Hold'em, 4 for Omaha), community cards usage rules, draw rounds for draw games, lowball or high-hand evaluation.

## Template Types

### Persistent Templates
Tables that run indefinitely until manually closed.

**Use Cases**
Cash game tables, permanent tournament tables, featured tables, community tables.

**Behavior**
No automatic closure, continue with minimum players, replace leaving players from waitlist, maintain state across server restarts.

### Expiring Templates
Tables that close automatically after a time period.

**Use Cases**
Sit-and-go tournaments, time-limited games, trial tables, event-specific tables.

**Behavior**
TTL countdown starts on creation, warnings before expiry, automatic closure at TTL, final state persisted.

## Variant Support

### Texas Hold'em (No Limit)
Two hole cards per player, five community cards, four betting rounds, standard hand rankings.

**Template Parameters**
Blind amounts, starting stacks, player limits, rake configuration.

### Short Deck Hold'em
Two hole cards, five community cards, reduced deck (36 cards), modified hand rankings.

**Template Parameters**
Similar to Hold'em with deck size flag, hand ranking adjustments.

### Pot Limit Omaha
Four hole cards per player, must use exactly two from hand, pot limit betting, five community cards.

**Template Parameters**
Hole card count, board cards usage rules, pot limit betting flag.

### Draw Poker Variants
Five hole cards (typically), draw rounds with discards, no community cards, various hand evaluations.

**Template Parameters**
Draw rounds count, discard limits, lowball or high-hand flag.

## Template Lifecycle

### Creation
Admin creates template, configuration validated, template stored in database, made available for table creation.

### Usage
User or system selects template, table created with template reference, all parameters loaded from template, template cannot be deleted while tables active.

### Updates
Admin modifies template configuration, new tables use updated configuration, existing tables retain original configuration, version tracking for changes.

### Deletion
Admin marks template inactive, no new tables can use template, existing tables unaffected, archive for historical reference.

## Validation Rules

### Configuration Validation
Blind amounts must be positive, stack sizes must exceed blinds, player limits must be reasonable, variant must be supported, rake percentages must be valid.

### Business Rules
Minimum players less than maximum, starting stack supports reasonable play, blind levels appropriate for variant, expiry times reasonable, seating thresholds achievable.

### Consistency Checks
All required fields present, no conflicting parameters, variant-specific requirements met, default values for optional fields.

## Template Management

### Admin Interface
List all templates, create new templates, edit existing templates, delete unused templates, test template configurations.

### Access Control
Only admins can create templates, public templates visible to all, private templates for specific groups, template usage tracked.

### Versioning
Template changes create new version, version history maintained, tables reference specific version, migration paths for updates.

## Default Templates

### Standard Cash Game
No-Limit Texas Hold'em, common blind levels, typical starting stacks, 2-9 player support, persistent table type.

### Quick SNG
No-Limit Texas Hold'em, tournament structure, faster blind levels, 6 or 9 player tables, expiring after completion.

### Practice Table
Low stakes for beginners, extended time banks, helpful hints enabled, persistent or expiring, smaller player counts.

## Custom Templates

### Creation Process
Admin specifies all parameters, system validates configuration, template saved and activated, assigned to table creation options.

### Testing
Templates tested in staging, validation ensures playability, test tables created, edge cases verified, production deployment.

### Maintenance
Monitor template usage, collect feedback, adjust parameters, update versions, retire unused templates.

## Related Documentation

- [Backend Services](./services.md) - Template service
- [Runtime](../runtime/overview.md) - Template application
- [Database Models](./models.md) - Template storage
- [Architecture](../architecture/overview.md) - System design
