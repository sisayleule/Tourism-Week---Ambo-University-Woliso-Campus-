-- =============================================================================
-- Migration 008 — Staff auth additions
-- Depends on : 002_core_tables.sql, 005_security_functions.sql,
--              006_rls_policies.sql
--
-- Changes:
--   1. Add profiles.must_change_password boolean NOT NULL DEFAULT true
--   2. Add RLS policy: staff member may UPDATE their own row but ONLY the
--      columns full_name and must_change_password.
--   3. Extend guard_profile_role_change trigger to also reject changes to
--      any column other than full_name and must_change_password by
--      non-admins (the existing check for role/is_active remains intact).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add must_change_password column
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'When true the staff member must set a new password at next login. '
  'Set to true automatically on account creation; set to false by the '
  'frontend after the user completes the forced-password-change flow.';

-- -----------------------------------------------------------------------------
-- 2. RLS policy — staff member updates OWN row (full_name + must_change_password only)
--
--    The column restriction is enforced by the guard trigger (section 3)
--    rather than trying to list columns in the policy itself, because
--    Postgres RLS WITH CHECK cannot directly inspect which columns changed.
--    The RLS policy simply opens the UPDATE gate for the owner; the trigger
--    slams it shut for disallowed columns.
-- -----------------------------------------------------------------------------

-- Drop old policy first to allow idempotent re-runs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles: staff updates own row'
  ) THEN
    DROP POLICY "profiles: staff updates own row" ON public.profiles;
  END IF;
END $$;

CREATE POLICY "profiles: staff updates own row"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  ( id = (SELECT auth.uid()) AND is_active = true )
  WITH CHECK ( id = (SELECT auth.uid()) );

-- -----------------------------------------------------------------------------
-- 3. Extend guard_profile_role_change() to block non-admins from touching
--    any column other than full_name and must_change_password.
--
--    Rule summary (for a non-admin updating their OWN row):
--      ALLOWED   : full_name, must_change_password
--      FORBIDDEN : role, is_active, id, created_at, updated_at
--
--    Admins may change any column (existing behaviour preserved).
--    service_role / migration (auth.uid() IS NULL) is always allowed through.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Migrations and service_role operations (auth.uid() IS NULL) pass through
  -- unconditionally so bootstrap and seed scripts keep working.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins may change anything.
  IF (SELECT public.is_admin()) THEN
    RETURN NEW;
  END IF;

  -- Non-admins: block changes to role or is_active (original guard).
  IF (NEW.role      IS DISTINCT FROM OLD.role     )
  OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
  THEN
    RAISE EXCEPTION
      'Permission denied: only an admin can change profiles.role or profiles.is_active.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Non-admins: block changes to every column except full_name and
  -- must_change_password (the only two self-service fields).
  IF (NEW.id         IS DISTINCT FROM OLD.id        )
  OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
  THEN
    RAISE EXCEPTION
      'Permission denied: id and created_at are immutable.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- updated_at is auto-stamped by a separate trigger; the value the caller
  -- sends is irrelevant (it will be overwritten), so we do not block it here.

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_role_change() IS
  'BEFORE UPDATE trigger on profiles. '
  'Blocks non-admins from changing role, is_active, id, or created_at. '
  'Non-admins may only update full_name and must_change_password. '
  'auth.uid() NULL (service_role / migration) is always allowed through.';

-- The trigger was already created in migration 005; no need to recreate it.
-- The DO block below is a no-op guard in case this migration runs on a fresh db.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE  tgname   = 'trg_guard_profile_role'
      AND  tgrelid  = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_guard_profile_role
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();
  END IF;
END $$;

-- =============================================================================
-- End of migration 008
-- =============================================================================

NOTIFY pgrst, 'reload schema';
