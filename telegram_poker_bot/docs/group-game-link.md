# Group Play Integration Spec

Comprehensive specification for the “Play in Group” feature spanning backend APIs, bot deep-link handling, mini-app UX, translations, theming, analytics, and validation.

---

## 1. Overview

- **Goal** – Let a host create a shareable invitation (link + QR) from the mini app, invite friends via Telegram, and funnel players (registered or not) through the bot into the same group table.
- **Touchpoints**
  - **Mini App (frontend)** – creates invites, renders share UI, guides joiners, and handles registration fallback with day/night + EN/FA support.
  - **FastAPI backend** – persists invites, exposes status/join APIs, validates Telegram init data, and notifies the host.
  - **Telegram bot** – responds to deep links (`/startgroup`, `startapp`, `start=register`), attaches invites to groups, and orchestrates registration prompts.
- **Happy path** – Host taps “Play in group” → receives link/QR → shares in Telegram → group admin uses link to add bot → joiners open link or mini app → backend confirms table readiness → players land in game view.

Sequence diagrams and component ownership live in this document to keep frontend, backend, and bot efforts aligned.

---

## 2. Responsibilities by Surface

| Surface | Primary Responsibilities | Key Files |
| ------- | ------------------------ | --------- |
| Backend (FastAPI) | Invite creation, invite status checks, join/registration logic, share message dispatch, analytics logging | `telegram_poker_bot/api/main.py`, `telegram_poker_bot/shared/services/group_invites.py`, `telegram_poker_bot/shared/models.py` |
| Telegram Bot | `/startgroup` parsing, group association, registration enforcement, localized responses, inline button orchestration | `telegram_poker_bot/bot/handlers.py`, `telegram_poker_bot/bot/main.py`, `telegram_poker_bot/bot/i18n.py` |
| Mini App (React) | Invite modal, QR display, copy/share controls, join flow state machine, registration fallback UI, theme/i18n toggles | `telegram_poker_bot/frontend/src/pages/GroupInvite.tsx`, `GroupJoin.tsx`, `components/LanguageSelector.tsx`, `providers/ThemeProvider.tsx`, `components/Toast.tsx` |

---

## 3. Data Model

Invites live in `group_game_invites`:

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `SERIAL` | Internal PK |
| `game_id` | `VARCHAR(64)` | Public identifier surfaced in deep links & QR |
| `creator_user_id` | `INTEGER` | FK → `users.id` |
| `group_id` | `INTEGER` (nullable) | FK → `groups.id`, set once bot joins a chat |
| `status` | `ENUM('pending','ready','consumed','expired')` | Lifecycle (defaults to `pending`, moves to `ready` after `/startgroup`, etc.) |
| `deep_link` | `VARCHAR(255)` | Cached `https://t.me/<bot>?startgroup=<GAME_ID>` |
| `expires_at` | `TIMESTAMPTZ` | Derived from `group_invite_ttl_seconds` |
| `consumed_at` | `TIMESTAMPTZ` (nullable) | Set when a table consumes the invite |
| `metadata_json` | `JSONB` | Creator language, names, device info, etc. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Auto-managed |

Support tables:

- `groups`: holds Telegram group metadata (`tg_chat_id`, `title`, `type`) linked on `/startgroup`.
- `users`: persisted via `/users/register`, keyed by Telegram `tg_user_id`.

Migrations: `telegram_poker_bot/migrations/versions/002_group_game_invites.py`.

---

## 4. Backend API Contracts

All endpoints expect `X-Telegram-Init-Data` headers and run `verify_telegram_init_data` (HMAC validation using `WebAppData` secret).

### 4.1 Create invite – `POST /group-games/invites`

- Auth: registered Telegram mini-app user.
- Side effects: generates `game_id`, persists invite, DM’s creator via `send_invite_share_message`, returns `startgroup` + `startapp` links (front derives QR from `deep_link`).

```http
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

Errors: `401` (missing/invalid init data), `500` (unique ID collision after retries).

### 4.2 Invite status – `GET /group-games/invites/{game_id}`

- Public metadata for mini-app preflight.
- Lazy invalidation: if `expires_at` < `now()`, status mutates to `expired`.
- Payload includes `group_title` when invite is already attached.

### 4.3 Join intent – `POST /group-games/invites/{game_id}/attend`

- Authenticated mini-app call used by joiners after registration check.
- Returns `status` (`pending`, `ready`, `consumed`, `expired`) and a localized `message` from `bot.i18n` keys (`group_invite_join_*`).

### 4.4 Registration helpers – `GET /users/me`, `POST /users/register`

- Used to gate invite flows for unregistered users.
- `POST /users/register` persists normalized language + username from Telegram payload.

### 4.5 Future endpoints (tracked)

- `POST /group-games/invites/{game_id}/consume` (not yet exposed) to mark invites consumed when a table starts.
- Metrics/logging pipeline via structured logs (JSON) with keys `event=group_invite.created`, etc.

---

## 5. Telegram Bot Integration

### 5.1 `/start`

- Accepts optional `start=register` parameter.
- Confirms registration success using `group_invite_register_confirm` copy, then shows menu with `Play in Group` CTA.

### 5.2 `/startgroup <GAME_ID>`

- Rejects private chats (`group_invite_use_in_group`).
- Validates invite status (`pending` or `ready`, not expired/consumed).
- Ensures caller is registered; otherwise emits inline `Register with bot` button linking to `https://t.me/<bot>?start=register`.
- Upserts `Group` record (`ensure_group_record`) and calls `attach_group_to_invite`, flipping invite to `ready`.
- Responds with `group_invite_group_ready` message and inline button linking to `startapp` deep link (opening mini app in context).

### 5.3 Error scenarios

- Missing ID: `group_invite_missing_id`.
- Already linked to another chat: `group_invite_already_linked`.
- Expired/consumed: `group_invite_expired` / `group_invite_consumed`.
- DB/logic exceptions: `group_invite_error` (with logging context).

### 5.4 Telemetry

- Log events: `bot.startgroup.success`, `bot.startgroup.registration_required`, `bot.startgroup.conflict`.
- Counters to expose metrics (Prometheus-ready via log forwarder).

---

## 6. Mini App UX & Components

### 6.1 Pages & responsibilities

- `Home.tsx` → hosts “Play in Group” CTA.
- `GroupInvite.tsx`
  - Calls `POST /group-games/invites`.
  - Shows invite card with copy button, share instructions, and “Generate QR code” toggle.
  - Uses `navigator.clipboard.writeText` fallback snippet (below) and `Toast` component for feedback.
- `GroupJoin.tsx`
  - Parses `startapp` payload (`game_id` from Telegram init or query string).
  - Calls `GET /users/me` → if `registered=false`, shows inline registration call-to-action (`POST /users/register`).
  - Once registered, calls `POST /group-games/invites/{game_id}/attend` and transitions through states: `loading` → `requiresRegistration` → `joining` → `ready`/`error`.
  - Redirects to `Table` view when invite status is `ready`.
- `LanguageSelector.tsx` & `providers/LocalizationProvider.tsx`
  - Provide EN/FA toggles, reading translation bundles from `src/locales/en/translation.json` and `fa/translation.json`.
- `ThemeProvider.tsx`
  - Derives theme via system preference + settings page override.
  - Supplies CSS variables consumed by `index.css` and component-level Tailwind classes.

### 6.2 UI copy & translation keys

Core keys (EN/FA parity) live in:

- Bot: `telegram_poker_bot/config/locales/{en,fa}.json`
- Mini app: `frontend/src/locales/{lang}/translation.json`, sections `groupInvite`, `groupJoin`, `qrModal`.

Strings include:

- Invite creation: `groupInvite.title`, `groupInvite.instructions`, `groupInvite.linkLabel`, `groupInvite.copyCta`, `groupInvite.copySuccess`, `groupInvite.qrCta`.
- Join flow: `groupJoin.loading`, `groupJoin.notFound`, `groupJoin.requiresRegistration`, `groupJoin.joining`, `groupJoin.ready`, `groupJoin.error`, `groupJoin.register`.
- Error messages align with backend statuses to avoid manual duplication.

### 6.3 Day/night treatments

- **Day mode**
  - Background: `#F8FAFC`.
  - Cards: white with `#E2E8F0` borders, drop shadow `0 10px 30px rgba(15, 23, 42, 0.12)`.
  - Primary button: `bg-sky-600`, hover `bg-sky-700`.
  - QR modal overlay: translucent `rgba(15, 23, 42, 0.65)` backdrop.
  - Toast: `bg-slate-900`, `text-slate-100`.
- **Night mode**
  - Background: `#0B1120`.
  - Cards: `#111827` surfaces, `#1F2937` outline, text `#F1F5F9`.
  - Primary button: `bg-blue-500`, hover `bg-blue-400`.
  - QR modal: surface `#1F2937`, border `#334155`, enlarge QR to 240px square with white padding.
  - Toast: `bg-slate-200`, `text-slate-900`.

### 6.4 QR code requirements

- Generated client-side (`qrcode.react` or similar), seeded with `deep_link`.
- Provide download button (`canvas.toDataURL('image/png')`) and “Share via Telegram” explanation.
- Ensure contrast ratio (QR black squares `#111827` on white background) meets scanning requirements across themes.

### 6.5 Copy-to-clipboard fallback

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

Referenced by `GroupInvite.tsx`. Toast messaging: `groupInvite.copySuccess` (`"Link copied!" / «لینک کپی شد!»`).

### 6.6 Error handling & edge cases

- Missing `game_id`: show `groupJoin.missingParam` and CTA to return home.
- Invite expired/full/consumed: map backend status to `groupInvite.expired`, `groupInvite.full`, `groupInvite.consumed` copy.
- Telegram losing `startgroup` parameter (known iOS bug):
  - Provide fallback instructions (`groupJoin.lostContext`) prompting user to open link from message again.
- Network failures: show `Toast` with retry button and log to Sentry (configurable).

---

## 7. Logging & Analytics

- **Backend**
  - Structured logs with `event`, `user_id`, `game_id`, `status`.
  - Events: `group_invite.created`, `group_invite.status`, `group_invite.join_attempt`.
  - Export via existing logging pipeline (`telegram_poker_bot/shared/logging.py`).
- **Bot**
  - Log deep link usage: `bot.startgroup.received`, `bot.startgroup.ready`, `bot.startgroup.registration_required`.
  - Optionally increment Redis counters for dashboard.
- **Frontend**
  - Emit analytics events (`window.Telegram.WebApp.sendData` or custom logger) for: invite_created, invite_copied, qr_opened, join_success, join_error.
  - Persist minimal telemetry; respect GDPR by avoiding PII beyond language/theme choices.

---

## 8. Automated & Manual Testing

### 8.1 Automated coverage

- `tests/test_group_invite_flow.py` – create → fetch → join.
- Add coverage for `/group-games/invites/{game_id}` expired branch (inject past `expires_at`).
- Bot handler tests (pytest + `python-telegram-bot` `Application.test` harness) verifying `/startgroup` for:
  - Valid invite (status transitions to `ready`).
  - Registration required path.
  - Already linked conflict.

Run subset:

```bash
pytest -k "group_invite or startgroup"
```

Frontend: add Cypress / Playwright smoke tests (tracked separately) for invite modal + join flow.

### 8.2 Manual verification checklist

1. Host creates invite, sees link + QR + toast.
2. Host receives DM from bot with deep link and inline button (`group_invite_share_message`).
3. Admin adds bot to group via link – bot responds localized, invite status flips to `ready`.
4. Registered player opens `startapp`, `GroupJoin` shows progress then auto-redirects to table.
5. Unregistered player opens link – sees registration prompt, taps button, returns and succeeds.
6. Expired invite shows friendly error on both bot and mini app.
7. Language toggle (EN/FA) updates invite + join copy; theme toggle updates colors including QR modal.
8. QR saved to gallery and scanned from another device → deep link resolves correctly.

Record outcomes in QA checklist.

---

## 9. Configuration & Deployment Checklist

| Setting | Description |
| ------- | ----------- |
| `PUBLIC_BASE_URL` | Base used for deep links; must be accessible over HTTPS. |
| `group_invite_ttl_seconds` | Invite lifetime (default `900`). Adjust for tournament modes if required. |
| `VITE_BOT_USERNAME` | Bot username (with/without `@`). Frontend normalizes before rendering links. |
| `VITE_API_BASE_URL` | API origin for mini app (defaults to `/api`). |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Used by bot service to verify Telegram webhook. |
| `VITE_DEFAULT_THEME` | `system`/`light`/`dark` toggling default. |
| `VITE_SUPPORTED_LANGS` | Ensure `["en","fa"]` includes both locales needed for invite flows. |

Deploy checklist:

1. Run Alembic migrations (ensures invite table present).
2. Restart bot + API services so new handlers/endpoints load.
3. Purge CDN cache for mini app to ship updated UI assets.

---

## 10. Reference Implementation Links

- API handlers: `telegram_poker_bot/api/main.py` (`create_group_game_invite`, `get_group_game_invite`, `attend_group_game_invite`, `register_current_user`).
- Bot handlers: `telegram_poker_bot/bot/handlers.py` (`start_handler`, `start_group_handler`).
- Shared services: `telegram_poker_bot/shared/services/group_invites.py`.
- Frontend pages: `telegram_poker_bot/frontend/src/pages/GroupInvite.tsx`, `GroupJoin.tsx`.
- Locale bundles: `telegram_poker_bot/config/locales/en.json`, `fa.json`; `frontend/src/locales/en/translation.json`, `fa/translation.json`.

---

## 11. Outstanding Enhancements (Backlog)

- Auto-expire invites via scheduled job & notify host.
- Surface invite activity metrics in admin dashboard.
- Support group roster preview in mini app before table start.
- Add inline “Share via Telegram” that triggers `navigator.share` when supported.

---

This document is the single source of truth for the Group Play invitation integration. Update it whenever backend contracts, bot flows, or mini-app UX changes to keep all surfaces synchronized.
