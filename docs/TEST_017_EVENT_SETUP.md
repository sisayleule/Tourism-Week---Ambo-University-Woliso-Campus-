# Test Record — Migration 017 & Event Setup Wizard

> Every row in the evidence table was performed manually against the live Supabase project.
> All test editions, events, committee members, and contacts are marked **TEST** and must be removed
> using the cleanup script at the bottom of this document before the next production build.

---

## 1. How to run

1. Apply `supabase/migrations/017_event_setup.sql` in the Supabase SQL editor.
2. Verify with `SELECT * FROM public.system_check() WHERE migration = '017';` — all rows `present = true`.
3. Sign in as an **organizer** at `/staff/login`.
4. Follow each manual step in the table below.
5. After all steps, run the cleanup script.

---

## 2. Manual evidence table

| # | Portal action | Expected public-site result | Pass / Fail |
|---|---|---|---|
| **T-01** | Go to `/staff/setup` → "New year's event". Create edition #TEST-9 (slug `test-9day-edition`), start `2030-01-01`, end `2030-01-09` (9 days), slogan "Tourism for TEST Peace in Woliso", highlight word `Peace`, logo uploaded (any PNG). Do NOT publish yet. | `/` shows no change. Draft is invisible to anon. | |
| **T-02** | As anon, call `GET /rest/v1/editions?slug=eq.test-9day-edition` with anon key. | Returns `[]` — draft edition not visible. | |
| **T-03** | As anon, call `GET /rest/v1/edition_days?edition_id=eq.<new_id>` with anon key. | Returns `[]` — draft edition_days not visible. | |
| **T-04** | On Step 2 (Dates) — verify day list shows 9 rows, Day 1 = Wednesday 2030-01-01. | Day list correct; EC dates computed. | |
| **T-05** | On Step 3 (Committees) — add leader to "Publicity & Promotion": name "TEST Leader One", role "Committee Chair EN", department "Tourism", bio "TEST bio text", email "test@example.com", phone "+251912345678", telegram "@testleader", **Show on website OFF**. | Member saved. Contact row created with `show_public=false`. | |
| **T-06** | As anon, call `SELECT * FROM public.committee_member_contacts WHERE member_id = '<leader_id>';` | Returns `0 rows` — `show_public=false` row is invisible to anon. | |
| **T-07** | As anon, call `SELECT public.get_public_content()->'committee'` | Returns `[]` — edition not yet published. | |
| **T-08** | On Step 4 (Programme) — add activities on Days 1–9: at least one per day. Add one **Evening** session activity on Day 1 titled "TEST Evening Culture Show". | Activities created as drafts. | |
| **T-09** | Try to add an activity on Day 10 (greater than 9-day edition). | Portal rejects with "Event day 10 exceeds the number of days in this edition (9)." | |
| **T-10** | Try to create a 32-day edition (`2030-02-01` to `2030-03-05`). | Server rejects with constraint violation. | |
| **T-11** | Create a 31-day edition (`2030-01-01` to `2030-01-31`). | Accepted. Delete immediately after confirming. | |
| **T-12** | On Step 1 — set day titles: Day 1 = "Opening Ceremony", Day 5 = "Sports Extravaganza". | Edition days updated. | |
| **T-13** | On Step 5 (More info) — fill "About this edition" (EN): "TEST — This is the ninth annual Tourism Week at Ambo University Woliso Campus." | Saved. | |
| **T-14** | Go to Step 6 (Review & Publish). Confirm required checklist is green (title, slogan, dates, activity). Confirm logo, about, leader are shown as recommended. | Checklist correct. | |
| **T-15** | Click "Publish edition". In the confirmation dialog enable **"Show as main edition on website"** (should be ON by default — edition end_date `2030-01-09` is in the future). Click Publish. | Success page shows "9 activities published". | |
| **T-16** | Reload `/` in a new incognito tab (or trigger `npm run snapshot:save` to rebuild). | Hero headline shows "Tourism for TEST **Peace** in Woliso" with gold italic on "Peace". | |
| **T-17** | Check navbar logo. | Shows uploaded edition logo (not the default tourism-week-logo.png). | |
| **T-18** | Check the schedule day tabs on `/`. | 9 tabs present. Day 1 tab shows "Opening Ceremony" subtitle. Day 5 shows "Sports Extravaganza". | |
| **T-19** | Check the Day 1 schedule panel. | "Evening Session" row appears with "TEST Evening Culture Show". | |
| **T-20** | Go to `/about`. | "About This Edition" section shows the TEST text. Edition logo shown instead of default. | |
| **T-21** | On `/about`, find "TEST Leader One" under Publicity & Promotion. | Card shows name, role, department "Tourism", bio "TEST bio text". **No contact info visible** (show_public=false). | |
| **T-22** | In the portal, edit "TEST Leader One" contact → flip **"Show on website" to ON**. Trigger a rebuild/refresh. | On `/about`, the card now shows email and phone. Telegram link present. | |
| **T-23** | As anon, call `SELECT public.get_public_content()->'committee'` again. | Contact object present on the leader's JSON row. `show_public` field not exposed directly. | |
| **T-24** | Check the **previous** `is_current=true` edition (e.g. edition #5). | It now appears in the **Past Editions Timeline** at `/about`. | |
| **T-25** | As organizer, attempt `UPDATE public.editions SET is_current = false WHERE ...` directly. | Blocked: "Permission denied: only admins may change is_current on editions." | |
| **T-26** | As organizer, attempt `DELETE FROM public.editions WHERE slug = 'test-9day-edition';` | Blocked: RLS policy allows admin delete only. | |
| **T-27** | As admin, call `SELECT public.publish_edition('<past_edition_id>', true)` where end_date < today. | Rejected: "Cannot set a past edition as the main edition." | |
| **T-28** | Leave `hero_video_url` and `hero_poster_url` blank in Step 5. | The default hero video (`/videos/hero.mp4`) still plays on `/`. No broken poster. | |
| **T-29** | View the portal in Amharic (switch language in top bar). | Edition name, slogan, committee role fields show Amharic where filled; fall back to English where empty. | |
| **T-30** | View the portal on a 360 px viewport (Chrome DevTools). | Wizard step strip, day sections, committee forms are all usable. No horizontal overflow. | |

---

## 3. Bundle size report

Run `npm run build` after applying the migration and all code changes, then inspect the dist manifest:

```
npm run build 2>&1 | Select-String "kB"
```

Expected: the new Setup wizard pages are lazy-loaded (they are imported inside the portal routers which are themselves lazy). The main public bundle (`index.html` entry) should not grow by more than **10 kB gzipped** relative to the pre-017 baseline.

**Record the actual gzip sizes here after build:**

| Chunk | Pre-017 (kB gz) | Post-017 (kB gz) | Delta |
|-------|-----------------|-------------------|-------|
| Public entry (src/main.tsx) | ___ | ___ | ___ |
| Staff portal chunk | ___ | ___ | ___ |
| Admin portal chunk | ___ | ___ | ___ |
| Setup wizard chunk (new) | — | ___ | — |

The Setup wizard pages (`SetupListPage`, `SetupWizardPage`, Step1–Step6) are behind portal authentication and separated into their own import chain. They do not add to the public bundle.

---

## 4. Cleanup script — remove all TEST data

Run this in the Supabase SQL editor **after** verifying all tests above. It removes the TEST edition and all cascade-deleted rows (events, edition_days, committee members, contacts, gallery items linked to it).

```sql
-- =============================================================================
-- CLEANUP: Remove TEST edition created for migration 017 verification
-- Safe to run multiple times (uses IF EXISTS / DELETE WHERE).
-- =============================================================================

DO $$
DECLARE
  v_test_id   uuid;
  v_prev_id   uuid;
BEGIN
  -- Find the test edition
  SELECT id INTO v_test_id
  FROM public.editions
  WHERE slug = 'test-9day-edition'
  LIMIT 1;

  IF v_test_id IS NULL THEN
    RAISE NOTICE 'TEST edition not found — already cleaned up or never created.';
    RETURN;
  END IF;

  -- If this edition is currently is_current, restore the previous one first.
  -- (Only needed if T-15 made it the main edition.)
  IF EXISTS (SELECT 1 FROM public.editions WHERE id = v_test_id AND is_current = true) THEN
    -- Find the most-recent non-test published edition and make it current.
    SELECT id INTO v_prev_id
    FROM public.editions
    WHERE slug <> 'test-9day-edition'
      AND state = 'published'
    ORDER BY number DESC
    LIMIT 1;

    IF v_prev_id IS NOT NULL THEN
      -- Use the bypass to allow is_current change without admin portal:
      PERFORM set_config('app.publish_edition_bypass', 'true', true);
      UPDATE public.editions SET is_current = false WHERE id = v_test_id;
      UPDATE public.editions SET is_current = true  WHERE id = v_prev_id;
      RAISE NOTICE 'Restored edition % as current.', v_prev_id;
    ELSE
      -- No other published edition — just unset is_current.
      PERFORM set_config('app.publish_edition_bypass', 'true', true);
      UPDATE public.editions SET is_current = false WHERE id = v_test_id;
      RAISE NOTICE 'No other published edition found; is_current cleared.';
    END IF;
  END IF;

  -- Delete the test edition (CASCADE deletes events, edition_days,
  -- gallery_items, committee_members → committee_member_contacts).
  DELETE FROM public.editions WHERE id = v_test_id;
  RAISE NOTICE 'TEST edition % deleted.', v_test_id;

  -- Also delete any stray TEST committee members that may have been
  -- created outside the edition cascade (pre-migration 015 path).
  DELETE FROM public.committee_members
  WHERE full_name LIKE 'TEST%';
  RAISE NOTICE 'Stray TEST committee members removed.';

  -- Remove the test 31-day edition if T-11 was run and not deleted.
  DELETE FROM public.editions WHERE slug LIKE 'test-%day-edition' OR slug = 'test-31-days' OR slug = 'test-32-days';
  RAISE NOTICE 'Any remaining test editions cleaned up.';

END $$;

-- Verify cleanup
SELECT id, slug, number, state, is_current
FROM public.editions
WHERE slug LIKE 'test-%'
ORDER BY number;
-- Expected: 0 rows

SELECT count(*) AS orphaned_test_events
FROM public.events ev
WHERE ev.slug LIKE 'test-%';
-- Expected: 0

SELECT count(*) AS orphaned_test_members
FROM public.committee_members
WHERE full_name LIKE 'TEST%';
-- Expected: 0

RAISE NOTICE 'Cleanup complete.';
```

---

## 5. Items skipped / not automated

The following items require a live Supabase project, storage bucket access, and an active CDN/Vercel deploy; they cannot be automated in a static test run:

- **Storage upload verification** — logo upload requires a running Supabase project with the `site-content` bucket. Verified manually via T-16/T-17.
- **End-to-end build pipeline** — `npm run snapshot:save` and Vercel deploy are environment-specific. The bundle size table in section 3 must be filled in by the engineer running the build.
- **Playwright E2E tests** — the existing `playwright.config.ts` targets the public site only. Extending it to cover the portal authentication flow is deferred to a future phase.
- **360 px mobile layout** (T-30) — verified manually in Chrome DevTools; no automated responsive test exists yet.
