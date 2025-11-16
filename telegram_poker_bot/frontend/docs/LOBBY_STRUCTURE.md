# Lobby layout reference

This frontend now renders the lobby with compact, reusable pieces to keep the list scannable in a mini-app viewport.

## Component hierarchy

- `pages/Lobby.tsx` – data fetching and state management. It stitches together the visual blocks below.
- `components/lobby/LobbySection.tsx` – wraps a card + section header for each lobby grouping (my tables, public tables).
- `components/lobby/TableRow.tsx` – the single compact renderer for any table. It shows:
  - Table name with a small stakes chip on the right.
  - Status + role/visibility badges with semantic colors.
  - A 3-item meta grid (players, blinds/stack, created/joined timestamps).
- `components/lobby/LobbyEmptyState.tsx` – consistent empty state styling with optional actions.
- `components/lobby/types.ts` – shared TypeScript types for table payloads.

## Adjusting density and typography

- Row padding, font weights, and badge sizing live in `TableRow.tsx`. Tweaking the `p-4` padding or `text-base`/`text-[13px]` classes will tighten or loosen the rows globally.
- Section spacing is centralized in `LobbySection.tsx` (`padding="md"` on the card and `mt-4 space-y-2` for content).

## Status and role color tokens

Semantic badge colors come from CSS variables in `src/index.css`:

- Status: `--status-running-*`, `--status-waiting-*`, `--status-finished-*`.
- Role: `--role-host-*`, `--role-seated-*`.

Adjusting these variables updates every badge tone without changing component code.
