-- =============================================================================
-- Migration 009 — Add status_note_i18n to events
-- Depends on : 003_content_tables.sql
--
-- Purpose: Allow organisers to attach a short localised note when an event
-- is Delayed (e.g. "Starts 30 minutes late").  The column is also visible for
-- any other status so notes can explain a cancellation, etc.
--
-- Rules:
--   • Nullable — no note is the common case.
--   • English key is required when a note is present (enforced by app logic,
--     not a DB CHECK, because the row may be updated piecemeal).
--   • Cleared by the Live Control UI when status returns to Scheduled or Live.
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS status_note_i18n jsonb NULL;

COMMENT ON COLUMN public.events.status_note_i18n IS
  'Short optional localised note attached to a non-scheduled status '
  '(e.g. "Starts 30 minutes late" for Delayed). '
  'English key required when a note is present. '
  'Cleared by Live Control when status returns to scheduled or live. '
  'Shape: {"en": "...", "am": "...", "om": "..."} — am/om optional.';

-- =============================================================================
-- End of migration 009
-- =============================================================================

NOTIFY pgrst, 'reload schema';
