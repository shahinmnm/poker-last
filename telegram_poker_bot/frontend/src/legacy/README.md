# Legacy UI Components

This directory contains legacy UI components and utilities that have been superseded by the new normalized state architecture.

## Directory Structure

- `ui/table-legacy/` - Legacy table components (ActionBar, PlayerSeat, etc.)
- `ui/lobby-legacy/` - Legacy lobby/tables components
- `hooks/` - Legacy hooks (useTableWebSocket, useTableActions)
- `utils/` - Legacy utility files (referenced by deprecation comments in src/utils/)
- `types/` - Legacy type definitions (referenced by deprecation comments in src/types/)

## Status

**QUARANTINED** - Do not use these components in new code.

These components are kept for reference and to maintain backward compatibility with existing code that hasn't been migrated yet. All new development should use:

- New UI: `src/components/lobby-new/`
- New hooks: `src/hooks/useTableSync.ts` and `src/hooks/useLobbySync.ts`
- New types: `src/types/normalized.ts`
- New services: `src/services/WebSocketManager.ts`

## Migration Path

When migrating legacy code:

1. Replace legacy WebSocket hooks with `useTableSync` or `useLobbySync`
2. Replace legacy types with normalized types
3. Use backend-provided state exclusively (no client-side calculations)
4. Attach Telegram `initData` to all API requests
5. Remove imports of legacy components

## Removal Plan

These components will be completely removed in a future release once all dependencies have been migrated.
