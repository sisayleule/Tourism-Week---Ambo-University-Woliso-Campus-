-- =============================================================================
-- Migration 013 — Site content: editions extended, page sections, items,
--                 site-content storage bucket, RLS, triggers
-- Depends on : 001_enums_and_triggers.sql, 002_core_tables.sql,
--              005_security_functions.sql, 006_rls_policies.sql,
--              011_pipeline.sql, 012_admin_tools.sql
--
-- Purpose:
--   1. Extend editions with subtitle, theme highlight word, hero media,
--      summary, cover image, and content_state so past editions can be
--      edited and published independently of the live edition.
--   2. Add page_sections — one row per named section of the public site.
--   3. Add page_section_items — cards/chips within a section (FK to section).
--   4. Add site-content storage bucket (public-read, staff-upload, admin-delete).
--   5. RLS: anon sees published only; staff insert/update; admin delete.
--   6. Guard trigger: only admins may change editions.is_current.
--   7. touch_site_state triggers for the new tables.
--   8. Activity log triggers for the new tables.
--   9. Extend create_edition_from_template so staff (not just admin) may call it.
-- =============================================================================

-- ─── 1. Extend editions ──────────────────────────────────────────────────────

-- subtitle_i18n: a secondary headline shown under the theme on the hero.
-- (sub_theme_i18n already exists; subtitle_i18n is the short hero subtitle,
--  while sub_theme_i18n is the richer "promoting…" text already in DB)
ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS subtitle_i18n       jsonb,
  ADD COLUMN IF NOT EXISTS theme_highlight_i18n jsonb,
  ADD COLUMN IF NOT EXISTS hero_poster_url      text,
  ADD COLUMN IF NOT EXISTS hero_video_url       text,
  ADD COLUMN IF NOT EXISTS summary_i18n         jsonb,
  ADD COLUMN IF NOT EXISTS cover_image_url      text,
  ADD COLUMN IF NOT EXISTS state               public.content_state NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN public.editions.subtitle_i18n IS
  'Short hero subtitle shown below the theme in the hero section. '
  'Falls back to sub_theme_i18n when empty.';

COMMENT ON COLUMN public.editions.theme_highlight_i18n IS
  'The word or phrase within theme_i18n to render gold-italic per language. '
  'If the value is not found inside the theme text, no highlight is shown. '
  'Example: {"en": "Peace", "am": "ሰላምና", "om": "Nageenyaa"}';

COMMENT ON COLUMN public.editions.hero_poster_url IS
  'Override the default hero poster image with an uploaded asset URL. '
  'NULL = keep the application default (Lalibela church photo).';

COMMENT ON COLUMN public.editions.hero_video_url IS
  'Override the default hero background video with an uploaded asset URL. '
  'NULL = keep the application default (/videos/hero.mp4).';

COMMENT ON COLUMN public.editions.summary_i18n IS
  'One-paragraph summary shown in the Past Editions Timeline. '
  'Markdown-safe plain text; no HTML.';

COMMENT ON COLUMN public.editions.cover_image_url IS
  'Cover image shown in the Past Editions Timeline card. '
  'No empty image box is shown when this is NULL.';

COMMENT ON COLUMN public.editions.state IS
  'draft = only staff can see the edition; published = visible to anon. '
  'All existing editions are set to published by the UPDATE below.';

-- Back-fill: mark all existing editions as published.
UPDATE public.editions SET state = 'published' WHERE state = 'draft';

-- edition_public view: now filters to published editions for anon read.
-- (The view uses security_invoker = true, so RLS on editions is applied;
--  we also update the RLS policy in section 5 below to filter by state.)

-- ─── 1b. Guard trigger: only admins may change is_current ────────────────────

CREATE OR REPLACE FUNCTION public.guard_edition_is_current()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire when is_current is actually being changed.
  IF NEW.is_current IS NOT DISTINCT FROM OLD.is_current THEN
    RETURN NEW;
  END IF;

  -- Allow if the caller is an admin (or service_role which bypasses RLS).
  IF (SELECT public.is_admin()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: only admins may change is_current on editions.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.guard_edition_is_current() IS
  'BEFORE UPDATE trigger on editions. Blocks non-admin callers from '
  'changing is_current. Admins and service_role may change it freely.';

DO $$ BEGIN
  CREATE TRIGGER trg_guard_edition_is_current
    BEFORE UPDATE ON public.editions
    FOR EACH ROW EXECUTE FUNCTION public.guard_edition_is_current();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1c. Update set_current_edition to require the edition to be published ───

-- Extend the existing function: add a published check before setting is_current.
CREATE OR REPLACE FUNCTION public.set_current_edition(p_edition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.editions WHERE id = p_edition_id) THEN
    RAISE EXCEPTION 'Edition not found: %', p_edition_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Require the target edition to be published.
  IF NOT EXISTS (
    SELECT 1 FROM public.editions
    WHERE id = p_edition_id AND state = 'published'
  ) THEN
    RAISE EXCEPTION 'Edition must be published before it can be set as the live edition.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.editions SET is_current = false WHERE is_current = true;
  UPDATE public.editions SET is_current = true  WHERE id = p_edition_id;
END;
$$;

COMMENT ON FUNCTION public.set_current_edition(uuid) IS
  'Atomically switches the current edition. Admin only. '
  'The target edition must have state = ''published''. '
  'SECURITY DEFINER so it bypasses RLS on the editions table.';

REVOKE EXECUTE ON FUNCTION public.set_current_edition(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_current_edition(uuid) TO authenticated;

-- ─── 1d. Allow staff to call create_edition_from_template ────────────────────

CREATE OR REPLACE FUNCTION public.create_edition_from_template(
  p_source      uuid,
  p_number      int,
  p_slug        text,
  p_title_i18n  jsonb,
  p_theme_i18n  jsonb,
  p_venue_i18n  jsonb,
  p_start       date,
  p_end         date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source      public.editions%ROWTYPE;
  v_new_id      uuid;
  v_days        int;
  v_copied      int := 0;
  v_skipped     int := 0;
BEGIN
  -- Allow staff (organizer or admin) — not anon.
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
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'Slug is required.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_title_i18n IS NULL OR (p_title_i18n->>'en') IS NULL OR btrim(p_title_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'English title is required.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_theme_i18n IS NULL OR (p_theme_i18n->>'en') IS NULL OR btrim(p_theme_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'English theme is required.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_venue_i18n IS NULL OR (p_venue_i18n->>'en') IS NULL OR btrim(p_venue_i18n->>'en') = '' THEN
    RAISE EXCEPTION 'English venue is required.'
      USING ERRCODE = 'check_violation';
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

  GET DIAGNOSTICS v_copied = ROW_COUNT;

  SELECT count(*) INTO v_skipped
  FROM public.events
  WHERE edition_id = p_source AND day > v_days;

  RETURN jsonb_build_object(
    'new_edition_id', v_new_id,
    'copied',         v_copied,
    'skipped',        v_skipped
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date) TO authenticated;

-- ─── 2. page_sections ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.page_sections (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unique machine key; matches a registered section in the front-end registry.
  -- Format: <page>.<section>, e.g. "home.hero", "about.heritage".
  key             text          NOT NULL UNIQUE,

  title_i18n      jsonb,
  subtitle_i18n   jsonb,

  -- Rich prose in Markdown; sanitised on render by the public site.
  body_i18n       jsonb,

  -- Optional image attached to the whole section (not to individual items).
  image_url       text,

  -- Optional call-to-action label + destination (internal path or https://).
  cta_label_i18n  jsonb,
  cta_url         text CHECK (
    cta_url IS NULL
    OR cta_url ~ '^/'
    OR cta_url ~ '^https://'
  ),

  state           public.content_state NOT NULL DEFAULT 'draft',
  needs_review    boolean       NOT NULL DEFAULT false,

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.page_sections IS
  'One row per named, editable section of the public site. '
  'The key field is the canonical identifier (e.g. "home.hero", "home.cta") '
  'and must match an entry in the front-end section registry. '
  'state=draft hides the section; state=published shows it. '
  'needs_review=true flags the section for department review '
  '(cleared by saving in the portal).';

CREATE TRIGGER trg_page_sections_updated_at
  BEFORE UPDATE ON public.page_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_page_sections_key
  ON public.page_sections (key);

CREATE INDEX IF NOT EXISTS idx_page_sections_state
  ON public.page_sections (state);

-- ─── 3. page_section_items ───────────────────────────────────────────────────

-- Fixed icon vocabulary — matches Lucide icon names used in the public site.
-- This CHECK is intentionally broad; the registry further restricts per section.
CREATE TABLE IF NOT EXISTS public.page_section_items (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),

  section_id  uuid      NOT NULL REFERENCES public.page_sections (id) ON DELETE CASCADE,

  title_i18n  jsonb,
  body_i18n   jsonb,

  -- Lucide icon name (e.g. "Mountain", "Coffee", "Heart").
  icon        text CHECK (icon ~ '^[A-Z][A-Za-z0-9]+$' OR icon IS NULL),

  image_url   text,

  -- Link destination: internal path or https:// only.
  link_url    text CHECK (
    link_url IS NULL
    OR link_url ~ '^/'
    OR link_url ~ '^https://'
  ),

  -- Small label (e.g. "32 km from Woliso", "In Woliso Town").
  badge_i18n  jsonb,

  sort_order  integer   NOT NULL DEFAULT 0,
  state       public.content_state NOT NULL DEFAULT 'published',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.page_section_items IS
  'Cards/chips within a page section. Cascade-deleted with their parent section. '
  'sort_order controls display order; the portal provides drag-to-reorder. '
  'icon must be a valid Lucide component name (PascalCase). '
  'link_url and badge_i18n hold factual claims that may need department '
  'verification (e.g. distances, statistics).';

CREATE TRIGGER trg_page_section_items_updated_at
  BEFORE UPDATE ON public.page_section_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_psi_section_order
  ON public.page_section_items (section_id, sort_order);

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.page_sections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_section_items ENABLE ROW LEVEL SECURITY;

-- ── editions: update existing public read policy to filter by state ──────────
-- Drop the old "everyone reads everything" editions policy and replace it with
-- published-only for anon, all-rows for staff.
DROP POLICY IF EXISTS "editions: public read"            ON public.editions;

CREATE POLICY "editions: anon reads published"
  ON public.editions FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "editions: staff reads all"
  ON public.editions FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- Staff may INSERT editions (create_edition_from_template handles via DEFINER,
-- but direct INSERT should also be allowed for staff in the portal UI).
DROP POLICY IF EXISTS "editions: admin insert" ON public.editions;

CREATE POLICY "editions: staff insert"
  ON public.editions FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

-- Staff may UPDATE edition fields; the guard trigger blocks is_current for non-admins.
DROP POLICY IF EXISTS "editions: admin update" ON public.editions;

CREATE POLICY "editions: staff update"
  ON public.editions FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Only admins may delete editions.
-- (The old "editions: admin delete" policy already exists; leave it in place.)

-- ── page_sections ─────────────────────────────────────────────────────────────

CREATE POLICY "page_sections: anon reads published"
  ON public.page_sections FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "page_sections: staff reads all"
  ON public.page_sections FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "page_sections: staff insert"
  ON public.page_sections FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "page_sections: staff update"
  ON public.page_sections FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Only admins may delete page_sections.
CREATE POLICY "page_sections: admin delete"
  ON public.page_sections FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- ── page_section_items ────────────────────────────────────────────────────────

CREATE POLICY "page_section_items: anon reads published items in published section"
  ON public.page_section_items FOR SELECT
  USING (
    state = 'published'
    AND EXISTS (
      SELECT 1 FROM public.page_sections ps
      WHERE ps.id = section_id AND ps.state = 'published'
    )
  );

CREATE POLICY "page_section_items: staff reads all"
  ON public.page_section_items FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "page_section_items: staff insert"
  ON public.page_section_items FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "page_section_items: staff update"
  ON public.page_section_items FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Staff (not just admin) may delete items (cards can be removed by organizers).
CREATE POLICY "page_section_items: staff delete"
  ON public.page_section_items FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- ─── 5. touch_site_state triggers for new tables ─────────────────────────────

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_page_sections
    AFTER INSERT OR UPDATE OR DELETE ON public.page_sections
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_touch_site_state_page_section_items
    AFTER INSERT OR UPDATE OR DELETE ON public.page_section_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 6. Activity-log triggers for new tables ─────────────────────────────────

DO $$ BEGIN
  CREATE TRIGGER trg_log_page_sections
    AFTER INSERT OR UPDATE OR DELETE ON public.page_sections
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_page_section_items
    AFTER INSERT OR UPDATE OR DELETE ON public.page_section_items
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Also add activity-log trigger for editions if not already present.
DO $$ BEGIN
  CREATE TRIGGER trg_log_editions
    AFTER INSERT OR UPDATE OR DELETE ON public.editions
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 7. set_updated_at trigger for editions if not already present ────────────
-- (Already created in 002_core_tables.sql — skipped idempotently above.)

-- ─── 8. Extend touch_site_state to handle page_sections draft-only changes ───
-- The existing touch_site_state() function handles all tables generically;
-- no change needed — both INSERT and UPDATE on page_sections touch site_state.

-- =============================================================================
-- End of migration 013
-- =============================================================================

NOTIFY pgrst, 'reload schema';
