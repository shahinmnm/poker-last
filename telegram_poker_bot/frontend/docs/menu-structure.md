# Mini App Menu Specification

This document captures the navigation tree for the Telegram poker mini app, including bilingual labels (English / Persian), routes, and the intended user flows for each node. All labels originate from the shared i18n catalog (`src/locales/{en,fa}/translation.json`).

## Top-Level Menus

| Route / Path          | Icon | English Label        | Persian Label | Description (EN)                                       | توضیح (FA)                                              |
|-----------------------|:----:|----------------------|---------------|--------------------------------------------------------|---------------------------------------------------------|
| `/`                   | 🏠   | Home                 | خانه          | Hub for quick actions, announcements, and onboarding.  | مرکز اقدامات سریع، اطلاعیه و معرفی تجربه.             |
| `/lobby`              | 🎲   | Lobby                | لابی          | Browse public tables, tournaments, and invitations.    | مرور میزهای عمومی، تورنمنت‌ها و دعوت‌نامه‌ها.         |
| `/games/create`       | 🃏   | Create Game          | ساخت بازی     | Configure a private/public table or tournament lobby. | ساخت میز خصوصی/عمومی یا تورنمنت.                      |
| `/games/join`         | ➕   | Join Game            | پیوستن به بازی | Enter an invite code or scan a QR to join.             | ورود کد دعوت یا اسکن QR برای پیوستن.                  |
| `/profile`            | 👤   | Profile              | پروفایل        | Player identity, highlights, achievements, stats.      | هویت بازیکن، آمار و دستاوردها.                         |
| `/wallet`             | 💰   | Wallet               | کیف پول        | Chip balance, deposits, withdrawals, and history.      | موجودی ژتون، واریز/برداشت و تاریخچه تراکنش.           |
| `/settings`           | ⚙️   | Settings             | تنظیمات        | Preferences, notifications, and language selection.    | ترجیحات، اعلان‌ها و انتخاب زبان.                       |
| `/help`               | ❓   | Help                 | راهنما         | How to play, FAQ, and contact/support information.     | نحوه بازی، سوالات متداول و پشتیبانی.                  |
| `/table/:tableId`     | —    | Table View           | نمای میز       | Real-time table state and player actions.              | وضعیت زنده میز و اقدامات بازیکن.                       |

## Sub-Menus & Flows

### Home (`/`)
- **Quick actions**  
  - `Quick seat / صندلی فوری` → opens Lobby filtered for anonymous tables (CTA links to `/lobby`).  
  - `Play with friends / بازی با دوستان` → deep links to Create Game workflow (`/games/create`).  
- **Main menu cards** surface every other top-level destination with their sub-menus for quick navigation.  
- **How it works / نحوه کار** gives a three-step onboarding checklist.

### Lobby (`/lobby`)
| Anchor | English Label      | Persian Label     | Flow |
|--------|--------------------|-------------------|------|
| `#active-tables` | Active tables | میزهای فعال | View auto-refreshed list of public tables. Selecting a row pushes `/games/join` with the table’s invite code prefilled (future WebSocket integration). |
| `#tournaments`   | Upcoming tournaments | تورمنت‌های پیش رو | Surfacing scheduled events. CTA opens modal (future) or dedicated schedule view. |
| `#invitations`   | Invitations | دعوت‌نامه‌ها | Shows invites received via bot messages. One-tap joins by reusing the invite code in `/games/join`. |

### Create Game (`/games/create`)
- **Private table / میز خصوصی** — default privacy, share code manually.  
- **Public listing / لیست عمومی** — marks visibility for Lobby discovery.  
- **Tournament / تورمنت** — reserved for future multi-table setup.  
- Form captures name, variant, buy-in, max players, privacy, auto-start preference. Submission currently stores draft locally pending API integration.

### Join Game (`/games/join`)
- **Invite code / کد دعوت** — 6-character alphanumeric entry; persists recent codes for convenience.  
- **Scan QR / اسکن QR** — placeholder button (future mini app integration with TG WebApp scanning).  
- Success acknowledgement notifies the player that seating will begin when host starts the table.

### Profile (`/profile`)
- **Overview / نمای کلی** — shows Telegram-derived identity, join date, and quick stats.  
- **Performance stats / آمار عملکرد** (`/profile/stats`) — detailed stats dashboard (currently placeholder analytics cards).  
- **Achievements / دستاوردها** — tracks milestone badges with lock/unlock states.  
- Cross-links to Wallet for chip management.

### Wallet (`/wallet`)
- **Balance / موجودی** — total chips, available and reserved split.  
- **Deposit / واریز**, **Withdraw / برداشت**, **Transfer / انتقال** — primary actions (UI stubs awaiting backend).  
- **Transaction history / تاریخچه تراکنش** — last movements with color-coded amounts.

### Settings (`/settings`)
- **Language / زبان** — inline language selector powered by i18next.  
- **Appearance / نمای ظاهری** — toggles dark mode preference (client-side placeholder).  
- **Notifications / اعلان‌ها** — toggle for push/in-app alerts.  
- Global “Save preferences” CTA ready for persistence hook.

### Help (`/help`)
- **How to play / چطور بازی کنیم** — ordered steps for onboarding.  
- **FAQ / سوالات متداول** — expandable questions & answers.  
- **Support / پشتیبانی** — directs to bot or support email.

### Table View (`/table/:tableId`)
- Displays board cards, pots (main + side), and current action buttons using i18n strings.  
- Buttons trigger REST actions with Telegram `initData` headers (existing backend integration).  
- Translation-aware chips and headings ensure localized play experience.

## Language Support Notes
- Supported languages are defined by environment variable `VITE_SUPPORTED_LANGS` (default `en,fa`).  
- Labels leverage the shared translation keys, so adding a new language requires:  
  1. Extending `translation.json` under `src/locales/<lang>/`.  
  2. Supplying optional overrides via `VITE_LANG_<CODE>_LABEL` / `_DIR` if needed.  
  3. Adding the code to `VITE_SUPPORTED_LANGS`.  
- Direction (LTR / RTL) automatically switches based on the selected language metadata.

