/**
 * scripts/csp-config.mjs — Single source of truth for Content-Security-Policy.
 *
 * Imported by scripts/generate-vercel-json.mjs, which writes vercel.json.
 * Never edit vercel.json directly — edit this file and regenerate:
 *
 *   node scripts/generate-vercel-json.mjs
 *
 * ─── CSP_MODE ────────────────────────────────────────────────────────────────
 * 'enforce'     → Content-Security-Policy           (blocks violations)
 * 'report-only' → Content-Security-Policy-Report-Only (logs, never blocks)
 *
 * To relax for debugging, set CSP_MODE = 'report-only'.
 * To tighten before a release, set CSP_MODE = 'enforce'.
 *
 * ─── Directive reference ─────────────────────────────────────────────────────
 *
 * 'self'
 *   All assets (HTML, JS, CSS, images, fonts) served from the same origin.
 *
 * 'unsafe-inline' in script-src
 *   Required by: React event handlers (compiled to inline attributes by some
 *   React versions), Vite HMR in dev (not in production build). The theme-init
 *   script was inlined — it is now external (public/theme-init.js) so this
 *   directive is only needed for Vite's production inline chunk manifests.
 *   TODO: when this site moves to a server-rendered or edge-function host,
 *   replace 'unsafe-inline' with per-request 'nonce-<base64>' values.
 *
 * 'unsafe-inline' in style-src
 *   Required by: Tailwind CSS v4 (injects critical CSS), React inline styles.
 *   Cannot be removed without switching to a CSS-in-JS solution that supports
 *   nonces, or Tailwind's static-extraction build (not yet stable).
 *
 * https://fonts.googleapis.com / https://fonts.gstatic.com
 *   Google Fonts: stylesheet loaded from googleapis.com, font files from
 *   gstatic.com. Both must be explicitly allowed.
 *
 * https://*.supabase.co / https://*.supabase.in
 *   Supabase REST API, Auth, Storage, and Realtime endpoints.
 *   The *.supabase.in pattern covers the newer EU/regional endpoints.
 *
 * wss://*.supabase.co / wss://*.supabase.in
 *   Supabase Realtime WebSocket connections (live announcements, site state).
 *
 * blob:
 *   Required by: video poster object URLs, canvas-to-blob for image upload
 *   processing (ImageUpload.tsx → imageResize.ts).
 *
 * data:
 *   Required by: Vite inlines tiny assets as data: URIs during build
 *   (favicon, tiny placeholder images). Restricted to img-src only.
 *
 * media-src
 *   Required by: hero video element (<video src=...>), video poster.
 *   Supabase storage for user-uploaded videos (future feature).
 *
 * frame-ancestors 'none'
 *   Prevents the site being embedded in an iframe on any domain.
 *   Equivalent to X-Frame-Options: DENY.
 */

export const CSP_MODE = 'enforce';

/** Directives shared by all routes. */
const SHARED = {
  'default-src':     ["'self'"],
  'script-src':      ["'self'", "'unsafe-inline'"],
  'style-src':       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src':        ["'self'", 'https://fonts.gstatic.com'],
  'img-src':         ["'self'", 'blob:', 'data:', 'https://*.supabase.co', 'https://*.supabase.in'],
  'media-src':       ["'self'", 'blob:', 'https://*.supabase.co', 'https://*.supabase.in'],
  'connect-src':     ["'self'", 'https://*.supabase.co', 'https://*.supabase.in',
                      'wss://*.supabase.co', 'wss://*.supabase.in'],
  'frame-ancestors': ["'none'"],
};

/** Serialise a directive map to a single CSP header value string. */
export function buildCsp(directives = SHARED) {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ') + ';';
}

export const PUBLIC_CSP   = buildCsp(SHARED);
export const STAFF_CSP    = buildCsp(SHARED);  // same policy; staff portal uses identical origins
