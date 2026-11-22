-- =============================================================================
-- Migration 021 — Content version: any_change_at + content_version() RPC
--
-- Depends on: 011_pipeline.sql (site_state, touch_site_state),
--             013_site_content.sql (page_sections, page_section_items),
--             017_event_setup.sql (edition_days, committee_member_contacts)
--
-- Changes:
--   1. Add site_state.any_change_at — updated on EVERY public-facing change
--      (including event status/note, announcements, committee_contacts).
--      last_change_at keeps its current meaning (triggers a Vercel rebuild).
--   2. Replace touch_site_state() to also update any_change_at on all calls,
--      AND add a new touch_any_change() function for live-only tables.
--   3. Wire touch_any_change() to tables not covered by touch_site_state():
--         announcements, page_sections, page_section_items,
--         edition_days, committee_member_contacts.
--      Re-wire events UPDATE so it updates any_change_at even for status-only
--      changes (but still skips last_change_at for those).
--   4. Create content_version() — SECURITY INVOKER, executable by anon —
--      returning { v: text } where v = any_change_at::text.
-- =============================================================================

-- ─── 1. Add any_change_at column ─────────────────────────────────────────────

ALTER TABLE public.site_state
  ADD COLUMN IF NOT EXISTS any_change_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.site_state.any_change_at IS
  'Updated on every change that affects what anonymous visitors see, including '
  'event status/note updates, announcements, gallery, page_sections, '
  'committee_member_contacts.show_public, and edition_days. '
  'The public site polls content_version() which reads this column; '
  'it re-fetches get_public_content() only when this value changes.';

-- Back-fill to match last_change_at so existing deployments don't trigger a
-- spurious full-fetch on the first poll after this migration is applied.
UPDATE public.site_state
   SET any_change_at = last_change_at
 WHERE id = true;

-- ─── 2. Replace touch_site_state() ───────────────────────────────────────────
--
-- The updated function:
--   · Still skips last_change_at for event status-only updates (no rebuild).
--   · NOW also updates any_change_at on every call.

CREATE OR REPLACE FUNCTION public.touch_site_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rebuild boolean := true;
BEGIN
  -- For events UPDATE: skip rebuild (last_change_at) if ONLY live-serving
  -- columns changed, but still update any_change_at.
  IF TG_TABLE_NAME = 'events' AND TG_OP = 'UPDATE' THEN
    IF NEW.title_i18n          IS NOT DISTINCT FROM OLD.title_i18n
       AND NEW.description_i18n IS NOT DISTINCT FROM OLD.description_i18n
       AND NEW.venue_name_i18n  IS NOT DISTINCT FROM OLD.venue_name_i18n
       AND NEW.category         IS NOT DISTINCT FROM OLD.category
       AND NEW.venue_type       IS NOT DISTINCT FROM OLD.venue_type
       AND NEW.day              IS NOT DISTINCT FROM OLD.day
       AND NEW.session          IS NOT DISTINCT FROM OLD.session
       AND NEW.start_time       IS NOT DISTINCT FROM OLD.start_time
       AND NEW.end_time         IS NOT DISTINCT FROM OLD.end_time
       AND NEW.sort_order       IS NOT DISTINCT FROM OLD.sort_order
       AND NEW.image_url        IS NOT DISTINCT FROM OLD.image_url
       AND NEW.featured         IS NOT DISTINCT FROM OLD.featured
       AND NEW.state            IS NOT DISTINCT FROM OLD.state
       AND NEW.edition_id       IS NOT DISTINCT FROM OLD.edition_id
       AND NEW.slug             IS NOT DISTINCT FROM OLD.slug
    THEN
      -- Only status / status_note_i18n / updated_at changed — skip rebuild
      -- but still mark any_change_at so live polling sees the update.
      v_rebuild := false;
    END IF;
  END IF;

  IF v_rebuild THEN
    UPDATE public.site_state
       SET last_change_at = now(),
           any_change_at  = now()
     WHERE id = true;
  ELSE
    UPDATE public.site_state
       SET any_change_at = now()
     WHERE id = true;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.touch_site_state() IS
  'SECURITY DEFINER trigger updating site_state.last_change_at (for Vercel '
  'rebuild) and site_state.any_change_at (for live version polling). '
  'For events UPDATE that only changes status/status_note/updated_at, skips '
  'last_change_at (no rebuild needed) but still bumps any_change_at.';

-- ─── 3. touch_any_change() — for live-only tables ────────────────────────────
-- Does NOT update last_change_at; only any_change_at.
-- Used for: announcements, page_sections, page_section_items,
--           edition_days, committee_member_contacts.

CREATE OR REPLACE FUNCTION public.touch_any_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.site_state
     SET any_change_at = now()
   WHERE id = true;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.touch_any_change() IS
  'SECURITY DEFINER trigger updating only site_state.any_change_at. '
  'Used for tables whose changes are served live (announcements, page_sections, '
  'committee_member_contacts.show_public, edition_days) and do not require '
  'a Vercel rebuild, but do need to be visible to the live-polling client.';

-- ─── 4. Wire touch_any_change() to live-only tables ──────────────────────────

-- 4a. announcements — previously had no site_state trigger at all
DO $$ BEGIN
  CREATE TRIGGER trg_touch_any_change_announcements
    AFTER INSERT OR UPDATE OR DELETE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.touch_any_change();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4b. page_sections (migration 013) — guard with table existence check
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'page_sections'
  ) THEN
    BEGIN
      CREATE TRIGGER trg_touch_any_change_page_sections
        AFTER INSERT OR UPDATE OR DELETE ON public.page_sections
        FOR EACH ROW EXECUTE FUNCTION public.touch_any_change();
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 4c. page_section_items (migration 013)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'page_section_items'
  ) THEN
    BEGIN
      CREATE TRIGGER trg_touch_any_change_page_section_items
        AFTER INSERT OR UPDATE OR DELETE ON public.page_section_items
        FOR EACH ROW EXECUTE FUNCTION public.touch_any_change();
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 4d. edition_days (migration 017) — already has trg_touch_site_state_edition_days
--     from migration 017, which calls touch_site_state().  That now updates
--     both last_change_at and any_change_at so no extra trigger is needed here.
--     (migration 017 intentionally routes edition_days through touch_site_state
--      because day-title changes should also trigger a rebuild.)

-- 4e. committee_member_contacts (migration 017) — show_public changes are live
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'committee_member_contacts'
  ) THEN
    BEGIN
      CREATE TRIGGER trg_touch_any_change_committee_member_contacts
        AFTER INSERT OR UPDATE OR DELETE ON public.committee_member_contacts
        FOR EACH ROW EXECUTE FUNCTION public.touch_any_change();
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─── 5. content_version() — public RPC ───────────────────────────────────────
--
-- Returns { v: "<any_change_at as ISO-8601 text>" }.
-- SECURITY INVOKER: RLS applies to the caller's role (anon can read site_state
-- via the SELECT policy we add below).
-- STABLE + tiny output: safe to poll every 30–120 s from the browser.

-- Allow anon to read site_state so SECURITY INVOKER content_version() works.
-- (Staff already have SELECT via the existing "site_state: staff read" policy.)
DO $$ BEGIN
  CREATE POLICY "site_state: anon read any_change_at"
    ON public.site_state FOR SELECT
    TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.content_version()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'v', (SELECT any_change_at::text FROM public.site_state WHERE id = true LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.content_version() IS
  'Returns { v: "<any_change_at>" } — a cheap version token the public site '
  'polls to detect content changes without downloading the full payload. '
  'SECURITY INVOKER (anon-safe). Returns null v when site_state is empty.';

-- Grant execute to anon and authenticated
REVOKE EXECUTE ON FUNCTION public.content_version() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.content_version() TO anon;
GRANT  EXECUTE ON FUNCTION public.content_version() TO authenticated;

-- ─── 6. Smoke-test ───────────────────────────────────────────────────────────

DO $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.content_version() INTO v_result;
  RAISE NOTICE 'content_version() OK — v: %', v_result->>'v';

  -- Verify any_change_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'site_state'
      AND column_name  = 'any_change_at'
  ) THEN
    RAISE EXCEPTION 'any_change_at column not found on site_state';
  END IF;
END $$;

-- =============================================================================
-- End of migration 021
-- =============================================================================

NOTIFY pgrst, 'reload schema';
