# Telegram Poker UI QA Checklist

This document provides a comprehensive checklist for QA testing the Telegram Poker Mini App UI before release. All tests should be performed manually in the Telegram mobile app environment.

## Test Environments

### Required Devices/Viewports
- [ ] iPhone SE (landscape: 568×320)
- [ ] iPhone 14 (landscape: 844×390)
- [ ] iPhone 14 Pro Max with notch (landscape: 932×430)
- [ ] Android phone (landscape: ~700×380)
- [ ] iPad Mini (landscape: 1024×768)
- [ ] Telegram Desktop (1280×720 minimum)

### Required Browsers/Containers
- [ ] Telegram iOS app (in-app WebView)
- [ ] Telegram Android app (in-app WebView)
- [ ] Telegram Desktop app (Windows/macOS)
- [ ] Safari mobile (for iOS debugging)
- [ ] Chrome DevTools device emulation

---

## 1. Viewport & Safe Area Tests

### Small Landscape (568×320)
- [ ] Action bar buttons fit without horizontal overflow
- [ ] Seat avatars remain readable (min 40px)
- [ ] Player names truncate properly with ellipsis
- [ ] Pot display remains visible above action bar
- [ ] Raise slider is usable with 44px touch targets

### Notch Landscape (iPhone 14 Pro Max)
- [ ] Content doesn't overlap with notch area
- [ ] Safe area insets applied to action bar bottom padding
- [ ] No double-counting of safe-area-inset-bottom
- [ ] Landscape orientation has proper left/right insets

### Tablet (iPad Mini/Pro)
- [ ] Seats scale appropriately (--seat-scale-factor: 1.1)
- [ ] Touch targets remain 44px minimum
- [ ] Layout doesn't feel stretched or sparse

---

## 2. RTL/Farsi Language Tests

### Setup
1. Change language to Farsi (Persian) in settings
2. Verify `[dir="rtl"]` is applied to root element

### Text & Layout
- [ ] Player names display correctly with `dir="auto"`
- [ ] Action button labels (فولد, چک, کال, رایز) don't overflow
- [ ] Badge text (ALL IN, Zzz, YOU) remains readable
- [ ] Numbers display in LTR (chip amounts, pot values)
- [ ] Slider Min/Max labels positioned correctly

### Punctuation & Numbers
- [ ] Persian digits render if using Farsi locale
- [ ] Mixed LTR/RTL text (e.g., "Call 1,000") wraps correctly
- [ ] Currency symbols position correctly

---

## 3. Telegram Container Tests

### Initialization
- [ ] App loads without white flash on startup
- [ ] OrientationGuard overlay matches app background (#010b08)
- [ ] No layout flicker when rotating portrait→landscape

### WebView Quirks
- [ ] Viewport meta tag respected (no zoom on double-tap)
- [ ] `touch-action: manipulation` prevents delayed clicks
- [ ] Haptic feedback triggers on button press (if enabled)
- [ ] Back button/swipe handled gracefully

### Performance
- [ ] No visible jank during seat animations
- [ ] Slider responds smoothly at 60fps
- [ ] Card flip animations complete in <300ms

---

## 4. Reduced Motion Tests

### Setup
1. Enable "Reduce Motion" in device settings
   - iOS: Settings → Accessibility → Motion → Reduce Motion
   - Android: Settings → Accessibility → Remove animations

### Verification
- [ ] `@media (prefers-reduced-motion: reduce)` rules apply
- [ ] Pulse animations on active seat stop (animate-none)
- [ ] Button hover/active transforms disabled (scale-100)
- [ ] Card slide/flip animations instant (<10ms)
- [ ] No motion-induced discomfort

---

## 5. Touch Target Verification

### Minimum 44px Targets
- [ ] All action buttons ≥44px height
- [ ] Raise +/- buttons ≥44×44px
- [ ] Preset bet buttons ≥44px height
- [ ] Empty seat "Sit Here" tap area ≥44×44px
- [ ] Toggle switches ≥44px width

### Slider Touch
- [ ] Raise slider thumb ≥44×44px
- [ ] Slider track touchable area padded (16px above/below)
- [ ] Thumb drag feels responsive, not jittery

---

## 6. Button State Consistency

### Disabled State
- [ ] Opacity reduced to 40-50%
- [ ] Cursor shows `not-allowed`
- [ ] No focus ring on disabled buttons
- [ ] No active/hover transforms when disabled
- [ ] Shadow removed on disabled state

### Focus State
- [ ] 2px focus ring visible on keyboard focus
- [ ] Focus ring offset from button edge
- [ ] Ring color matches button variant (emerald/rose/blue)
- [ ] Focus visible only on keyboard navigation

### Active/Pressed State
- [ ] Scale transform on tap (scale-0.97)
- [ ] Transform disabled when motion-reduce active
- [ ] Brightness change on press (90% or 110%)

---

## 7. Overflow & Text Wrapping

### Player Names
- [ ] Long names (20+ chars) truncate with ellipsis
- [ ] Max-width constraint (60px in compact, 76px in legacy)
- [ ] Title attribute shows full name on hover/long-press

### Action Labels
- [ ] "Raise to 10,000" fits without wrapping
- [ ] Farsi action labels fit in buttons
- [ ] `whitespace-nowrap` prevents mid-word breaks

### Status Badges
- [ ] ALL IN badge doesn't overflow seat
- [ ] Sitting Out (Zzz) badge stays compact
- [ ] YOU badge visible without overlap

---

## 8. Orientation Change Tests

### Portrait → Landscape
- [ ] OrientationGuard appears instantly (no white flash)
- [ ] Overlay background matches app (#010b08)
- [ ] Phone icon animation plays smoothly
- [ ] Text is readable and centered

### Landscape Rotation (180°)
- [ ] No layout reflow or flicker
- [ ] Action bar stays at bottom
- [ ] Seats maintain relative positions

---

## 9. Slider Expanded State

### Layout Integrity
- [ ] Slider container doesn't overlap with seats
- [ ] Min/Max labels visible above slider track
- [ ] Floating bet amount label tracks slider position
- [ ] Confirm button accessible below slider

### Touch Interaction
- [ ] Slider draggable across full width
- [ ] +/- buttons increment by ~10% of range
- [ ] Preset buttons set exact amounts
- [ ] Cancel (✕) closes slider panel

---

## 10. Color & Contrast

### Token Consistency
- [ ] All CSS vars resolve (no undefined fallbacks)
- [ ] `--color-warning` used for dealer button (#f97316)
- [ ] `--color-success` used for winner highlights (#22c55e)
- [ ] `--color-danger` used for fold/all-in (#ef4444)

### Accessibility
- [ ] Text contrast ≥4.5:1 for body text
- [ ] Text contrast ≥3:1 for large text (18px+)
- [ ] Focus indicators visible against all backgrounds

---

## Sign-Off

| Tester | Date | Device | Pass/Fail | Notes |
|--------|------|--------|-----------|-------|
|        |      |        |           |       |
|        |      |        |           |       |

---

## Appendix: Quick Test Checklist

For rapid smoke testing, verify these 10 critical items:

1. [ ] App loads in landscape without white flash
2. [ ] Action buttons have 44px touch targets
3. [ ] Player names truncate (don't overflow)
4. [ ] Farsi labels fit in buttons
5. [ ] Disabled buttons have no focus ring
6. [ ] Raise slider is draggable
7. [ ] Notch devices have safe-area padding
8. [ ] Reduced motion disables animations
9. [ ] Orientation guard shows on portrait
10. [ ] Build passes: `npm run build`
