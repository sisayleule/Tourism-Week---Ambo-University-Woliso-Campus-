/**
 * seo-html.mjs — Post-build SEO static HTML generation (Part E).
 *
 * Runs automatically after `vite build` (postbuild npm script).
 * Reads the build-time snapshot and the built dist/index.html, then writes
 * per-page static HTML copies with correct <title>, description, Open Graph
 * and Twitter tags at:
 *
 *   dist/events/<slug>/index.html  — each published event
 *   dist/news/<slug>/index.html    — each published news item
 *
 * Includes JSON-LD Event structured data on event pages so links shared on
 * Telegram, WhatsApp and Facebook show a proper preview.
 *
 * The SPA rewrite in vercel.json handles everything else — these static files
 * take precedence for crawlers, while the SPA loads for interactive navigation.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local'), override: true });

const SITE_URL = (process.env.VITE_SITE_URL || process.env.APP_URL || process.env.VERCEL_URL || '')
  .replace(/^"|"$/g, '')
  .replace(/\/$/, '') || 'https://tourism-week.vercel.app';

const DIST = join(ROOT, 'dist');
const SNAPSHOT_PATH = join(ROOT, 'src', 'data', 'generated', 'snapshot.json');
const INDEX_PATH = join(DIST, 'index.html');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Regex matching /assets/aistudio/<name>.png */
const AISTUDIO_RE = /^\/assets\/aistudio\/(image_[0-9a-f]+)\.png$/i;

/**
 * Map a local image path to an absolute JPEG share URL.
 *
 * Rules (in priority order):
 *  1. aistudio PNGs  → /assets/share/<name>.jpg  (committed share JPEG)
 *  2. Already absolute https URL with JPEG/PNG extension → returned unchanged
 *  3. Already absolute https URL with WebP/other extension → map to default
 *     (Supabase storage images are WebP; social crawlers don't support WebP)
 *  4. Anything else → default share image
 *
 * Always returns an absolute HTTPS URL.
 */
function resolveShareImageUrl(path, siteUrl) {
  if (!path) return `${siteUrl}/assets/share/default.jpg`;

  // aistudio PNG → share JPEG
  const m = AISTUDIO_RE.exec(path);
  if (m) return `${siteUrl}/assets/share/${m[1]}.jpg`;

  // Already absolute — check extension
  if (path.startsWith('https://') || path.startsWith('http://')) {
    const ext = path.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return path;
    // WebP or unknown (Supabase uploads) → fall back to default
    return `${siteUrl}/assets/share/default.jpg`;
  }

  // Other relative path (shouldn't happen, but be safe)
  return `${siteUrl}/assets/share/default.jpg`;
}

// Keep old name as alias used by replaceMeta calls below
const resolveImageUrl = resolveShareImageUrl;

function replaceMeta(html, replacements) {
  let result = html;

  // Replace <title>
  if (replacements.title) {
    result = result.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(replacements.title)}</title>`);
  }

  // Replace or insert meta description
  if (replacements.description) {
    const descTag = `<meta name="description" content="${escapeHtml(replacements.description)}" />`;
    if (result.includes('name="description"')) {
      result = result.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, descTag);
    } else {
      result = result.replace('</head>', `${descTag}\n  </head>`);
    }
  }

  // Replace OG tags
  const ogReplacements = {
    'og:title': replacements.ogTitle || replacements.title,
    'og:description': replacements.ogDescription || replacements.description,
    'og:type': replacements.ogType || 'website',
    'og:image': replacements.ogImage,
    'og:image:width': replacements.ogImage ? '1200' : null,
    'og:image:height': replacements.ogImage ? '630' : null,
    'og:image:alt': replacements.ogImageAlt,
    'og:url': replacements.ogUrl,
  };

  for (const [property, content] of Object.entries(ogReplacements)) {
    if (!content) continue;
    const tag = `<meta property="${property}" content="${escapeHtml(content)}" />`;
    const regex = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`, 'i');
    if (regex.test(result)) {
      result = result.replace(regex, tag);
    } else {
      result = result.replace('</head>', `${tag}\n  </head>`);
    }
  }

  // Replace Twitter tags
  const twitterReplacements = {
    'twitter:card': replacements.twitterCard || 'summary_large_image',
    'twitter:title': replacements.twitterTitle || replacements.title,
    'twitter:description': replacements.twitterDescription || replacements.description,
    'twitter:image': replacements.twitterImage || replacements.ogImage,
    'twitter:image:alt': replacements.ogImageAlt || null,
  };

  for (const [name, content] of Object.entries(twitterReplacements)) {
    if (!content) continue;
    const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`;
    const regex = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>`, 'i');
    if (regex.test(result)) {
      result = result.replace(regex, tag);
    } else {
      result = result.replace('</head>', `${tag}\n  </head>`);
    }
  }

  // Insert JSON-LD structured data
  if (replacements.jsonLd) {
    const jsonLdTag = `<script type="application/ld+json">\n${JSON.stringify(replacements.jsonLd, null, 2)}\n    </script>`;
    result = result.replace('</head>', `${jsonLdTag}\n  </head>`);
  }

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  seo-html — Static HTML share-preview generator               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!existsSync(INDEX_PATH)) {
    console.warn('  ⚠ dist/index.html not found — skipping SEO HTML generation');
    console.warn('  ⚠ Run "npm run build" first (this runs as a postbuild step)\n');
    return;
  }

  if (!existsSync(SNAPSHOT_PATH)) {
    console.warn('  ⚠ snapshot.json not found — skipping SEO HTML generation\n');
    return;
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
  const template = readFileSync(INDEX_PATH, 'utf-8');

  // ── Clear stale SEO pages so old slugs don't linger in dist/ ────────────
  // Note: Node's rmSync with recursive silently fails on some Windows paths.
  // We walk, delete each file, then remove each now-empty directory.
  function clearDir(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        clearDir(full);
      } else {
        try { rmSync(full); } catch { /* ignore */ }
      }
    }
    // Remove the now-empty directory itself (non-recursive rmSync works on empty dirs)
    try { rmSync(dir); } catch { /* ignore if not empty or already gone */ }
  }
  for (const dir of ['events', 'news']) {
    clearDir(join(DIST, dir));
  }

  let eventCount = 0;
  let newsCount = 0;

  // ── Generate event pages ─────────────────────────────────────────────────
  for (const evt of snapshot.events || []) {
    const slug = evt.slug;
    if (!slug) continue;

    const title = evt.titleI18n?.en || 'Tourism Week Event';
    const description = evt.descriptionI18n?.en || '';
    const imageUrl = resolveImageUrl(evt.image, SITE_URL);
    const eventUrl = `${SITE_URL}/events/${slug}`;

    // JSON-LD Event structured data
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: title,
      description: description.slice(0, 300),
      image: [imageUrl],
      url: eventUrl,
      eventStatus: evt.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : evt.status === 'live'
          ? 'https://schema.org/EventScheduled'
          : 'https://schema.org/EventScheduled',
      organizer: {
        '@type': 'Organization',
        name: 'Ambo University, Woliso Campus — Department of Tourism and Hotel Management',
        url: SITE_URL,
      },
      location: {
        '@type': 'Place',
        name: evt.venueNameI18n?.en || 'Woliso Campus',
      },
    };

    const html = replaceMeta(template, {
      title: `${title} — Tourism Week`,
      description: description.slice(0, 160),
      ogTitle: title,
      ogDescription: description.slice(0, 200),
      ogType: 'article',
      ogImage: imageUrl,
      ogImageAlt: title,
      ogUrl: eventUrl,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description.slice(0, 200),
      twitterImage: imageUrl,
      jsonLd,
    });

    const outDir = join(DIST, 'events', slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
    eventCount++;
  }

  // ── Generate news pages ──────────────────────────────────────────────────
  for (const item of snapshot.news || []) {
    const slug = item.slug;
    if (!slug) continue;

    const title = item.titleI18n?.en || 'Tourism Week News';
    const description = item.excerptI18n?.en || '';
    const imageUrl = resolveImageUrl(item.image, SITE_URL);
    const newsUrl = `${SITE_URL}/news/${slug}`;

    const html = replaceMeta(template, {
      title: `${title} — Tourism Week News`,
      description: description.slice(0, 160),
      ogTitle: title,
      ogDescription: description.slice(0, 200),
      ogType: 'article',
      ogImage: imageUrl,
      ogImageAlt: title,
      ogUrl: newsUrl,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description.slice(0, 200),
      twitterImage: imageUrl,
    });

    const outDir = join(DIST, 'news', slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
    newsCount++;
  }

  console.log(`  📄 Generated ${eventCount} event pages + ${newsCount} news pages with SEO meta tags`);
  console.log(`  🔗 Site URL: ${SITE_URL}`);
  if (eventCount > 0) console.log(`  📋 JSON-LD Event structured data added to event pages`);

  // ── Patch dist/index.html: make og:image / twitter:image absolute ────────
  // The source index.html uses a relative path; seo-html makes it absolute.
  if (SITE_URL && existsSync(INDEX_PATH)) {
    const absDefault = `${SITE_URL}/assets/share/default.jpg`;
    let rootHtml = readFileSync(INDEX_PATH, 'utf-8');
    // Replace relative /assets/share/... with absolute SITE_URL/assets/share/...
    rootHtml = rootHtml.replace(
      /content="(\/assets\/share\/[^"]+)"/g,
      (_, p) => `content="${SITE_URL}${p}"`
    );
    // Ensure og:image:width and og:image:height are present
    if (!rootHtml.includes('og:image:width')) {
      rootHtml = rootHtml.replace(
        /(<meta\s+property="og:image"\s+content="[^"]*"\s*\/>)/,
        `$1\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`
      );
    }
    writeFileSync(INDEX_PATH, rootHtml, 'utf-8');
    console.log(`  🔗 dist/index.html og:image patched to absolute URL`);
  }

  console.log(`\n  ✅ SEO HTML generation complete\n`);
}

main();
