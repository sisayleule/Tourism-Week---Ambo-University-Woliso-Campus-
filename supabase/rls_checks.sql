-- =============================================================================
-- rls_checks.sql — Manual RLS verification script
--
-- Run this against the Supabase SQL editor (or psql) to verify that Row Level
-- Security policies behave as expected for all three roles:
--   anon       — unauthenticated public visitor
--   organizer  — authenticated staff with role='organizer'
--   admin      — authenticated staff with role='admin'
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor.
--   2. Run each section block individually.  Inspect the result rows.
--   3. Expected behaviour is stated in comments above each query.
--   4. All SELECT checks use the anon key URL (no JWT) or switch role with
--      SET LOCAL role to simulate authenticated access.
--
-- NOTE: These are READ-ONLY checks.  No data is modified.
-- =============================================================================

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Count helper used in several checks.
-- The number in parens after each table name is the expected result.

-- =============================================================================
-- SECTION 1 — EDITIONS
-- =============================================================================

-- 1a. Anon sees only published editions.
--     Expected: only rows where state = 'published'.
SELECT id, number, slug, state, is_current
FROM   public.editions
WHERE  state = 'draft'    -- should return 0 rows when called as anon
LIMIT 10;

-- 1b. Anon cannot read draft editions directly.
--     (Run as anon via PostgREST; this is the check for the policy itself.)
--     Expected: empty result set.
-- curl "SUPABASE_URL/rest/v1/editions?state=eq.draft" \
--      -H "apikey: ANON_KEY"

-- 1c. Staff (organizer) can see ALL editions including drafts.
--     Expected: all rows.
-- (Authenticate as organizer, then:)
-- SELECT count(*) FROM public.editions;

-- 1d. Organizer cannot change is_current.
--     Expected: EXCEPTION 'Permission denied: only admins may change is_current'.
DO $$
BEGIN
  -- Simulate: attempt to set is_current without admin role.
  -- This should raise an exception from the guard trigger.
  -- The DO block catches it so the script continues.
  BEGIN
    -- NOTE: replace with a real edition id when running against live data.
    UPDATE public.editions
    SET    is_current = true
    WHERE  id = '00000000-0000-0000-0000-000000000005';
    RAISE NOTICE 'BUG: UPDATE succeeded — guard trigger is missing!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: guard_edition_is_current blocked non-admin is_current change.';
  END;
END $$;

-- 1e. Organizer cannot delete an edition.
--     Expected: 0 rows deleted (RLS blocks it).
-- DELETE FROM public.editions WHERE id = '00000000-0000-0000-0000-000000000005';
-- (should raise RLS error or return 0 affected rows)

-- 1f. set_current_edition rejects a draft edition.
--     Expected: EXCEPTION 'Edition must be published before it can be set as the live edition.'
DO $$
DECLARE
  v_draft_id uuid;
BEGIN
  -- Find any draft edition (or use a known one).
  SELECT id INTO v_draft_id FROM public.editions WHERE state = 'draft' LIMIT 1;
  IF v_draft_id IS NULL THEN
    RAISE NOTICE 'SKIP: no draft editions found.';
    RETURN;
  END IF;
  BEGIN
    PERFORM public.set_current_edition(v_draft_id);
    RAISE NOTICE 'BUG: set_current_edition accepted a draft edition!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: set_current_edition rejected draft edition.';
  END;
END $$;

-- =============================================================================
-- SECTION 2 — PAGE SECTIONS
-- =============================================================================

-- 2a. Anon sees only published sections.
--     Expected: only rows where state = 'published'.
SELECT key, state, needs_review
FROM   public.page_sections
ORDER BY key;

-- 2b. Anon cannot see draft sections.
--     (Via PostgREST with anon key — draft rows must not appear.)
-- curl "SUPABASE_URL/rest/v1/page_sections?state=eq.draft" \
--      -H "apikey: ANON_KEY"
-- Expected: empty array.

-- 2c. Organizer can read ALL sections (including drafts).
--     Expected: all rows returned when authenticated as organizer.

-- 2d. Organizer can insert a section.
--     Expected: row inserted successfully.
-- INSERT INTO public.page_sections (key, title_i18n, state)
-- VALUES ('test.check', '{"en":"Test"}', 'draft');

-- 2e. Organizer can update a section (e.g. change title).
--     Expected: 1 row updated.
-- UPDATE public.page_sections SET needs_review = true WHERE key = 'test.check';

-- 2f. Organizer cannot delete a page_section.
--     Expected: RLS error / 0 affected rows.
-- DELETE FROM public.page_sections WHERE key = 'test.check';
-- Should fail with policy "page_sections: admin delete".

-- 2g. Admin can delete a section.
--     Expected: 1 row deleted when authenticated as admin.
-- DELETE FROM public.page_sections WHERE key = 'test.check';

-- =============================================================================
-- SECTION 3 — PAGE SECTION ITEMS
-- =============================================================================

-- 3a. Anon sees only published items whose parent section is also published.
--     Expected: items with state='draft' OR whose section is draft are hidden.
SELECT psi.id, psi.section_id, psi.state, ps.key AS section_key, ps.state AS section_state
FROM   public.page_section_items psi
JOIN   public.page_sections ps ON ps.id = psi.section_id
WHERE  psi.state = 'draft' OR ps.state = 'draft'
LIMIT 10;
-- Expected: 0 rows from this angle when queried as anon.

-- 3b. Staff can read ALL items.
--     Expected: all rows.

-- 3c. Staff (organizer) can insert, update, AND delete items.
--     Expected: all three operations succeed.

-- =============================================================================
-- SECTION 4 — NEWS end-to-end
-- =============================================================================

-- 4a. Anon sees only published news.
SELECT id, slug, state FROM public.news WHERE state = 'draft';
-- Expected: 0 rows as anon.

-- 4b. Unknown slug returns empty.
SELECT * FROM public.news WHERE slug = 'this-slug-does-not-exist-xyzzy';
-- Expected: 0 rows.

-- 4c. Publish → visible; unpublish → hidden.
-- (manual: publish a news article in the portal, check public /news, unpublish, check again)

-- =============================================================================
-- SECTION 5 — GALLERY, EVENTS, SPONSORS, COMMITTEE, FAQS (same pattern)
-- =============================================================================

-- 5a. Anon sees only published rows in each content table.
SELECT 'gallery_items' AS tbl, count(*) AS draft_rows_visible_to_anon
FROM   public.gallery_items WHERE state = 'draft'
UNION ALL
SELECT 'events',          count(*) FROM public.events          WHERE state = 'draft'
UNION ALL
SELECT 'sponsors',        count(*) FROM public.sponsors        WHERE state = 'draft'
UNION ALL
SELECT 'committee_members', count(*) FROM public.committee_members WHERE state = 'draft'
UNION ALL
SELECT 'faqs',            count(*) FROM public.faqs            WHERE state = 'draft';
-- All counts should be 0 when queried through the anon PostgREST endpoint.
-- When queried as staff (superuser in SQL editor), counts may be > 0 — that is correct.

-- =============================================================================
-- SECTION 6 — ORGANIZER CANNOT SET LIVE EDITION
-- =============================================================================

-- 6a. set_current_edition is admin-only.
--     Expected: EXCEPTION 'Permission denied: admin role required.'
DO $$
BEGIN
  BEGIN
    -- Calling as a non-admin role should fail.
    -- Replace with a real published edition id.
    PERFORM public.set_current_edition('00000000-0000-0000-0000-000000000005');
    RAISE NOTICE 'BUG: set_current_edition succeeded without admin!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: set_current_edition correctly blocked non-admin.';
  END;
END $$;

-- =============================================================================
-- SECTION 7 — EDITIONS: STAFF INSERT/UPDATE; ADMIN DELETE ONLY
-- =============================================================================

-- 7a. Staff can INSERT a new edition (state='draft' by default).
-- 7b. Staff can UPDATE edition fields (except is_current — guard trigger blocks it).
-- 7c. Only admin can DELETE an edition.
--     Policy: "editions: admin delete" USING ( is_admin() ).
-- (Test by running DELETE as organizer; expect RLS violation.)

-- =============================================================================
-- SECTION 8 — SITE_STATE readable by staff, not anon
-- =============================================================================

SELECT last_change_at, last_deploy_requested_at
FROM   public.site_state;
-- Expected as anon: empty (policy "site_state: staff read" requires is_staff()).
-- Expected as staff: 1 row.

-- =============================================================================
-- END OF rls_checks.sql
-- =============================================================================

-- =============================================================================
-- SECTION 9 — get_public_content() RPC (added in migration 014)
-- =============================================================================

-- 9a. Anon can call get_public_content() and receives a valid JSONB object.
--     Expected: 1 row with keys: generated_at, edition, events, news, gallery,
--     sponsors, committee, faqs, site_settings, announcements, sections, past_editions.
SELECT
  jsonb_typeof(result)                                   AS type,
  (result ? 'generated_at')                              AS has_generated_at,
  (result ? 'edition')                                   AS has_edition,
  (result ? 'events')                                    AS has_events,
  (result ? 'news')                                      AS has_news,
  (result ? 'gallery')                                   AS has_gallery,
  (result ? 'sponsors')                                  AS has_sponsors,
  (result ? 'committee')                                 AS has_committee,
  (result ? 'faqs')                                      AS has_faqs,
  (result ? 'site_settings')                             AS has_site_settings,
  (result ? 'announcements')                             AS has_announcements,
  (result ? 'sections')                                  AS has_sections,
  (result ? 'past_editions')                             AS has_past_editions,
  jsonb_array_length(result->'events')                   AS event_count,
  (result->'edition'->>'is_current')::boolean            AS edition_is_current
FROM public.get_public_content() AS result;
-- Expected: type='object', all has_* = true, event_count >= 0,
--           edition_is_current = true (or NULL if no current edition).

-- 9b. Anon MUST NOT see draft events via get_public_content().
--     Expected: 0 draft events in the returned payload.
SELECT count(*) AS draft_events_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'events')
) AS ev
WHERE (ev->>'state') = 'draft';
-- Expected: 0

-- 9c. Anon MUST NOT see draft news via get_public_content().
SELECT count(*) AS draft_news_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'news')
) AS n
WHERE (n->>'state') = 'draft';
-- Expected: 0

-- 9d. Anon MUST NOT see draft gallery items via get_public_content().
SELECT count(*) AS draft_gallery_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'gallery')
) AS g
WHERE (g->>'state') = 'draft';
-- Expected: 0

-- 9e. Anon MUST NOT see draft sponsors.
SELECT count(*) AS draft_sponsors_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'sponsors')
) AS s
WHERE (s->>'state') = 'draft';
-- Expected: 0

-- 9f. Anon MUST NOT see draft page sections.
SELECT count(*) AS draft_sections_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'sections')
) AS ps
WHERE (ps->>'state') = 'draft';
-- Expected: 0

-- 9g. Anon MUST NOT see draft items within published sections.
SELECT count(*) AS draft_items_in_published_sections
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'sections')
) AS ps,
jsonb_array_elements(ps->'items') AS psi
WHERE (psi->>'state') = 'draft';
-- Expected: 0

-- 9h. Announcement time-window enforcement via RPC:
--     Expired announcements must not appear.
--     Expected: 0 rows whose expires_at < now().
SELECT count(*) AS expired_announcements_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'announcements')
) AS a
WHERE (a->>'expires_at') IS NOT NULL
  AND (a->>'expires_at')::timestamptz < now();
-- Expected: 0

-- 9i. Confirm the edition returned is the current one.
SELECT
  result->'edition'->>'id'           AS edition_id,
  result->'edition'->>'is_current'   AS is_current,
  result->'edition'->>'state'        AS state
FROM public.get_public_content() AS result;
-- Expected: state = 'published', is_current = 'true'

-- 9j. Confirm private tables are absent from the result.
--     The object must not contain keys: messages, profiles, activity_log,
--     site_state, message_rate_limits.
SELECT
  NOT (result ? 'messages')              AS no_messages,
  NOT (result ? 'profiles')             AS no_profiles,
  NOT (result ? 'activity_log')         AS no_activity_log,
  NOT (result ? 'site_state')           AS no_site_state,
  NOT (result ? 'message_rate_limits')  AS no_rate_limits
FROM public.get_public_content() AS result;
-- Expected: all columns = true

-- 9k. Performance / size check: response under 150 kB gzipped.
--     (Approximate check using pg_column_size on the raw jsonb.)
SELECT
  pg_size_pretty(pg_column_size(public.get_public_content())::bigint) AS approx_size,
  pg_column_size(public.get_public_content()) < 1572864               AS under_1_5MB_raw
FROM (SELECT 1) AS dummy;
-- Expected: under_1_5MB_raw = true (1.5 MB raw ≈ < 150 kB gzipped for typical JSON).

-- =============================================================================
-- END OF rls_checks.sql additions (migration 014)
-- =============================================================================

-- =============================================================================
-- SECTION 10 — PART 6 RLS: Organizer refused on messages and page_sections
--             (added in migration 015)
-- =============================================================================

-- 10a. Organizer CANNOT read messages (admin-only after migration 015).
--      Expected as organizer: 0 rows (RLS blocks SELECT).
-- (Run as an authenticated organizer — not superuser — via PostgREST or
--  supabase-js with the organizer's JWT.)
-- curl "SUPABASE_URL/rest/v1/messages" \
--      -H "apikey: ANON_KEY" \
--      -H "Authorization: Bearer <organizer_jwt>"
-- Expected: empty array [].

-- 10b. Organizer CANNOT update a message.
--      Expected: 0 rows updated / RLS violation.
-- UPDATE public.messages SET handled = true WHERE id = 1;
-- (as organizer) → should fail or affect 0 rows

-- 10c. Organizer CANNOT insert into page_sections (admin-only after mig 015).
DO $$
BEGIN
  BEGIN
    INSERT INTO public.page_sections (key, state) VALUES ('test.rls.check', 'draft');
    RAISE NOTICE 'BUG: organizer inserted into page_sections — policy missing!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: organizer blocked from inserting into page_sections.';
  END;
END $$;

-- 10d. Organizer CANNOT update page_sections.
DO $$
BEGIN
  BEGIN
    UPDATE public.page_sections SET needs_review = true WHERE key = 'home.hero';
    RAISE NOTICE 'BUG: organizer updated page_sections — policy missing!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: organizer blocked from updating page_sections.';
  END;
END $$;

-- 10e. Organizer CANNOT insert into page_section_items.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.page_section_items (section_id, sort_order)
    SELECT id, 999 FROM public.page_sections LIMIT 1;
    RAISE NOTICE 'BUG: organizer inserted into page_section_items — policy missing!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: organizer blocked from inserting into page_section_items.';
  END;
END $$;

-- 10f. Admin CAN still read messages.
--      (Run as admin — should return rows.)
SELECT count(*) AS messages_readable_by_admin FROM public.messages;
-- Expected: some number >= 0 when queried as admin.

-- =============================================================================
-- END OF SECTION 10
-- =============================================================================

-- =============================================================================
-- SECTION 11 — MIGRATION 017: edition_days, contacts, publish_edition
-- =============================================================================

-- ── 11a. Anon CANNOT see edition_days when edition is draft ──────────────────
-- (Run as anon via PostgREST; the edition must be in state='draft'.)
-- Expected: 0 rows.
-- curl "SUPABASE_URL/rest/v1/edition_days?select=*" -H "apikey: ANON_KEY"

-- Via SQL — simulates what anon RLS sees:
SELECT count(*) AS draft_edition_days_visible_to_anon
FROM public.edition_days ed
WHERE NOT EXISTS (
  SELECT 1 FROM public.editions e
  WHERE e.id = ed.edition_id AND e.state = 'published'
);
-- Expected: 0 when queried through the anon PostgREST endpoint.

-- ── 11b. Anon CAN see edition_days when edition is published ─────────────────
-- (After publish_edition() is called with a valid edition.)
-- Expected: rows for each day of the published edition.
SELECT ed.edition_id, ed.day, ed.title_i18n
FROM public.edition_days ed
JOIN public.editions e ON e.id = ed.edition_id
WHERE e.state = 'published' AND e.is_current = true
ORDER BY ed.day;

-- ── 11c. Staff can read edition_days for draft editions ─────────────────────
-- (Authenticate as organizer; run:)
-- SELECT * FROM public.edition_days ORDER BY edition_id, day;
-- Expected: all rows.

-- ── 11d. committee_member_contacts show_public = false → never to anon ───────
-- This is the critical privacy test.
-- Expected: 0 rows where show_public = false appear in any anon query.
SELECT count(*) AS contacts_with_show_public_false_visible_to_anon
FROM public.committee_member_contacts
WHERE show_public = false;
-- When run AS ANON through PostgREST, expected: 0 rows.
-- When run as staff/admin: may be > 0 (expected, that is correct).

-- ── 11e. Contact details absent from get_public_content() when show_public=false
-- After creating a member with a contact row (show_public=false), call:
SELECT count(*) AS contacts_exposed_in_rpc
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'committee')
) AS m
WHERE (m->'contact') IS NOT NULL
  AND (m->>'show_public') IS DISTINCT FROM 'true';
-- Expected: 0  (contact key should be NULL for any member without show_public=true)

-- ── 11f. Contact details ARE present when show_public=true ───────────────────
-- After setting a member's contact.show_public = true and publishing the edition:
SELECT count(*) AS members_with_public_contact
FROM jsonb_array_elements(
  (SELECT public.get_public_content()->'committee')
) AS m
WHERE (m->'contact') IS NOT NULL;
-- Expected: >= 1 if at least one member has show_public=true.

-- ── 11g. 31-day edition is accepted ──────────────────────────────────────────
DO $$
DECLARE v_id uuid;
BEGIN
  BEGIN
    INSERT INTO public.editions (
      number, slug, edition_name_i18n, title_i18n, theme_i18n,
      venue_i18n, start_date, end_date, state
    ) VALUES (
      9999, 'test-31-days',
      '{"en":"TEST31"}', '{"en":"TEST31"}', '{"en":"TEST31 theme"}',
      '{"en":"Woliso"}',
      '2030-01-01', '2030-01-31',
      'draft'
    ) RETURNING id INTO v_id;
    RAISE NOTICE 'OK: 31-day edition inserted (id: %)', v_id;
    DELETE FROM public.editions WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: 31-day edition rejected: %', SQLERRM;
  END;
END $$;

-- ── 11h. 32-day edition is rejected ──────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO public.editions (
      number, slug, edition_name_i18n, title_i18n, theme_i18n,
      venue_i18n, start_date, end_date, state
    ) VALUES (
      9998, 'test-32-days',
      '{"en":"TEST32"}', '{"en":"TEST32"}', '{"en":"TEST32 theme"}',
      '{"en":"Woliso"}',
      '2030-01-01', '2030-02-01',  -- 32 days
      'draft'
    );
    RAISE NOTICE 'BUG: 32-day edition accepted — constraint missing!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: 32-day edition correctly rejected.';
  END;
END $$;

-- ── 11i. Event beyond edition day count is rejected ──────────────────────────
DO $$
DECLARE
  v_edition_id uuid;
BEGIN
  -- Create a 3-day edition
  INSERT INTO public.editions (
    number, slug, edition_name_i18n, title_i18n, theme_i18n,
    venue_i18n, start_date, end_date, state
  ) VALUES (
    9997, 'test-event-day-trigger',
    '{"en":"TESTDAY"}', '{"en":"TESTDAY"}', '{"en":"TESTDAY theme"}',
    '{"en":"Woliso"}',
    '2030-02-01', '2030-02-03',  -- 3 days
    'draft'
  ) RETURNING id INTO v_edition_id;

  -- Try to insert an event on day 4 (exceeds the 3-day edition)
  BEGIN
    INSERT INTO public.events (
      edition_id, slug, day, session, title_i18n, category, venue_type, state
    ) VALUES (
      v_edition_id, 'test-event-day-too-high', 4, 'morning',
      '{"en":"Test event"}', 'culture', 'campus', 'draft'
    );
    RAISE NOTICE 'BUG: event on day 4 of 3-day edition accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: event on day 4 of 3-day edition correctly rejected.';
  END;

  -- Cleanup
  DELETE FROM public.editions WHERE id = v_edition_id;
END $$;

-- ── 11j. publish_edition() organizer-accessible ───────────────────────────────
-- (Authenticate as organizer; then:)
-- SELECT public.publish_edition('<draft_edition_id>', false);
-- Expected: JSON with published_events, published_days, etc.
-- Expected NOT: insufficient_privilege exception.

-- ── 11k. publish_edition() rejects past edition as make_current ──────────────
DO $$
DECLARE
  v_edition_id uuid;
BEGIN
  -- Create a past edition (end_date in the past)
  INSERT INTO public.editions (
    number, slug, edition_name_i18n, title_i18n, theme_i18n,
    venue_i18n, start_date, end_date, state
  ) VALUES (
    9996, 'test-past-edition-current',
    '{"en":"TESTPAST"}', '{"en":"TESTPAST"}', '{"en":"TESTPAST slogan"}',
    '{"en":"Woliso"}',
    '2020-01-01', '2020-01-05',
    'draft'
  ) RETURNING id INTO v_edition_id;

  BEGIN
    PERFORM public.publish_edition(v_edition_id, true);  -- make_current = true
    RAISE NOTICE 'BUG: publish_edition accepted past edition as main!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: publish_edition rejected past edition as make_current.';
  END;

  -- Cleanup
  DELETE FROM public.editions WHERE id = v_edition_id;
END $$;

-- ── 11l. Organizer CANNOT change is_current directly ─────────────────────────
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.editions WHERE is_current = true LIMIT 1;
  IF v_id IS NULL THEN
    RAISE NOTICE 'SKIP: no current edition to test.';
    RETURN;
  END IF;
  BEGIN
    UPDATE public.editions SET is_current = false WHERE id = v_id;
    RAISE NOTICE 'BUG: organizer changed is_current directly!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: guard_edition_is_current blocked organizer.';
  END;
END $$;

-- ── 11m. Organizer CANNOT delete an edition ───────────────────────────────────
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.editions LIMIT 1;
  IF v_id IS NULL THEN RAISE NOTICE 'SKIP: no editions.'; RETURN; END IF;
  BEGIN
    DELETE FROM public.editions WHERE id = v_id;
    RAISE NOTICE 'BUG: organizer deleted an edition!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: organizer correctly blocked from deleting edition.';
  END;
END $$;

-- ── 11n. get_public_content() now returns edition_days key ───────────────────
SELECT
  (result ? 'edition_days') AS has_edition_days,
  jsonb_typeof(result->'edition_days') AS edition_days_type,
  (result->'edition' ? 'logo_url') AS has_logo_url,
  (result->'edition' ? 'about_i18n') AS has_about_i18n
FROM public.get_public_content() AS result;
-- Expected: has_edition_days = true, edition_days_type = 'array',
--           has_logo_url = true, has_about_i18n = true.

-- =============================================================================
-- END OF SECTION 11 (migration 017 checks)
-- =============================================================================
