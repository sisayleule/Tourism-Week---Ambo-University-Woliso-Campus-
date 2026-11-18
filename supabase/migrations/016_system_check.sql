-- =============================================================================
-- Migration 016 — System check function
-- Depends on : 001–015
--
-- Adds public.system_check() SECURITY DEFINER admin-only function that
-- returns one row per column, table, or function created by migrations
-- 008–015, with a boolean `present` flag.  Used by the Admin Dashboard
-- "System Check" card to detect missing updates.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.system_check()
RETURNS TABLE (
  migration  text,
  kind       text,   -- 'column' | 'table' | 'function' | 'type'
  item       text,   -- human-readable identifier
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
  RETURN QUERY SELECT '008', 'column', 'profiles.must_change_password',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'must_change_password'
    );

  -- ── Migration 009 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '009', 'column', 'events.status_note_i18n',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'
        AND column_name = 'status_note_i18n'
    );

  -- ── Migration 011 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '011', 'table', 'site_state',
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'site_state'
    );

  RETURN QUERY SELECT '011', 'table', 'message_rate_limits',
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'message_rate_limits'
    );

  RETURN QUERY SELECT '011', 'function', 'touch_site_state()',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'touch_site_state'
    );

  -- ── Migration 012 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '012', 'column', 'site_state.last_backup_at',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'site_state'
        AND column_name = 'last_backup_at'
    );

  RETURN QUERY SELECT '012', 'function', 'set_current_edition(uuid)',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'set_current_edition'
    );

  RETURN QUERY SELECT '012', 'function', 'create_edition_from_template()',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_edition_from_template'
    );

  RETURN QUERY SELECT '012', 'function', 'restore_log_entry(bigint)',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'restore_log_entry'
    );

  RETURN QUERY SELECT '012', 'function', 'purge_activity_log(int)',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'purge_activity_log'
    );

  RETURN QUERY SELECT '012', 'function', 'set_last_backup_at()',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'set_last_backup_at'
    );

  -- ── Migration 013 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '013', 'column', 'editions.state',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'state'
    );

  RETURN QUERY SELECT '013', 'column', 'editions.subtitle_i18n',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'subtitle_i18n'
    );

  RETURN QUERY SELECT '013', 'column', 'editions.theme_highlight_i18n',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'theme_highlight_i18n'
    );

  RETURN QUERY SELECT '013', 'column', 'editions.hero_poster_url',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'hero_poster_url'
    );

  RETURN QUERY SELECT '013', 'column', 'editions.hero_video_url',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'hero_video_url'
    );

  RETURN QUERY SELECT '013', 'column', 'editions.summary_i18n',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'summary_i18n'
    );

  RETURN QUERY SELECT '013', 'column', 'editions.cover_image_url',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'editions'
        AND column_name = 'cover_image_url'
    );

  RETURN QUERY SELECT '013', 'table', 'page_sections',
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'page_sections'
    );

  RETURN QUERY SELECT '013', 'table', 'page_section_items',
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'page_section_items'
    );

  -- ── Migration 014 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '014', 'function', 'get_public_content()',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_public_content'
    );

  -- ── Migration 015 ──────────────────────────────────────────────────────────
  RETURN QUERY SELECT '015', 'type', 'committee_key_enum',
    EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'committee_key_enum'
    );

  RETURN QUERY SELECT '015', 'column', 'committee_members.committee_key',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'committee_key'
    );

  RETURN QUERY SELECT '015', 'column', 'committee_members.is_leader',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'is_leader'
    );

  RETURN QUERY SELECT '015', 'column', 'committee_members.edition_id',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committee_members'
        AND column_name = 'edition_id'
    );

  RETURN QUERY SELECT '015', 'column', 'gallery_items.thumb_url',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'gallery_items'
        AND column_name = 'thumb_url'
    );

  -- ── Migration 016 (self) ───────────────────────────────────────────────────
  RETURN QUERY SELECT '016', 'function', 'system_check()',
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'system_check'
    );

END;
$$;

COMMENT ON FUNCTION public.system_check() IS
  'Returns one row per column, table, type, and function introduced by '
  'migrations 008–016.  present = false means that migration has not been '
  'applied.  Admin-only via is_admin() check.';

REVOKE EXECUTE ON FUNCTION public.system_check() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.system_check() TO authenticated;

-- Schema reload so PostgREST can call the new function immediately.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- End of migration 016
-- =============================================================================
