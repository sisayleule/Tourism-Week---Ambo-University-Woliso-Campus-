-- supabase/fixes/restore_page_sections_staff_write.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 tightened page_sections and page_section_items write access
-- to admin-only. This breaks the "Website Text" editor in the Organizer Portal,
-- which is used by organizer-role staff.
--
-- This fix restores INSERT/UPDATE/DELETE to all staff (organizer + admin).
-- Admin-delete on page_sections itself is kept — only admins can delete
-- entire sections. Organizers can still delete individual items (cards).
--
-- Run once in the Supabase SQL editor, then apply as migration 018 or later.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── page_sections ─────────────────────────────────────────────────────────────

-- Drop the admin-only policies from migration 015
DROP POLICY IF EXISTS "page_sections: admin insert" ON public.page_sections;
DROP POLICY IF EXISTS "page_sections: admin update" ON public.page_sections;

-- Restore staff (organizer + admin) write access
CREATE POLICY "page_sections: staff insert"
  ON public.page_sections FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "page_sections: staff update"
  ON public.page_sections FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- ── page_section_items ────────────────────────────────────────────────────────

-- Drop the admin-only policies from migration 015
DROP POLICY IF EXISTS "page_section_items: admin insert" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: admin update" ON public.page_section_items;
DROP POLICY IF EXISTS "page_section_items: admin delete" ON public.page_section_items;

-- Restore staff write access
CREATE POLICY "page_section_items: staff insert"
  ON public.page_section_items FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "page_section_items: staff update"
  ON public.page_section_items FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "page_section_items: staff delete"
  ON public.page_section_items FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );
