-- =============================================================================
-- Migration 004 — Messages, site_settings, activity_log and audit trigger
-- Depends on : 001_enums_and_triggers.sql, 002_core_tables.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. messages
--    Written by anonymous visitors (contact form, sponsor inquiry).
--    The anon role may INSERT but never SELECT; staff SELECT and UPDATE (handle).
--    DELETE is admin only.
--    Length constraints guard against abuse.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.messages (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- 'contact' = contact form, 'sponsor_inquiry' = sponsorship interest form.
  kind            text        NOT NULL CHECK (kind IN ('contact', 'sponsor_inquiry')),

  -- Visitor-supplied fields.
  name            text        NOT NULL CHECK (char_length(name)         BETWEEN 1 AND 200),
  organisation    text             CHECK (char_length(organisation)     <= 500),
  email           text        NOT NULL CHECK (char_length(email)        BETWEEN 3 AND 320),
  phone           text             CHECK (char_length(phone)            <= 30),
  message         text        NOT NULL CHECK (char_length(message)      BETWEEN 1 AND 5000),

  -- Staff workflow fields.
  handled         boolean     NOT NULL DEFAULT false,
  handled_by      uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  handled_at      timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
  -- No updated_at — messages are append-only from the visitor side.
);

COMMENT ON TABLE public.messages IS
  'Contact and sponsor inquiry submissions from public visitors. '
  'Visitors INSERT with returning:''minimal'' — they can never read messages. '
  'Staff UPDATE to mark handled. Only admins may DELETE.';

-- Index for the staff dashboard query: unhandled messages first.
CREATE INDEX IF NOT EXISTS idx_messages_handled
  ON public.messages (handled, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. site_settings
--    Exactly one row (enforced by the boolean primary key trick).
--    Only admins may INSERT / UPDATE / DELETE.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_settings (
  -- The boolean PK ensures at most one row can ever exist.
  id              boolean     PRIMARY KEY DEFAULT true CHECK (id = true),

  contact_email   text,
  -- Phone deliberately NULL until the department supplies a real number.
  phone           text,

  address_i18n    jsonb,

  -- e.g. {"telegram": "https://t.me/...", "facebook": "..."}
  social          jsonb,

  footer_text_i18n jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_settings IS
  'Single-row table for global site configuration. '
  'phone is intentionally NULL until the department provides a verified number. '
  'Only admins can modify this table.';

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. activity_log
--    Immutable audit trail.  Written ONLY by the log_activity() trigger
--    function (SECURITY DEFINER).  No role may UPDATE or DELETE log rows.
--    Only admins may SELECT.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_log (
  -- bigint identity makes log IDs monotonically increasing.
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- The authenticated staff member who caused the change (NULL = system).
  actor_id    uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- e.g. 'INSERT', 'UPDATE', 'DELETE'
  action      text        NOT NULL,

  -- Which content table was touched.
  table_name  text        NOT NULL,

  -- String representation of the affected row's primary key.
  row_id      text        NOT NULL,

  -- Full before/after snapshots for recovery purposes.
  old_data    jsonb,
  new_data    jsonb,

  created_at  timestamptz NOT NULL DEFAULT now()
  -- No updated_at — log rows are strictly immutable.
);

COMMENT ON TABLE public.activity_log IS
  'Immutable audit log written only by the log_activity() SECURITY DEFINER trigger. '
  'No role may UPDATE or DELETE rows. Only admins may SELECT. '
  'Use old_data / new_data JSON snapshots to restore accidentally changed content.';

-- Index for the admin audit trail query.
CREATE INDEX IF NOT EXISTS idx_activity_log_table_row
  ON public.activity_log (table_name, row_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_actor
  ON public.activity_log (actor_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. log_activity() TRIGGER FUNCTION
--    Attached (AFTER INSERT OR UPDATE OR DELETE) to:
--      profiles, editions, events, announcements, news,
--      gallery_items, sponsors, committee_members, faqs, site_settings
--    SECURITY DEFINER so it can always INSERT into activity_log regardless of
--    the calling user's RLS permissions.
--    search_path = '' avoids schema-injection attacks.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row_id  text;
  v_old     jsonb;
  v_new     jsonb;
BEGIN
  -- Determine the primary key value as a string.
  -- All logged tables use either uuid (id) or boolean (site_settings).
  IF TG_OP = 'DELETE' THEN
    v_row_id := OLD.id::text;
    v_old    := to_jsonb(OLD);
    v_new    := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_row_id := NEW.id::text;
    v_old    := NULL;
    v_new    := to_jsonb(NEW);
  ELSE  -- UPDATE
    v_row_id := NEW.id::text;
    v_old    := to_jsonb(OLD);
    v_new    := to_jsonb(NEW);
  END IF;

  INSERT INTO public.activity_log (actor_id, action, table_name, row_id, old_data, new_data)
  VALUES (
    -- auth.uid() is NULL when the trigger fires via service_role (seed / migration);
    -- that is acceptable — it means "system action".
    (SELECT auth.uid()),
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_old,
    v_new
  );

  RETURN NULL;  -- AFTER trigger; return value is ignored.
END;
$$;

COMMENT ON FUNCTION public.log_activity() IS
  'SECURITY DEFINER audit trigger. Writes one row to activity_log for every '
  'INSERT, UPDATE or DELETE on the attached content tables. '
  'auth.uid() is NULL during seed/migration runs (logged as system action).';

-- Attach log_activity to every content table.
-- Each CREATE TRIGGER is wrapped in a DO block so the migration is
-- re-runnable without "trigger already exists" errors.

DO $$ BEGIN
  CREATE TRIGGER trg_log_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_editions
    AFTER INSERT OR UPDATE OR DELETE ON public.editions
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_events
    AFTER INSERT OR UPDATE OR DELETE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_announcements
    AFTER INSERT OR UPDATE OR DELETE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_news
    AFTER INSERT OR UPDATE OR DELETE ON public.news
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_gallery_items
    AFTER INSERT OR UPDATE OR DELETE ON public.gallery_items
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_sponsors
    AFTER INSERT OR UPDATE OR DELETE ON public.sponsors
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_committee_members
    AFTER INSERT OR UPDATE OR DELETE ON public.committee_members
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_faqs
    AFTER INSERT OR UPDATE OR DELETE ON public.faqs
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_site_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.site_settings
    FOR EACH ROW EXECUTE FUNCTION public.log_activity();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration 004
-- =============================================================================
