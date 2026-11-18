-- =============================================================================
-- Migration 002 — Core tables: profiles, editions, edition_public view
-- Depends on : 001_enums_and_triggers.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles
--    One row per auth user.  Role assignment NEVER reads from user-editable
--    metadata; it is always written by the server-side trigger below.
--    The trigger is created here because it acts on auth.users which exists
--    from the start in every Supabase project.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  -- Primary key mirrors auth.users(id) exactly.
  id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,

  full_name   text,

  -- Role is set by the handle_new_user trigger; only admins may change it
  -- via the role-guard function (migration 005).
  role        public.app_role NOT NULL DEFAULT 'organizer',

  -- Soft-disable a staff account without deleting it.
  is_active   boolean     NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'One row per invited staff member. Role is always "organizer" on creation; '
  'an admin must manually promote to "admin". Visitors never have profiles.';

-- Stamp updated_at automatically.
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile with role='organizer' whenever auth.users gains a row.
-- SECURITY DEFINER so the trigger can write to public.profiles without the
-- calling user needing INSERT permission (invite flow runs as service_role).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    -- Prefer display_name from metadata if the admin set it during invite,
    -- fall back to email prefix.  Role is intentionally hard-coded here —
    -- never read from NEW.raw_user_meta_data to prevent privilege escalation.
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'organizer'
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent re-runs
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a profiles row with role=organizer when a new auth user is inserted. '
  'Role is NEVER read from user metadata to prevent privilege escalation.';

-- Attach the trigger to auth.users.
-- "IF NOT EXISTS" is not supported for triggers before PG 17; use DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. editions
--    One row per annual event cycle.  Only one row may have is_current = true
--    (enforced by a partial unique index).
--    There is NO stored `status` column — computed status lives in the
--    edition_public view (see section 3).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.editions (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-facing edition number (e.g. 5 for the 5th annual edition).
  number          integer NOT NULL CHECK (number > 0),

  -- URL-safe identifier, e.g. "5th-annual-2017-ec".
  slug            text    NOT NULL UNIQUE,

  -- Internationalised strings stored as {"en": "...", "am": "...", "om": "..."}.
  -- The CHECK ensures the "en" key is always present and non-empty.
  title_i18n      jsonb   NOT NULL CHECK ((title_i18n->>'en') <> ''),
  theme_i18n      jsonb   NOT NULL CHECK ((theme_i18n->>'en') <> ''),
  sub_theme_i18n  jsonb,
  edition_name_i18n jsonb NOT NULL CHECK ((edition_name_i18n->>'en') <> ''),
  venue_i18n      jsonb   NOT NULL CHECK ((venue_i18n->>'en') <> ''),
  date_range_display_i18n jsonb,

  -- Gregorian calendar dates used for all date arithmetic.
  start_date      date    NOT NULL,
  end_date        date    NOT NULL CHECK (end_date >= start_date),

  -- Ethiopian Calendar display strings (not used in date logic).
  start_date_ec   text,
  end_date_ec     text,

  -- Nullable statistics; NULL = not yet known, hides the tile on the home page.
  -- Stored as jsonb to allow arbitrary keys without schema changes.
  -- Expected shape: {"expectedParticipants": "2,000+", "exhibitorsCount": "30+"}
  stats           jsonb,

  -- Only one edition may be current.  Enforced by the partial unique index below.
  is_current      boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.editions IS
  'One row per annual Tourism Week edition. '
  'is_current=true marks the edition shown on the public home page. '
  'Status (upcoming/live/past) is computed in the edition_public view, not stored.';

COMMENT ON COLUMN public.editions.stats IS
  'Nullable JSON blob. Keys: expectedParticipants, exhibitorsCount. '
  'Computed values (daysCount, activitiesCount) are derived at query time.';

-- Enforce at most one current edition.
CREATE UNIQUE INDEX IF NOT EXISTS udx_editions_one_current
  ON public.editions (is_current)
  WHERE is_current = true;

CREATE TRIGGER trg_editions_updated_at
  BEFORE UPDATE ON public.editions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. edition_public VIEW
--    Computes the live status in the Africa/Addis_Ababa timezone so the app
--    never needs to store or manually update a status field.
--
--    security_invoker = true  → the view runs as the calling user, meaning RLS
--    on the underlying editions table is still enforced.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.edition_public
WITH (security_invoker = true)
AS
SELECT
  e.*,
  -- Computed status using today's date in Addis Ababa time.
  CASE
    WHEN (now() AT TIME ZONE 'Africa/Addis_Ababa')::date < e.start_date
      THEN 'upcoming'
    WHEN (now() AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN e.start_date AND e.end_date
      THEN 'live'
    ELSE 'past'
  END AS status
FROM public.editions e;

COMMENT ON VIEW public.edition_public IS
  'Editions with a computed status column (upcoming/live/past) based on '
  'today''s date in Africa/Addis_Ababa timezone. '
  'security_invoker=true means RLS on editions is still applied.';

-- =============================================================================
-- End of migration 002
-- =============================================================================
