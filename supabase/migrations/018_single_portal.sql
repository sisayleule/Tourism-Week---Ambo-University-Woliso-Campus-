-- =============================================================================
-- Migration 018 — Single organizer portal
-- Removes the admin-portal privilege split from content operations.
--
-- Design after this migration:
--   is_staff() (any active staff member) gates all content CRUD including DELETE.
--   is_admin() still gates: profiles.role / profiles.is_active changes,
--             purge_activity_log, and direct SQL access to editions DELETE.
--   Nobody deletes an edition through the API (unpublish instead).
--   The activity-log triggers remain unchanged on every table.
--
-- Depends on: 005, 006, 007, 012, 013, 016, 017
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Content table DELETE policies → is_staff()
--    Replace every "admin delete" policy with a "staff delete" policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- events
DROP POLICY IF EXISTS "events: admin delete" ON public.events;
CREATE POLICY "events: staff delete"
  ON public.events FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- news
DROP POLICY IF EXISTS "news: admin delete" ON public.news;
CREATE POLICY "news: staff delete"
  ON public.news FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- gallery_items
DROP POLICY IF EXISTS "gallery_items: admin delete" ON public.gallery_items;
CREATE POLICY "gallery_items: staff delete"
  ON public.gallery_items FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- sponsors
DROP POLICY IF EXISTS "sponsors: admin delete" ON public.sponsors;
CREATE POLICY "sponsors: staff delete"
  ON public.sponsors FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- committee_members
DROP POLICY IF EXISTS "committee_members: admin delete" ON public.committee_members;
CREATE POLICY "committee_members: staff delete"
  ON public.committee_members FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- faqs
DROP POLICY IF EXISTS "faqs: admin delete" ON public.faqs;
CREATE POLICY "faqs: staff delete"
  ON public.faqs FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- messages (delete)
DROP POLICY IF EXISTS "messages: admin delete" ON public.messages;
CREATE POLICY "messages: staff delete"
  ON public.messages FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- page_sections (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'page_sections' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "page_sections: admin delete" ON public.page_sections;
    EXECUTE $pol$
      CREATE POLICY "page_sections: staff delete"
        ON public.page_sections FOR DELETE
        TO authenticated
        USING ( (SELECT public.is_staff()) )
    $pol$;
  END IF;
END $$;

-- page_section_items (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'page_section_items' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "page_section_items: admin delete" ON public.page_section_items;
    EXECUTE $pol$
      CREATE POLICY "page_section_items: staff delete"
        ON public.page_section_items FOR DELETE
        TO authenticated
        USING ( (SELECT public.is_staff()) )
    $pol$;
  END IF;
END $$;

-- edition_days (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'edition_days' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "edition_days: admin delete" ON public.edition_days;
    EXECUTE $pol$
      CREATE POLICY "edition_days: staff delete"
        ON public.edition_days FOR DELETE
        TO authenticated
        USING ( (SELECT public.is_staff()) )
    $pol$;
  END IF;
END $$;

-- committee_member_contacts (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'committee_member_contacts' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "committee_member_contacts: admin delete" ON public.committee_member_contacts;
    EXECUTE $pol$
      CREATE POLICY "committee_member_contacts: staff delete"
        ON public.committee_member_contacts FOR DELETE
        TO authenticated
        USING ( (SELECT public.is_staff()) )
    $pol$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. site_settings INSERT and UPDATE → is_staff()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "site_settings: admin insert" ON public.site_settings;
CREATE POLICY "site_settings: staff insert"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

DROP POLICY IF EXISTS "site_settings: admin update" ON public.site_settings;
CREATE POLICY "site_settings: staff update"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- site_settings delete stays admin-only (no UI trigger)
-- (pre-existing policy left in place)

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. activity_log SELECT → is_staff()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "activity_log: admin read" ON public.activity_log;
CREATE POLICY "activity_log: staff read"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. editions INSERT and UPDATE → is_staff()
--    DELETE stays admin-only (no UI; use unpublish instead)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "editions: admin insert" ON public.editions;
CREATE POLICY "editions: staff insert"
  ON public.editions FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

DROP POLICY IF EXISTS "editions: admin update" ON public.editions;
CREATE POLICY "editions: staff update"
  ON public.editions FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- editions: admin delete remains unchanged (admin/SQL only, no portal UI)

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Storage policies — content bucket DELETEs → is_staff()
-- ─────────────────────────────────────────────────────────────────────────────

-- Only update policies that exist and use is_admin().
-- Storage policies live in storage.objects; check and recreate if present.

DO $$
DECLARE
  v_buckets text[] := ARRAY['gallery', 'news', 'sponsors', 'committee', 'site-content', 'events'];
  v_bucket  text;
BEGIN
  FOREACH v_bucket IN ARRAY v_buckets LOOP
    -- Remove old admin-only delete policy if present
    DELETE FROM storage.policies
    WHERE bucket_id = v_bucket
      AND name ILIKE '%admin%delete%';

    -- Upsert staff delete policy
    IF NOT EXISTS (
      SELECT 1 FROM storage.policies
      WHERE bucket_id = v_bucket AND name = v_bucket || ': staff delete'
    ) THEN
      INSERT INTO storage.policies (name, bucket_id, operation, definition)
      VALUES (
        v_bucket || ': staff delete',
        v_bucket,
        'DELETE',
        '(SELECT public.is_staff())'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Update SECURITY DEFINER functions: set_current_edition → is_staff()
--    restore_log_entry → is_staff()
--    system_check → is_staff()
--    purge_activity_log stays admin/SQL only (no UI)
-- ─────────────────────────────────────────────────────────────────────────────

-- set_current_edition
CREATE OR REPLACE FUNCTION public.set_current_edition(p_edition_id uuid)
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

  IF NOT EXISTS (SELECT 1 FROM public.editions WHERE id = p_edition_id) THEN
    RAISE EXCEPTION 'Edition not found: %', p_edition_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.editions SET is_current = false WHERE is_current = true;
  UPDATE public.editions SET is_current = true  WHERE id = p_edition_id;
END;
$$;

-- restore_log_entry
CREATE OR REPLACE FUNCTION public.restore_log_entry(p_log_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry  public.activity_log%ROWTYPE;
  v_table  text;
  v_id     uuid;
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'Permission denied: staff role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_entry FROM public.activity_log WHERE id = p_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log entry not found: %', p_log_id;
  END IF;

  v_table := v_entry.table_name;

  -- Only allow restoration of content tables (not profiles/messages)
  IF v_table NOT IN ('events','announcements','news','gallery_items','sponsors',
                     'committee_members','faqs','editions','site_settings',
                     'page_sections','page_section_items') THEN
    RAISE EXCEPTION 'Table "%" cannot be restored from the activity log.', v_table
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Profiles are explicitly blocked
  IF v_table = 'profiles' THEN
    RAISE EXCEPTION 'Profiles cannot be restored from the activity log.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_id := (COALESCE(v_entry.old_data, v_entry.new_data) ->> 'id')::uuid;

  IF v_entry.action = 'UPDATE' THEN
    -- Restore previous values
    EXECUTE format('UPDATE public.%I SET (%s) = ROW(%s) WHERE id = $1',
      v_table,
      (SELECT string_agg(key, ', ') FROM jsonb_each(v_entry.old_data)),
      (SELECT string_agg('$2->>' || quote_literal(key), ', ') FROM jsonb_each(v_entry.old_data))
    ) USING v_id, v_entry.old_data;
    RETURN jsonb_build_object('success', true, 'message', format('Restored %s to its previous state.', v_table));

  ELSIF v_entry.action = 'DELETE' THEN
    -- Re-insert deleted row
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(null::public.%I, $1) ON CONFLICT (id) DO NOTHING',
      v_table, v_table
    ) USING v_entry.old_data;
    RETURN jsonb_build_object('success', true, 'message', format('Recreated deleted %s.', v_table));

  ELSIF v_entry.action = 'INSERT' THEN
    -- Unpublish (set state = draft) the inserted row
    EXECUTE format('UPDATE public.%I SET state = ''draft'' WHERE id = $1', v_table) USING v_id;
    RETURN jsonb_build_object('success', true, 'message', format('Unpublished %s (set to draft).', v_table));

  ELSE
    RAISE EXCEPTION 'Unknown action: %', v_entry.action;
  END IF;
END;
$$;

-- system_check (update if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'system_check') THEN
    -- Replace the is_admin() check with is_staff()
    -- The function body varies by version; redefine with is_staff() check
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.system_check()
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $body$
      BEGIN
        IF NOT (SELECT public.is_staff()) THEN
          RAISE EXCEPTION 'Permission denied: staff role required.'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
        RETURN jsonb_build_object(
          'db_reachable', true,
          'checked_at',   now()
        );
      END;
      $body$
    $fn$;
  END IF;
END $$;

-- purge_activity_log stays admin/SQL only — NOT updated.
-- No UI exposes purge to organizers.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. profiles — keep as is
--    Only admin or SQL can change profiles.role and profiles.is_active.
--    The guard_profile_role_change trigger is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- (No changes needed — existing policies and trigger already enforce this.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- End of migration 018
-- =============================================================================
