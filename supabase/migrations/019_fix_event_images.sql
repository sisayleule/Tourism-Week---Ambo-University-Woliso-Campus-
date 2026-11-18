-- =============================================================================
-- Migration 019 — Fix missing event image_url values
--
-- Some events were inserted without an image_url (NULL), which causes the
-- frontend to display a "[EVENT PHOTO]" placeholder instead of an image.
-- This migration backfills image_url using existing aistudio assets for all
-- known events that are missing one.
--
-- The mapping is: slug → /assets/aistudio/<image>.png
-- Images are static files committed under public/assets/aistudio/.
--
-- Depends on: 003 (events table)
-- Safe to re-run: UPDATE … WHERE image_url IS NULL is idempotent once filled.
-- =============================================================================

-- Cleaning Campaign (Day 1 morning) — green outdoor scene
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_fe8a90e0.png',
       updated_at = now()
WHERE  slug      = 'cleaning-campaign-campus-town'
  AND  image_url IS NULL;

-- Green Tourism / Cleaning Campaign within Campus and town (alternate slug)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_fe8a90e0.png',
       updated_at = now()
WHERE  slug LIKE '%cleaning%'
  AND  image_url IS NULL;

-- Street Cultural Show / Handcrafts / Music / Dance (Day 2 morning)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_c7963080.png',
       updated_at = now()
WHERE  slug      = 'street-cultural-show-handcrafts-music'
  AND  image_url IS NULL;

-- Tourism Academic Seminar (Day 2 afternoon)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_a7c5afdc.png',
       updated_at = now()
WHERE  slug      = 'tourism-academic-seminar'
  AND  image_url IS NULL;

-- Great Woliso Campus Road Run (Day 3 morning)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_9108d7cc.png',
       updated_at = now()
WHERE  slug      = 'great-campus-road-run'
  AND  image_url IS NULL;

-- Catch alternate slugs that contain "run" or "road-run"
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_9108d7cc.png',
       updated_at = now()
WHERE  (slug LIKE '%road-run%' OR slug LIKE '%great-run%')
  AND  image_url IS NULL;

-- Miss & Mr. Tourism Pageant (Day 3 afternoon)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_6eb824fd.png',
       updated_at = now()
WHERE  slug      = 'miss-mr-tourism-pageant'
  AND  image_url IS NULL;

-- Academic Seminar, Destination Promotion, Contests & Awards (Day 4 morning)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_25e4d059.png',
       updated_at = now()
WHERE  slug      = 'seminar-tourism-promotion-competitions-awards'
  AND  image_url IS NULL;

-- Staff Friendly Football Match (Day 4 afternoon)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_6eb824fd.png',
       updated_at = now()
WHERE  slug      = 'football-academic-vs-administrative-staff'
  AND  image_url IS NULL;

-- Guest Tour to Regional Eco-Tourism & Heritage Sites (Day 5 morning)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_7544bf77.png',
       updated_at = now()
WHERE  slug      = 'guest-tour-woliso-destinations'
  AND  image_url IS NULL;

-- End of Programme — Closing Ceremony (Day 5 afternoon)
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_c9b19ed8.png',
       updated_at = now()
WHERE  slug      = 'end-of-the-programme-closing'
  AND  image_url IS NULL;

-- ─── Catch-all: any remaining featured event still missing an image ──────────
-- Uses image_b3b470e9.png as a generic tourism-week fallback.
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_b3b470e9.png',
       updated_at = now()
WHERE  image_url IS NULL
  AND  featured  = true;

-- Non-featured events without an image get a neutral fallback too.
UPDATE public.events
SET    image_url  = '/assets/aistudio/image_b3b470e9.png',
       updated_at = now()
WHERE  image_url IS NULL;
