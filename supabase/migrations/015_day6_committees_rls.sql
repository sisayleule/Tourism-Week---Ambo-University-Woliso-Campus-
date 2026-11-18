-- =============================================================================
-- Migration 015 — Day 6, Committee keys, Messages/Site RLS tighten
--
-- Depends on: 001–014
--
-- Changes:
--   1. Set the current edition end_date to 2025-04-12 (Day 6 = Saturday).
--   2. Add committee_key, is_leader, edition_id to committee_members.
--   3. Add thumb_url (480px WebP) to gallery_items.
--   4. Tighten RLS: messages SELECT/UPDATE admin-only;
--      page_sections/page_section_items INSERT/UPDATE/DELETE admin-only.
-- =============================================================================

-- ─── 1. Extend edition end_date to Day 6 ─────────────────────────────────────

UPDATE public.editions
SET end_date = '2025-04-12'
WHERE is_current = true
  AND end_date = '2025-04-11';

-- Also update end_date_ec to reflect Miyazya 04, 2017
UPDATE public.editions
SET end_date_ec = '04/08/2017'
WHERE is_current = true
  AND end_date = '2025-04-12'
  AND (end_date_ec IS NULL OR end_date_ec = '03/08/2017');

-- ─── 2. Committee keys ───────────────────────────────────────────────────────
-- Five fixed committees; committee_key is one of these:
--   publicity_promotion
--   technical_physical
--   sponsorship_fundraising
--   award_beauty_contest
--   documentation

DO $$ BEGIN
  CREATE TYPE public.committee_key_enum AS ENUM (
    'publicity_promotion',
    'technical_physical',
    'sponsorship_fundraising',
    'award_beauty_contest',
    'documentation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.committee_members
  ADD COLUMN IF NOT EXISTS committee_key public.committee_key_enum,
  ADD COLUMN IF NOT EXISTS is_leader     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edition_id    uuid REFERENCES public.editions(id) ON DELETE SET NULL;

-- Back-fill edition_id from the current edition for existing rows
UPDATE public.committee_members
SET edition_id = (SELECT id FROM public.editions WHERE is_current = true LIMIT 1)
WHERE edition_id IS NULL;

-- Unique partial index: at most one leader per committee per edition
CREATE UNIQUE INDEX IF NOT EXISTS udx_committee_one_leader
  ON public.committee_members (committee_key, edition_id)
  WHERE is_leader = true;

-- ─── 3. Add thumb_url to gallery_items ───────────────────────────────────────

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS thumb_url text;

-- ─── 4. Tighten RLS ───────────────────────────────────────────────────────────

-- 4a. Messages: SELECT and UPDATE become admin-only
--     (INSERT stays anon via submit-message edge function; DELETE stays admin)

DROP POLICY IF EXISTS "messages: staff read" ON public.messages;
DROP POLICY IF EXISTS "messages: staff update handled" ON public.messages;
DROP POLICY IF EXISTS "messages: organizer read" ON public.messages;

CREATE POLICY "messages: admin read"
  ON public.messages FOR SELECT
  USING ( public.is_admin() );

CREATE POLICY "messages: admin update handled"
  ON public.messages FOR UPDATE
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- 4b. page_sections INSERT/UPDATE become admin-only
--     (organizers previously could insert/update)

DROP POLICY IF EXISTS "page_sections: staff insert" ON public.page_sections;
DROP POLICY IF EXISTS "page_sections: staff update" ON public.page_sections;
DROP POLICY IF EXISTS "page_sections: organizer insert" ON public.page_sections;
DROP POLICY IF EXISTS "page_sections: organizer update" ON public.page_sections;

CREATE POLICY "page_sections: admin insert"
  ON public.page_sections FOR INSERT
  WITH CHECK ( public.is_admin() );

CREATE POLICY "page_sections: admin update"
  ON public.page_sections FOR UPDATE
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- 4c. page_section_items INSERT/UPDATE/DELETE become admin-only

DROP POLICY IF EXISTS "page_section_items: staff insert" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: staff update" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: staff delete" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: organizer insert" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: organizer update" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: organizer delete" ON public.page_section_items;

CREATE POLICY "page_section_items: admin insert"
  ON public.page_section_items FOR INSERT
  WITH CHECK ( public.is_admin() );

CREATE POLICY "page_section_items: admin update"
  ON public.page_section_items FOR UPDATE
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

CREATE POLICY "page_section_items: admin delete"
  ON public.page_section_items FOR DELETE
  USING ( public.is_admin() );

-- =============================================================================
-- End of migration 015
-- =============================================================================

NOTIFY pgrst, 'reload schema';
