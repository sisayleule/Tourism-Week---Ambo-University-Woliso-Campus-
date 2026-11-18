-- =============================================================================
-- Migration 003 — Content tables
--   events, announcements, news, gallery_items,
--   sponsors, committee_members, faqs
-- Depends on : 001_enums_and_triggers.sql, 002_core_tables.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. events
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id      uuid          NOT NULL REFERENCES public.editions (id) ON DELETE CASCADE,

  -- Unique within an edition (slug must be unique globally for clean URLs).
  slug            text          NOT NULL UNIQUE,

  -- Day number within the festival (1–7 to allow future editions > 5 days).
  day             smallint      NOT NULL CHECK (day BETWEEN 1 AND 7),

  session         public.session_type NOT NULL,

  -- Exact times are optional; the programme sometimes states "Morning" only.
  start_time      time,
  end_time        time,

  -- Ordering within a day-session pair.
  sort_order      integer       NOT NULL DEFAULT 0,

  -- Required internationalised title; am/om optional (frontend falls back to en).
  title_i18n      jsonb         NOT NULL CHECK ((title_i18n->>'en') <> ''),
  description_i18n jsonb,
  venue_name_i18n jsonb,

  category        public.event_category  NOT NULL,
  venue_type      public.venue_type      NOT NULL DEFAULT 'campus',

  -- May point to an existing repo path like /assets/aistudio/... or a Storage URL.
  image_url       text,

  featured        boolean       NOT NULL DEFAULT false,
  status          public.event_status   NOT NULL DEFAULT 'scheduled',
  state           public.content_state  NOT NULL DEFAULT 'draft',

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.events IS
  'Individual programme activities within an edition. '
  'state=draft hides the event from the public; state=published shows it. '
  'status tracks the real-time operational state (scheduled/live/delayed/cancelled).';

COMMENT ON COLUMN public.events.image_url IS
  'May be a repo-relative path (/assets/aistudio/...) or a Supabase Storage URL. '
  'Do not move or rename existing repo images.';

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for the most common query: all published events for the current edition.
CREATE INDEX IF NOT EXISTS idx_events_edition_state
  ON public.events (edition_id, state);

CREATE INDEX IF NOT EXISTS idx_events_day_session
  ON public.events (edition_id, day, session, sort_order);

-- -----------------------------------------------------------------------------
-- 2. announcements
--    Announcements go live immediately (default state = 'published').
--    Organisers can create and delete them; admins can do everything.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  message_i18n jsonb      NOT NULL CHECK ((message_i18n->>'en') <> ''),

  type        public.announcement_type NOT NULL DEFAULT 'normal',

  -- Optional link target (e.g. '/schedule').
  link        text,

  -- Visibility window.  NULL expires_at means no expiry.
  starts_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,

  -- Default published so staff can post instantly without a publish step.
  state       public.content_state NOT NULL DEFAULT 'published',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- expires_at must be after starts_at when both are set.
  CONSTRAINT chk_announcement_window
    CHECK (expires_at IS NULL OR expires_at > starts_at)
);

COMMENT ON TABLE public.announcements IS
  'Site-wide banners shown to all visitors. '
  'state defaults to published so staff can post immediately. '
  'expires_at=NULL means the announcement never auto-expires.';

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for the public query: active, published, non-expired announcements.
CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON public.announcements (state, starts_at, expires_at);

-- -----------------------------------------------------------------------------
-- 3. news
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.news (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional link to an edition; NULL = general departmental news.
  edition_id      uuid      REFERENCES public.editions (id) ON DELETE SET NULL,

  slug            text      NOT NULL UNIQUE,

  title_i18n      jsonb     NOT NULL CHECK ((title_i18n->>'en') <> ''),
  summary_i18n    jsonb,
  body_i18n       jsonb,

  category        public.news_category NOT NULL DEFAULT 'general',

  cover_image_url text,

  -- Pinned articles appear at the top of the news list.
  pinned          boolean   NOT NULL DEFAULT false,

  -- Explicitly set when the article is published.
  published_at    timestamptz,

  state           public.content_state NOT NULL DEFAULT 'draft',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news IS
  'News articles and press releases. '
  'published_at is set by staff when they change state to ''published''.';

CREATE TRIGGER trg_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_news_state_pinned
  ON public.news (state, pinned DESC, published_at DESC);

-- -----------------------------------------------------------------------------
-- 4. gallery_items
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gallery_items (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),

  edition_id  uuid      NOT NULL REFERENCES public.editions (id) ON DELETE CASCADE,

  -- Optional link to a specific event.
  event_id    uuid      REFERENCES public.events (id) ON DELETE SET NULL,

  -- 'photo' or 'video' only.
  media_type  text      NOT NULL CHECK (media_type IN ('photo', 'video')),

  -- Primary asset URL (Storage URL or repo path for existing images).
  image_url   text      NOT NULL,

  -- Only populated for video items.
  video_url   text,

  caption_i18n jsonb,

  -- The calendar year the photo/video was taken (for archive filtering).
  year        integer   NOT NULL CHECK (year BETWEEN 2000 AND 2100),

  -- Category matches event_category so gallery can be filtered by programme area.
  category    text      NOT NULL CHECK (category IN (
    'culture', 'sports', 'academic', 'competition', 'community', 'highlights'
  )),

  sort_order  integer   NOT NULL DEFAULT 0,
  state       public.content_state NOT NULL DEFAULT 'draft',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gallery_items IS
  'Photos and videos from the current and past editions. '
  'image_url may point to existing repo assets (/assets/aistudio/...) — '
  'do not rename or move those files.';

CREATE TRIGGER trg_gallery_items_updated_at
  BEFORE UPDATE ON public.gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_gallery_edition_state
  ON public.gallery_items (edition_id, state, sort_order);

-- -----------------------------------------------------------------------------
-- 5. sponsors
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sponsors (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),

  name        text      NOT NULL,
  logo_url    text,
  website_url text,

  tier        public.sponsor_tier NOT NULL DEFAULT 'partner',

  sort_order  integer   NOT NULL DEFAULT 0,
  state       public.content_state NOT NULL DEFAULT 'draft',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sponsors IS
  'Sponsoring organisations. logo_url is NULL until the official asset is uploaded.';

CREATE TRIGGER trg_sponsors_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_sponsors_tier_state
  ON public.sponsors (tier, state, sort_order);

-- -----------------------------------------------------------------------------
-- 6. committee_members
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.committee_members (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name   text    NOT NULL,
  role_i18n   jsonb   NOT NULL CHECK ((role_i18n->>'en') <> ''),

  photo_url   text,

  sort_order  integer NOT NULL DEFAULT 0,
  state       public.content_state NOT NULL DEFAULT 'draft',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.committee_members IS
  'Organizing committee members shown on the About page. '
  'photo_url is NULL until real photos are uploaded to the committee bucket.';

CREATE TRIGGER trg_committee_members_updated_at
  BEFORE UPDATE ON public.committee_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. faqs
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.faqs (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  question_i18n jsonb NOT NULL CHECK ((question_i18n->>'en') <> ''),
  answer_i18n   jsonb NOT NULL CHECK ((answer_i18n->>'en') <> ''),

  sort_order  integer NOT NULL DEFAULT 0,
  state       public.content_state NOT NULL DEFAULT 'draft',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.faqs IS
  'Frequently asked questions shown on the Contact page.';

CREATE TRIGGER trg_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- End of migration 003
-- =============================================================================
