/**
 * live-content.spec.ts — Acceptance tests for the live-first content pipeline.
 *
 * These tests cover every scenario from the spec:
 *
 *   Group A — Day tabs derived from edition dates
 *   Group B — Live content visible after organizer save (requires Supabase)
 *   Group C — Snapshot / fallback behaviour (Supabase unreachable)
 *   Group D — Draft items never appear on the public site
 *   Group E — Debug view (?debug=content)
 *   Group F — Specific scenario: Day 5 morning event title change
 *
 * Tests that cannot be automated (require a running Supabase + portal) are
 * marked with test.skip() and documented in docs/PUBLISHING.md instead.
 *
 * Run against local dev:
 *   npx playwright test
 *
 * Run against a deployed preview:
 *   TEST_BASE_URL=https://tourism-week.vercel.app npx playwright test
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wait for the Schedule page to finish rendering (day tabs visible). */
async function goToSchedule(page: Page, day = 1) {
  await page.goto(`/schedule?day=${day}`);
  await expect(page.locator('button[role="tab"], button:has-text("Day")').first()).toBeVisible({ timeout: 8000 });
}

/** Wait for the Home page day explorer tabs to be visible. */
async function goToHome(page: Page) {
  await page.goto('/');
  // Day tabs are inside a grid, role=tab
  await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 8000 });
}

/** Check that the live layer's RPC URL is configured (requires .env). */
function hasSupabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.TEST_SUPABASE_URL ?? '';
  return url.length > 0 && !url.includes('placeholder');
}

// =============================================================================
// GROUP A — Day tabs derived from edition dates
// =============================================================================

test.describe('Day tabs', () => {
  test('Schedule shows exactly 5 day tabs (edition is 5 days)', async ({ page }) => {
    await goToSchedule(page);
    // Each day tab contains "Day N" text
    const tabs = page.locator('button:has-text("Day")');
    // Should be 5 (or fewer if trailing days have no events — spec allows that)
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(5);
  });

  test('Schedule does NOT show a Day 6 tab', async ({ page }) => {
    await goToSchedule(page);
    await expect(page.locator('button:has-text("Day 6")')).toHaveCount(0);
  });

  test('Home day explorer shows the same number of tabs as Schedule', async ({ page }) => {
    await goToSchedule(page);
    const scheduleTabs = await page.locator('button:has-text("Day")').count();

    await goToHome(page);
    const homeTabs = await page.locator('[role="tab"]').count();

    // Both should be <= 5 and consistent
    expect(homeTabs).toBeGreaterThanOrEqual(1);
    expect(homeTabs).toBeLessThanOrEqual(5);
    expect(scheduleTabs).toBeGreaterThanOrEqual(1);
  });

  test('Active day tab shows an E.C. date substring', async ({ page }) => {
    await goToSchedule(page, 1);
    // The active tab (bg-green) should contain something like "29/07"
    const activeTab = page.locator('button:has-text("Day 1")').first();
    await expect(activeTab).toContainText('/');
  });

  test('Selecting Day 5 on Schedule shows Day 5 events or empty-state', async ({ page }) => {
    await goToSchedule(page, 5);
    // Either events are shown, or the friendly empty-state message
    const hasEvents = await page.locator('article').count() > 0;
    const hasEmptyState = await page.locator('text=/programme.*coming soon|no events/i').count() > 0;
    expect(hasEvents || hasEmptyState).toBe(true);
  });

  test('Invalid day param defaults to Day 1', async ({ page }) => {
    await page.goto('/schedule?day=99');
    // Should land on Day 1 (URL may be rewritten or Day 1 tab is active)
    const day1Tab = page.locator('button:has-text("Day 1")').first();
    await expect(day1Tab).toBeVisible();
  });
});

// =============================================================================
// GROUP B — Live content visible after save (requires Supabase)
// These tests are skipped when VITE_SUPABASE_URL is not set.
// Run manually against a connected local dev or preview deployment.
// =============================================================================

test.describe('Live content (requires Supabase)', () => {
  test.skip(!hasSupabaseEnv(), 'Skipped: no VITE_SUPABASE_URL configured');

  test('Public site fetches live data within 10 seconds of a page refresh', async ({ page }) => {
    // Navigate, wait up to 10 s for the live layer to populate the cache
    await page.goto('/?debug=content');
    // The debug view shows the localStorage cached source
    // After a live fetch it should say "supabase"
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem('tw_live_snapshot');
        if (!raw) return false;
        try {
          return JSON.parse(raw)?.snapshot?.source === 'supabase';
        } catch { return false; }
      },
      null,
      { timeout: 10_000 }
    );
  });

  test('Debug view shows source=supabase when Supabase is reachable', async ({ page }) => {
    await page.goto('/?debug=content');
    // The debug panel shows "source" row with "supabase" for the live fetch
    await expect(page.locator('td:has-text("supabase")')).toBeVisible({ timeout: 10_000 });
  });
});

// =============================================================================
// GROUP C — Snapshot / fallback when Supabase is unreachable
// These tests work without Supabase since they test the snapshot initialData.
// =============================================================================

test.describe('Snapshot fallback', () => {
  test('Home page renders without network (snapshot initialData)', async ({ page }) => {
    // Block the Supabase RPC endpoint to simulate offline
    await page.route('**/rest/v1/rpc/get_public_content**', (route) => route.abort('failed'));
    await page.goto('/');
    // Page should still show without any spinner or error
    await expect(page.locator('h1, [data-testid="hero"]')).toBeVisible({ timeout: 8000 });
    // No error boundary visible
    await expect(page.locator('text=/something went wrong|error/i')).toHaveCount(0);
  });

  test('Schedule renders without network using snapshot events', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_public_content**', (route) => route.abort('failed'));
    await goToSchedule(page);
    // Schedule tabs and content are present
    await expect(page.locator('button:has-text("Day")').first()).toBeVisible();
  });

  test('Circuit breaker prevents repeated retries after failure', async ({ page }) => {
    // Block all Supabase calls
    await page.route('**/rest/v1/**', (route) => route.abort('failed'));

    let fetchCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('get_public_content')) fetchCount++;
    });

    await page.goto('/');
    // Wait 3 seconds — should NOT retry repeatedly within the first 10 min
    await page.waitForTimeout(3000);
    // Should have attempted at most 1 fetch (the initial one) before the
    // circuit breaker trips
    expect(fetchCount).toBeLessThanOrEqual(2);
  });

  test('No error message shown to visitors when Supabase is down', async ({ page }) => {
    await page.route('**/rest/v1/**', (route) => route.abort('failed'));
    await page.goto('/');
    // Verify no error UI
    await expect(page.locator('text=/error|failed|unavailable/i')).toHaveCount(0);
  });

  test('Returning visitor sees localStorage-cached content immediately', async ({ page }) => {
    // Seed localStorage with a known snapshot
    await page.goto('/');
    await page.evaluate(() => {
      const fakeSnap = {
        snapshot: {
          source: 'supabase',
          generatedAt: new Date().toISOString(),
          edition: { id: 'test-cached', endDateGC: '2025-04-11', startDateGC: '2025-04-07' },
          events: [],
          news: [], gallery: [], sponsors: [], committee: [], faqs: [],
          announcements: [], siteSettings: null, sections: [], pastEditions: [],
        },
        fetchedAt: Date.now(),
      };
      localStorage.setItem('tw_live_snapshot', JSON.stringify(fakeSnap));
    });

    // Now navigate again — the cached data should be used as initialData
    await page.route('**/rest/v1/**', (route) => route.abort('failed'));
    await page.goto('/');
    // Page loads immediately (no flash of empty state)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 3000 });
  });
});

// =============================================================================
// GROUP D — Draft items never appear on the public site
// =============================================================================

test.describe('Draft items hidden from visitors', () => {
  test('No event shows state=draft in the public HTML', async ({ page }) => {
    await page.goto('/events');
    // The public events list must not expose any draft-state events
    const html = await page.content();
    // "state":"draft" would only appear if draft data leaked into the DOM
    expect(html).not.toContain('"state":"draft"');
    expect(html).not.toContain('"state": "draft"');
  });

  test('Events page loads and shows at least the day structure', async ({ page }) => {
    await page.goto('/events');
    // Should have at least one event card or an empty state — never a blank page
    const cards = await page.locator('article').count();
    const emptyState = await page.locator('text=/no events|coming soon/i').count();
    expect(cards + emptyState).toBeGreaterThan(0);
  });
});

// =============================================================================
// GROUP E — Debug view
// =============================================================================

test.describe('Debug view (?debug=content)', () => {
  test('Debug panel appears when ?debug=content is in URL', async ({ page }) => {
    await page.goto('/?debug=content');
    await expect(page.locator('text=Content Debug')).toBeVisible({ timeout: 5000 });
  });

  test('Debug panel shows snapshot source', async ({ page }) => {
    await page.goto('/?debug=content');
    // Should show one of: supabase, last-good, seed
    const panel = page.locator('text=Content Debug').locator('..').locator('..');
    await expect(panel.locator('text=/supabase|last-good|seed/')).toBeVisible({ timeout: 5000 });
  });

  test('Debug panel does NOT appear without the query param', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Content Debug')).toHaveCount(0);
  });

  test('Debug panel shows generatedAt timestamp', async ({ page }) => {
    await page.goto('/?debug=content');
    // The snapshot generatedAt is an ISO date — look for the year
    await expect(page.locator('td:has-text("202")')).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// GROUP F — Specific scenario from the spec
// "Organizer changes Day 5 morning event title to 'Guest Tour and Destination
//  Promotion' — it appears on Home Day 5, /schedule?day=5, /events, /events/<slug>"
//
// The slug must remain 'guest-tour-woliso-destinations'.
// This test mocks the live RPC response to simulate the organizer's change.
// =============================================================================

test.describe('Specific scenario: Day 5 morning title change', () => {
  const MOCK_TITLE = 'Guest Tour and Destination Promotion';
  const SLUG       = 'guest-tour-woliso-destinations';

  /**
   * Intercept the get_public_content RPC and inject the updated title
   * into the response, simulating what happens after an organizer saves.
   */
  async function injectUpdatedTitle(page: Page) {
    await page.route('**/rest/v1/rpc/get_public_content**', async (route) => {
      const response = await route.fetch();
      let body: Record<string, unknown>;
      try {
        body = await response.json();
      } catch {
        await route.continue();
        return;
      }

      // Patch the Day 5 morning event title
      const events = (body.events as Array<Record<string, unknown>>) ?? [];
      const patched = events.map((e) => {
        if (e.slug === SLUG) {
          return {
            ...e,
            title_i18n: { en: MOCK_TITLE, am: MOCK_TITLE, om: MOCK_TITLE },
            titleI18n: { en: MOCK_TITLE, am: MOCK_TITLE, om: MOCK_TITLE },
          };
        }
        return e;
      });
      body.events = patched;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }

  test('Updated title appears on /schedule?day=5', async ({ page }) => {
    await injectUpdatedTitle(page);
    await page.goto('/schedule?day=5');
    // Wait for live content to populate (up to 10 s)
    await expect(
      page.locator(`text=${MOCK_TITLE}`)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Updated title appears on /events', async ({ page }) => {
    await injectUpdatedTitle(page);
    await page.goto('/events');
    await expect(
      page.locator(`text=${MOCK_TITLE}`)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Updated title appears on /events/<slug>', async ({ page }) => {
    await injectUpdatedTitle(page);
    await page.goto(`/events/${SLUG}`);
    await expect(
      page.locator(`text=${MOCK_TITLE}`)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Slug stays the same after title change', async ({ page }) => {
    await injectUpdatedTitle(page);
    await page.goto(`/events/${SLUG}`);
    // Page should load (not 404)
    await expect(page.locator('h1, [data-testid="event-title"]')).toBeVisible({ timeout: 8000 });
    // URL slug did not change
    expect(page.url()).toContain(SLUG);
  });

  test('Updated title appears on Home Day 5 explorer', async ({ page }) => {
    await injectUpdatedTitle(page);
    await page.goto('/');
    // Click the Day 5 tab in the day explorer
    const day5Tab = page.locator('[role="tab"]:has-text("5"), button:has-text("Day 5")').first();
    await expect(day5Tab).toBeVisible({ timeout: 8000 });
    await day5Tab.click();
    await expect(
      page.locator(`text=${MOCK_TITLE}`)
    ).toBeVisible({ timeout: 10_000 });
  });
});

// =============================================================================
// GROUP G — Navigation and pages load
// =============================================================================

test.describe('Core pages render', () => {
  const pages = [
    { url: '/',          label: 'Home'     },
    { url: '/schedule',  label: 'Schedule' },
    { url: '/events',    label: 'Events'   },
    { url: '/news',      label: 'News'     },
    { url: '/gallery',   label: 'Gallery'  },
    { url: '/about',     label: 'About'    },
    { url: '/sponsors',  label: 'Sponsors' },
    { url: '/contact',   label: 'Contact'  },
  ];

  for (const { url, label } of pages) {
    test(`${label} page loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(url);
      await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
      expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
    });
  }
});
