-- =============================================================================
-- Migration 020 — Publish all draft committee members
--
-- committee_members were inserted with state = 'draft' (the old default in
-- Step3Committees.tsx) so they were invisible on the public About page.
-- This migration publishes every member that belongs to a published edition.
--
-- Safe to re-run: UPDATE … WHERE state = 'draft' is a no-op once all rows
-- are already published.
-- =============================================================================

UPDATE public.committee_members cm
SET    state      = 'published',
       updated_at = now()
WHERE  cm.state = 'draft'
  AND  EXISTS (
    SELECT 1
    FROM   public.editions e
    WHERE  e.id    = cm.edition_id
      AND  e.state = 'published'
  );
