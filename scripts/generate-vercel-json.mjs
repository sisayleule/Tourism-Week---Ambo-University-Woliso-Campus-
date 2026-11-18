/**
 * scripts/generate-vercel-json.mjs
 *
 * Writes vercel.json from scripts/csp-config.mjs (the single source of truth
 * for Content-Security-Policy directives).
 *
 * Usage:
 *   node scripts/generate-vercel-json.mjs
 *
 * To switch between enforce and report-only:
 *   Edit CSP_MODE in scripts/csp-config.mjs, then re-run this script.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP_MODE, PUBLIC_CSP, STAFF_CSP } from './csp-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const publicCspKey  = CSP_MODE === 'enforce'
  ? 'Content-Security-Policy'
  : 'Content-Security-Policy-Report-Only';

const vercelConfig = {
  rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  redirects: [
    { source: '/admin',      destination: '/staff/login', permanent: false },
    { source: '/admin/(.*)', destination: '/staff/login', permanent: false },
  ],
  headers: [
    {
      source: '/staff/(.*)',
      headers: [
        { key: 'X-Robots-Tag',          value: 'noindex, nofollow' },
        { key: 'Cache-Control',          value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        { key: 'X-Frame-Options',        value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        // Staff always enforced — never report-only
        { key: 'Content-Security-Policy', value: STAFF_CSP },
      ],
    },
    {
      source: '/sitemap.xml',
      headers: [
        { key: 'Content-Type',  value: 'application/xml' },
        { key: 'Cache-Control', value: 'public, max-age=3600' },
      ],
    },
    {
      source: '/content-meta.json',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
      ],
    },
    {
      source: '/assets/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'Accept-Ranges', value: 'bytes' },
      ],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        // Public: enforce or report-only depending on CSP_MODE in csp-config.mjs
        { key: publicCspKey, value: PUBLIC_CSP },
      ],
    },
  ],
};

const outPath = join(ROOT, 'vercel.json');
writeFileSync(outPath, JSON.stringify(vercelConfig, null, 2) + '\n', 'utf-8');

console.log(`\n✅  vercel.json written (CSP_MODE=${CSP_MODE})`);
console.log(`   Staff:  Content-Security-Policy (always enforced)`);
console.log(`   Public: ${publicCspKey}`);
console.log(`\n   CSP value:\n   ${PUBLIC_CSP}\n`);
