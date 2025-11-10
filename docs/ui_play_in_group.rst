Play in Group UI/UX Specification
=================================

Overview
--------
This document defines the end-to-end user experience for the "Play in group" (بازی در گروه) flow in the Telegram mini-app. It covers screen structure, interaction details, styling tokens, responsive behavior, and localization requirements for implementing the front-end skeleton. Backend integration, game logic, and navigation beyond these flows are out of scope.

Experience Goals
~~~~~~~~~~~~~~~~
* Users can invite others to join a group poker table via a generated deep-link or QR code.
* The interface remains understandable in both English and Persian (right-to-left) contexts.
* Day and night themes maintain contrast accessibility (WCAG AA) while sharing consistent hierarchy.
* Key actions are always visible and accompanied by inline guidance.

User Flow Summary
-----------------
The flow consists of five primary screens presented below. Each screen exists in Day Mode and Night Mode themes, and supports language and theme toggles.

A. Entry: "Play in group"
~~~~~~~~~~~~~~~~~~~~~~~~~~~
Structure
  * **Header area:**
    * Left: theme toggle icon (sun/moon) with tooltip "Switch theme" / «تغییر تم».
    * Right: language toggle pill showing `EN | FA` with the active language highlighted and accessible label.
  * **Content column:**
    * Title: "Play in group" / «بازی در گروه».
    * Subtitle: "Invite friends to your table" / «دعوت دوستان به میز شما».
    * Illustration slot (optional) sized 160×160 px max, centered.
    * Primary button (≥48 px height): "Generate link" / «ایجاد لینک».
  * **Footer helper text:** "You can share the link or QR code with your group." / «می‌توانید لینک یا کد QR را با گروه‌تان به اشتراک بگذارید.»

States
  * Primary button disabled state before backend responds; show loading spinner when awaiting link creation.

Spacing & Layout
  * Mobile (≤480 px): 24 px horizontal padding, stacked vertically, 16 px spacing between elements.
  * Tablet (481–1024 px): 32 px padding, center column max width 480 px.

B. Invite Link Modal
~~~~~~~~~~~~~~~~~~~~
Triggered upon successful link generation.

Structure
  * **Modal header:** "Your invite link" / «لینک دعوت شما» and close icon.
  * **Body content:**
    * Read-only text field containing `https://t.me/YourBot?startgroup=<GAME_ID>`.
      * Shows clipboard icon on the right.
      * Supports horizontal scroll with gradient fade for overflow.
    * Note: "Share this link with your group to start the game" / «این لینک را با گروه‌تان به اشتراک بگذارید تا بازی شروع شود».
  * **Actions:**
    * Primary button: "Copy link" / «کپی لینک».
    * Secondary outline button: "Show QR code" / «نمایش QR کد».

Feedback
  * Toast appears bottom-center for 2 seconds after copy action: "Link copied!" / «لینک کپی شد!».
    * Includes checkmark icon, slight slide-up animation, dismissible via swipe.

Accessibility
  * Text field labeled for screen readers as "Invite link".
  * Buttons have focus rings (2 px) using theme accent.

C. QR Code Screen
~~~~~~~~~~~~~~~~~
Displays a full-screen modal or separate screen stacked over Screen B.

Structure
  * Header: back arrow (returns to link modal), title "Scan or share the QR code" / «کد QR را اسکن کرده یا به اشتراک بگذارید».
  * Body: centered QR code (min 220×220 px on mobile, scaling up to 320×320 px on tablet).
    * QR container has 16 px padding, 12 px rounded corners, and subtle drop shadow/glow appropriate to theme.
    * Below QR: text "Tap to copy link too" / «برای کپی لینک هم بزنید».
  * Actions: primary button "Copy link" and secondary button "Back" / «بازگشت».

Fallback Behavior
  * If QR generation fails, display placeholder with dotted outline, QR icon, and text "Unable to load QR. Use the link instead." / «بارگذاری کد QR ممکن نشد. از لینک استفاده کنید.» plus retry button.

D. Joining State
~~~~~~~~~~~~~~~~
Shown when a participant opens the invite link or scans the QR code.

Structure
  * Header: "Joining group game…" / «در حال پیوستن به بازی گروهی…».
  * Progress indicator: circular spinner sized 48 px with theme accent color.
  * Helper text: "Please wait while we seat you" / «لطفاً منتظر بمانید تا شما را بنشانیم».
  * Optional cancel/back button for user-initiated abort.

Visual Cues
  * Background gradient or subtle cards illustration (low opacity) optional.

E. Registration Required
~~~~~~~~~~~~~~~~~~~~~~~~
Presented if backend reports the user is unregistered.

Structure
  * Header: "You must register first" / «ابتدا باید ثبت‌نام کنید».
  * Supporting text: "Tap the button below to open the bot and complete registration" / «برای تکمیل ثبت‌نام روی دکمه زیر بزنید».
  * Primary button: "Open Bot" / «باز کردن ربات».
  * Secondary helper text: "After registration you will join the game." / «پس از ثبت‌نام به بازی خواهید پیوست.».

Interaction
  * Primary button opens Telegram bot deep link; after returning, re-check registration status.

Theme Specifications
---------------------
Day Mode
  * Background: #FFFFFF
  * Primary text: #333333 (Titles), #666666 (secondary)
  * Primary button: background #0066FF, text #FFFFFF, shadow rgba(0, 102, 255, 0.24)
  * Secondary button: border #CCCCCC, background #FFFFFF, text #333333
  * Inputs: border #DDDDDD, background #FAFAFA
  * Toast: background #F0F8FF, text #0066FF, icon #0066FF
  * QR container: background #FFFFFF, border #E5E5E5, shadow rgba(0,0,0,0.08)

Night Mode
  * Background: #121212
  * Primary text: #E0E0E0, secondary #B0B0B0
  * Primary button: background #1E88E5, text #FFFFFF, shadow rgba(30, 136, 229, 0.32)
  * Secondary button: border #333333, background #1F1F1F, text #E0E0E0
  * Inputs: border #444444, background #1A1A1A
  * Toast: background #1E1E1E, text #1E88E5, icon #1E88E5
  * QR container: background #1F1F1F, inner glow rgba(30, 136, 229, 0.24)

Shared Tokens
  * Typeface: "Inter" (fallback sans-serif), weights 400/600.
  * Title size: 24 px / 32 px leading (mobile); 28 px / 36 px (tablet).
  * Body text: 16 px / 24 px leading.
  * Button text: 16 px uppercase, letter spacing 0.5 px.
  * Corner radius: 12 px for buttons and cards, 8 px for inputs.
  * Iconography: 24 px line icons for clipboard, QR, theme, and language toggles.
  * Animation: 200 ms ease-in-out for button presses, 150 ms fade for modals.

Localization Reference
----------------------
+------------------------------+---------------------------+---------------------------+
| Key                          | English Text              | Persian Text              |
+==============================+===========================+===========================+
| play_in_group                | Play in group             | بازی در گروه              |
+------------------------------+---------------------------+---------------------------+
| invite_friends_subtitle      | Invite friends to your    | دعوت دوستان به میز شما    |
|                              | table                     |                           |
+------------------------------+---------------------------+---------------------------+
| generate_link_button         | Generate link             | ایجاد لینک                |
+------------------------------+---------------------------+---------------------------+
| invite_link_header           | Your invite link          | لینک دعوت شما             |
+------------------------------+---------------------------+---------------------------+
| share_link_note              | Share this link with your | این لینک را با گروه‌تان   |
|                              | group to start the game   | به اشتراک بگذارید تا بازی |
|                              |                           | شروع شود                  |
+------------------------------+---------------------------+---------------------------+
| copy_link_button             | Copy link                 | کپی لینک                  |
+------------------------------+---------------------------+---------------------------+
| link_copied_toast            | Link copied!              | لینک کپی شد!              |
+------------------------------+---------------------------+---------------------------+
| show_qr_code                 | Show QR code              | نمایش QR کد               |
+------------------------------+---------------------------+---------------------------+
| scan_or_share_qr             | Scan or share the QR code | کد QR را اسکن کرده یا به   |
|                              |                           | اشتراک بگذارید            |
+------------------------------+---------------------------+---------------------------+
| tap_to_copy_hint             | Tap to copy link too      | برای کپی لینک هم بزنید    |
+------------------------------+---------------------------+---------------------------+
| back_button                  | Back                      | بازگشت                    |
+------------------------------+---------------------------+---------------------------+
| joining_game                 | Joining group game…       | در حال پیوستن به بازی     |
|                              |                           | گروهی…                    |
+------------------------------+---------------------------+---------------------------+
| seating_wait_message         | Please wait while we seat | لطفاً منتظر بمانید تا شما  |
|                              | you                       | را بنشانیم                |
+------------------------------+---------------------------+---------------------------+
| registration_required_header | You must register first   | ابتدا باید ثبت‌نام کنید   |
+------------------------------+---------------------------+---------------------------+
| registration_instruction     | Tap the button below to   | برای تکمیل ثبت‌نام روی    |
|                              | open the bot and complete | دکمه زیر بزنید             |
|                              | registration              |                           |
+------------------------------+---------------------------+---------------------------+
| open_bot_button              | Open Bot                  | باز کردن ربات             |
+------------------------------+---------------------------+---------------------------+
| post_registration_note       | After registration you    | پس از ثبت‌نام به بازی     |
|                              | will join the game.       | خواهید پیوست.             |
+------------------------------+---------------------------+---------------------------+
| theme_toggle_tooltip         | Switch theme              | تغییر تم                  |
+------------------------------+---------------------------+---------------------------+
| language_toggle_label        | Language                  | زبان                      |
+------------------------------+---------------------------+---------------------------+
| qr_load_error                | Unable to load QR. Use    | بارگذاری کد QR ممکن نشد.  |
|                              | the link instead.         | از لینک استفاده کنید.     |
+------------------------------+---------------------------+---------------------------+
| retry_button                 | Retry                     | تلاش دوباره               |
+------------------------------+---------------------------+---------------------------+

Responsive Guidelines
---------------------
* **Mobile:** Single-column layout, 24 px padding, buttons full-width.
* **Tablet:** Centered card up to 560 px width, background illustration allowed in margins.
* **Desktop:** Optional two-column layout with hero illustration; primary content column capped at 640 px.
* **RTL Support:** Mirror horizontal layout when Persian is active, including toast alignment and icon flipping where appropriate.

Component Annotations
---------------------
* **Language Toggle:** Pill button 44 px height, segmented control with active state background matching theme accent (Day: #E6F0FF, Night: #1E2E3F). Text 14 px.
* **Theme Toggle:** Icon button 44×44 px with circular background (#F5F5F5 day, #1F1F1F night). Transition animates sun ↔ moon.
* **Toast:** Appears 24 px above bottom safe area. Includes subtle shadow and rounded corners (12 px). Auto-dismiss after 2 seconds; manual dismiss via tap.
* **Progress Spinner:** Uses theme accent color (#0066FF day, #1E88E5 night) with 1.5 s rotation.
* **Buttons:** Provide pressed state darkening by 8% and focus outline 2 px (Day: #80B7FF, Night: #64B5F6).

Icons
-----
* Clipboard: outline style, 24×24 px.
* QR code: square icon, 24×24 px.
* Sun/Moon: dual-state icon for theme toggle.
* Language: globe icon optional when toggle collapsed.

Micro-interactions
-------------------
* Copy button triggers ripple, link field briefly highlights (0.5 s) to reinforce action.
* Modal transitions: fade-in + upward slide 16 px over 200 ms.
* QR code tap expands to show copy hint if hidden.

Edge Cases
----------
* If link generation fails, show inline error in modal with red text (#D32F2F day / #EF5350 night) and retry button.
* For slow network, show skeleton shimmer in link field and disable actions until link loads.
* Persist chosen language/theme in local storage to respect user preference across sessions.

Implementation Notes
--------------------
* Provide data-testids for primary actions (`generate-link`, `copy-link`, `show-qr`, `open-bot`).
* Ensure deep links are selectable and keyboard navigable.
* Wrap Persian text with RTL attributes to maintain correct direction in mixed content.
* Use CSS variables or design tokens for theme values to simplify switching.

