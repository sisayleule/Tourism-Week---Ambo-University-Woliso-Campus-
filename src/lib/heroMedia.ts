/**
 * heroMedia.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for default hero media paths.
 *
 * File names are versioned (v2) so that a name change guarantees a cache miss
 * on CDN and browser — no need to bust query strings.
 *
 * hero-720-v2.mp4 ≈ 2 MB  — 1280×720, served to desktop (≥ 768 px viewport)
 * hero-480-v2.mp4 ≈ 1 MB  — 854×480,  served to phones (< 768 px) and slow nets
 *
 * Both files are produced by ffmpeg from source-media/ originals.
 * Run `node scripts/check-hero-media.mjs` to verify size + moov position.
 *
 * The old 22.8 MB video.mp4 is archived in source-media/ and is NOT deployed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Vite-hashed poster — resolved at build time, correct in dev and prod.
import heroPosterImg from '../assets/images/lalibela_church_1793725586137.jpg';

/** Default hero poster (content-hashed Vite import, resolved at build time). */
export const DEFAULT_HERO_POSTER: string = heroPosterImg;

/**
 * Default desktop hero video.
 * Served from /videos/ — Vercel adds Accept-Ranges + Cache-Control headers
 * for this path (see vercel.json /videos/* rule).
 */
export const DEFAULT_HERO_720 = '/videos/hero-720-v2.mp4';

/**
 * Default mobile / save-data hero video.
 * Used when viewport ≤ 767 px, saveData is true, or effectiveType ≤ 3g.
 */
export const DEFAULT_HERO_480 = '/videos/hero-480-v2.mp4';
