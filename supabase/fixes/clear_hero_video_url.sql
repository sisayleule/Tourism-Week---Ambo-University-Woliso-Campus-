-- supabase/fixes/clear_hero_video_url.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Clears hero_video_url on all editions so they fall back to the new default
-- compressed video (hero-720-v2.mp4 / hero-480-v2.mp4) served from /videos/.
--
-- Run this once after deploying the new video files:
--   psql $DATABASE_URL -f supabase/fixes/clear_hero_video_url.sql
-- or paste into the Supabase SQL editor.
--
-- Effect: hero_video_url = NULL causes the app to use DEFAULT_HERO_720 /
-- DEFAULT_HERO_480 from heroMedia.ts instead of a Supabase Storage URL.
-- ─────────────────────────────────────────────────────────────────────────────

update public.editions
set    hero_video_url = null
where  hero_video_url is not null;
