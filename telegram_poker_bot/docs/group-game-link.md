# Group Game Link Flow

This document captures the end-to-end design for the “Play in Group” feature, covering backend data structures, public APIs, Telegram bot behaviour, and the mini-app UX (day and night themes).

## Database Schema

Group invites are stored in `group_game_invites`:

| Column            | Type                    | Notes                                                         |
| ----------------- | ----------------------- | ------------------------------------------------------------- |
| `id`              | `SERIAL`                | Internal primary key                                          |
| `game_id`         | `VARCHAR(64)`           | Public identifier shared via Telegram deep links              |
| `creator_user_id` | `INTEGER`               | FK → `users.id` (registered mini-app user)                    |
| `group_id`        | `INTEGER` (nullable)    | FK → `groups.id`, set after the bot is added to a Telegram chat |
| `status`          | `ENUM` (`pending`, `ready`, `consumed`, `expired`) | Lifecycle state (`pending` by default)                         |
| `deep_link`       | `VARCHAR(255)`          | Cached `https://t.me/<bot>?startgroup=<GAME_ID>`              |
| `expires_at`      | `TIMESTAMPTZ`           | Invite expiry derived from `group_invite_ttl_seconds`         |
| `consumed_at`     | `TIMESTAMPTZ` (nullable)| When a table consumes the invite                             |
| `metadata_json`   | `JSON`                  | Arbitrary context (creator name, language, etc.)              |
| `created_at`      | `TIMESTAMPTZ`           | Auto-managed                                                  |
| `updated_at`      | `TIMESTAMPTZ`           | Auto-managed                                                  |

Migrations live at `telegram_poker_bot/migrations/versions/002_group_game_invites.py`.

## Public API Contracts

All endpoints expect the Telegram WebApp init data header (`X-Telegram-Init-Data`). Helper utilities for verifying the signature live in `telegram_poker_bot/api/main.py`.

### `POST /group-games/invites`

Creates a new invite and DM’s the creator with a shareable message.

```
Request headers:
  X-Telegram-Init-Data: <signed init data>

Response body:
{
  "game_id": "ABC123XYZ",
  "deep_link": "https://t.me/<bot>?startgroup=ABC123XYZ",
  "startapp_link": "https://t.me/<bot>?startapp=ABC123XYZ",
  "expires_at": "2025-11-10T12:34:56Z",
  "status": "pending"
}
```

### `GET /group-games/invites/{game_id}`

Returns public metadata and lazy-updates status to `expired` when `expires_at` passes.

### `POST /group-games/invites/{game_id}/attend`

Marks a user’s intent to join. The response includes a localized status message that the mini app displays while routing.

### `GET /users/me` & `POST /users/register`

Expose a minimal registration flow for players reaching the mini app from a shared invite.

## Telegram Bot Behaviour

* `/start` with `start=register` acknowledges registration and then presents the main menu.
* `/startgroup <GAME_ID>` validates the invite, enforces that the caller is already registered, persists the Telegram group metadata, and replies with a “Start game in group” button (`startapp` deep link).
* If an invite is stale or belongs to a different group, the handler returns localized error messages (`group_invite_expired`, `group_invite_already_linked`, etc.).

## Mini App UX (Day & Night)

### Invite modal (day mode)

* White backdrop (`#FFFFFF`) with shadowed card and neutral border (`#E2E8F0`).
* Accent buttons use `#007BFF`.
* Copy-to-clipboard feedback is a rounded toast (`bg-slate-900`, white text).

### Invite modal (night mode)

* Global background `#121212`, card surfaces `#1F1F1F`, borders `#2B2B2B`.
* Inputs fall back to `#121212` with high-contrast borders.
* Accent buttons use `#1E88E5`, hover state `#166FC1`.
* Toast component switches to `#2B2B2B` with light text.

### Join flow

* Progressive states (`loading`, `requiresRegistration`, `joining`, `ready`, `error`) rendered with context-sensitive cards.
* Messages from the backend (already localized) are surfaced directly.
* CTA buttons reuse the accent palette and respect the active theme.

### Copy-to-clipboard snippet

```tsx
async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
```

Used by `GroupInvitePage` to support both modern browsers and legacy Telegram webviews.

## Configuration Checklist

| Setting | Description |
|---------|-------------|
| `PUBLIC_BASE_URL` | Must point to `https://poker.shahin8n.sbs` (or your deployment domain); used to derive invite links. |
| `group_invite_ttl_seconds` | Controls invite expiry (defaults to 900 seconds). |
| `VITE_BOT_USERNAME` | Bot username (with or without `@`). |
| `VITE_API_BASE_URL` | Base URL for the mini app API (defaults to `/api`). |

## Automated Tests

`tests/test_group_invite_flow.py` exercises the invite lifecycle (create → fetch → join) using an in-memory SQLite database and a fully signed Telegram init payload. Run with:

```
pytest -k group_invite
```

## Manual Verification

1. Create an invite in the mini app and copy the deep link (toast should read “Link copied!” / «لینک کپی شد!»).
2. Visit the `startgroup` link on a Telegram client, add the bot to a group, and observe the localized confirmation message.
3. Launch the mini app from the `startapp` button; the `/group/join/<GAME_ID>` view should display status text (“You are joining … / در حال پیوستن …”).
4. Toggle languages via the header globe button (EN / FA) and confirm all invite/join text updates.
5. Switch to night mode from Settings; invite and join views adapt to the dark palette (`#121212` backgrounds, `#1E88E5` accents).
6. Forward the shared Telegram message to another group to reuse the same invite; duplicate groups are rejected with `group_invite_already_linked`.
