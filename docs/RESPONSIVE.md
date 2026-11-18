# Responsive Design Reference

Ambo University Woliso Campus — Tourism Week  
Last updated: 2026-11-17

---

## 1. Breakpoints

This project uses Tailwind CSS v4. All breakpoints are **min-width** (mobile-first).

| Tailwind prefix | CSS min-width | Use |
|----------------|--------------|-----|
| _(none)_       | 0 px         | Phones portrait (320–430 px) |
| `sm:`          | 640 px       | Large phones, small tablets |
| `md:`          | 768 px       | Tablet portrait |
| `lg:`          | 1024 px      | Tablet landscape, small laptop |
| `xl:`          | 1280 px      | Desktop — bottom nav disappears here |
| `2xl:`         | 1536 px      | Wide desktop |

**Desktop-guard rule:** any class that affects layout at ≥ 1024 px must be gated behind `lg:` or `xl:`. Mobile fixes use plain classes or `max-sm:` / `sm:` and must not change behaviour above `xl:`.

---

## 2. Viewport and Safe-Area Rules

### index.html
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```
- `viewport-fit=cover` enables `env(safe-area-inset-*)` on notched iPhones and Android.
- Pinch-zoom is **never** disabled (no `user-scalable=no` or `maximum-scale`).

### CSS utilities (src/index.css)
| Class | Effect |
|-------|--------|
| `.safe-area-bottom` | `padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px)` |
| `.pb-safe` | `padding-bottom: env(safe-area-inset-bottom, 0px)` |
| `.h-screen-small` | `height: 100svh` with `100vh` fallback |
| `.h-screen-dyn` | `height: 100dvh` with `100vh` fallback |
| `.min-h-screen-dyn` | `min-height: 100dvh` with fallback |

**Rule:** every fixed bar (Navbar, MobileBottomNav, StaffLayout bottom nav) accounts for safe-area. The `<main>` element in `RootLayout` adds `pb-[calc(64px+env(safe-area-inset-bottom,0px))]` on `< xl` to prevent content hiding under the bottom nav.

---

## 3. Component Patterns

### 3.1 Navbar drawer (public site)
- **Trigger:** hamburger shown on `xl:hidden`; `xl:flex` shows inline nav.
- **Drawer:** slides in from the **right** (`translate-x-full` → `translate-x-0`), `w-[min(320px,90vw)]`.
- **Focus trap:** `trapFocus()` cycles Tab within the drawer. First focusable element gets focus on open. Focus returns to the hamburger button on close.
- **Body scroll lock:** `document.body.style.overflow = 'hidden'` while open, restored on close.
- **Close triggers:** Escape key, click outside the drawer panel, route change.
- **`inert` attribute:** applied to the drawer when closed so screen readers skip it.
- Minimum tap target on all Navbar buttons: **44 × 44 px** (`min-w-[44px] min-h-[44px]`).

### 3.2 MobileBottomNav (public site)
- Visible on `xl:hidden`, fixed at the bottom.
- Bar height: `calc(64px + env(safe-area-inset-bottom, 0px))`.
- Each item: `min-w-[56px] flex-1` — always exceeds 44 × 44 px.
- **"More" sheet:** bottom-sheet with body-scroll lock, Escape/route-change close, 44 px close button, handle bar, safe-area padding.
- `RootLayout` adds matching `pb-[calc(64px+env(safe-area-inset-bottom,0px))] xl:pb-0` to `<main>`.

### 3.3 Bottom sheet (mobile modals/dialogs)
Applied to: `ConfirmDialog`, `ConfirmPasswordModal`, `LivePage` delay-note dialog, Events filter sheet, MobileBottomNav "More" sheet.

Pattern:
```jsx
<div className="fixed inset-0 z-[200] flex flex-col justify-end
                sm:items-center sm:justify-center bg-black/50">
  <div className="w-full bg-... rounded-t-3xl sm:rounded-2xl sm:max-w-sm sm:mx-4 p-5"
       style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}>
    {/* handle bar (mobile only) */}
    <div className="sm:hidden w-10 h-1 rounded-full bg-... mx-auto mb-2" />
    …content…
  </div>
</div>
```
- On phones: anchored to bottom, `rounded-t-3xl`, safe-area pb.
- On sm+: centred card, `rounded-2xl`, normal padding.
- All buttons inside: `min-h-[48px] w-full sm:w-auto`, stacked `flex-col-reverse sm:flex-row`.

### 3.4 StaffLayout drawer (organizer portal)
- Same focus-trap + body-scroll lock as the public Navbar drawer.
- Drawer slides in from the **left**, `w-72`.
- Bottom nav: `calc(64px + env(safe-area-inset-bottom, 0px))`, items `min-h-[56px]`.
- Portal `<main>` pb: `max(calc(64px + env(safe-area-inset-bottom, 0px)), 1.5rem)` on mobile, `2rem` on `lg+`.

### 3.5 Sticky action bar (portal forms)
```css
.sticky-action-bar {
  position: sticky;
  bottom: 0;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 0.5rem);
  background: var(--surface-card);
  border-top: 1px solid var(--border-subtle);
  z-index: 20;
}
```
Keeps Save / Publish visible above the software keyboard on phones.

### 3.6 Carousels and filter chip rows
```css
.snap-x-container {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.snap-x-item { scroll-snap-align: start; flex-shrink: 0; }
```
Used for: highlights carousel, gallery strip, day-tab strip (Schedule), category filter chips (Events, Gallery), I18nTabs.

### 3.7 Gallery lightbox
- Full-screen (`fixed inset-0 bg-black`).
- Touch swipe left/right via `onTouchStart` / `onTouchEnd` (dx > 40 px threshold).
- Pinch zoom: `style={{ touchAction: 'pinch-zoom' }}` on the image container.
- Keyboard: ArrowLeft / ArrowRight / Escape.
- Body scroll locked while open.
- Top and bottom bars placed above browser chrome via `pt-[max(env(safe-area-inset-top,12px),12px)]` and `pb-[max(env(safe-area-inset-bottom,12px),12px)]`.
- Close button: `min-w-[44px] min-h-[44px]`.

### 3.8 Forms (public Contact, portal forms)
- Single column throughout — no side-by-side grids on phones.
- All `<input>` and `<select>` elements: `font-size: 16px` (prevents iOS Safari auto-zoom).
- Correct `type=` attributes: `email`, `tel`, `search`, `password`.
- Correct `autocomplete=` attributes: `name`, `email`, `tel`, `current-password`.
- Submit buttons: `w-full sm:w-auto min-h-[48px sm:52px]`.
- Error messages: `role="alert"` for screen reader announcements.

### 3.9 Event Setup wizard (portal)
- Mobile: "Step X of 6 — Label" text, numbered dot-buttons, gold progress bar.
- Desktop: 52px-wide sidebar list (unchanged).
- Dot buttons: 28 × 28 px with `aria-current="step"` on the active one.

---

## 4. Global CSS rules (src/index.css)

```css
*, *::before, *::after { box-sizing: border-box; }
html, body            { overflow-x: hidden; }
h1–h6, p, li, …      { overflow-wrap: anywhere; word-break: break-word; min-width: 0; }
img, video, iframe    { max-width: 100%; height: auto; }
.flex > *, .grid > *  { min-width: 0; }
```

These four rules prevent the most common causes of horizontal scroll on phones, including long Amharic and Afaan Oromo words.

---

## 5. Hero section

```jsx
<section className="… h-screen-small" style={{ minHeight: 560, maxHeight: 1080 }}>
```

- `h-screen-small` → `height: 100svh` (small viewport, excludes browser chrome) with `100vh` fallback.
- Countdown boxes: `grid-cols-4` constrained to `max-w-[280px]` at 320 px; number font `clamp(1rem, 5vw, 1.75rem)`.
- CTA buttons: `flex-col sm:flex-row w-full sm:w-auto` (stack on phones, row on sm+).

---

## 6. Tap target sizes

| Component | Required | Implementation |
|-----------|----------|----------------|
| Nav links (mobile) | 44 × 44 px | `min-h-[44px]` on `NavLink` |
| Icon buttons (Navbar, etc.) | 44 × 44 px | `min-w-[44px] min-h-[44px]` |
| Bottom nav items | 44 × 44 px | `min-w-[56px] flex-1` |
| Dialog action buttons | 48 × 48 px | `min-h-[48px]` |
| Live Control status buttons | 48 × 48 px | `min-h-[48px]` (existing) |
| Gallery lightbox prev/next/close | 44 × 44 px | `min-w-[44px] min-h-[44px]` |
| Filter chips / tabs | 36–40 px height | `min-h-[36px]` or `min-h-[40px]` |

---

## 7. Text size rules

| Context | Minimum | Rule |
|---------|---------|------|
| Body text | 16 px | `body { font-size: 16px }` |
| UI labels / metadata | 14 px | Never below `text-xs` (12 px) except legal fine print |
| Inputs / selects | 16 px | Inline `style={{ fontSize: '16px' }}` on every `<input>` |
| Overline / badge | 11 px | Acceptable for decorative all-caps labels |

---

## 8. Running the audit

### Full responsive audit (saves screenshots + report)
```bash
# Start dev server first
npm run dev

# In a second terminal:
npm run audit:responsive          # → audit/responsive/before/  + report-before.md
npm run audit:responsive:after    # → audit/responsive/after/   + report-after.md
```

### Fast CI overflow check (no screenshots, exits 1 on horizontal scroll)
```bash
npm run audit:overflow
```
This is added to CI and fails if any public page has horizontal scroll at 360 px.

### Manual audit (when no browser is available)
Run `npm run audit:responsive` — the script detects that the dev server is not reachable and falls back to static analysis of source files, then prints a full manual checklist to stdout.

### Desktop guard
After the fix pass, compare screenshots at `1280×800` and `1440×900` from `audit/responsive/before/` and `audit/responsive/after/` using an image-diff tool (e.g. `pixelmatch`) or by eye. Any layout change at those sizes must be justified.

---

## 9. Adding new pages / components — checklist

- [ ] Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- [ ] All interactive elements ≥ 44 × 44 px
- [ ] All `<input>` / `<select>` with `style={{ fontSize: '16px' }}`
- [ ] No fixed pixel widths that exceed the viewport at 320 px
- [ ] Images have explicit `width` + `height` or `aspect-ratio` to prevent CLS
- [ ] Any modal uses the bottom-sheet pattern (section 3.3)
- [ ] Any fixed bar accounts for `env(safe-area-inset-bottom)`
- [ ] Long strings use `overflow-wrap: anywhere` or `line-clamp-*`
- [ ] Run `npm run audit:overflow` and confirm exit code 0
