-- =============================================================================
-- Migration 006 — Row Level Security policies
-- Depends on : 002_core_tables.sql, 003_content_tables.sql,
--              004_messages_settings_audit.sql, 005_security_functions.sql
--
-- Design rules (from spec):
--   anon + authenticated  SELECT  published rows only (with window check for announcements)
--   staff (is_staff())    SELECT  all rows including drafts
--   staff                 INSERT + UPDATE on content tables
--   staff                 UPDATE messages (mark handled)
--   staff                 DELETE announcements only
--   admin (is_admin())    DELETE everything else
--   admin                 INSERT/UPDATE/DELETE editions, site_settings
--   profiles              staff reads own row; admin reads/updates all
--   messages              anon+authenticated INSERT only; staff SELECT
--   activity_log          admin SELECT only; nobody UPDATE/DELETE
--
-- All policies use (select auth.uid()) instead of auth.uid() directly so the
-- expression is evaluated once per statement rather than once per row.
--
-- Staff policies are written TO authenticated so they are NEVER evaluated
-- for the anon role, which keeps the anon query path fast and secure.
-- =============================================================================

-- ─── Helper: enable RLS on every table ───────────────────────────────────────

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: profiles
-- =============================================================================

-- A staff member can read their own profile row.
CREATE POLICY "profiles: staff reads own row"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND is_active = true
  );

-- Admins can read every profile (for the user management UI in Phase 2).
CREATE POLICY "profiles: admin reads all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- Admins can update any profile (to change role / is_active).
-- The guard_profile_role_change trigger provides the second line of defence.
CREATE POLICY "profiles: admin updates all"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

-- No direct INSERT — handle_new_user() trigger is the only insert path.
-- No DELETE — cascade from auth.users handles cleanup.

-- =============================================================================
-- TABLE: editions
-- =============================================================================

-- Everyone (anon + authenticated) can read editions.
CREATE POLICY "editions: public read"
  ON public.editions FOR SELECT
  USING (true);

-- Only admins may create a new edition.
CREATE POLICY "editions: admin insert"
  ON public.editions FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

-- Only admins may update edition details.
CREATE POLICY "editions: admin update"
  ON public.editions FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

-- Only admins may delete an edition.
CREATE POLICY "editions: admin delete"
  ON public.editions FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: events
-- =============================================================================

-- Public: published events only.
CREATE POLICY "events: public read published"
  ON public.events FOR SELECT
  USING ( state = 'published' );

-- Staff: see all rows including drafts.
CREATE POLICY "events: staff read all"
  ON public.events FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- Staff: create events.
CREATE POLICY "events: staff insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

-- Staff: update events (including publish / unpublish).
CREATE POLICY "events: staff update"
  ON public.events FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Admin only: delete events.
CREATE POLICY "events: admin delete"
  ON public.events FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: announcements
-- =============================================================================

-- Public: published announcements within their active time window.
CREATE POLICY "announcements: public read active"
  ON public.announcements FOR SELECT
  USING (
    state = 'published'
    AND starts_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Staff: see all announcements regardless of state or window.
CREATE POLICY "announcements: staff read all"
  ON public.announcements FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- Staff: create announcements.
CREATE POLICY "announcements: staff insert"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

-- Staff: update announcements.
CREATE POLICY "announcements: staff update"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Exception to the general delete rule: ANY staff member may delete announcements.
CREATE POLICY "announcements: staff delete"
  ON public.announcements FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- =============================================================================
-- TABLE: news
-- =============================================================================

CREATE POLICY "news: public read published"
  ON public.news FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "news: staff read all"
  ON public.news FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "news: staff insert"
  ON public.news FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "news: staff update"
  ON public.news FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "news: admin delete"
  ON public.news FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: gallery_items
-- =============================================================================

CREATE POLICY "gallery_items: public read published"
  ON public.gallery_items FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "gallery_items: staff read all"
  ON public.gallery_items FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "gallery_items: staff insert"
  ON public.gallery_items FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "gallery_items: staff update"
  ON public.gallery_items FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "gallery_items: admin delete"
  ON public.gallery_items FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: sponsors
-- =============================================================================

CREATE POLICY "sponsors: public read published"
  ON public.sponsors FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "sponsors: staff read all"
  ON public.sponsors FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "sponsors: staff insert"
  ON public.sponsors FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "sponsors: staff update"
  ON public.sponsors FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "sponsors: admin delete"
  ON public.sponsors FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: committee_members
-- =============================================================================

CREATE POLICY "committee_members: public read published"
  ON public.committee_members FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "committee_members: staff read all"
  ON public.committee_members FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "committee_members: staff insert"
  ON public.committee_members FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "committee_members: staff update"
  ON public.committee_members FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "committee_members: admin delete"
  ON public.committee_members FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: faqs
-- =============================================================================

CREATE POLICY "faqs: public read published"
  ON public.faqs FOR SELECT
  USING ( state = 'published' );

CREATE POLICY "faqs: staff read all"
  ON public.faqs FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

CREATE POLICY "faqs: staff insert"
  ON public.faqs FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "faqs: staff update"
  ON public.faqs FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

CREATE POLICY "faqs: admin delete"
  ON public.faqs FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: messages
--   Visitors INSERT only (no SELECT, no UPDATE, no DELETE).
--   Staff SELECT + UPDATE (to mark handled).
--   Admin DELETE.
--   The client must use { returning: 'minimal' } on insert.
-- =============================================================================

-- anon and authenticated may INSERT (both roles needed because the contact
-- form is used by anonymous visitors on the public site).
CREATE POLICY "messages: anon insert"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "messages: authenticated insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Staff can read all messages (to process them in the admin panel).
CREATE POLICY "messages: staff read"
  ON public.messages FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_staff()) );

-- Staff can update messages (e.g. set handled=true, handled_by, handled_at).
CREATE POLICY "messages: staff update"
  ON public.messages FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_staff()) )
  WITH CHECK ( (SELECT public.is_staff()) );

-- Only admins may permanently delete messages.
CREATE POLICY "messages: admin delete"
  ON public.messages FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: site_settings
--   Everyone can read (used by the public site footer, contact page).
--   Only admins can write.
-- =============================================================================

CREATE POLICY "site_settings: public read"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "site_settings: admin insert"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.is_admin()) );

CREATE POLICY "site_settings: admin update"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING  ( (SELECT public.is_admin()) )
  WITH CHECK ( (SELECT public.is_admin()) );

CREATE POLICY "site_settings: admin delete"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- =============================================================================
-- TABLE: activity_log
--   Only admins may SELECT.
--   Nobody may INSERT, UPDATE, or DELETE (only log_activity() SECURITY DEFINER
--   function inserts rows; no policy is needed for that path because
--   SECURITY DEFINER bypasses RLS by running as the function owner).
-- =============================================================================

CREATE POLICY "activity_log: admin read"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING ( (SELECT public.is_admin()) );

-- Explicitly deny UPDATE and DELETE for all roles by not creating those policies.
-- RLS default-deny means the absence of a policy = no access.

-- =============================================================================
-- End of migration 006
-- =============================================================================
