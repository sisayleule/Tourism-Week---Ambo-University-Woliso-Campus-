-- =============================================================================
-- Migration 023 — Allow staff (organizers) to delete sponsors
--
-- The original policy "sponsors: admin delete" restricted DELETE to is_admin()
-- only. The organizer portal shows the delete button to all staff (canDelete=true)
-- but the DB was silently rejecting the DELETE due to this RLS restriction,
-- making it appear broken.
--
-- This migration replaces the admin-only delete policy with a staff-level one,
-- matching the same pattern used for announcements (staff may delete).
--
-- Safe to re-run: DROP POLICY IF EXISTS is idempotent.
-- =============================================================================

-- Drop the old admin-only delete policy
DROP POLICY IF EXISTS "sponsors: admin delete" ON public.sponsors;

-- Allow any staff member (organizer or admin) to delete sponsors
CREATE POLICY "sponsors: staff delete"
  ON public.sponsors FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );
