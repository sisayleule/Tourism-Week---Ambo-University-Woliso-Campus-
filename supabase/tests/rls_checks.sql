-- =============================================================================
-- supabase/tests/rls_checks.sql — Full permission matrix verification
--
-- Run in Supabase SQL Editor (or psql) to verify RLS behaviour for all
-- identities and all sensitive operations.
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor.
--   2. Run as a superuser (the SQL Editor default) to see ALL rows.
--   3. For anon-role checks, use the PostgREST curl examples below.
--   4. Expected result is stated in the comment above each block.
--
-- IDENTITY KEY:
--   superuser  = Supabase SQL Editor (bypasses RLS entirely)
--   anon       = no JWT (public visitor)
--   organizer  = JWT for a profile with role='organizer', is_active=true
--   admin      = JWT for a profile with role='admin',      is_active=true
--   deactivated= JWT for a profile with is_active=false
--   no-profile = JWT for an auth.users row with no profiles row
-- =============================================================================

-- ─── 0. Confirm RLS is enabled on every table ─────────────────────────────────
-- Expected: relrowsecurity = true for all rows.
SELECT relname, relrowsecurity
FROM   pg_class
WHERE  relname IN (
  'profiles','editions','events','announcements','news',
  'gallery_items','sponsors','committee_members','faqs',
  'messages','site_settings','activity_log','message_rate_limits',
  'site_state','page_sections','page_section_items',
  'edition_days','committee_member_contacts'
)
ORDER BY relname;

-- =============================================================================
-- 1. DRAFTS HIDDEN FROM ANONYMOUS
-- =============================================================================

-- 1a. anon sees 0 draft events via get_public_content()
SELECT count(*) AS draft_events_visible_to_anon
FROM   jsonb_array_elements( public.get_public_content()->'events' ) AS ev
WHERE  (ev->>'state') = 'draft';
-- Expected: 0

-- 1b. anon sees 0 draft news
SELECT count(*) AS draft_news_visible_to_anon
FROM   jsonb_array_elements( public.get_public_content()->'news' ) AS n
WHERE  (n->>'state') = 'draft';
-- Expected: 0

-- 1c. anon sees 0 draft sponsors
SELECT count(*) AS draft_sponsors_visible_to_anon
FROM   jsonb_array_elements( public.get_public_content()->'sponsors' ) AS s
WHERE  (s->>'state') = 'draft';
-- Expected: 0

-- 1d. anon sees 0 draft gallery items
SELECT count(*) AS draft_gallery_visible_to_anon
FROM   jsonb_array_elements( public.get_public_content()->'gallery' ) AS g
WHERE  (g->>'state') = 'draft';
-- Expected: 0

-- 1e. anon sees 0 draft committee members
SELECT count(*) AS draft_committee_visible_to_anon
FROM   jsonb_array_elements( public.get_public_content()->'committee' ) AS c
WHERE  (c->>'state') = 'draft';
-- Expected: 0

-- 1f. anon sees 0 draft page sections
SELECT count(*) AS draft_sections_visible_to_anon
FROM   jsonb_array_elements( public.get_public_content()->'sections' ) AS ps
WHERE  (ps->>'state') = 'draft';
-- Expected: 0

-- 1g. anon sees 0 draft items inside published sections
SELECT count(*) AS draft_items_inside_published_sections
FROM   jsonb_array_elements( public.get_public_content()->'sections' ) AS ps,
       jsonb_array_elements( ps->'items' ) AS psi
WHERE  (psi->>'state') = 'draft';
-- Expected: 0

-- =============================================================================
-- 2. COMMITTEE CONTACT PRIVACY
-- =============================================================================

-- 2a. Contacts with show_public=false must never appear via RPC
SELECT count(*) AS private_contacts_exposed_in_rpc
FROM   jsonb_array_elements( public.get_public_content()->'committee' ) AS m
WHERE  (m->>'show_public') IS DISTINCT FROM 'true'
  AND  (m->'contact') IS NOT NULL
  AND  (m->'contact') != 'null'::jsonb;
-- Expected: 0

-- 2b. Confirm the committee_member_contacts table is not in the RPC payload
SELECT
  NOT (public.get_public_content() ? 'committee_member_contacts') AS contacts_table_absent;
-- Expected: true

-- =============================================================================
-- 3. PRIVATE TABLES NOT EXPOSED VIA RPC
-- =============================================================================

SELECT
  NOT (result ? 'messages')              AS no_messages,
  NOT (result ? 'profiles')             AS no_profiles,
  NOT (result ? 'activity_log')         AS no_activity_log,
  NOT (result ? 'site_state')           AS no_site_state,
  NOT (result ? 'message_rate_limits')  AS no_rate_limits
FROM public.get_public_content() AS result;
-- Expected: all columns = true

-- =============================================================================
-- 4. ANNOUNCEMENT TIME WINDOW
-- =============================================================================

-- 4a. No expired announcements in RPC payload
SELECT count(*) AS expired_announcements_in_rpc
FROM   jsonb_array_elements( public.get_public_content()->'announcements' ) AS a
WHERE  (a->>'expires_at') IS NOT NULL
  AND  (a->>'expires_at')::timestamptz < now();
-- Expected: 0

-- 4b. No future-scheduled announcements in RPC payload
SELECT count(*) AS future_announcements_in_rpc
FROM   jsonb_array_elements( public.get_public_content()->'announcements' ) AS a
WHERE  (a->>'starts_at')::timestamptz > now();
-- Expected: 0

-- =============================================================================
-- 5. EDITION CONSTRAINTS
-- =============================================================================

-- 5a. Only one edition is current
SELECT count(*) AS current_editions FROM public.editions WHERE is_current = true;
-- Expected: 0 or 1

-- 5b. 32-day edition rejected by CHECK constraint
DO $$
BEGIN
  BEGIN
    INSERT INTO public.editions (
      number, slug, edition_name_i18n, title_i18n, theme_i18n,
      venue_i18n, start_date, end_date, state
    ) VALUES (
      9998, 'test-32-days',
      '{"en":"TEST32"}', '{"en":"TEST32"}', '{"en":"TEST32 theme"}',
      '{"en":"Woliso"}', '2030-01-01', '2030-02-01', 'draft'
    );
    RAISE NOTICE 'BUG: 32-day edition accepted — constraint missing!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: 32-day edition correctly rejected.';
  END;
END $$;

-- 5c. 31-day edition accepted
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.editions (
    number, slug, edition_name_i18n, title_i18n, theme_i18n,
    venue_i18n, start_date, end_date, state
  ) VALUES (
    9997, 'test-31-days',
    '{"en":"TEST31"}', '{"en":"TEST31"}', '{"en":"TEST31 theme"}',
    '{"en":"Woliso"}', '2030-01-01', '2030-01-31', 'draft'
  ) RETURNING id INTO v_id;
  RAISE NOTICE 'OK: 31-day edition inserted (id: %)', v_id;
  DELETE FROM public.editions WHERE id = v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: 31-day edition rejected: %', SQLERRM;
END $$;

-- 5d. Event on day beyond edition length is rejected
DO $$
DECLARE v_edition_id uuid;
BEGIN
  INSERT INTO public.editions (
    number, slug, edition_name_i18n, title_i18n, theme_i18n,
    venue_i18n, start_date, end_date, state
  ) VALUES (
    9996, 'test-day-trigger', '{"en":"TDT"}', '{"en":"TDT"}', '{"en":"TDT"}',
    '{"en":"W"}', '2030-02-01', '2030-02-03', 'draft'
  ) RETURNING id INTO v_edition_id;

  BEGIN
    INSERT INTO public.events (
      edition_id, slug, day, session, title_i18n, category, venue_type, state
    ) VALUES (
      v_edition_id, 'test-day4', 4, 'morning',
      '{"en":"Test"}', 'culture', 'campus', 'draft'
    );
    RAISE NOTICE 'BUG: event on day 4 of 3-day edition accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: event on day 4 of 3-day edition correctly rejected.';
  END;
  DELETE FROM public.editions WHERE id = v_edition_id;
END $$;

-- =============================================================================
-- 6. PROFILE PROTECTION
-- =============================================================================

-- 6a. handle_new_user always sets role='organizer' (never from metadata)
SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';
-- Review: prosrc must NOT contain raw_user_meta_data->>''role''

-- 6b. guard_profile_role_change exists and fires BEFORE UPDATE
SELECT tgname, tgenabled
FROM   pg_trigger
WHERE  tgname = 'trg_guard_profile_role'
  AND  tgrelid = 'public.profiles'::regclass;
-- Expected: 1 row, tgenabled = 'O' (origin fires)

-- 6c. Organizer cannot change role or is_active (trigger fires)
DO $$
BEGIN
  BEGIN
    -- Simulate non-admin update (auth.uid() IS NULL = service role, so we
    -- test the logic directly in the function body by calling it):
    RAISE NOTICE 'Manual test: sign in as organizer and attempt: UPDATE public.profiles SET role=''admin'' WHERE id=auth.uid();';
    RAISE NOTICE 'Expected: insufficient_privilege exception from guard_profile_role_change.';
  END;
END $$;

-- =============================================================================
-- 7. STORAGE POLICIES
-- =============================================================================

-- 7a. Confirm all expected buckets exist
SELECT id, public AS is_public, file_size_limit, allowed_mime_types
FROM   storage.buckets
WHERE  id IN ('gallery','news-covers','sponsor-logos','committee','event-images','site-content','edition-logos')
ORDER BY id;
-- Expected: 7 rows, all public=true, file_size_limit=5242880 (or 2097152 for site-content)

-- 7b. Anon has no INSERT policy on any bucket
SELECT name, bucket_id, operation
FROM   storage.policies
WHERE  operation = 'INSERT'
  AND  (definition NOT LIKE '%is_staff%' AND definition NOT LIKE '%auth.uid%')
ORDER BY bucket_id;
-- Expected: 0 rows (all INSERT policies require is_staff())

-- 7c. Anonymous upload is refused (PostgREST / API check)
-- curl -X POST "SUPABASE_URL/storage/v1/object/gallery/test.jpg" \
--      -H "apikey: ANON_KEY" -H "Content-Type: image/jpeg" --data-binary @test.jpg
-- Expected: 400 or 403

-- =============================================================================
-- 8. MESSAGES — anon INSERT only, no SELECT/UPDATE/DELETE
-- =============================================================================

-- 8a. anon can INSERT (no JWT)
-- curl -X POST "SUPABASE_URL/rest/v1/messages" \
--   -H "apikey: ANON_KEY" -H "Content-Type: application/json" \
--   -d '{"kind":"contact","name":"Test","email":"t@t.com","message":"hi"}'
-- Expected: 201

-- 8b. anon cannot SELECT
-- curl "SUPABASE_URL/rest/v1/messages" -H "apikey: ANON_KEY"
-- Expected: 200 with [] (RLS returns empty)

-- 8c. Confirm no anonymous SELECT policy on messages
SELECT policyname FROM pg_policies
WHERE schemaname='public' AND tablename='messages'
  AND cmd='SELECT' AND roles && ARRAY['anon'];
-- Expected: 0 rows

-- =============================================================================
-- 9. ACTIVITY_LOG — staff read only, no write by anyone
-- =============================================================================

SELECT policyname, cmd, roles
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename  = 'activity_log'
ORDER BY cmd;
-- Expected: 1 row — SELECT for authenticated (is_staff() check)
-- No INSERT, UPDATE, or DELETE policies (written only by SECURITY DEFINER trigger)

-- =============================================================================
-- 10. SITE_STATE — staff read only
-- =============================================================================

SELECT policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='site_state';
-- Expected: at least 1 SELECT policy gated on is_staff()
-- curl "SUPABASE_URL/rest/v1/site_state" -H "apikey: ANON_KEY"
-- Expected: [] (empty — RLS blocks anon)

-- =============================================================================
-- 11. SECURITY DEFINER FUNCTIONS — search_path and permissions
-- =============================================================================

SELECT
  p.proname,
  p.prosecdef        AS is_security_definer,
  p.proconfig        AS config,  -- should include search_path=''
  array_agg(a.rolname ORDER BY a.rolname) AS grantees
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN information_schema.role_routine_grants g
  ON g.routine_name   = p.proname
 AND g.routine_schema = n.nspname
LEFT JOIN pg_roles a ON a.rolname = g.grantee
WHERE n.nspname = 'public'
  AND p.prosecdef = true
GROUP BY p.proname, p.prosecdef, p.proconfig
ORDER BY p.proname;
-- Review each row:
--   is_security_definer = true  ✓
--   config includes 'search_path='  ✓
--   grantees must NOT include 'anon' for is_staff(), is_admin(),
--     set_current_edition(), restore_log_entry(), purge_activity_log()

-- Spot-check: anon must not have EXECUTE on is_staff or is_admin
SELECT has_function_privilege('anon',  'public.is_staff()',  'execute') AS anon_can_call_is_staff;
SELECT has_function_privilege('anon',  'public.is_admin()',  'execute') AS anon_can_call_is_admin;
-- Expected: both false

SELECT has_function_privilege('authenticated', 'public.is_staff()', 'execute') AS auth_can_call_is_staff;
SELECT has_function_privilege('authenticated', 'public.is_admin()', 'execute') AS auth_can_call_is_admin;
-- Expected: both true

SELECT has_function_privilege('anon', 'public.get_public_content()', 'execute') AS anon_can_call_get_public;
-- Expected: true (this is the public RPC)

-- =============================================================================
-- 12. EDITION: staff INSERT/UPDATE, admin-only DELETE, no anon writes
-- =============================================================================

SELECT policyname, cmd, roles
FROM   pg_policies
WHERE  schemaname='public' AND tablename='editions'
ORDER BY cmd, policyname;
-- Expected:
--   public read   SELECT  (no role restriction)
--   staff insert  INSERT  authenticated
--   staff update  UPDATE  authenticated
--   admin delete  DELETE  authenticated (is_admin() check)

-- =============================================================================
-- 13. get_public_content() structure check
-- =============================================================================

SELECT
  jsonb_typeof(result)                    AS type,
  (result ? 'generated_at')              AS has_generated_at,
  (result ? 'edition')                   AS has_edition,
  (result ? 'events')                    AS has_events,
  (result ? 'news')                      AS has_news,
  (result ? 'gallery')                   AS has_gallery,
  (result ? 'sponsors')                  AS has_sponsors,
  (result ? 'committee')                 AS has_committee,
  (result ? 'faqs')                      AS has_faqs,
  (result ? 'site_settings')             AS has_site_settings,
  (result ? 'announcements')             AS has_announcements,
  (result ? 'sections')                  AS has_sections,
  (result ? 'past_editions')             AS has_past_editions,
  (result ? 'edition_days')              AS has_edition_days
FROM public.get_public_content() AS result;
-- Expected: type='object', all has_* = true

-- =============================================================================
-- END OF rls_checks.sql
-- =============================================================================
