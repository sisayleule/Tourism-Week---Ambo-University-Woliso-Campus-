-- =============================================================================
-- Migration 001 — Enums and shared trigger
-- Project : Ambo University Woliso Campus — Tourism Week
-- Applied : once on a fresh Supabase project
-- Idempotent: yes (uses DO $$ … IF NOT EXISTS pattern for enums)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS
--    All enum types are created inside the public schema so that tables and
--    functions in public can reference them without schema-qualifying.
--    The DO block makes the migration safe to re-run (no error if type exists).
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  -- Staff role — only two values; no public / visitor role exists.
  CREATE TYPE public.app_role AS ENUM ('organizer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Generic publish lifecycle used by most content tables.
  CREATE TYPE public.content_state AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Per-event operational status (separate from content_state).
  CREATE TYPE public.event_status AS ENUM (
    'scheduled',
    'live',
    'delayed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Event programme category.
  CREATE TYPE public.event_category AS ENUM (
    'culture',
    'sports',
    'academic',
    'competition',
    'community'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Whether an event is held on campus, in town, or across both.
  CREATE TYPE public.venue_type AS ENUM ('campus', 'town', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Morning vs afternoon session slot.
  CREATE TYPE public.session_type AS ENUM ('morning', 'afternoon');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Urgency level for site-wide announcements.
  CREATE TYPE public.announcement_type AS ENUM ('normal', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Editorial category for news articles.
  CREATE TYPE public.news_category AS ENUM (
    'department',
    'sports_community',
    'academic',
    'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Sponsorship tier hierarchy.
  -- "title" is the top tier (the spec uses 'platinum' in seed data but
  -- specifies 'title' in the enum; we map platinum→title in seed.sql).
  CREATE TYPE public.sponsor_tier AS ENUM (
    'title',
    'gold',
    'silver',
    'partner'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. set_updated_at TRIGGER FUNCTION
--    Attached to every table that has an `updated_at` column.
--    Uses search_path = '' so it never accidentally resolves to the wrong schema.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Automatically stamps updated_at = now() on every UPDATE. '
  'Attach via CREATE TRIGGER … BEFORE UPDATE ON <table>.';

-- =============================================================================
-- End of migration 001
-- =============================================================================
