-- =============================================================================
-- Migration 007 — Storage buckets and access policies
-- Depends on : 005_security_functions.sql
--
-- Five public-read buckets (no auth required to download an asset):
--   event-images   — hero images for programme activities
--   gallery        — full-resolution gallery photos
--   news-covers    — news article cover images
--   sponsor-logos  — sponsor and partner logo images
--   committee      — committee member headshots
--
-- Upload rules:
--   Allowed MIME types : image/jpeg, image/png, image/webp, image/avif
--   Max file size      : 5 MB  (5 * 1024 * 1024 = 5,242,880 bytes)
--   No SVG accepted    (SVGs can carry executable content)
--
-- Write permissions:
--   Staff (is_staff()) : upload (INSERT) and replace (UPDATE) objects
--   Admin (is_admin()) : additionally may delete objects
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bucket creation
-- storage.buckets is a Supabase-managed table; we use INSERT … ON CONFLICT
-- so the migration is idempotent (safe to re-run).
-- public = true means the GET /object/public/<bucket>/… endpoint works without
-- a JWT, which is what the public website uses to display images.
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'event-images',
    'event-images',
    true,
    5242880,   -- 5 MB
    ARRAY['image/jpeg','image/png','image/webp','image/avif']
  ),
  (
    'gallery',
    'gallery',
    true,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp','image/avif']
  ),
  (
    'news-covers',
    'news-covers',
    true,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp','image/avif']
  ),
  (
    'sponsor-logos',
    'sponsor-logos',
    true,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp','image/avif']
  ),
  (
    'committee',
    'committee',
    true,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp','image/avif']
  )
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Storage RLS policies
-- storage.objects already has RLS enabled by Supabase.
-- We create policies per-bucket using the bucket_id column.
-- Policy naming: "<bucket>: <role> <action>"
-- -----------------------------------------------------------------------------

-- ── event-images ─────────────────────────────────────────────────────────────

-- Anyone can download (SELECT) from public buckets.
CREATE POLICY "event-images: public read"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'event-images' );

-- Staff can upload new objects.
CREATE POLICY "event-images: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-images'
    AND (SELECT public.is_staff())
  );

-- Staff can overwrite / update existing objects (e.g. replace a photo).
CREATE POLICY "event-images: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  ( bucket_id = 'event-images' AND (SELECT public.is_staff()) )
  WITH CHECK ( bucket_id = 'event-images' AND (SELECT public.is_staff()) );

-- Only admins can delete objects.
CREATE POLICY "event-images: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'event-images' AND (SELECT public.is_admin()) );

-- ── gallery ───────────────────────────────────────────────────────────────────

CREATE POLICY "gallery: public read"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'gallery' );

CREATE POLICY "gallery: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'gallery' AND (SELECT public.is_staff()) );

CREATE POLICY "gallery: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  ( bucket_id = 'gallery' AND (SELECT public.is_staff()) )
  WITH CHECK ( bucket_id = 'gallery' AND (SELECT public.is_staff()) );

CREATE POLICY "gallery: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'gallery' AND (SELECT public.is_admin()) );

-- ── news-covers ───────────────────────────────────────────────────────────────

CREATE POLICY "news-covers: public read"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'news-covers' );

CREATE POLICY "news-covers: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'news-covers' AND (SELECT public.is_staff()) );

CREATE POLICY "news-covers: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  ( bucket_id = 'news-covers' AND (SELECT public.is_staff()) )
  WITH CHECK ( bucket_id = 'news-covers' AND (SELECT public.is_staff()) );

CREATE POLICY "news-covers: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'news-covers' AND (SELECT public.is_admin()) );

-- ── sponsor-logos ─────────────────────────────────────────────────────────────

CREATE POLICY "sponsor-logos: public read"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'sponsor-logos' );

CREATE POLICY "sponsor-logos: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'sponsor-logos' AND (SELECT public.is_staff()) );

CREATE POLICY "sponsor-logos: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  ( bucket_id = 'sponsor-logos' AND (SELECT public.is_staff()) )
  WITH CHECK ( bucket_id = 'sponsor-logos' AND (SELECT public.is_staff()) );

CREATE POLICY "sponsor-logos: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'sponsor-logos' AND (SELECT public.is_admin()) );

-- ── committee ─────────────────────────────────────────────────────────────────

CREATE POLICY "committee: public read"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'committee' );

CREATE POLICY "committee: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'committee' AND (SELECT public.is_staff()) );

CREATE POLICY "committee: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  ( bucket_id = 'committee' AND (SELECT public.is_staff()) )
  WITH CHECK ( bucket_id = 'committee' AND (SELECT public.is_staff()) );

CREATE POLICY "committee: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'committee' AND (SELECT public.is_admin()) );

-- =============================================================================
-- End of migration 007
-- =============================================================================
