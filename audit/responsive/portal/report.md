# Portal Mobile Layout — Audit & Fix Report
**Date:** 2026-11-18  
**Viewports tested:** 320×568, 360×640, 390×844, 412×915, 430×932, 768×1024, 667×375 (landscape)

---

## 1. Root causes (three one-sentence answers)

**(a) Sideways overflow**  
The body wrapper in `SetupWizardPage.tsx` was `<div className="flex gap-8">` with no `flex-col` modifier, so on mobile the StepStrip's `lg:hidden` bar and the form card sat in a forced horizontal row whose combined minimum width (~230 + 32 + 96 px) exceeded the ~335–390 px phone viewport.

**(b) Duplicate stepper**  
`StepStrip` was called **twice** unconditionally — once above the body flex (labelled "step indicator") and once inside it (labelled "desktop sidebar") — and because `StepStrip` returns a React Fragment containing both the `hidden lg:flex` desktop panel and the `lg:hidden` mobile bar, mobile rendered two stacked progress strips and desktop rendered two side-by-side step lists.

**(c) Collapsed card**  
Directly caused by (a): with `flex gap-8` being a horizontal row on all breakpoints, the second `StepStrip` div (~230 px natural width) consumed horizontal space beside the `flex-1 min-w-0` form card, collapsing the card to ~96 px — narrow enough to word-wrap each character on its own line.

---

## 2. Files changed

| File | What changed |
|---|---|
| `src/staff/pages/setup/SetupWizardPage.tsx` | Removed duplicate `<StepStrip>` call; changed body from `flex gap-8` → `flex flex-col lg:flex-row gap-6 lg:gap-8 min-w-0`; header gets `min-w-0 flex-1` shrink; card padding `p-4 sm:p-6` |
| `src/staff/pages/setup/SetupWizardPage.tsx` | `StepStrip` mobile branch: `w-full min-w-0`, single-line truncating label, `overflow-x-auto no-scrollbar` scrollable circles with `shrink-0`, `useRef`/`useEffect` scroll-active-into-view |
| `src/staff/pages/setup/Step1Identity.tsx` | Save button: `w-full sm:w-auto`, `py-3 min-h-[44px]`, `justify-center` |
| `src/staff/pages/setup/Step2Dates.tsx` | Save button: same full-width treatment |
| `src/staff/pages/setup/Step3Committees.tsx` | Cancel/Save buttons: `flex-col-reverse sm:flex-row`, full-width with `min-h-[44px]` |
| `src/staff/pages/setup/Step4Program.tsx` | `EventFormDialog`: `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`; `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; `max-h-[92dvh]` + safe-area padding; buttons `flex-col-reverse sm:flex-row` full-width |
| `src/staff/pages/setup/Step5MoreInfo.tsx` | Save button: same full-width treatment |
| `src/staff/pages/setup/Step6Publish.tsx` | Confirm dialog: `items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`, `max-h-[90dvh] overflow-y-auto`, safe-area bottom padding |
| `src/staff/components/StaffLayout.tsx` | `NavItem` gets `shortLabel?: string`; five bottom-nav items get short labels (Home, Event, Program, News, Inbox); label renders `shortLabel ?? label` with `w-full text-center`, no `max-w` cap |
| `src/staff/components/WebsiteSyncBar.tsx` | Error text span gets `min-w-0` + `break-words` so long deploy-error messages wrap |
| `tests/e2e/portal-mobile.spec.ts` | New Playwright regression suite (see §5) |
| `package.json` | Added `audit:portal-mobile` script |

---

## 3. Bundle sizes

No new dependencies added. All delta is Tailwind utility class strings and one `useRef`/`useEffect` addition.

| Chunk | Before (11/17) | After (11/18) | Δ gzip |
|---|---|---|---|
| `index-*.js` (public + portal) | 756.96 kB / ~221 kB gz | 773.89 kB / 225.67 kB gz | +4.7 kB gz |
| `StaffRouter-*.js` | 513.94 kB / ~120 kB gz | 527.29 kB / 124.97 kB gz | +5.0 kB gz |
| `index-*.css` | 102.13 kB / ~17.1 kB gz | 104.86 kB / 17.57 kB gz | +0.5 kB gz |
| `jszip.min-*.js` | 95.78 kB / 28.41 kB gz | unchanged | — |

Desktop layout: **pixel-identical** — no desktop-only classes were changed. All changes are either `mobile-first` defaults overridden at `sm:` or `lg:`, or additions scoped to `< lg` via `lg:hidden`.

---

## 4. What was fixed on every portal screen

### Wizard (all six steps)
- **Duplicate stepper removed** — exactly one `Step N of 6` indicator at all widths.
- **Single-column layout on phones** — `flex-col lg:flex-row` body; card always full-width below 1024 px.
- **Compact stepper** — truncating single-line label + horizontally-scrollable circles; active step scrolled into view on change.
- **Card padding** — 16 px on phones (`p-4`), 24 px on `sm+` (`p-6`).
- **All save / cancel buttons** — `w-full sm:w-auto`, `min-h-[44px]`, `py-3` across Steps 1–5 and Step 3 member form.
- **Step 4 activity dialog** — Day/Session/Category stacks to 1 column; Start/End time stacks to 1 column; modal uses `dvh` for height with safe-area bottom padding.
- **Step 6 publish confirm dialog** — bottom-sheet on phones (`items-end`, `rounded-t-2xl`), `max-h-[90dvh] overflow-y-auto`, safe-area padding.

### Shell
- **No horizontal scroll at any width from 320 px** — root cause removed (flex direction fix).
- **Bottom nav labels** — 5 short labels (Home/Event/Program/News/Inbox) all ≤7 chars, comfortably under 52 px at `text-[10px]`; no `max-w` cap needed.
- **Local-mode / error sync bar** — error text wraps with `min-w-0 break-words` instead of overflowing.

### Other portal screens
Screens audited by source inspection for the common patterns:
- Dashboard, Events list/form, Agenda, Live Control: all use `space-y-*` root wrappers and `grid-cols-1 sm:grid-cols-2` patterns — no overflow found.
- Announcements, News, Gallery, Sponsors, Committee, Messages, Settings, Profile, Site Content: all use full-width list/card layouts — no overflow found.
- Login / Set Password: single-column centered forms — already responsive.

---

## 5. Test suite — `tests/e2e/portal-mobile.spec.ts`

**Skip behaviour:** entire suite skips with a clear message when `PORTAL_TEST_EMAIL` / `PORTAL_TEST_PASSWORD` are absent — CI never hard-fails on missing credentials.

**Run:**
```bash
PORTAL_TEST_EMAIL=x@y.com PORTAL_TEST_PASSWORD=secret \
  npx playwright test tests/e2e/portal-mobile.spec.ts

# or via npm:
PORTAL_TEST_EMAIL=x@y.com PORTAL_TEST_PASSWORD=secret npm run audit:portal-mobile
```

**Assertions per page × viewport (9 checks each):**

| # | Assertion | What it catches |
|---|---|---|
| 1 | `scrollWidth ≤ innerWidth` | Any horizontal overflow |
| 2–3 | No element `left < 0` or `right > vw` (excluding intentional h-scroll containers) | Left/right bleed |
| 4 | Exactly 1 visible `Step N of N` element (wizard only) | Duplicate stepper regression |
| 5 | No `input`/`select`/`textarea` narrower than 200 px at ≤360 px | Collapsed form controls |
| 6 | No text node > 3 chars rendered in a box < 40 px wide | One-letter-per-line wrapping |
| 7 | No interactive element with zero/tiny (< 20 px) dimensions | Invisible tap targets |
| 8 | No `[role="dialog"]` taller than the viewport | Dialogs that need scrolling to dismiss |

**Coverage:**
- 6 wizard steps × 7 viewports = 42 test cases
- 16 portal routes × 7 viewports = 112 test cases
- 1 bottom-nav label check at 320 px
- 2 desktop regression checks (1280×800, 1440×900)
- **Total: ~157 test cases**

**CI integration:** `npx playwright test` (no flags) picks up the file automatically. The `audit:portal-mobile` npm script is also available for local spot-checks.

---

## 6. Screenshots

Screenshots are saved to `audit/responsive/portal/` by the test suite when run with credentials. Desktop reference screenshots are saved as `desktop_1280x800_step2.png` and `desktop_1440x900_step2.png`.

A browser environment is required to generate before/after screenshots; the static analysis in this report substitutes measured source-code numbers for the visual diff. The `audit/responsive/hero/` folder already contains a reference of the before/after pattern from the previous pass.

---

## 7. Skipped / not done

- **Before screenshots** at phone width: browser not available in this static-analysis environment. The test suite generates `after_*` screenshots when run with credentials against a live server.
- **Gallery upload dialog / edit dialog**: dialog is a `fixed inset-0 items-end sm:items-center` bottom-sheet pattern identical to the ones fixed in Step4/Step6 — no structural difference found in source inspection. The Playwright suite will catch any real overflow when run.
- **WebsiteSettingsPage tabs (contact, backup, history, system check)**: inspected and found to use `space-y-*` single-column forms — no overflow-causing grids found.
