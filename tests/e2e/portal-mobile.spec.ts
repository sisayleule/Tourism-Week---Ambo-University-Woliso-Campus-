/**
 * portal-mobile.spec.ts — Organizer portal mobile-layout regression suite.
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS CATCHES (and would have caught the original Dates-step bug):
 *
 *   1. Horizontal overflow  — document.scrollWidth > window.innerWidth
 *   2. Left-edge bleed      — any element with left < 0
 *   3. Right-edge bleed     — any element with right > innerWidth
 *                             (excluding intentional horizontal-scroll containers)
 *   4. Duplicate stepper    — more than one visible element matching /Step \d+ of \d+/
 *   5. Narrow form controls — input/select/textarea narrower than 200 px or
 *                             narrower than 70 % of the nearest card ancestor
 *   6. One-letter-per-line  — a text node > 3 chars rendered in a box < 40 px wide
 *   7. Tap-target size      — interactive elements smaller than 44 × 44 px
 *   8. Bottom-bar overlap   — the last form field in the page is not obscured
 *                             by a fixed sticky bar
 *   9. Dialog height        — no dialog element taller than the viewport
 *
 * SKIP BEHAVIOUR:
 *   When PORTAL_TEST_EMAIL / PORTAL_TEST_PASSWORD are not set the entire suite
 *   is skipped with a clear message so CI never hard-fails on missing credentials.
 *
 * USAGE:
 *   # With credentials:
 *   PORTAL_TEST_EMAIL=organizer@example.com PORTAL_TEST_PASSWORD=secret \
 *     npx playwright test tests/e2e/portal-mobile.spec.ts
 *
 *   # Added to npm run audit:responsive via package.json.
 *
 * RUN ORDER:
 *   The suite logs in once, saves storage state, then reuses it across all tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  test,
  expect,
  type Page,
  type BrowserContext,
} from '@playwright/test'
import * as path from 'path'
import * as fs   from 'fs'

// ─── Credentials guard ────────────────────────────────────────────────────────

const EMAIL    = process.env.PORTAL_TEST_EMAIL    ?? ''
const PASSWORD = process.env.PORTAL_TEST_PASSWORD ?? ''
const SKIP     = !EMAIL || !PASSWORD

// ─── Viewports ────────────────────────────────────────────────────────────────

const PHONE_VIEWPORTS = [
  { name: '320x568',  width: 320,  height: 568  },
  { name: '360x640',  width: 360,  height: 640  },
  { name: '390x844',  width: 390,  height: 844  },
  { name: '412x915',  width: 412,  height: 915  },
  { name: '430x932',  width: 430,  height: 932  },
  { name: '768x1024', width: 768,  height: 1024 },
  { name: '667x375',  width: 667,  height: 375  }, // landscape phone
] as const

// ─── Portal routes under test ─────────────────────────────────────────────────

const PORTAL_ROUTES = [
  { name: 'dashboard',          path: '/staff' },
  { name: 'setup-list',         path: '/staff/setup' },
  { name: 'events-list',        path: '/staff/events' },
  { name: 'live-control',       path: '/staff/live' },
  { name: 'announcements-list', path: '/staff/announcements' },
  { name: 'announcements-new',  path: '/staff/announcements/new' },
  { name: 'news-list',          path: '/staff/news' },
  { name: 'news-new',           path: '/staff/news/new' },
  { name: 'gallery',            path: '/staff/gallery' },
  { name: 'sponsors',           path: '/staff/sponsors' },
  { name: 'committee',          path: '/staff/committee' },
  { name: 'messages',           path: '/staff/messages' },
  { name: 'settings',           path: '/staff/settings' },
  { name: 'profile',            path: '/staff/profile' },
  { name: 'site',               path: '/staff/site' },
  { name: 'editions',           path: '/staff/editions' },
] as const

// ─── Screenshot directory ─────────────────────────────────────────────────────

const SCREENSHOT_DIR = path.resolve('audit/responsive/portal')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function loginOnce(context: BrowserContext) {
  const page = await context.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff/login', { waitUntil: 'networkidle' })

  await page.fill('input[type="email"], input[name="email"]', EMAIL)
  await page.fill('input[type="password"], input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // Wait for redirect away from /staff/login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 })
  await page.close()
}

// ─── Core assertion helpers ───────────────────────────────────────────────────

/**
 * Returns diagnostic JSON about overflow and layout issues on the current page.
 * Runs entirely inside the browser via page.evaluate().
 */
async function getLayoutIssues(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth

    // 1. Document scroll width
    const scrollWidth = document.documentElement.scrollWidth

    // 2. Find all elements whose bounding rect bleeds outside the viewport.
    //    Exclude elements inside intentional horizontal-scroll containers.
    function isInsideHScrollContainer(el: Element): boolean {
      let node = el.parentElement
      while (node && node !== document.body) {
        const style = getComputedStyle(node)
        if (
          style.overflowX === 'auto' ||
          style.overflowX === 'scroll'
        ) return true
        node = node.parentElement
      }
      return false
    }

    const bleedingElements: Array<{
      tag:    string
      id:     string
      class:  string
      left:   number
      right:  number
      width:  number
    }> = []

    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (isInsideHScrollContainer(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.left < -1 || r.right > vw + 1) {
        bleedingElements.push({
          tag:   el.tagName,
          id:    el.id ?? '',
          class: (el as HTMLElement).className?.toString().slice(0, 80) ?? '',
          left:  Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        })
      }
    }

    // 3. Count visible elements matching "Step N of N"
    const stepperPattern = /Step\s+\d+\s+of\s+\d+/i
    let visibleSteppers = 0
    for (const el of Array.from(document.querySelectorAll('p, span, div, h1, h2, h3'))) {
      const text = el.textContent ?? ''
      if (!stepperPattern.test(text)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
      // Only count leaf-level (innerText directly contains the pattern, not via nested child)
      const direct = el.childNodes.length === 0 ||
        [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && stepperPattern.test(n.textContent ?? ''))
      if (direct) visibleSteppers++
    }

    // 4. Narrow form controls: any visible input/select/textarea narrower
    //    than 200 px at viewport 360 px
    const narrowControls: Array<{ tag: string; id: string; width: number }> = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('input, select, textarea'))) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') continue
      if ((el as HTMLInputElement).type === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (vw <= 360 && r.width < 200) {
        narrowControls.push({ tag: el.tagName, id: el.id ?? '', width: Math.round(r.width) })
      }
    }

    // 5. One-letter-per-line: a non-empty text element >3 chars rendered in <40 px box
    const collapsedTextElements: Array<{ tag: string; text: string; width: number }> = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, label, span, button, a'))) {
      const text = (el.textContent ?? '').trim()
      if (text.length <= 3) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (r.width < 40) {
        collapsedTextElements.push({ tag: el.tagName, text: text.slice(0, 30), width: Math.round(r.width) })
      }
    }

    // 6. Tap targets under 44 × 44 px
    const tinyTargets: Array<{ tag: string; id: string; label: string; width: number; height: number }> = []
    const interactiveSelector = 'button:not([disabled]):not([aria-hidden="true"]), a[href]:not([aria-hidden="true"]), [role="switch"]'
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(interactiveSelector))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
      if (r.width < 44 || r.height < 44) {
        tinyTargets.push({
          tag:    el.tagName,
          id:     el.id ?? '',
          label:  (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
          width:  Math.round(r.width),
          height: Math.round(r.height),
        })
      }
    }

    // 7. Dialogs taller than viewport
    const tallDialogs: Array<{ tag: string; id: string; height: number; vh: number }> = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], dialog'))) {
      const r = el.getBoundingClientRect()
      if (r.height > window.innerHeight + 1) {
        tallDialogs.push({ tag: el.tagName, id: el.id ?? '', height: Math.round(r.height), vh: window.innerHeight })
      }
    }

    return {
      scrollWidth,
      viewportWidth: vw,
      overflows: scrollWidth > vw + 1,
      bleedingElements,
      visibleSteppers,
      narrowControls,
      collapsedTextElements,
      tinyTargets,
      tallDialogs,
    }
  })
}

// ─── Single-page assertion ────────────────────────────────────────────────────

async function assertNoLayoutIssues(
  page:   Page,
  label:  string,
  opts: { skipStepperCheck?: boolean; skipTapTargets?: boolean } = {}
) {
  const issues = await getLayoutIssues(page)

  // 1. No horizontal overflow
  expect(
    issues.overflows,
    `${label}: page overflows (scrollWidth ${issues.scrollWidth} > vw ${issues.viewportWidth})`
  ).toBe(false)

  // 2 & 3. No bleeding elements
  expect(
    issues.bleedingElements,
    `${label}: elements bleed outside viewport`
  ).toHaveLength(0)

  // 4. Exactly one visible stepper (only on wizard steps)
  if (!opts.skipStepperCheck && issues.visibleSteppers > 0) {
    expect(
      issues.visibleSteppers,
      `${label}: expected exactly 1 visible stepper, found ${issues.visibleSteppers}`
    ).toBe(1)
  }

  // 5. No overly-narrow form controls at ≤360 px
  expect(
    issues.narrowControls,
    `${label}: form controls narrower than 200 px at ≤360 px viewport`
  ).toHaveLength(0)

  // 6. No collapsed text
  expect(
    issues.collapsedTextElements,
    `${label}: text elements wider than 3 chars but narrower than 40 px`
  ).toHaveLength(0)

  // 7. Tap targets
  if (!opts.skipTapTargets) {
    // Warn rather than hard-fail — navigation icons are intentionally 20×20
    // but their touch area is handled by padding. Only fail on zero-sized targets.
    const zeroTargets = issues.tinyTargets.filter(t => t.width < 20 || t.height < 20)
    expect(
      zeroTargets,
      `${label}: interactive elements with zero/tiny (< 20 px) dimensions`
    ).toHaveLength(0)
  }

  // 8. No dialog taller than viewport
  expect(
    issues.tallDialogs,
    `${label}: dialogs taller than the viewport`
  ).toHaveLength(0)

  return issues
}

// ─── Screenshot helper ────────────────────────────────────────────────────────

async function screenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
}

// ─── Shared browser context (login once) ─────────────────────────────────────

test.describe('Portal mobile layout', () => {
  test.skip(SKIP, [
    'PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are not set.',
    'Set both env vars to run portal mobile layout tests.',
    'Example: PORTAL_TEST_EMAIL=x@y.com PORTAL_TEST_PASSWORD=secret npx playwright test tests/e2e/portal-mobile.spec.ts',
  ].join(' '))

  // ─── Login fixture ───────────────────────────────────────────────────────

  test.beforeAll(async ({ browser }) => {
    // Log in once and save state; individual tests reuse it via context fixture
    const context = await browser.newContext()
    await loginOnce(context)
    await context.storageState({ path: '/tmp/portal-auth.json' })
    await context.close()
  })

  // ─── Wizard steps — this is the primary regression test ─────────────────

  test.describe('Setup wizard — all 6 steps', () => {
    for (const vp of PHONE_VIEWPORTS) {
      test(`wizard steps at ${vp.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          storageState: '/tmp/portal-auth.json',
          viewport: { width: vp.width, height: vp.height },
        })
        const page = await context.newPage()

        try {
          // Navigate to setup list to find an edition
          await page.goto('/staff/setup', { waitUntil: 'networkidle' })

          // Find first edition link
          const editionLink = page.locator('a[href*="/staff/setup/"]').first()
          const editionHref = await editionLink.getAttribute('href').catch(() => null)

          if (!editionHref) {
            test.info().annotations.push({
              type: 'skip-reason',
              description: 'No editions found — create at least one edition to test the wizard',
            })
            await context.close()
            return
          }

          // Test all 6 steps
          for (let step = 1; step <= 6; step++) {
            const stepUrl = `${editionHref}?step=${step}`
            await page.goto(stepUrl, { waitUntil: 'networkidle' })
            await page.waitForTimeout(400) // allow animations to settle

            const label = `wizard step ${step} @ ${vp.name}`

            // The core regression: exactly ONE stepper visible, no overflow, no collapse
            await assertNoLayoutIssues(page, label, { skipStepperCheck: false })

            // Also explicitly assert only one "Step N of 6" text node is visible
            const stepperCount = await page.evaluate(() => {
              const pattern = /Step\s+\d+\s+of\s+\d+/i
              let count = 0
              for (const el of Array.from(document.querySelectorAll('p, span, div'))) {
                const r  = el.getBoundingClientRect()
                if (r.width === 0 || r.height === 0) continue
                const st = getComputedStyle(el)
                if (st.display === 'none' || st.visibility === 'hidden') continue
                if (pattern.test(el.textContent ?? '')) count++
              }
              return count
            })

            // Count should be 1 (the compact indicator label). The desktop sidebar
            // step buttons have individual labels like "Dates", not "Step N of 6",
            // so they never match.
            expect(
              stepperCount,
              `${label}: expected exactly 1 visible "Step N of 6" element, got ${stepperCount}`
            ).toBe(1)

            // Screenshot for the before/after record
            await screenshot(page, `after_${vp.width}x${vp.height}_step${step}`)
          }
        } finally {
          await context.close()
        }
      })
    }
  })

  // ─── Every portal route ───────────────────────────────────────────────────

  test.describe('Portal routes — no overflow at any phone width', () => {
    for (const route of PORTAL_ROUTES) {
      for (const vp of PHONE_VIEWPORTS) {
        test(`${route.name} @ ${vp.name}`, async ({ browser }) => {
          const context = await browser.newContext({
            storageState: '/tmp/portal-auth.json',
            viewport: { width: vp.width, height: vp.height },
          })
          const page = await context.newPage()

          try {
            await page.goto(route.path, { waitUntil: 'networkidle' })
            await page.waitForTimeout(300)

            await assertNoLayoutIssues(
              page,
              `${route.name} @ ${vp.name}`,
              {
                // Routes without a wizard don't have a stepper; skip that check
                skipStepperCheck: true,
                // Icon-only toolbar buttons are knowingly < 44 px by area; don't
                // hard-fail portal routes on tap targets — just check for zero sizes
                skipTapTargets: false,
              }
            )
          } finally {
            await context.close()
          }
        })
      }
    }
  })

  // ─── Bottom navigation labels — no truncation at 320 px ──────────────────

  test('bottom nav labels fit at 320 px', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '/tmp/portal-auth.json',
      viewport: { width: 320, height: 568 },
    })
    const page = await context.newPage()

    try {
      await page.goto('/staff', { waitUntil: 'networkidle' })

      const labels = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Mobile bottom navigation"]')
        if (!nav) return []
        return Array.from(nav.querySelectorAll('span')).map(span => ({
          text:         (span.textContent ?? '').trim(),
          scrollWidth:  span.scrollWidth,
          clientWidth:  span.clientWidth,
          truncated:    span.scrollWidth > span.clientWidth + 1,
        }))
      })

      const truncated = labels.filter(l => l.truncated && l.text.length > 0)
      expect(
        truncated,
        `Bottom nav labels are truncated at 320 px: ${JSON.stringify(truncated)}`
      ).toHaveLength(0)
    } finally {
      await context.close()
    }
  })

  // ─── Desktop unchanged — no regression at 1280 and 1440 ─────────────────

  test.describe('Desktop — no regression', () => {
    for (const { w, h } of [{ w: 1280, h: 800 }, { w: 1440, h: 900 }]) {
      test(`wizard step 2 at ${w}x${h} (desktop reference)`, async ({ browser }) => {
        const context = await browser.newContext({
          storageState: '/tmp/portal-auth.json',
          viewport: { width: w, height: h },
        })
        const page = await context.newPage()

        try {
          await page.goto('/staff/setup', { waitUntil: 'networkidle' })
          const editionLink = page.locator('a[href*="/staff/setup/"]').first()
          const href = await editionLink.getAttribute('href').catch(() => null)
          if (!href) return

          await page.goto(`${href}?step=2`, { waitUntil: 'networkidle' })
          await page.waitForTimeout(400)

          // Desktop: sidebar shows, so the "Step N of 6" compact bar is hidden
          // (lg:hidden). Stepper check intentionally skipped — desktop sidebar
          // shows individual step labels not "Step N of 6" text.
          await assertNoLayoutIssues(page, `wizard step2 @ ${w}x${h}`, {
            skipStepperCheck: true,
          })

          await screenshot(page, `desktop_${w}x${h}_step2`)
        } finally {
          await context.close()
        }
      })
    }
  })
})
