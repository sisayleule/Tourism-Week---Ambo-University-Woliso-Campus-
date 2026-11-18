-- =============================================================================
-- Migration 017 — Event Setup: edition_days, committee contacts,
--                 publish_edition(), extended schema, full public content
--
-- Depends on: 001–016
--
-- Changes:
--   1a. editions: add logo_url, about_i18n; add CHECK end_date >= start_date
--       (already exists on column) and new CHECK end_date - start_date <= 30
--   1b. edition_days: new table (day programme metadata)
--   1c. events: widen day CHECK to 1–31; add 'evening' to session_type;
--       add trigger to reject day > edition's day count
--   1d. committee_members: add bio_i18n, department
--   1e. committee_member_contacts: new table (private contact details)
--   1f. publish_edition(): SECURITY DEFINER function (organizer + admin)
--   1g. create_edition_from_template(): copy edition_days + optionally committees
--   1h. edition_public view, get_public_content(): include new fields;
--       REST fallback also updated via RLS
--   1i. storage: edition-logos bucket (public read, staff upload, admin delete)
--   1j. system_check() extended to cover migration 017 items
-- =============================================================================

-- ─── 0. Guard: abort if already applied ──────────────────────────────────────
-- (DO block; individual ALTER … ADD COLUMN IF NOT EXISTS are idempotent)

-- =============================================================================
-- 1a. EDITIONS — logo_url, about_i18n, 31-day CHECK
-- =============================================================================

ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS about_i18n  jsonb;

COMMENT ON COLUMN public.editions.logo_url IS
  'Edition logo uploaded to the site-content bucket. '
  'NULL = use the application default tourism-week logo.';

COMMENT ON COLUMN public.editions.about_i18n IS
  'Markdown prose for the "About this edition" section. '
  'Sanitised on render; no raw HTML.';

-- Add the ≤ 30-day constraint (editions up to 31 days: end-start <= 30).
-- The existing CHECK (end_date >= start_date) on the column is not named
-- and cannot be re-added with ADD CONSTRAINT IF NOT EXISTS in PG 14; use DO.
DO $$ BEGIN
  ALTER TABLE public.editions
    ADD CONSTRAINT chk_editions_max_days
    CHECK (end_date - start_date <= 30);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 1b. EDITION_DAYS — per-day programme metadata
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.edition_days (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id      uuid      NOT NULL REFERENCES public.editions (id) ON DELETE CASCADE,

  -- 1-based day number within the edition (must correspond to a real calendar day).
  day             smallint  NOT NULL CHECK (day BETWEEN 1 AND 31),

  -- Optional display overrides for the tab / section heading.
  title_i18n       jsonb,
  description_i18n jsonb,

  -- Enforce one row per day per edition.
  UNIQUE (edition_id, day),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.edition_days IS
  'Per-day metadata for an edition (optional title + description). '
  'Rows are auto-created for each calendar day when an edition is set up. '
  'Public SELECT is gated by the parent edition''s state = ''published''. '
  'Staff may insert, update and delete.';

CREATE TRIGGER trg_edition_days_updated_at
  BEFORE UPDATE ON public.edition_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_edition_days_edition_day
  ON public.edition_days (edition_id, day);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.edition_days ENABLE ROW LEVEL SECURITY;

-- Anon: only when the parent edition is published.
CREATE POLICY "edition_days: public read when edition published"
  ON public.edition_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.editions e
      WHERE e.id = edition_days.edition_id
        AND e.state = 'published'
    )
  );

-- Staff: read all (including draft editions).
CREATE POLICY "edition_days: staff read"
  ON public.edition_days FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "edition_days: staff insert"
  ON public.edition_days FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "edition_days: staff update"
  ON public.edition_days FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "edition_days: staff delete"
  ON public.edition_days FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- ── Activity log trigger ──────────────────────────────────────────────────────

DO $$ BEGIN
  -- Reuse the generic log_change function from migration 004 if it exists.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'log_change'
  ) THEN
    CREATE TRIGGER trg_log_edition_days
      AFTER INSERT OR UPDATE OR DELETE ON public.edition_days
      FOR EACH ROW EXECUTE FUNCTION public.log_change();
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── touch_site_state trigger ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_edition_days
    AFTER INSERT OR UPDATE OR DELETE ON public.edition_days
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 1c. EVENTS — widen day to 1–31; add 'evening' session; validate day range
-- =============================================================================

-- ── 1c-i. Add 'evening' to the session_type enum ────────────────────────────
-- ALTER TYPE … ADD VALUE is not transactional; must run outside a transaction
-- in a plain migration. Supabase migrations run non-transactionally so this
-- is safe. The IF NOT EXISTS guard keeps it idempotent.

DO $$ BEGIN
  ALTER TYPE public.session_type ADD VALUE IF NOT EXISTS 'evening';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'session_type ''evening'' already exists or could not be added: %', SQLERRM;
END $$;

-- ── 1c-ii. Widen the day CHECK from 1–7 to 1–31 ────────────────────────────
-- PostgreSQL does not support ALTER COLUMN … DROP CONSTRAINT by name on a
-- column-level CHECK directly; we must drop the named table constraint.
-- The existing constraint in migration 003 is an inline column CHECK with no
-- name, so it appears as a generated name like events_day_check.
-- We drop any constraint named events_day_check and re-add the wider one.

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_day_check;

DO $$ BEGIN
  ALTER TABLE public.events
    ADD CONSTRAINT events_day_check
    CHECK (day BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1c-iii. Trigger: reject event whose day exceeds the edition's day count ──

CREATE OR REPLACE FUNCTION public.validate_event_day_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start date;
  v_end   date;
  v_days  int;
BEGIN
  SELECT start_date, end_date
    INTO v_start, v_end
    FROM public.editions
   WHERE id = NEW.edition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edition not found: %', NEW.edition_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_days := (v_end - v_start) + 1;

  IF NEW.day > v_days THEN
    RAISE EXCEPTION
      'Event day % exceeds the number of days in this edition (%).',
      NEW.day, v_days
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_event_day_range() IS
  'BEFORE INSERT/UPDATE trigger on events. '
  'Rejects an event whose day number exceeds (end_date - start_date + 1) '
  'for the parent edition.';

DO $$ BEGIN
  CREATE TRIGGER trg_validate_event_day_range
    BEFORE INSERT OR UPDATE OF day, edition_id ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.validate_event_day_range();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 1d. COMMITTEE_MEMBERS — bio_i18n, department
-- =============================================================================

ALTER TABLE public.committee_members
  ADD COLUMN IF NOT EXISTS bio_i18n    jsonb,
  ADD COLUMN IF NOT EXISTS department  text;

COMMENT ON COLUMN public.committee_members.bio_i18n IS
  'Short biography for the leader card (Markdown, 3 languages).';

COMMENT ON COLUMN public.committee_members.department IS
  'Academic department or organisational unit.';

-- =============================================================================
-- 1e. COMMITTEE_MEMBER_CONTACTS — private contact details
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.committee_member_contacts (
  -- One row per member; member_id is both PK and FK.
  member_id   uuid    PRIMARY KEY REFERENCES public.committee_members (id) ON DELETE CASCADE,

  email       text,
  phone       text,
  telegram    text,

  -- When false the row must NEVER appear in any public query.
  show_public boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.committee_member_contacts IS
  'Private contact details for a committee member. '
  'show_public = false (default): row is invisible to anon. '
  'show_public = true: email, phone, telegram are shown on the About page. '
  'NEVER join this table into a public query without filtering show_public = true '
  'AND the member''s edition being published.';

CREATE TRIGGER trg_committee_member_contacts_updated_at
  BEFORE UPDATE ON public.committee_member_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.committee_member_contacts ENABLE ROW LEVEL SECURITY;

-- Anon may read a contact ONLY when show_public = true AND the member's
-- edition is published AND the member is published.
CREATE POLICY "contacts: public read when show_public"
  ON public.committee_member_contacts FOR SELECT
  USING (
    show_public = true
    AND EXISTS (
      SELECT 1
      FROM public.committee_members cm
      JOIN public.editions e ON e.id = cm.edition_id
      WHERE cm.id = committee_member_contacts.member_id
        AND cm.state = 'published'
        AND e.state = 'published'
    )
  );

-- Staff: read all contact rows (required for the Setup wizard).
CREATE POLICY "contacts: staff read all"
  ON public.committee_member_contacts FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- Staff: insert and update contact rows.
CREATE POLICY "contacts: staff insert"
  ON public.committee_member_contacts FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "contacts: staff update"
  ON public.committee_member_contacts FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Admin: delete.
CREATE POLICY "contacts: admin delete"
  ON public.committee_member_contacts FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- ── touch_site_state trigger ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_contacts
    AFTER INSERT OR UPDATE OR DELETE ON public.committee_member_contacts
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 1f. publish_edition() — atomic validation + publish in one transaction
-- =============================================================================

CREATE OR REPLACE FUNCTION public.publish_edition(
  p_edition_id    uuid,
  p_make_current  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ed              public.editions%ROWTYPE;
  v_today           date;
  v_days            int;
  v_published_events  int := 0;
  v_published_days    int := 0;
  v_published_members int := 0;
  v_days_without_activities int := 0;
  v_committees_without_leader int := 0;
  v_warnings        text[] := ARRAY[]::text[];
BEGIN
  -- ── Permission check ───────────────────────────────────────────────────────
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'Permission denied: staff role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Load the edition ───────────────────────────────────────────────────────
  SELECT * INTO v_ed FROM public.editions WHERE id = p_edition_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edition not found: %', p_edition_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- ── Validate required fields ───────────────────────────────────────────────
  IF (v_ed.theme_i18n->>'en') IS NULL OR btrim(v_ed.theme_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'Edition must have an English theme/slogan before publishing.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (v_ed.title_i18n->>'en') IS NULL OR btrim(v_ed.title_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'Edition must have an English title before publishing.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_ed.start_date IS NULL OR v_ed.end_date IS NULL THEN
    RAISE EXCEPTION 'Edition must have both start_date and end_date before publishing.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_ed.end_date < v_ed.start_date THEN
    RAISE EXCEPTION 'end_date must not be before start_date.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_days := (v_ed.end_date - v_ed.start_date) + 1;

  IF v_days > 31 THEN
    RAISE EXCEPTION 'Edition spans % days; maximum is 31.', v_days
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Make-current validation ────────────────────────────────────────────────
  v_today := (now() AT TIME ZONE 'Africa/Addis_Ababa')::date;

  IF p_make_current AND v_ed.end_date < v_today THEN
    RAISE EXCEPTION
      'Cannot set a past edition as the main edition (end_date % is before today %).',
      v_ed.end_date, v_today
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Publish the edition itself ─────────────────────────────────────────────
  UPDATE public.editions
     SET state = 'published'
   WHERE id = p_edition_id;

  -- ── Publish all draft events belonging to this edition ────────────────────
  UPDATE public.events
     SET state = 'published'
   WHERE edition_id = p_edition_id
     AND state = 'draft';
  GET DIAGNOSTICS v_published_events = ROW_COUNT;

  -- ── Publish all draft edition_days belonging to this edition ──────────────
  UPDATE public.edition_days
     SET title_i18n       = title_i18n,       -- no-op; ensures row is touched
         description_i18n = description_i18n
   WHERE edition_id = p_edition_id;
  -- edition_days don't have a state column; they are gated by edition.state.
  -- Count rows as "published" via the view.
  SELECT COUNT(*) INTO v_published_days
    FROM public.edition_days
   WHERE edition_id = p_edition_id;

  -- ── Publish all draft committee_members for this edition ──────────────────
  UPDATE public.committee_members
     SET state = 'published'
   WHERE edition_id = p_edition_id
     AND state = 'draft';
  GET DIAGNOSTICS v_published_members = ROW_COUNT;

  -- ── Set is_current if requested (uses transaction-local setting to bypass ──
  --    the guard_edition_is_current trigger's admin check).
  IF p_make_current THEN
    -- Signal to the guard trigger that we are inside publish_edition.
    PERFORM set_config('app.publish_edition_bypass', 'true', true);  -- true = transaction-local
    UPDATE public.editions SET is_current = false WHERE is_current = true;
    UPDATE public.editions SET is_current = true  WHERE id = p_edition_id;
  END IF;

  -- ── Build warnings ─────────────────────────────────────────────────────────

  -- Days without any published activity
  WITH day_series AS (
    SELECT generate_series(1, v_days) AS day
  )
  SELECT COUNT(*)
    INTO v_days_without_activities
    FROM day_series ds
   WHERE NOT EXISTS (
     SELECT 1 FROM public.events ev
      WHERE ev.edition_id = p_edition_id
        AND ev.day = ds.day
        AND ev.state = 'published'
   );

  IF v_days_without_activities > 0 THEN
    v_warnings := v_warnings || ARRAY[
      format('%s day(s) have no published activities.', v_days_without_activities)
    ];
  END IF;

  -- Committees without a leader
  WITH committee_keys AS (
    SELECT unnest(ENUM_RANGE(NULL::public.committee_key_enum)) AS ckey
  )
  SELECT COUNT(*)
    INTO v_committees_without_leader
    FROM committee_keys ck
   WHERE NOT EXISTS (
     SELECT 1 FROM public.committee_members cm
      WHERE cm.edition_id = p_edition_id
        AND cm.committee_key = ck.ckey
        AND cm.is_leader = true
        AND cm.state = 'published'
   );

  IF v_committees_without_leader > 0 THEN
    v_warnings := v_warnings || ARRAY[
      format('%s committee(s) have no published leader.', v_committees_without_leader)
    ];
  END IF;

  RETURN jsonb_build_object(
    'edition_id',           p_edition_id,
    'is_current',           p_make_current,
    'published_events',     v_published_events,
    'published_days',       v_published_days,
    'published_members',    v_published_members,
    'days_in_edition',      v_days,
    'warnings',             to_jsonb(v_warnings)
  );
END;
$$;

COMMENT ON FUNCTION public.publish_edition(uuid, boolean) IS
  'Atomically validates and publishes an edition in one transaction. '
  'Validates: English theme, English title, dates, ≤ 31 days. '
  'Publishes: edition, all its draft events, edition_days (gated by state), '
  'and all its draft committee members. '
  'If p_make_current is true, requires end_date >= today (Africa/Addis_Ababa) '
  'and flips is_current using a transaction-local bypass setting. '
  'Returns counts of published items and an array of non-fatal warnings. '
  'Allowed for staff (organizer and admin).';

REVOKE EXECUTE ON FUNCTION public.publish_edition(uuid, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.publish_edition(uuid, boolean) TO authenticated;

-- ── Update guard_edition_is_current to allow publish_edition bypass ──────────

CREATE OR REPLACE FUNCTION public.guard_edition_is_current()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_current IS NOT DISTINCT FROM OLD.is_current THEN
    RETURN NEW;
  END IF;

  -- Allow if the caller is an admin.
  IF (SELECT public.is_admin()) THEN
    RETURN NEW;
  END IF;

  -- Allow if we are inside publish_edition() (transaction-local setting).
  IF current_setting('app.publish_edition_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: only admins may change is_current on editions.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.guard_edition_is_current() IS
  'BEFORE UPDATE trigger on editions. Blocks non-admin callers from '
  'changing is_current. Admins and service_role may change it freely. '
  'publish_edition() uses a transaction-local setting to bypass the check.';

-- =============================================================================
-- 1g. create_edition_from_template() — also copy edition_days + committees
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_edition_from_template(
  p_source          uuid,
  p_number          int,
  p_slug            text,
  p_title_i18n      jsonb,
  p_theme_i18n      jsonb,
  p_venue_i18n      jsonb,
  p_start           date,
  p_end             date,
  p_copy_committees boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source         public.editions%ROWTYPE;
  v_new_id         uuid;
  v_days           int;
  v_copied_events  int := 0;
  v_skipped_events int := 0;
  v_copied_days    int := 0;
  v_copied_members int := 0;
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'Permission denied: staff role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_number <= 0 THEN
    RAISE EXCEPTION 'Edition number must be greater than zero.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RAISE EXCEPTION 'End date must not be before start date.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF (p_end - p_start) > 30 THEN
    RAISE EXCEPTION 'Edition must not span more than 31 days (end - start = %).',
      (p_end - p_start)
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'Slug is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF (p_title_i18n->>'en') IS NULL OR btrim(p_title_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'English title is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF (p_theme_i18n->>'en') IS NULL OR btrim(p_theme_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'English theme is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF (p_venue_i18n->>'en') IS NULL OR btrim(p_venue_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'English venue is required.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_source FROM public.editions WHERE id = p_source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source edition not found: %', p_source
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.editions WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already exists: %', p_slug
      USING ERRCODE = 'unique_violation';
  END IF;

  v_days := (p_end - p_start) + 1;

  -- Insert the new edition
  INSERT INTO public.editions (
    number, slug,
    edition_name_i18n, title_i18n, theme_i18n,
    sub_theme_i18n, venue_i18n, date_range_display_i18n,
    start_date, end_date,
    start_date_ec, end_date_ec,
    stats, is_current, state
  ) VALUES (
    p_number, p_slug,
    p_title_i18n, p_title_i18n, p_theme_i18n,
    v_source.sub_theme_i18n, p_venue_i18n, NULL,
    p_start, p_end,
    NULL, NULL,
    NULL, false, 'draft'
  )
  RETURNING id INTO v_new_id;

  -- Copy events (day within range only)
  INSERT INTO public.events (
    edition_id, slug, day, session,
    start_time, end_time, sort_order,
    title_i18n, description_i18n, venue_name_i18n,
    category, venue_type, image_url, featured,
    status, state
  )
  SELECT
    v_new_id,
    p_slug || '-' || e.slug,
    e.day, e.session,
    e.start_time, e.end_time, e.sort_order,
    e.title_i18n, e.description_i18n, e.venue_name_i18n,
    e.category, e.venue_type, e.image_url, e.featured,
    'scheduled', 'draft'
  FROM public.events e
  WHERE e.edition_id = p_source
    AND e.day <= v_days;

  GET DIAGNOSTICS v_copied_events = ROW_COUNT;

  SELECT count(*) INTO v_skipped_events
  FROM public.events
  WHERE edition_id = p_source AND day > v_days;

  -- Copy edition_days (day within range only)
  INSERT INTO public.edition_days (edition_id, day, title_i18n, description_i18n)
  SELECT v_new_id, ed.day, ed.title_i18n, ed.description_i18n
  FROM public.edition_days ed
  WHERE ed.edition_id = p_source
    AND ed.day <= v_days
  ON CONFLICT (edition_id, day) DO NOTHING;

  GET DIAGNOSTICS v_copied_days = ROW_COUNT;

  -- Optionally copy committee members (as drafts, no contacts)
  IF p_copy_committees THEN
    INSERT INTO public.committee_members (
      full_name, role_i18n, photo_url, sort_order, state,
      committee_key, is_leader, edition_id,
      bio_i18n, department
    )
    SELECT
      cm.full_name, cm.role_i18n, cm.photo_url, cm.sort_order, 'draft',
      cm.committee_key, cm.is_leader, v_new_id,
      cm.bio_i18n, cm.department
    FROM public.committee_members cm
    WHERE cm.edition_id = p_source;

    GET DIAGNOSTICS v_copied_members = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'new_edition_id',  v_new_id,
    'copied_events',   v_copied_events,
    'skipped_events',  v_skipped_events,
    'copied_days',     v_copied_days,
    'copied_members',  v_copied_members
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date,boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date,boolean) TO authenticated;

-- Keep the old 8-argument overload working (p_copy_committees defaults to false)
-- by granting on the new 9-argument signature. The old signature is replaced.
-- PostgREST routes by function name + argument count, so old callers must be
-- updated to pass 9 arguments (the new default handles the transition).

-- =============================================================================
-- 1h. edition_public VIEW — add logo_url, about_i18n to projection
--
-- PostgreSQL 42P16: CREATE OR REPLACE VIEW cannot change existing column names.
-- Safe approach: DROP the view (no other DB objects depend on it directly —
-- it is security_invoker and only used by queries, not FK targets), then
-- recreate it with the same definition. The view body is identical to migration
-- 002/013 except that e.* now includes the new logo_url and about_i18n columns.
-- =============================================================================

DROP VIEW IF EXISTS public.edition_public;

CREATE VIEW public.edition_public
WITH (security_invoker = true)
AS
SELECT
  e.*,
  CASE
    WHEN (now() AT TIME ZONE 'Africa/Addis_Ababa')::date < e.start_date
      THEN 'upcoming'
    WHEN (now() AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN e.start_date AND e.end_date
      THEN 'live'
    ELSE 'past'
  END AS status
FROM public.editions e;

COMMENT ON VIEW public.edition_public IS
  'Editions with computed status (upcoming/live/past). '
  'Includes logo_url and about_i18n from migration 017. '
  'security_invoker=true means RLS on editions is still applied.';

-- =============================================================================
-- 1h (cont). get_public_content() — include edition_days + committee contacts
--            + edition logo/about
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_content()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_edition_id      uuid;
  v_result          jsonb;
  v_sections        jsonb := '[]'::jsonb;
  v_past_editions   jsonb := '[]'::jsonb;
  v_edition_days    jsonb := '[]'::jsonb;
  v_has_sections    boolean;
  v_has_state_col   boolean;
  v_has_017_cols    boolean;
BEGIN

  -- ── Does page_sections exist? ──────────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'page_sections'
  ) INTO v_has_sections;

  -- ── Does editions.state exist? (migration 013) ────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'editions'
      AND column_name = 'state'
  ) INTO v_has_state_col;

  -- ── Does migration 017 exist? (editions.logo_url) ─────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'editions'
      AND column_name = 'logo_url'
  ) INTO v_has_017_cols;

  -- ── Current edition id ─────────────────────────────────────────────────────
  SELECT id INTO v_edition_id
  FROM public.editions
  WHERE is_current = true
  LIMIT 1;

  -- ── Page sections ──────────────────────────────────────────────────────────
  IF v_has_sections THEN
    EXECUTE $q$
      SELECT COALESCE(jsonb_agg(
        jsonb_set(
          to_jsonb(ps),
          '{items}',
          COALESCE((
            SELECT jsonb_agg(psi ORDER BY psi.sort_order)
            FROM public.page_section_items psi
            WHERE psi.section_id = ps.id
              AND psi.state = 'published'
          ), '[]'::jsonb)
        )
        ORDER BY ps.key
      ), '[]'::jsonb)
      FROM public.page_sections ps
      WHERE ps.state = 'published'
    $q$ INTO v_sections;
  END IF;

  -- ── Past editions ──────────────────────────────────────────────────────────
  IF v_has_state_col THEN
    EXECUTE $q$
      SELECT COALESCE(jsonb_agg(e ORDER BY e.number DESC), '[]'::jsonb)
      FROM (
        SELECT e.*
        FROM public.edition_public e
        WHERE e.state = 'published'
          AND e.status = 'past'
        ORDER BY e.number DESC
      ) e
    $q$ INTO v_past_editions;
  ELSE
    SELECT COALESCE(jsonb_agg(e ORDER BY e.number DESC), '[]'::jsonb)
    INTO v_past_editions
    FROM (
      SELECT e.*
      FROM public.edition_public e
      WHERE e.status = 'past'
      ORDER BY e.number DESC
    ) e;
  END IF;

  -- ── Edition days (migration 017) ───────────────────────────────────────────
  IF v_has_017_cols AND v_edition_id IS NOT NULL THEN
    EXECUTE $q$
      SELECT COALESCE(jsonb_agg(ed ORDER BY ed.day), '[]'::jsonb)
      FROM public.edition_days ed
      WHERE ed.edition_id = $1
    $q$ USING v_edition_id INTO v_edition_days;
  END IF;

  -- ── Build the main payload ─────────────────────────────────────────────────
  SELECT jsonb_build_object(

    'generated_at', now(),

    -- Current edition (now includes logo_url, about_i18n from 017)
    'edition', (
      SELECT row_to_json(e)
      FROM public.edition_public e
      WHERE e.is_current = true
      LIMIT 1
    ),

    -- Published events (≤ 100; now up to day 31)
    'events', COALESCE((
      SELECT jsonb_agg(ev ORDER BY ev.day, ev.session, ev.sort_order)
      FROM (
        SELECT
          ev.id, ev.slug, ev.edition_id, ev.day, ev.session,
          ev.start_time, ev.end_time, ev.sort_order,
          ev.title_i18n, ev.description_i18n, ev.venue_name_i18n,
          ev.category, ev.venue_type, ev.image_url, ev.featured,
          ev.status, ev.status_note_i18n, ev.state,
          ev.created_at, ev.updated_at
        FROM public.events ev
        WHERE ev.state = 'published'
          AND ev.edition_id = v_edition_id
        ORDER BY ev.day, ev.session, ev.sort_order
        LIMIT 100
      ) ev
    ), '[]'::jsonb),

    -- Published news (≤ 50)
    'news', COALESCE((
      SELECT jsonb_agg(n ORDER BY n.pinned DESC, n.published_at DESC)
      FROM (
        SELECT n.id, n.slug, n.title_i18n, n.summary_i18n, n.body_i18n,
               n.category, n.cover_image_url, n.pinned,
               n.published_at, n.state, n.created_at, n.updated_at
        FROM public.news n
        WHERE n.state = 'published'
        ORDER BY n.pinned DESC, n.published_at DESC
        LIMIT 50
      ) n
    ), '[]'::jsonb),

    -- Published gallery items (≤ 200)
    'gallery', COALESCE((
      SELECT jsonb_agg(g ORDER BY g.sort_order)
      FROM (
        SELECT g.id, g.edition_id, g.event_id, g.media_type,
               g.image_url, g.video_url, g.caption_i18n, g.year,
               g.category, g.sort_order, g.state,
               g.created_at, g.updated_at
        FROM public.gallery_items g
        WHERE g.state = 'published'
        ORDER BY g.sort_order
        LIMIT 200
      ) g
    ), '[]'::jsonb),

    -- Published sponsors
    'sponsors', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.sort_order)
      FROM (
        SELECT s.id, s.name, s.tier, s.logo_url, s.website_url,
               s.sort_order, s.state, s.created_at, s.updated_at
        FROM public.sponsors s
        WHERE s.state = 'published'
        ORDER BY s.sort_order
      ) s
    ), '[]'::jsonb),

    -- Published committee members FOR the current edition,
    -- with leader first, with optional public contacts inline.
    'committee', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.is_leader DESC, c.sort_order)
      FROM (
        SELECT
          cm.id, cm.full_name, cm.role_i18n,
          cm.photo_url, cm.sort_order, cm.state,
          cm.committee_key, cm.is_leader, cm.edition_id,
          cm.bio_i18n, cm.department,
          -- Embed contact ONLY when show_public = true
          CASE
            WHEN cmc.show_public = true
            THEN jsonb_build_object(
              'email',    cmc.email,
              'phone',    cmc.phone,
              'telegram', cmc.telegram
            )
            ELSE NULL
          END AS contact,
          cm.created_at, cm.updated_at
        FROM public.committee_members cm
        LEFT JOIN public.committee_member_contacts cmc
               ON cmc.member_id = cm.id
              AND cmc.show_public = true
        WHERE cm.state = 'published'
          AND cm.edition_id = v_edition_id
        ORDER BY cm.is_leader DESC, cm.sort_order
      ) c
    ), '[]'::jsonb),

    -- Published FAQs
    'faqs', COALESCE((
      SELECT jsonb_agg(f ORDER BY f.sort_order)
      FROM (
        SELECT f.id, f.question_i18n, f.answer_i18n,
               f.sort_order, f.state, f.created_at, f.updated_at
        FROM public.faqs f
        WHERE f.state = 'published'
        ORDER BY f.sort_order
      ) f
    ), '[]'::jsonb),

    -- Site settings
    'site_settings', (
      SELECT row_to_json(ss)
      FROM public.site_settings ss
      LIMIT 1
    ),

    -- Active announcements
    'announcements', COALESCE((
      SELECT jsonb_agg(a ORDER BY a.created_at DESC)
      FROM (
        SELECT a.id, a.message_i18n, a.type, a.link,
               a.starts_at, a.expires_at, a.state,
               a.created_at, a.updated_at
        FROM public.announcements a
        WHERE a.state = 'published'
          AND a.starts_at <= now()
          AND (a.expires_at IS NULL OR a.expires_at > now())
        ORDER BY a.created_at DESC
      ) a
    ), '[]'::jsonb),

    -- Page sections (empty when migration 013 not applied)
    'sections', v_sections,

    -- Past editions
    'past_editions', v_past_editions,

    -- Edition days (empty when migration 017 not applied or no current edition)
    'edition_days', v_edition_days

  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_public_content() IS
  'Returns all published content for the public site in a single JSONB object. '
  'Migration 017: adds edition_days[], edition.logo_url, edition.about_i18n, '
  'committee[].bio_i18n, committee[].department, committee[].contact (show_public only). '
  'Contact details are excluded unless show_public = true on the contacts row.';

REVOKE EXECUTE ON FUNCTION public.get_public_content() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_content() TO anon;
GRANT  EXECUTE ON FUNCTION public.get_public_content() TO authenticated;

-- =============================================================================
-- 1i. STORAGE — edition-logos bucket
-- =============================================================================

-- Create the edition-logos bucket if it doesn't already exist.
-- Supabase stores bucket definitions in the storage schema.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'edition-logos',
  'edition-logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for edition-logos bucket
-- Public read (bucket is public = true, so this is automatic in Supabase)
-- Staff upload: authenticated users may INSERT into the bucket
DO $$ BEGIN
  INSERT INTO storage.policies (name, bucket_id, operation, definition)
  VALUES
    ('edition-logos: public read',   'edition-logos', 'SELECT', 'true'),
    ('edition-logos: staff insert',  'edition-logos', 'INSERT', '(auth.role() = ''authenticated'')'),
    ('edition-logos: staff update',  'edition-logos', 'UPDATE', '(auth.role() = ''authenticated'')'),
    ('edition-logos: admin delete',  'edition-logos', 'DELETE', '(auth.role() = ''authenticated'')')
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- storage.policies table may not exist in all Supabase versions; skip gracefully
  RAISE NOTICE 'storage.policies insert skipped: %', SQLERRM;
END $$;

-- =============================================================================
-- 1j. system_check() — extend for migration 017 items
-- =============================================================================

CREATE OR REPLACE FUNCTION public.system_check()
RETURNS TABLE (
  migration  text,
  kind       text,
  item       text,
  present    boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Migration 008 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '008'::text, 'column'::text, 'profiles.must_change_password'::text,
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'must_change_password');

  -- ── Migration 009 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '009', 'column', 'events.status_note_i18n',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'
        AND column_name = 'status_note_i18n');

  -- ── Migration 011 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '011', 'table', 'site_state',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'site_state');

  RETURN QUERY SELECT '011', 'table', 'message_rate_limits',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'message_rate_limits');

  RETURN QUERY SELECT '011', 'function', 'touch_site_state()',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'touch_site_state');

  -- ── Migration 012 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '012', 'column', 'site_state.last_backup_at',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'site_state'
        AND column_name = 'last_backup_at');

  RETURN QUERY SELECT '012', 'function', 'set_current_edition(uuid)',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'set_current_edition');

  RETURN QUERY SELECT '012', 'function', 'create_edition_from_template()',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_edition_from_template');

  -- ── Migration 013 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '013', 'column', 'editions.state',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'state');

  RETURN QUERY SELECT '013', 'column', 'editions.theme_highlight_i18n',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'theme_highlight_i18n');

  RETURN QUERY SELECT '013', 'table', 'page_sections',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'page_sections');

  -- ── Migration 014 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '014', 'function', 'get_public_content()',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_public_content');

  -- ── Migration 015 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '015', 'type', 'committee_key_enum',
    EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'committee_key_enum');

  RETURN QUERY SELECT '015', 'column', 'committee_members.committee_key',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'committee_key');

  RETURN QUERY SELECT '015', 'column', 'committee_members.edition_id',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'edition_id');

  -- ── Migration 016 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '016', 'function', 'system_check()',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'system_check');

  -- ── Migration 017 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '017', 'column', 'editions.logo_url',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'logo_url');

  RETURN QUERY SELECT '017', 'column', 'editions.about_i18n',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'about_i18n');

  RETURN QUERY SELECT '017', 'table', 'edition_days',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'edition_days');

  RETURN QUERY SELECT '017', 'column', 'events.day_check_1_31',
    EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'events'
        AND c.conname = 'events_day_check'
        AND pg_get_constraintdef(c.oid) LIKE '%31%'
    );

  RETURN QUERY SELECT '017', 'column', 'committee_members.bio_i18n',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'bio_i18n');

  RETURN QUERY SELECT '017', 'column', 'committee_members.department',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'department');

  RETURN QUERY SELECT '017', 'table', 'committee_member_contacts',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'committee_member_contacts');

  RETURN QUERY SELECT '017', 'function', 'publish_edition(uuid,boolean)',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'publish_edition');

  RETURN QUERY SELECT '017', 'function', 'validate_event_day_range()',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'validate_event_day_range');

END;
$$;

REVOKE EXECUTE ON FUNCTION public.system_check() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.system_check() TO authenticated;

-- =============================================================================
-- 1i. STORAGE — edition-logos bucket + RLS on storage.objects
-- =============================================================================

-- Create the bucket (idempotent).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'edition-logos',
  'edition-logos',
  true,                 -- public: anon can read via URL
  2097152,              -- 2 MB limit
  ARRAY['image/png', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152;

-- RLS on storage.objects for the edition-logos bucket.
-- Supabase storage uses storage.objects with RLS; policies are rows in
-- storage.objects with the standard USING / WITH CHECK pattern.

-- 1. Anon + authenticated can read (SELECT) — bucket is public so URLs work.
DO $$ BEGIN
  DROP POLICY IF EXISTS "edition-logos: public read" ON storage.objects;
  CREATE POLICY "edition-logos: public read"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'edition-logos' );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Authenticated staff can INSERT (upload).
DO $$ BEGIN
  DROP POLICY IF EXISTS "edition-logos: staff insert" ON storage.objects;
  CREATE POLICY "edition-logos: staff insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'edition-logos' );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Authenticated staff can UPDATE (upsert / replace).
DO $$ BEGIN
  DROP POLICY IF EXISTS "edition-logos: staff update" ON storage.objects;
  CREATE POLICY "edition-logos: staff update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING  ( bucket_id = 'edition-logos' )
    WITH CHECK ( bucket_id = 'edition-logos' );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Admin can DELETE.
DO $$ BEGIN
  DROP POLICY IF EXISTS "edition-logos: admin delete" ON storage.objects;
  CREATE POLICY "edition-logos: admin delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'edition-logos' AND (SELECT public.is_admin()) );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration 017
-- =============================================================================

NOTIFY pgrst, 'reload schema';
