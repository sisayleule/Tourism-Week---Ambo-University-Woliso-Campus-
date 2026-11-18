-- =============================================================================
-- Migration 005 — Security functions and role-guard trigger
-- Depends on : 001_enums_and_triggers.sql, 002_core_tables.sql
--
-- Functions are SECURITY DEFINER so they run as the function owner (postgres)
-- and can read profiles without being blocked by RLS on that table.
-- search_path = '' prevents schema-injection attacks.
-- EXECUTE is granted to the `authenticated` role only — anon never calls these.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. is_staff()
--    Returns TRUE when the calling user has an active row in public.profiles.
--    Used as the gate for organizer-level RLS policies.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE         -- result is constant within a single SQL statement
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id        = (SELECT auth.uid())
      AND  is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_staff() IS
  'Returns TRUE if the current authenticated user has an active staff profile. '
  'Used as the gate in organizer-level RLS policies. '
  'SECURITY DEFINER so it bypasses RLS on profiles itself.';

-- Revoke from PUBLIC first (belt-and-suspenders: Supabase grants to public by default).
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. is_admin()
--    Returns TRUE when the calling user is an active staff member with
--    role = 'admin'.  Used as the gate for admin-only RLS policies.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id        = (SELECT auth.uid())
      AND  role      = 'admin'
      AND  is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns TRUE if the current authenticated user is an active admin. '
  'Used as the gate in admin-only RLS policies (DELETE, editions, site_settings). '
  'SECURITY DEFINER so it bypasses RLS on profiles itself.';

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. guard_profile_role_change()  — TRIGGER FUNCTION
--    Prevents any UPDATE of profiles.role or profiles.is_active unless the
--    caller is an admin.  This is a second line of defence; RLS policies (in
--    migration 006) also restrict UPDATE on profiles, but a defence-in-depth
--    approach ensures privilege escalation is impossible even if a policy is
--    accidentally misconfigured.
--
--    The trigger fires BEFORE UPDATE so it can RAISE EXCEPTION before the
--    change reaches the table.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Allow the change only if the calling user is an admin.
  -- auth.uid() is NULL during migration / service_role operations — allow those
  -- unconditionally so the seed and admin bootstrap scripts work.
  IF (SELECT auth.uid()) IS NOT NULL THEN
    IF (NEW.role      IS DISTINCT FROM OLD.role     )
    OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
    THEN
      IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION
          'Permission denied: only an admin can change profiles.role or profiles.is_active.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_role_change() IS
  'BEFORE UPDATE trigger on profiles. Raises an error if a non-admin tries to '
  'change the role or is_active flag. auth.uid() NULL (service_role / migration) '
  'is allowed through so the admin bootstrap UPDATE works.';

-- Attach the guard trigger to profiles.
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
-- End of migration 005
-- =============================================================================
