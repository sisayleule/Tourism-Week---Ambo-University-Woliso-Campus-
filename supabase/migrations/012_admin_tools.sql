-- =============================================================================
-- Migration 012 — Admin tools: edition management, activity-log restore, backup
-- Depends on : 002_core_tables.sql, 003_content_tables.sql,
--              004_messages_settings_audit.sql, 005_security_functions.sql,
--              006_rls_policies.sql, 009_event_status_note.sql, 011_pipeline.sql
--
-- All functions are SECURITY DEFINER with SET search_path = '' and an
-- is_admin() check as the first statement.  EXECUTE is granted to
-- authenticated only — anon can never call these.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. site_state.last_backup_at
--    Set by the admin Backup page (via the service role, through an RPC) after
--    a backup ZIP is downloaded.  Readable by staff (existing SELECT policy).
-- -----------------------------------------------------------------------------

ALTER TABLE public.site_state
  ADD COLUMN IF NOT EXISTS last_backup_at timestamptz;

COMMENT ON COLUMN public.site_state.last_backup_at IS
  'Timestamp of the last backup ZIP download. Set by the admin Backup page. '
  'Used to show a reminder banner when the last backup is older than 30 days '
  'or when the current edition has ended without a post-event backup.';

-- -----------------------------------------------------------------------------
-- 2. set_current_edition(p_edition_id uuid)
--    Atomically sets is_current = false on all editions and true on the chosen
--    one.  Admin only.
-- -----------------------------------------------------------------------------

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

  -- Verify the target edition exists.
  IF NOT EXISTS (SELECT 1 FROM public.editions WHERE id = p_edition_id) THEN
    RAISE EXCEPTION 'Edition not found: %', p_edition_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.editions SET is_current = false WHERE is_current = true;
  UPDATE public.editions SET is_current = true  WHERE id = p_edition_id;
END;
$$;

COMMENT ON FUNCTION public.set_current_edition(uuid) IS
  'Atomically switches the current edition. Admin only. '
  'SECURITY DEFINER so it bypasses RLS on the editions table.';

REVOKE EXECUTE ON FUNCTION public.set_current_edition(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_current_edition(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. create_edition_from_template(
--      p_source uuid, p_number int, p_slug text,
--      p_title_i18n jsonb, p_theme_i18n jsonb, p_venue_i18n jsonb,
--      p_start date, p_end date)
--
--    Creates a new edition (is_current = false) and copies the source edition's
--    events as DRAFTS (state 'draft', status 'scheduled', status_note_i18n NULL).
--    Events whose day exceeds the new edition's number of days are skipped.
--    Returns: { new_edition_id, copied, skipped }
--    Admin only.
-- -----------------------------------------------------------------------------

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
  v_admin_ok    boolean;
  v_source      public.editions%ROWTYPE;
  v_new_id      uuid;
  v_days        int;
  v_copied      int := 0;
  v_skipped     int := 0;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validate arguments.
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

  -- Verify the source edition exists.
  SELECT * INTO v_source FROM public.editions WHERE id = p_source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source edition not found: %', p_source
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Verify slug uniqueness.
  IF EXISTS (SELECT 1 FROM public.editions WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already exists: %', p_slug
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Number of days in the new edition (end - start + 1).
  v_days := (p_end - p_start) + 1;

  -- Create the new edition (is_current = false).
  INSERT INTO public.editions (
    number, slug,
    edition_name_i18n, title_i18n, theme_i18n,
    sub_theme_i18n, venue_i18n, date_range_display_i18n,
    start_date, end_date,
    start_date_ec, end_date_ec,
    stats, is_current
  ) VALUES (
    p_number, p_slug,
    p_title_i18n, p_title_i18n, p_theme_i18n,
    v_source.sub_theme_i18n, p_venue_i18n, NULL,
    p_start, p_end,
    NULL, NULL,
    NULL, false
  )
  RETURNING id INTO v_new_id;

  -- Copy events from the source edition as drafts.
  -- Keep: day, session, sort_order, titles, descriptions, category, venue
  --        fields, featured, image_url.
  -- Set:  state = 'draft', status = 'scheduled', status_note_i18n = NULL.
  -- Skip: events whose day > v_days.
  -- Slug: made unique by prefixing with the new edition slug + '-'.

  INSERT INTO public.events (
    edition_id, slug, day, session,
    start_time, end_time, sort_order,
    title_i18n, description_i18n, venue_name_i18n,
    category, venue_type, image_url, featured,
    status, state
  )
  SELECT
    v_new_id,
    -- Make slug unique: prefix with new edition slug.
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

  -- Count skipped events (day > v_days).
  SELECT count(*) INTO v_skipped
  FROM public.events
  WHERE edition_id = p_source
    AND day > v_days;

  RETURN jsonb_build_object(
    'new_edition_id', v_new_id,
    'copied', v_copied,
    'skipped', v_skipped
  );
END;
$$;

COMMENT ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date) IS
  'Creates a new edition from a template and copies events as drafts. Admin only. '
  'Events whose day exceeds the new edition length are skipped. '
  'Returns { new_edition_id, copied, skipped }.';

REVOKE EXECUTE ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_edition_from_template(uuid,int,text,jsonb,jsonb,jsonb,date,date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. restore_log_entry(p_log_id bigint)
--
--    Restores a row from an activity_log entry.  Admin only.
--
--    action UPDATE  → re-applies old_data to the row (undo the change).
--    action DELETE  → re-inserts old_data (recreate the deleted row).
--    action INSERT  → sets state = 'draft' where a state column exists
--                     (unpublish the item); refuses for tables without state.
--
--    Fixed whitelist of table names (never concatenates unchecked input).
--    The existing log_activity trigger logs the restore as a new entry.
--
--    Returns: { success: true, message: '...' } or raises with a friendly error.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_log_entry(p_log_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log          public.activity_log%ROWTYPE;
  v_table        text;
  v_action       text;
  v_row_id       text;
  v_old          jsonb;
  v_set_clause   text;
  v_col          text;
  v_has_state    boolean;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Fetch the log entry.
  SELECT * INTO v_log FROM public.activity_log WHERE id = p_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log entry not found.'
      USING ERRCODE = 'not_found';
  END IF;

  v_table  := v_log.table_name;
  v_action := v_log.action;
  v_row_id := v_log.row_id;
  v_old    := v_log.old_data;

  -- ── Whitelist check (never concatenate unchecked input) ──────────────────
  IF v_table NOT IN (
    'events', 'announcements', 'news', 'gallery_items',
    'sponsors', 'committee_members', 'faqs',
    'editions', 'site_settings'
  ) THEN
    RAISE EXCEPTION 'Table % is not restorable.', v_table
      USING ERRCODE = 'check_violation';
  END IF;

  -- profiles is explicitly excluded — it must never appear here, but we
  -- double-check just in case a future migration adds a log trigger.
  IF v_table = 'profiles' THEN
    RAISE EXCEPTION 'Profiles cannot be restored from the activity log.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Determine whether the table has a state column ──────────────────────
  v_has_state := v_table IN (
    'events', 'announcements', 'news', 'gallery_items',
    'sponsors', 'committee_members', 'faqs'
  );

  -- ── UPDATE: re-apply old_data to the row ─────────────────────────────────
  IF v_action = 'UPDATE' THEN
    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Cannot restore: no old_data for this UPDATE entry.'
        USING ERRCODE = 'no_data';
    END IF;

    -- Build the SET clause from old_data keys (exclude id).
    v_set_clause := '';
    FOR v_col IN SELECT jsonb_object_keys(v_old) LOOP
      IF v_col <> 'id' THEN
        IF v_set_clause <> '' THEN
          v_set_clause := v_set_clause || ', ';
        END IF;
        v_set_clause := v_set_clause || format('%I = restored.%I', v_col, v_col);
      END IF;
    END LOOP;

    IF v_set_clause = '' THEN
      RAISE EXCEPTION 'No columns to restore.'
        USING ERRCODE = 'no_data';
    END IF;

    -- Use a CTE with jsonb_populate_record for type-safe values.
    -- The table name comes from the whitelist (safe for dynamic SQL).
    BEGIN
      EXECUTE format(
        'WITH restored AS ('
          'SELECT * FROM jsonb_populate_record(null::public.%s, $1)'
        ') '
        'UPDATE public.%I t SET %s '
        'FROM restored '
        'WHERE t.id::text = $2',
        v_table, v_table, v_set_clause
      )
      USING v_old, v_row_id;
    EXCEPTION
      WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Cannot restore: a referenced row no longer exists (foreign key problem).'
          USING ERRCODE = 'foreign_key_violation';
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Cannot restore: the row ID does not match an existing row.'
          USING ERRCODE = 'invalid_text_representation';
      WHEN check_violation THEN
        RAISE EXCEPTION 'Cannot restore: a value violates a database constraint (check).'
          USING ERRCODE = 'check_violation';
      WHEN invalid_parameter_value THEN
        RAISE EXCEPTION 'Cannot restore: an enum or type value is no longer valid.'
          USING ERRCODE = 'invalid_parameter_value';
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Cannot restore UPDATE: %', SQLERRM
          USING ERRCODE = 'internal_error';
    END;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot restore: the row no longer exists (it may have been deleted).'
        USING ERRCODE = 'not_found';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', format('Restored %s to its previous state.', v_table)
    );

  -- ── DELETE: re-insert old_data ────────────────────────────────────────────
  ELSIF v_action = 'DELETE' THEN
    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Cannot restore: no old_data for this DELETE entry.'
        USING ERRCODE = 'no_data';
    END IF;

    BEGIN
      EXECUTE format(
        'INSERT INTO public.%I '
        'SELECT * FROM jsonb_populate_record(null::public.%s, $1)',
        v_table, v_table
      )
      USING v_old;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'Cannot restore: a row with this ID already exists.'
          USING ERRCODE = 'unique_violation';
      WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Cannot restore: a referenced parent row no longer exists (foreign key problem).'
          USING ERRCODE = 'foreign_key_violation';
      WHEN check_violation THEN
        RAISE EXCEPTION 'Cannot restore: a value violates a database constraint (check).'
          USING ERRCODE = 'check_violation';
      WHEN invalid_parameter_value THEN
        RAISE EXCEPTION 'Cannot restore: an enum or type value is no longer valid.'
          USING ERRCODE = 'invalid_parameter_value';
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Cannot restore DELETE: %', SQLERRM
          USING ERRCODE = 'internal_error';
    END;

    RETURN jsonb_build_object(
      'success', true,
      'message', format('Recreated the deleted %s row.', v_table)
    );

  -- ── INSERT: set state = 'draft' (unpublish) ──────────────────────────────
  ELSIF v_action = 'INSERT' THEN
    IF NOT v_has_state THEN
      RAISE EXCEPTION 'Cannot restore an INSERT on %: this table has no state column to reset.', v_table
        USING ERRCODE = 'check_violation';
    END IF;

    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET state = ''draft'' WHERE id::text = $1',
        v_table
      )
      USING v_row_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Cannot restore INSERT: %', SQLERRM
          USING ERRCODE = 'internal_error';
    END;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot restore: the row no longer exists (it may have been deleted).'
        USING ERRCODE = 'not_found';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', format('Unpublished the %s item (set to draft).', v_table)
    );

  ELSE
    RAISE EXCEPTION 'Unknown action: %', v_action
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.restore_log_entry(bigint) IS
  'Restores a row from an activity_log entry. Admin only. '
  'UPDATE → re-applies old_data; DELETE → re-inserts old_data; '
  'INSERT → sets state=''draft'' where a state column exists. '
  'Uses a fixed whitelist of table names. '
  'The existing log_activity trigger logs the restore as a new entry.';

REVOKE EXECUTE ON FUNCTION public.restore_log_entry(bigint) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.restore_log_entry(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. purge_activity_log(p_older_than_days int)
--
--    Deletes activity_log rows older than the given number of days.
--    Admin only.  Refuses values below 180 days.
--    This is the ONLY way to delete log rows (no DELETE policy exists on the
--    table; this SECURITY DEFINER function bypasses RLS).
--    Returns: { deleted: N }
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_activity_log(p_older_than_days int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_older_than_days IS NULL OR p_older_than_days < 180 THEN
    RAISE EXCEPTION 'Minimum retention is 180 days. Requested: % days',
      COALESCE(p_older_than_days, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.activity_log
  WHERE created_at < (now() - (p_older_than_days || ' days')::interval);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('deleted', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.purge_activity_log(int) IS
  'Deletes activity_log rows older than N days (min 180). Admin only. '
  'This is the only way to delete log rows.';

REVOKE EXECUTE ON FUNCTION public.purge_activity_log(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.purge_activity_log(int) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. set_last_backup_at()
--    Sets site_state.last_backup_at = now().  Called by the admin Backup page
--    (via the frontend service layer using the caller's own JWT — the existing
--    site_state SELECT policy allows staff to read; this function handles the
--    UPDATE since no UPDATE policy exists on site_state).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_last_backup_at()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'Permission denied: staff role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.site_state
  SET last_backup_at = now()
  WHERE id = true;
END;
$$;

COMMENT ON FUNCTION public.set_last_backup_at() IS
  'Records the time of the last backup download. Staff (organizer or admin) '
  'can call this from the admin Backup page.';

REVOKE EXECUTE ON FUNCTION public.set_last_backup_at() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_last_backup_at() TO authenticated;

-- =============================================================================
-- End of migration 012
-- =============================================================================

NOTIFY pgrst, 'reload schema';
