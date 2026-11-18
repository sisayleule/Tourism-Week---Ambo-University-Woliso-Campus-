-- =============================================================================
-- Migration 014 — Live content: get_public_content() RPC function
-- Depends on : 001_enums_and_triggers.sql, 002_core_tables.sql,
--              003_content_tables.sql, 004_messages_settings_audit.sql,
--              005_security_functions.sql, 006_rls_policies.sql,
--              011_pipeline.sql
--
-- Migration 013 (page_sections) is optional — if it has not been applied the
-- function still works; sections and past_editions return empty arrays.
-- =============================================================================

-- ─── 1. Create or replace the function ───────────────────────────────────────

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
  v_has_sections    boolean;
  v_has_state_col   boolean;
BEGIN

  -- ── Does page_sections exist? ──────────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'page_sections'
  ) INTO v_has_sections;

  -- ── Does editions.state exist? (added in migration 013) ───────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'editions'
      AND column_name  = 'state'
  ) INTO v_has_state_col;

  -- ── Current edition id ─────────────────────────────────────────────────────
  SELECT id INTO v_edition_id
  FROM public.editions
  WHERE is_current = true
  LIMIT 1;

  -- ── Page sections (only if migration 013 has been applied) ─────────────────
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

  -- ── Past editions (only if editions.state column exists) ──────────────────
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
    -- editions.state does not exist yet — return all past editions
    SELECT COALESCE(jsonb_agg(e ORDER BY e.number DESC), '[]'::jsonb)
    INTO v_past_editions
    FROM (
      SELECT e.*
      FROM public.edition_public e
      WHERE e.status = 'past'
      ORDER BY e.number DESC
    ) e;
  END IF;

  -- ── Build the main payload ─────────────────────────────────────────────────
  SELECT jsonb_build_object(

    'generated_at', now(),

    -- Current edition
    'edition', (
      SELECT row_to_json(e)
      FROM public.edition_public e
      WHERE e.is_current = true
      LIMIT 1
    ),

    -- Published events (≤100)
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

    -- Published news (≤50)
    'news', COALESCE((
      SELECT jsonb_agg(n ORDER BY n.pinned DESC, n.published_at DESC)
      FROM (
        SELECT
          n.id, n.slug, n.title_i18n, n.summary_i18n, n.body_i18n,
          n.category, n.cover_image_url, n.pinned,
          n.published_at, n.state,
          n.created_at, n.updated_at
        FROM public.news n
        WHERE n.state = 'published'
        ORDER BY n.pinned DESC, n.published_at DESC
        LIMIT 50
      ) n
    ), '[]'::jsonb),

    -- Published gallery items (≤200)
    'gallery', COALESCE((
      SELECT jsonb_agg(g ORDER BY g.sort_order)
      FROM (
        SELECT
          g.id, g.edition_id, g.event_id,
          g.media_type, g.image_url, g.video_url,
          g.caption_i18n, g.year, g.category,
          g.sort_order, g.state,
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
        SELECT
          s.id, s.name, s.tier, s.logo_url, s.website_url,
          s.sort_order, s.state,
          s.created_at, s.updated_at
        FROM public.sponsors s
        WHERE s.state = 'published'
        ORDER BY s.sort_order
      ) s
    ), '[]'::jsonb),

    -- Published committee members
    'committee', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.sort_order)
      FROM (
        SELECT
          c.id, c.full_name, c.role_i18n,
          c.photo_url, c.sort_order, c.state,
          c.created_at, c.updated_at
        FROM public.committee_members c
        WHERE c.state = 'published'
        ORDER BY c.sort_order
      ) c
    ), '[]'::jsonb),

    -- Published FAQs
    'faqs', COALESCE((
      SELECT jsonb_agg(f ORDER BY f.sort_order)
      FROM (
        SELECT
          f.id, f.question_i18n, f.answer_i18n,
          f.sort_order, f.state,
          f.created_at, f.updated_at
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
        SELECT
          a.id, a.message_i18n, a.type, a.link,
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
    'sections',      v_sections,

    -- Past editions (empty when no past editions exist)
    'past_editions', v_past_editions

  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_public_content() IS
  'Returns a single JSONB object with all published content for the public site. '
  'Uses SECURITY INVOKER so RLS applies with the caller''s role — anon sees published rows only. '
  'Callable by anon via POST /rest/v1/rpc/get_public_content. '
  'page_sections and past_editions are skipped gracefully when migration 013 is not applied.';

-- ─── 2. Grant execute to the anon and authenticated roles ────────────────────
REVOKE EXECUTE ON FUNCTION public.get_public_content() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_content() TO anon;
GRANT  EXECUTE ON FUNCTION public.get_public_content() TO authenticated;

-- ─── 3. Smoke-test ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.get_public_content() INTO v_result;
  RAISE NOTICE 'get_public_content() OK — events: %, generated_at: %',
    jsonb_array_length(v_result->'events'),
    v_result->>'generated_at';
END $$;

-- =============================================================================
-- End of migration 014
-- =============================================================================

NOTIFY pgrst, 'reload schema';
