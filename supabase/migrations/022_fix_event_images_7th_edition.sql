-- =============================================================================
-- Migration 022 — Fix event image_url values for 7th-edition events
--
-- Assigns real event photos (committed to public/assets/events/) to each
-- event by its exact slug. Photos were provided by the organiser.
--
-- Mapping:
--   Day 1 morning  — Green Tourism / Cleaning Campaign  → event-cleaning-campaign.jpg
--   Day 2 morning  — Carnival / Cultural Show           → Carnival (Cultural Show).jpg
--   Day 3 morning  — Great Run                          → event-great-run.jpg
--   Day 3 afternoon — Miss & Mr. Tourism Pageant        → event-miss-mr-tourism.jpg
--   Day 4 morning  — Academic Seminar / Awards          → event-seminar-awards.png
--   Day 4 afternoon — Football Match                    → event-football.jpg.png
--   Day 5 morning  — Guest Tour / Eco-Tourism           → event-guest-tour.jpg
--   Day 6          — Closing Ceremony                   → End of the Programme — Closing Ceremony.png
--
-- Safe to re-run: WHERE slug = '...' is idempotent.
-- =============================================================================

-- Day 1 — Green Tourism (Cleaning Campaign) within Campus and town
UPDATE public.events
SET    image_url  = '/assets/events/event-cleaning-campaign.jpg',
       updated_at = now()
WHERE  slug = 'green-tourism-cleaning-campaign-within-campus-and-town';

-- Day 2 — Carnival / Cultural Show / Handcrafts / Music / Dance
UPDATE public.events
SET    image_url  = '/assets/events/Carnival (Cultural Show).jpg',
       updated_at = now()
WHERE  slug = 'carnival-cultural-show-handcrafts-exhibition-music-festival-dance-contest';

-- Day 3 morning — Great Run for Ambo University Woliso Campus
UPDATE public.events
SET    image_url  = '/assets/events/event-great-run.jpg',
       updated_at = now()
WHERE  slug = 'great-run-for-ambo-university-woliso-campus';

-- Day 3 afternoon — Miss & Mr. Tourism Pageant
UPDATE public.events
SET    image_url  = '/assets/events/event-miss-mr-tourism.jpg',
       updated_at = now()
WHERE  slug = '7-annual-tourism-week-miss-mr-tourism-pageant';

-- Day 4 morning — Academic Seminar, Destination Promotion, Interdepartmental Contests & Awards
UPDATE public.events
SET    image_url  = '/assets/events/event-seminar-awards.png',
       updated_at = now()
WHERE  slug = '7-annual-tourism-week-seminar-tourism-promotion-competitions-awards';

-- Day 4 afternoon — Staff Friendly Football Match
UPDATE public.events
SET    image_url  = '/assets/events/event-football.jpg.png',
       updated_at = now()
WHERE  slug = '7-annual-tourism-week-football-academic-vs-administrative-staff';

-- Day 5 morning — Guest Tour to Regional Eco-Tourism & Heritage Sites
UPDATE public.events
SET    image_url  = '/assets/events/event-guest-tour.jpg',
       updated_at = now()
WHERE  slug = '7-annual-tourism-week-guest-tour-woliso-destinations';

-- Day 6 — End of the Programme / Closing Ceremony
UPDATE public.events
SET    image_url  = '/assets/events/End of the Programme — Closing Ceremony.png',
       updated_at = now()
WHERE  slug = 'end-of-the-programme-closing-ceremony';
