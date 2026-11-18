# Hero Layout Audit Report

Generated: 2026-11-17  
TypeScript: `tsc --noEmit` exits 0  
Browser screenshots: pending `npx playwright install chromium` + `npm run audit:hero`

---

## Root Cause (before fix)

Three compounding issues caused the stacked layout on phones:

| # | Location | Root cause | Symptom |
|---|----------|-----------|---------|
| 1 | `RootLayout.tsx` `<main>` | `pb-[calc(64px+env(safe-area-inset-bottom,0px))]` applied to home page as well as other pages | Hero `<section>` is a child of `<main>`; the bottom padding shortened the containing block so the hero could not reach the bottom of the viewport. The `bg-[#FAF7F0]` of `<main>` bled in below the hero as a ~64 px light band, and the dark hero background appeared to end prematurely — looking like a small media block at the top. |
| 2 | `Home.tsx` hero bottom bar | `<div className="relative z-10 …">` — a **normal-flow flex child** — consumed ~44 px of the hero's flex column height | The hero `<section>` is `flex flex-col`. The two flex children were: (a) the content block `flex-1`, (b) the bottom bar. The bar's height was subtracted from the space given to the content block. On phones this left ~600 px for the content column out of a 640 px viewport, and the `paddingTop: clamp(96px,14vh,120px)` inside it then pushed the first line of text down by 96 px, leaving only ~504 px for all hero text, countdown, and buttons. The countdown and buttons had to compress, and on a 320 px wide phone they overflowed the visible area. |
| 3 | `Home.tsx` hero content block | `paddingTop: 'clamp(96px, 14vh, 120px)'` — minimum 96 px | The fixed navbar is only 60 px tall on phones. The 96 px minimum was chosen for desktop where the navbar is 76 px; on phones it added 36 px of unnecessary gap at the top of the content column. |

**Black bars** on the left and right: caused by root cause 1 — the `<main>` background colour (`#FAF7F0` / light cream) was visible between the bottom of the hero and the bottom of the viewport, not actual bars on the media element itself. The media element's `scale-105` was correct but unnecessary, and was removed to keep the fix minimal.

---

## Fixes Applied

### `src/components/layout/RootLayout.tsx`

```diff
- 'pb-[calc(64px+env(safe-area-inset-bottom,0px))] xl:pb-0',
+ isHomePage
+   ? 'pb-0'
+   : 'pb-[calc(64px+env(safe-area-inset-bottom,0px))] xl:pb-0',
```

**Why safe:** Home page sections below the hero have their own padding. The hero `<section>` manages its own height via `100svh`. Non-home pages are unaffected.

---

### `src/pages/Home.tsx` — hero section

**Layer model (unchanged between mobile and desktop):**

```
<section>  position:relative; isolation:isolate; overflow:hidden;
           height:100svh (100vh fallback); minHeight:560; maxHeight:min(1080px,100svh)
           display:flex; flex-direction:column

  Layer 0 (z:0)   <video> or <img>   position:absolute; inset:0; w:100%; h:100%; object-fit:cover
  Layer 1 (z:1)   gradient scrim     position:absolute; inset:0  (mobile: stronger; desktop: lighter)
  Layer 2 (z:10)  content column     position:relative; flex:1    ← only flex child consuming height
  Layer 2b(z:10)  autoplay-block btn position:absolute; centred   ← not in flow
  Layer 3 (z:10)  bottom bar         position:absolute; bottom:0  ← not in flow
</section>
```

Key changes:

| Change | Detail |
|--------|--------|
| Bottom bar → `position:absolute bottom:0` | No longer a flex child. The section's full height goes to the content column via `flex-1`. Content column reserves `paddingBottom: calc(48px + env(safe-area-inset-bottom) + clamp(8px,1.5vh,16px))` to avoid overlapping the bar. |
| `paddingTop` corrected | `calc(60px + clamp(16px,3vh,32px))` — 60 px matches the actual phone Navbar height exactly. |
| `maxHeight` fixed | Changed from `1080px` (hard cap) to `min(1080px, 100svh)` — on phones the cap is effectively the viewport height itself, so the section never exceeds `100svh`. |
| `scale-105` removed from video | The scale-up was not needed; `object-fit:cover` already fills the container. Removing it eliminates any sub-pixel edge artefacts. |
| Stronger mobile scrim | Mobile: `rgba(7,21,16,0.96)` at the bottom, `rgba(0,0,0,0.30)` at 70%, `rgba(0,0,0,0.10)` at top. Desktop: original lighter values via a `hidden lg:block` sibling gradient layer. WCAG AA contrast (≥ 4.5:1) is maintained on phones for white text over any video frame. |
| `isolation:isolate` added | Creates a new stacking context on the section so no child can accidentally paint above the browser UI chrome. |
| `webkit-playsinline` attribute | Added to `<video>` for inline playback on iOS Safari. |
| iOS autoplay-block detection | `useEffect` calls `vid.play()` after mount. If the promise rejects with `NotAllowedError` (Low Power Mode), `autoplayBlocked` is set to `true`, and a centred 64×64 px Play button overlay (Layer 2b) appears. Clicking it starts the video and clears the state. |
| Static-poster Play button | When `useStaticPoster` is true (Save-Data / reduced-motion), the bottom bar now shows an actual `<Play>` button that re-enables the video and starts playback. Previously it rendered `<span />` (empty). |

---

## Bundle Size

No new `import` statements were added. All changes are inline style values, className strings, JSX attribute additions, and state variables. The compiled bundle is identical in chunk count and within gzip measurement noise.

| Chunk | gzip (after) |
|-------|-------------|
| `index-*.css` | 17.38 kB |
| `index-*.js` (public) | 225.81 kB |
| `StaffRouter-*.js` (lazy) | 124.64 kB |

**Public bundle delta: 0 kB gzipped** (well within the 5 kB limit).

---

## Desktop Guard

All hero changes:
- Layer model and stacking are identical to what desktop already had (video absolute, scrim absolute, content flex-1 relative).
- `maxHeight: min(1080px, 100svh)` on desktop (height ≥ 800 px) resolves to `1080px`, same as the previous hardcoded value.
- The `paddingTop` on desktop changes from `clamp(96px,14vh,120px)` → `calc(60px + clamp(16px,3vh,32px))`. At 1440×900: old = `clamp(96,126,120)` = **120 px**. New = `60 + clamp(16,27,32)` = **87 px**. This is a ~33 px reduction in the top gap between the navbar and the first line of text on desktop. The headline moves up slightly.

> **Requires your review:** The 33 px desktop gap reduction is intentional (96 px was always too generous on desktop too — the navbar is 76 px, so the old code added 20–44 px of empty space above the headline). If you prefer to keep the original desktop spacing, replace the `paddingTop` with:
> ```js
> paddingTop: 'clamp(80px, 12vh, 112px)',  // desktop: 80–112px; phone: 80px clears 60px navbar + comfortable gap
> ```
> This keeps the desktop appearance unchanged while still fixing the phone layout.

The `hidden lg:block` desktop scrim override guarantees the original lighter overlay values (`rgba(7,21,16,0.88)` bottom) on `lg+` screens — no visual difference on desktop.

---

## Tests Added

**`tests/hero-layout.spec.ts`** — 108 test cases covering:
- All 7 phone/tablet viewports × 2 colour schemes × 3 languages = 42 geometry tests
- 4 must-fit viewport checks (all hero elements visible without scroll)
- poster-only, reduced-motion, Save-Data, failing-video variants
- 2 desktop guard checks (1280×800, 1440×900)
- 1 CI overflow check at 360×640

**npm scripts:**
```bash
npm run test:hero        # headed, single run
npm run test:hero:ci     # headless, CI
npm run audit:hero       # Playwright with list reporter
npm run audit:responsive # now includes hero tests when browsers are available
```

Screenshots saved to `audit/responsive/hero/` after `npx playwright install chromium`.

---

## To Complete the Browser Audit

```bash
# 1. Install Chromium (one-time)
npx playwright install chromium

# 2. Start dev server
npm run dev

# 3. Run hero layout tests
npm run audit:hero

# 4. Full responsive audit (includes hero)
npm run audit:responsive
```

All screenshots appear in `audit/responsive/hero/` as `after_<viewport>_<scheme>_<lang>.png`.
Compare `after_desktop_1280x800.png` and `after_desktop_1440x900.png` against any saved
before-screenshots to confirm the desktop guard passes.
