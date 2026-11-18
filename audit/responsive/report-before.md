# Responsive Audit — BEFORE Report (Static Analysis)

Generated: 2026-11-17  
Method: Static source analysis (Playwright browsers not installed; run `npx playwright install chromium` then `npm run audit:responsive` for full screenshot audit)

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 8 |
| 🟠 Major    | 24 |
| 🟡 Minor    | 11 |
| **Total**   | **43** |

---

## Issues

| Page / File | Viewport | Issue Type | Element | Severity | Detail |
|-------------|----------|-----------|---------|----------|--------|
| `index.html` | all | missing-viewport-cover | `<meta name="viewport">` | 🟠 Major | Missing `viewport-fit=cover` — notched iPhone/Android safe-area insets not respected |
| `src/index.css` | all | no-dvh-fallback | `<section>` hero | 🟠 Major | Hero uses `height: 100svh` inline style with no `100vh` CSS fallback class |
| `src/index.css` | all | no-safe-area-utilities | global | 🟠 Major | No `env(safe-area-inset-*)` utilities defined for fixed bars |
| `src/index.css` | all | no-box-sizing-reset | global | 🟡 Minor | No `box-sizing: border-box` reset — border/padding can cause overflow |
| `src/index.css` | all | no-overflow-wrap | `h1,p,…` | 🟠 Major | No `overflow-wrap: anywhere` — long Amharic/Oromo words can push page wider than viewport |
| `src/index.css` | all | no-min-width-zero | `.flex>*,.grid>*` | 🟡 Minor | No `min-width: 0` on flex/grid children — text overflow risk |
| `src/components/layout/Navbar.tsx` | ≤767px | no-focus-trap | `#mobile-nav-drawer` | 🔴 Critical | Mobile drawer has no focus trap — Tab key escapes overlay |
| `src/components/layout/Navbar.tsx` | ≤767px | no-scroll-lock | `body` | 🔴 Critical | Opening the mobile drawer does not lock `body` scroll |
| `src/components/layout/Navbar.tsx` | ≤767px | drawer-inline | `.xl:hidden` drawer | 🟠 Major | Drawer renders inline below the bar (pushes content) rather than as a fixed overlay panel |
| `src/components/layout/Navbar.tsx` | ≤767px | tap-target | language buttons | 🟠 Major | Language switcher buttons `px-2 py-1` ≈ 30×24 px — below 44×44 px minimum |
| `src/components/layout/Navbar.tsx` | ≤767px | tap-target | theme toggle | 🟠 Major | Theme toggle `p-2` ≈ 36×36 px — below 44×44 px minimum |
| `src/components/layout/RootLayout.tsx` | ≤767px | content-hidden-under-nav | `<main>` | 🔴 Critical | `pb-16 xl:pb-0` does not account for `env(safe-area-inset-bottom)` — content clipped on notched phones |
| `src/components/layout/RootLayout.tsx` | ≤767px | top-padding-wrong | `<main>` | 🟠 Major | `pt-20 sm:pt-24` doesn't match Navbar heights (60/68/76 px) — gap or overlap at breakpoints |
| `src/pages/Home.tsx` | 320px | countdown-wraps | countdown grid | 🔴 Critical | Countdown `max-w-xs` = 320 px + gap overflows at 320 px viewport |
| `src/pages/Home.tsx` | ≤430px | hero-buttons-side-by-side | CTA buttons | 🟠 Major | CTA buttons use `flex-wrap` — may overlap on 320 px; not full-width stacked |
| `src/pages/Home.tsx` | ≤639px | lightbox-centered | gallery modal | 🟠 Major | Gallery lightbox always centred (`items-center justify-center`) — obscured by iOS browser chrome on phones |
| `src/pages/Home.tsx` | ≤639px | close-button-small | modal `<button>` | 🟠 Major | Close button `p-1.5` ≈ 28×28 px — below 44×44 px minimum |
| `src/pages/Gallery.tsx` | ≤639px | grid-1-col | `.grid-cols-1` | 🟠 Major | Gallery grid is single-column on phones — wastes screen space; standard is 2-col |
| `src/pages/Gallery.tsx` | ≤639px | no-lightbox-swipe | lightbox | 🔴 Critical | Lightbox has no touch swipe — users cannot navigate photos on phones |
| `src/pages/Gallery.tsx` | ≤639px | no-pinch-zoom | lightbox image | 🟠 Major | `touch-action` not set — browser may prevent pinch-zoom on the photo |
| `src/pages/Gallery.tsx` | ≤639px | close-button-small | `p-1.5` button | 🟠 Major | Close button ≈ 28×28 px — below 44×44 px minimum |
| `src/pages/Gallery.tsx` | ≤639px | no-aspect-ratio | `<img>` grid | 🟡 Minor | Grid images have no explicit `width`/`height` or `aspect-ratio` — potential CLS |
| `src/pages/Schedule.tsx` | ≤767px | sticky-tabs-wrong-offset | `.sticky.top-16` | 🟠 Major | Sticky day-tabs use `top-16` (64 px) but Navbar is 60 px on phones — 4 px content hidden |
| `src/pages/Schedule.tsx` | ≤639px | action-buttons-wrap | button row | 🟡 Minor | Download/print/calendar buttons use `flex-wrap` — stack awkwardly on 320 px |
| `src/pages/Events.tsx` | ≤639px | filters-not-collapsible | filter chips | 🟠 Major | Day + category chips both visible at all sizes — no mobile filter sheet, chips overflow |
| `src/pages/Events.tsx` | ≤639px | search-input-font | `<input type="text">` | 🔴 Critical | Input `text-xs sm:text-sm` ≈ 12 px — iOS Safari zooms the page on focus |
| `src/pages/Events.tsx` | ≤639px | image-no-size | `<img>` in cards | 🟡 Minor | Event card images have no explicit `width`/`height` — CLS risk |
| `src/pages/Contact.tsx` | ≤639px | grid-col-2 | email+phone row | 🟠 Major | Email and phone inputs in a 2-column grid — both too narrow at 320 px |
| `src/pages/Contact.tsx` | ≤639px | input-font-small | all `<input>` | 🔴 Critical | Inputs use `text-xs sm:text-sm` ≈ 12 px — iOS zooms page on focus |
| `src/pages/Contact.tsx` | ≤639px | submit-not-full-width | `<button type=submit>` | 🟡 Minor | Submit button `inline-flex` — small tap area on phones |
| `src/pages/Contact.tsx` | ≤639px | faq-tap-target | FAQ `<button>` | 🟡 Minor | FAQ toggle `py-4` ≈ 40 px height — just below 44 px minimum |
| `src/components/layout/Footer.tsx` | 320px | logo-overflow | logo flex row | 🟠 Major | Logos side-by-side (gap-4) can exceed 320 px viewport width |
| `src/components/layout/Footer.tsx` | ≤639px | nav-link-tap | `<NavLink>` items | 🟠 Major | Nav links `text-sm` with no explicit height — ≈ 24 px, below 44 px |
| `src/components/layout/Footer.tsx` | ≤639px | lang-button-small | language buttons | 🟠 Major | `px-3 py-1.5 text-xs` ≈ 28×24 px — below 44×44 px minimum |
| `src/components/layout/MobileBottomNav.tsx` | ≤767px | no-safe-area | nav bar | 🟠 Major | Bar uses `py-1.5` only — no `env(safe-area-inset-bottom)` — clipped on notched phones |
| `src/staff/components/StaffLayout.tsx` | ≤1023px | no-focus-trap | drawer | 🟠 Major | Staff drawer has no focus trap |
| `src/staff/components/StaffLayout.tsx` | ≤1023px | no-scroll-lock | body | 🟠 Major | Opening the staff drawer does not lock body scroll |
| `src/staff/components/StaffLayout.tsx` | ≤1023px | no-safe-area | bottom nav | 🟠 Major | Bottom nav `h-16` only — no safe-area on notched phones |
| `src/staff/components/I18nTabs.tsx` | 320px | tab-overflow | tab strip | 🟡 Minor | Tabs may clip/wrap at 320 px — no `overflow-x-auto` |
| `src/staff/components/ConfirmDialog.tsx` | ≤639px | dialog-centered | modal | 🟠 Major | Always centred — does not become a bottom sheet on phones |
| `src/staff/components/ConfirmDialog.tsx` | ≤639px | buttons-small | action buttons | 🟡 Minor | Buttons `py-2.5` ≈ 36 px — below 48 px recommendation for dialogs |
| `src/staff/components/ConfirmPasswordModal.tsx` | ≤639px | dialog-centered | modal | 🟠 Major | Always centred — does not become a bottom sheet on phones |
| `src/staff/components/ConfirmPasswordModal.tsx` | ≤639px | input-font-small | password input | 🔴 Critical | No explicit font-size — may be < 16 px, causing iOS zoom |
| `src/staff/pages/setup/SetupWizardPage.tsx` | 320px | mobile-step-strip | step tabs | 🟡 Minor | Mobile strip shows only step numbers (1–6) with no progress indicator or label |
| `src/staff/pages/LivePage.tsx` | ≤639px | note-dialog-centered | delay-note dialog | 🟡 Minor | Dialog always centred — does not use bottom-sheet on phones |

---

## Desktop Guard (1280×800 and 1440×900)

Browsers not installed. All changes are gated behind `sm:` / `lg:` / `xl:` breakpoints or `max-sm:` and do not affect layouts at ≥ 1024 px. No desktop guard regressions expected.

## Manual Steps to Verify Before State

Run `npm run dev`, open Chrome DevTools, enable the Device Toolbar (⌘⇧M / Ctrl+Shift+M), and check each issue in the table above at the listed viewport width. Screenshots can be saved manually to `audit/responsive/before/`.

To enable the browser audit automatically:
```bash
npx playwright install chromium
npm run audit:responsive
```
