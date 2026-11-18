# Publishing Pipeline — Tourism Week Website

> **Phase 6 (live-first)** — How content flows from Supabase to the live public website,
> and how to verify that it is working correctly.

---

## Pipeline overview

```
 Staff Portal (/staff/*)                           Public Website (React SPA, /*)
 ┌────────────────────────┐                        ┌──────────────────────────────┐
 │ Edit event / news / …  │                        │ 1. Build-time snapshot       │
 │ ↓ Supabase UPDATE      │                        │    src/data/generated/       │
 │                        │                        │    snapshot.json             │
 │ EventFormPage:         │                        │    (bundled at Vite build)   │
 │  · "Save changes"      │                        │                              │
 │    keeps state=pub.    │                        │ 2. localStorage cache        │
 │  · "Save draft"        │                        │    tw_live_snapshot          │
 │    keeps state=draft   │                        │    (from last live fetch)    │
 │  · "Publish" sets      │                        │                              │
 │    state=published     │                        │ 3. Live RPC layer            │
 │  · "Unpublish" sets    │                        │    GET /rest/v1/rpc/         │
 │    state=draft         │                        │    get_public_content()      │
 └────────────┬───────────┘                        │    after mount + on focus    │
              │                                     │    + every 60 s              │
              │  DB triggers →                      │    (3 s timeout, 10 min      │
              │  site_state.last_change_at          │    circuit breaker)          │
              │                                     └──────────────────────────────┘
              │  90 s debounce
              ▼  (scheduleDeploy)
 ┌────────────────────────┐
 │ trigger-deploy          │──POST──▶ Vercel Deploy Hook
 │ Edge Function           │          → vite build
 │ (staff JWT required)    │          → prebuild: snapshot.json from Supabase
 └────────────────────────┘          → postbuild: SEO HTML
```

**Key property:** an organizer's title/description/image change reaches the public
site in two ways:
- **Immediately** (< 10 s): the live RPC layer fetches `get_public_content()` and
  writes the result into the TanStack Query cache. No rebuild needed.
- **Durably** (1–2 min): the 90-second deploy debounce triggers a Vercel rebuild,
  which writes a new `snapshot.json` and ships it to the CDN.

**Live-only changes (event status, announcements)** go through the same live RPC
layer and do not trigger a rebuild.

---

## 1. Prerequisites — set up Supabase

### a. Run migrations

Apply migrations in order in your Supabase SQL editor:

```bash
# Via Supabase CLI (recommended):
supabase db push
```

Or paste each file from `supabase/migrations/` in order.
Migration 014 (`014_live_content.sql`) creates `get_public_content()` and grants
execute to the `anon` role.

### b. Apply the programme fix (first run only)

After running all migrations, apply the programme alignment:

```sql
-- In Supabase SQL Editor → paste supabase/fixes/align_programme.sql → Run
```

Review the `(needs review)` markers in the Amharic and Afaan Oromo translations
before running in production.

### c. Seed initial data

```bash
node scripts/generate-seed-sql.mjs   # regenerates content/seed-for-dashboard.sql
# Then paste content/seed-for-dashboard.sql into the Supabase SQL Editor and run it.
```

---

## 2. Environment variables

### Local development (`.env`)

```env
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon key>"
VITE_SITE_URL=""            # leave empty → sync bar shows "Local mode"
VITE_FORCE_LIVE_OVERLAY=""  # set to "true" to force live fetches regardless of dates
VITE_LIVE_CONTENT=""        # set to "false" to disable the live layer entirely
```

### Vercel (Settings → Environment Variables)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon (publishable) key |
| `VITE_SITE_URL` | Canonical site URL (for sitemap + sync bar) |
| `VITE_FORCE_LIVE_OVERLAY` | Optional: `"true"` for live-always testing |
| `VITE_LIVE_CONTENT` | Optional: `"false"` to disable live layer |
| `VITE_TURNSTILE_SITE_KEY` | Optional: Cloudflare Turnstile site key |

### Supabase Edge Function secrets

| Secret | Required? | Purpose |
|--------|-----------|---------|
| `VERCEL_DEPLOY_HOOK_URL` | Yes | URL from Vercel → Settings → Deploy Hooks |
| `IP_SALT` | Yes | Random hex string for IP hashing |
| `SITE_URL` | Yes | Public site URL (for CORS in submit-message) |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare anti-bot |

```bash
supabase secrets set VERCEL_DEPLOY_HOOK_URL=https://api.vercel.co/v1/...
supabase secrets set IP_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
supabase secrets set SITE_URL=https://your-app.vercel.app
```

---

## 3. The `get_public_content()` RPC function

The live layer calls a single Supabase SQL function via `POST /rest/v1/rpc/get_public_content`.

- **Security model**: `SECURITY INVOKER` — RLS applies with the caller's (anon) role.
  Drafts are invisible to anonymous callers.
- **Returns**: one JSONB with `edition`, `events` (≤100), `news` (≤50),
  `gallery` (≤200), `sponsors`, `committee`, `faqs`, `site_settings`,
  `announcements`, `sections` (with items), `past_editions`, `generated_at`.
- **Call it manually** to verify RLS:

```sql
-- In Supabase SQL Editor → run as anon (no JWT):
SELECT public.get_public_content();

-- Count events returned (should equal published events only):
SELECT jsonb_array_length(public.get_public_content()->'events') AS published_events;
```

Run the full RLS check suite from `supabase/rls_checks.sql` (sections 9a–9k).

---

## 4. Verifying live-first behaviour manually

### 4a. The quick end-to-end test

1. Open the staff portal (`/staff/events`).
2. Edit any published event's English title — add " [LIVE TEST]" to the end.
3. Click **Save changes**.
4. The status line should show "Live on the website".
5. The post-save feedback shows "Saved. Visitors see it within a few seconds".
6. Click **Verify on website** — it should return "Visible on the website" within 10 s.
7. Open the public site in another tab at `/schedule?day=N` (the event's day).
8. Refresh — the updated title appears immediately (live layer hit).
9. Remove " [LIVE TEST]" and save again.

### 4b. Confirm no rebuild was needed

The event title change must appear **without** a Vercel rebuild:
- Watch the sync bar: it may go through "changes-waiting" → "updating"
  (that is the 90-second debounce triggering a rebuild for durability).
- But the public title change should be visible **before** the rebuild completes,
  because the live RPC layer updates on page focus/refresh within 10 s.

### 4c. Debug view

Open `/?debug=content` in the public site. The panel shows:
- **Build-time snapshot**: source, generatedAt, editionId, eventCount
- **Deployed content-meta.json**: same fields from the live CDN
- **Last live fetch**: timestamp from `localStorage.tw_live_snapshot`
- **Circuit breaker**: whether it has tripped and when it expires
- **Active TanStack cache**: editionId, endDateGC, eventCount

---

## 5. Automated acceptance tests

### Running the tests

```bash
# Against local dev (auto-starts Vite dev server):
npm test

# Or with the interactive UI:
npm run test:ui

# Against a deployed preview:
TEST_BASE_URL=https://tourism-week.vercel.app npm test
```

### What is automated (`tests/live-content.spec.ts`)

| Test group | What it covers | Needs Supabase? |
|-----------|----------------|-----------------|
| **A: Day tabs** | 5 tabs max, no Day 6, E.C. dates visible, Day 5 shows events or empty-state, invalid day defaults to 1 | No |
| **B: Live content** | Live RPC populated in localStorage within 10 s; debug view shows source=supabase | Yes (skipped otherwise) |
| **C: Snapshot fallback** | Renders without network; circuit breaker stops retries; no error shown; localStorage cache used immediately | No |
| **D: Draft items** | state=draft never appears in public HTML | No |
| **E: Debug view** | Panel appears with ?debug=content; hidden without it; shows generatedAt | No |
| **F: Title change scenario** | Mock RPC injects new Day 5 title → visible on /schedule?day=5, /events, /events/<slug>, Home Day 5 | No (mocked) |
| **G: Core pages** | All 8 public pages load without JS errors | No |

Group B tests run only when `VITE_SUPABASE_URL` or `TEST_SUPABASE_URL` is set.

---

## 6. Manual acceptance tests (cannot be automated against local dev)

These require a live Supabase project, portal login, and optionally a deployed Vercel site.

### M-1: Organizer changes Day 5 morning title

**Scenario**: Title changed to "Guest Tour and Destination Promotion".

Steps:
1. Sign in to the staff portal.
2. Navigate to Events → find `guest-tour-woliso-destinations`.
3. Change the English title to "Guest Tour and Destination Promotion".
4. Click **Save changes** (item is published — button must say "Save changes", not "Save draft").
5. Status line shows "Live on the website".
6. Wait up to 10 seconds, then open:
   - `/schedule?day=5` → new title visible
   - `/events` → new title visible
   - `/events/guest-tour-woliso-destinations` → new title visible (slug unchanged)
   - `/` → click Day 5 in the day explorer → new title visible
7. Click **Verify on website** in the portal → "Visible on the website".

### M-2: Publish and unpublish

Steps:
1. Create a new event as draft.
2. The public site must NOT show it after a live refresh.
3. Click **Publish** in the portal (with confirmation).
4. Refresh the public site — event appears within 10 s.
5. Click **Unpublish**.
6. Refresh the public site — event disappears within 10 s.

### M-3: "Save draft" on a published item does not hide it

Steps:
1. Open a published event.
2. The save button must say **"Save changes"** (not "Save draft").
3. Click "Save changes" — item remains published, no downgrade to draft.
4. Verify "Live on the website" status line is still shown.

### M-4: Agenda reordering

Steps:
1. In the Agenda Builder, drag a Day 3 morning event to Day 3 afternoon.
2. Refresh `/schedule?day=3` — event appears in the afternoon session within 10 s.

### M-5: News create, edit, unpublish, delete

Steps:
1. Create a news article as draft — not visible on `/news`.
2. Publish — appears on Home and `/news` within 10 s.
3. Edit title and save — new title appears within 10 s.
4. Unpublish — disappears from public within 10 s.
5. Admin delete — article gone.

### M-6: Gallery, Sponsors, Committee, FAQs

Same publish/unpublish/edit cycle as news. Each change appears without a rebuild.

### M-7: Announcement

1. Create a published announcement with a future `expires_at`.
2. It appears on the public site within 10 s.
3. Set `expires_at` to 1 minute in the past — it disappears within 60 s (live layer re-evaluates the time window).

### M-8: Supabase paused / unreachable

1. Pause the Supabase project (or set an invalid `VITE_SUPABASE_URL` in `.env`).
2. Open the public site — it loads from the last-good snapshot.
3. No error message is visible to visitors.
4. The circuit breaker trips: on first failure, the live layer stops retrying for 10 minutes (verify with `?debug=content`).
5. The sync bar in the portal shows the error in plain language (not a stack trace).

### M-9: Anonymous requests never return drafts

```sql
-- Run in Supabase SQL Editor as anon (no JWT):
-- Expected: 0 rows
SELECT count(*) FROM public.events WHERE state = 'draft';

-- Via the RPC function:
SELECT count(*) AS draft_in_rpc
FROM jsonb_array_elements(public.get_public_content()->'events') AS e
WHERE (e->>'state') = 'draft';
-- Expected: 0
```

### M-10: Edition dates drive day tabs

1. Change the edition `end_date` to `2025-04-09` (3 days) in the DB.
2. Refresh the public site — Schedule shows only 3 day tabs.
3. Change it back to `2025-04-11` — 5 tabs return.

### M-11: Live status (no rebuild)

1. Set `VITE_FORCE_LIVE_OVERLAY=true` in `.env.local`.
2. In the portal Live Control, change an event to "Delayed" with a note.
3. The public Schedule page shows the Delayed badge + note within 60 s.
4. The `site_state.last_change_at` trigger should NOT have fired (status-only change).
5. The sync bar must NOT show "changes-waiting" (no rebuild needed).

---

## 7. Sync bar behaviour reference

| Bar state | Colour | Message | Action available |
|-----------|--------|---------|-----------------|
| `loading` | — | Hidden | — |
| `up-to-date` | — | Hidden | — |
| `changes-waiting` | Amber | "Unpublished changes are waiting." | "Update website" button |
| `updating` | Blue | "Updating… usually takes 1–2 minutes." | — |
| Error | Red | Plain-language description of the error | "Retry" button |
| Local dev | Grey | "Local mode: changes appear after you refresh the public page" | — |

**Common error messages and causes:**

| Error shown | Cause | Fix |
|------------|-------|-----|
| "Deploy hook URL not configured" | `VERCEL_DEPLOY_HOOK_URL` secret not set | Add the secret in Supabase Edge Functions |
| "Authentication error — sign out and sign back in" | Staff JWT expired | Re-sign in |
| "Your account does not have permission" | Profile `is_active=false` | Check profile in Supabase Dashboard |
| "A rebuild was requested recently. Wait 60 seconds" | Rate limit hit | Wait and retry |
| "The Vercel deploy hook returned an error" | Invalid hook URL | Regenerate hook in Vercel settings |

---

## 8. Saving the last-good snapshot

After any successful deployment:

```bash
npm run snapshot:save
git add content/snapshot.last-good.json
git commit -m "chore: update last-good snapshot"
```

This copies the freshly-fetched Supabase data to `content/snapshot.last-good.json`
so future builds and cold-start visitors get recent content even if Supabase is paused.

---

## 9. Yearly runbook

1. **Resume Supabase** if paused.
2. Create new edition in the staff portal (Editions → New edition).
3. Add events, publish content.
4. Run `npm run snapshot:save && git add content/snapshot.last-good.json && git commit`.
5. Verify with `?debug=content` that `source=supabase` and `eventCount` is correct.
6. Take a database backup (Supabase Dashboard → Database → Backups, or `supabase db dump`).
