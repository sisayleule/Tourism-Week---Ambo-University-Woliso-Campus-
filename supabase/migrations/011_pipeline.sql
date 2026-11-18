-- =============================================================================
-- Migration 011 — Publishing pipeline: site_state, rate limits, triggers
-- Depends on : 003_content_tables.sql, 004_messages_settings_audit.sql,
--              005_security_functions.sql, 006_rls_policies.sql,
--              009_event_status_note.sql
--
-- Purpose:
--   1. Drop the policy that lets anon/authenticated INSERT into messages.
--      Only the submit-message Edge Function (service role) will insert.
--   2. Create message_rate_limits table (RLS enabled, no policies — only
--      the Edge Function via service role can read/write).
--   3. Create site_state table (single row: last_change_at, last_deploy_requested_at).
--      Readable by staff, writable only by SECURITY DEFINER functions / service role.
--   4. Add triggers on events, news, gallery_items, sponsors, committee_members,
--      faqs, editions, site_settings that set site_state.last_change_at = now().
--      For events, do NOT set it when only status, status_note_i18n or updated_at
--      changed (those are served live). Announcements do NOT trigger it either.
-- =============================================================================

-- ─── 1. Drop anon/authenticated INSERT policies on messages ─────────────────

DROP POLICY IF EXISTS "messages: anon insert" ON public.messages;
DROP POLICY IF EXISTS "messages: authenticated insert" ON public.messages;

-- ─── 2. message_rate_limits ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.message_rate_limits (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash     text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('contact', 'sponsor_inquiry')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.message_rate_limits IS
  'Rate-limit log for public form submissions. Written by the submit-message '
  'Edge Function (service role). RLS is enabled with no policies — only the '
  'service role can read or write. Hashed IP + kind identify the caller.';

-- Index for the rate-limit queries (count per hour/day).
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_kind_created
  ON public.message_rate_limits (ip_hash, kind, created_at DESC);

ALTER TABLE public.message_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies — default deny for all roles except service_role (which bypasses RLS).

-- ─── 3. site_state ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_state (
  -- Boolean PK ensures at most one row.
  id                        boolean     PRIMARY KEY DEFAULT true CHECK (id = true),

  -- Updated by triggers whenever content changes (not for live status/announcements).
  last_change_at            timestamptz NOT NULL DEFAULT now(),

  -- Updated by the trigger-deploy Edge Function when a deploy is requested.
  last_deploy_requested_at  timestamptz,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_state IS
  'Single-row table tracking content changes and deploy requests. '
  'last_change_at is set by triggers on content tables (events, news, etc.) '
  'but NOT for live-only changes (event status, status_note, announcements). '
  'last_deploy_requested_at is set by the trigger-deploy Edge Function. '
  'Staff can read it; only functions / service role can write it.';

CREATE TRIGGER trg_site_state_updated_at
  BEFORE UPDATE ON public.site_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Initialize the single row.
INSERT INTO public.site_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- RLS: staff can SELECT; nobody can INSERT/UPDATE/DELETE directly
-- (SECURITY DEFINER functions and service role bypass RLS).
ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_state: staff read"
  ON public.site_state FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- ─── 4. touch_site_state() trigger function ────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_site_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- For events UPDATE: skip if ONLY status, status_note_i18n, or updated_at
  -- changed (those are served live and don't need a rebuild).
  IF TG_TABLE_NAME = 'events' AND TG_OP = 'UPDATE' THEN
    IF NEW.title_i18n      IS NOT DISTINCT FROM OLD.title_i18n
       AND NEW.description_i18n IS NOT DISTINCT FROM OLD.description_i18n
       AND NEW.venue_name_i18n  IS NOT DISTINCT FROM OLD.venue_name_i18n
       AND NEW.category    IS NOT DISTINCT FROM OLD.category
       AND NEW.venue_type  IS NOT DISTINCT FROM OLD.venue_type
       AND NEW.day          IS NOT DISTINCT FROM OLD.day
       AND NEW.session      IS NOT DISTINCT FROM OLD.session
       AND NEW.start_time   IS NOT DISTINCT FROM OLD.start_time
       AND NEW.end_time     IS NOT DISTINCT FROM OLD.end_time
       AND NEW.sort_order    IS NOT DISTINCT FROM OLD.sort_order
       AND NEW.image_url    IS NOT DISTINCT FROM OLD.image_url
       AND NEW.featured     IS NOT DISTINCT FROM OLD.featured
       AND NEW.state        IS NOT DISTINCT FROM OLD.state
       AND NEW.edition_id   IS NOT DISTINCT FROM OLD.edition_id
       AND NEW.slug         IS NOT DISTINCT FROM OLD.slug
    THEN
      -- Only status, status_note_i18n, or updated_at changed — don't trigger rebuild
      RETURN NULL;
    END IF;
  END IF;

  -- Update the single site_state row
  UPDATE public.site_state SET last_change_at = now() WHERE id = true;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.touch_site_state() IS
  'SECURITY DEFINER trigger that updates site_state.last_change_at = now() '
  'on INSERT/UPDATE/DELETE of content tables. For events, skips updates that '
  'only change status, status_note_i18n, or updated_at (served live). '
  'Announcements are deliberately NOT wired to this trigger.';

-- ─── 5. Attach triggers ─────────────────────────────────────────────────────
-- Attached to: events, news, gallery_items, sponsors, committee_members,
--              faqs, editions, site_settings.
-- NOT attached to: announcements (live-only, no rebuild needed).

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_events
    AFTER INSERT OR UPDATE OR DELETE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_news
    AFTER INSERT OR UPDATE OR DELETE ON public.news
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_gallery_items
    AFTER INSERT OR UPDATE OR DELETE ON public.gallery_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_sponsors
    AFTER INSERT OR UPDATE OR DELETE ON public.sponsors
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_committee_members
    AFTER INSERT OR UPDATE OR DELETE ON public.committee_members
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_faqs
    AFTER INSERT OR UPDATE OR DELETE ON public.faqs
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_editions
    AFTER INSERT OR UPDATE OR DELETE ON public.editions
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_site_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.site_settings
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration 011
-- =============================================================================

NOTIFY pgrst, 'reload schema';
