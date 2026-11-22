/**
 * build-content.mjs — Build-time content snapshot generator.
 *
 * Runs automatically before `vite dev` (predev) and `vite build` (prebuild).
 * Fetches published content from the Supabase REST API using the anon key
 * (RLS limits it to published rows), adapts the snake_case DB rows to the
 * public-site types, and writes:
 *
 *   src/data/generated/snapshot.json   — full snapshot (gitignored)
 *   public/content-meta.json           — { generatedAt } only
 *   public/sitemap.xml                 — sitemap for SEO
 *
 * Fail-safe order:
 *   1. Fresh data from Supabase
 *   2. content/snapshot.last-good.json (committed fallback)
 *   3. Seed data (edition + events only; sponsors/committee/news/gallery/faqs hidden)
 *
 * In every fallback case the build SUCCEEDS and prints a clear warning.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env (Vite env vars are prefixed VITE_ but dotenv reads them all)
dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE_URL = (process.env.VITE_SITE_URL || process.env.APP_URL || process.env.VERCEL_URL || '')
  .replace(/^"|"$/g, '')
  .replace(/\/$/, '');
const IS_SAVE = process.argv.includes('--save');

const REST = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : '';
const HEADERS = ANON_KEY
  ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' }
  : {};

const GENERATED_DIR = join(ROOT, 'src', 'data', 'generated');
const SNAPSHOT_PATH = join(GENERATED_DIR, 'snapshot.json');
const META_PATH = join(ROOT, 'public', 'content-meta.json');
const SITEMAP_PATH = join(ROOT, 'public', 'sitemap.xml');
const LAST_GOOD_PATH = join(ROOT, 'content', 'snapshot.last-good.json');

// ─── Constants (host department / university / campus — not in the DB) ──────

const HOST_DEPARTMENT_I18N = {
  en: 'Department of Tourism and Hotel Management',
  am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
  om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
};
const HOST_UNIVERSITY_I18N = {
  en: 'Ambo University',
  am: 'አምቦ ዩኒቨርሲቲ',
  om: 'Yuunivarsiitii Amboo',
};
const CAMPUS_I18N = {
  en: 'Woliso Campus',
  am: 'ወሊሶ ካምፓስ',
  om: 'Kaampasii Walisoo',
};

const NEWS_CATEGORY_LABELS = {
  department: { en: 'Department', am: 'ክፍል', om: 'Kutaa' },
  sports_community: { en: 'Sports & Community', am: 'ስፖርትና ማህበረሰብ', om: 'Spootii fi Hawaasa' },
  academic: { en: 'Academic', am: 'አካዳሚክ', om: 'Akadaemik' },
  general: { en: 'General', am: 'አጠቃላይ', om: 'Waliigala' },
};

// ─── Fetch helpers ──────────────────────────────────────────────────────────

/**
 * Fetch a PostgREST endpoint with a timeout. Returns parsed JSON or throws.
 */
async function fetchTable(table, query, timeoutMs = 15000) {
  if (!REST || !ANON_KEY) throw new Error('Supabase URL or anon key not configured');
  const url = `${REST}/${table}?${query}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} from ${table}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Adaptation: DB rows (snake_case) → public types (camelCase) ─────────────

function toI18n(raw) {
  if (!raw || typeof raw !== 'object') return { en: '', am: '', om: '' };
  const en = raw.en ?? '';
  return { en, am: raw.am || en, om: raw.om || en };
}

function mapSponsorTier(dbTier) {
  // DB 'title' maps to public 'platinum' (the top tier)
  if (dbTier === 'title') return 'platinum';
  return dbTier; // 'gold' | 'silver' | 'partner'
}

function mapAnnouncementType(dbType) {
  // DB 'normal' → public 'info'; 'urgent' stays 'urgent'
  if (dbType === 'urgent') return 'urgent';
  return 'info';
}

/** Compute the day name from the edition start date and day number. */
function computeDayNameI18n(startDate, day) {
  const start = new Date(startDate + 'T00:00:00');
  start.setDate(start.getDate() + (day - 1));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const name = dayNames[start.getDay()];
  return { en: `Day ${day} — ${name}`, am: `ቀን ${day} — ${name}`, om: `Guyyaa ${day} — ${name}` };
}

function adaptEdition(row) {
  const stats = row.stats || {};
  return {
    id: row.id,
    number: row.number,
    editionNameI18n: toI18n(row.edition_name_i18n),
    titleI18n: toI18n(row.title_i18n),
    themeI18n: toI18n(row.theme_i18n),
    subThemeI18n: row.sub_theme_i18n ? toI18n(row.sub_theme_i18n) : undefined,
    startDateEC: row.start_date_ec ?? '',
    endDateEC: row.end_date_ec ?? '',
    dateRangeDisplayI18n: row.date_range_display_i18n
      ? toI18n(row.date_range_display_i18n)
      : { en: `${row.start_date} — ${row.end_date}`, am: '', om: '' },
    startDateGC: row.start_date,
    endDateGC: row.end_date,
    status: row.status ?? 'past',
    venueI18n: toI18n(row.venue_i18n),
    hostDepartmentI18n: HOST_DEPARTMENT_I18N,
    hostUniversityI18n: HOST_UNIVERSITY_I18N,
    campusI18n: CAMPUS_I18N,
    stats: {
      daysCount: stats.daysCount ?? null,
      activitiesCount: stats.activitiesCount ?? null,
      // Use known confirmed values when the DB still has null
      expectedParticipants: stats.expectedParticipants ?? '2,000+',
      exhibitorsCount: stats.exhibitorsCount ?? '30+',
    },
  };
}

function adaptEvent(row) {
  return {
    id: row.id,
    slug: row.slug,
    editionId: row.edition_id,
    day: row.day,
    dayNameI18n: computeDayNameI18n(row._startDate || '2025-04-07', row.day),
    session: row.session,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    titleI18n: toI18n(row.title_i18n),
    descriptionI18n: toI18n(row.description_i18n),
    category: row.category,
    venueType: row.venue_type,
    venueNameI18n: toI18n(row.venue_name_i18n),
    status: row.status,
    featured: row.featured ?? false,
    image: row.image_url ?? undefined,
    statusNoteI18n: row.status_note_i18n ? toI18n(row.status_note_i18n) : undefined,
    subEvents: undefined,
  };
}

function adaptNews(row) {
  const catKey = row.category || 'general';
  return {
    id: row.id,
    slug: row.slug,
    titleI18n: toI18n(row.title_i18n),
    excerptI18n: toI18n(row.summary_i18n),
    contentI18n: toI18n(row.body_i18n),
    publishedAt: row.published_at ?? new Date().toISOString(),
    publishedAtEC: '', // EC display string — not stored in DB
    categoryI18n: NEWS_CATEGORY_LABELS[catKey] || NEWS_CATEGORY_LABELS.general,
    authorI18n: HOST_DEPARTMENT_I18N,
    pinned: row.pinned ?? false,
    image: row.cover_image_url ?? undefined,
  };
}

function adaptGallery(row) {
  return {
    id: row.id,
    titleI18n: toI18n(row.caption_i18n),
    captionI18n: row.caption_i18n ? toI18n(row.caption_i18n) : undefined,
    year: row.year,
    category: row.category,
    mediaType: row.media_type === 'video' ? 'video' : 'image',
    url: row.image_url,
    thumbnail: row.image_url, // no separate thumb_url column; use main asset
    eventSlug: undefined,
  };
}

function adaptSponsor(row) {
  return {
    id: row.id,
    name: row.name,
    tier: mapSponsorTier(row.tier),
    logoPlaceholder: row.logo_url ?? '[SPONSOR LOGO]',
    sectorI18n: { en: '', am: '', om: '' }, // not in DB schema
    website: row.website_url ?? undefined,
  };
}

function adaptCommittee(row) {
  return {
    id: row.id,
    nameI18n: { en: row.full_name, am: row.full_name, om: row.full_name },
    roleI18n: toI18n(row.role_i18n),
    // ── 017 additions ─────────────────────────────────────────────────────
    department: row.department ?? null,
    committeeKey: row.committee_key ?? null,
    isLeader: row.is_leader ?? false,
    editionId: row.edition_id ?? null,
    departmentI18n: { en: row.department ?? '', am: row.department ?? '', om: row.department ?? '' },
    photoPlaceholder: row.photo_url ?? '[PHOTO]',
    photoUrl: row.photo_url ?? null,
    bioI18n: row.bio_i18n ? toI18n(row.bio_i18n) : null,
    // contact is embedded in the row when show_public=true (via get_public_content)
    // or as a joined column in build-content (fetched separately below)
    contact: row.contact
      ? {
          email: row.contact.email ?? null,
          phone: row.contact.phone ?? null,
          telegram: row.contact.telegram ?? null,
        }
      : null,
  };
}

/** Adapt an edition_days row (migration 017). */
function adaptEditionDay(row) {
  return {
    id: row.id,
    editionId: row.edition_id,
    day: row.day,
    titleI18n: row.title_i18n ? toI18n(row.title_i18n) : null,
    descriptionI18n: row.description_i18n ? toI18n(row.description_i18n) : null,
  };
}

function adaptFaq(row) {
  return {
    id: row.id,
    questionI18n: toI18n(row.question_i18n),
    answerI18n: toI18n(row.answer_i18n),
    category: 'general',
  };
}

function adaptAnnouncement(row) {
  return {
    id: row.id,
    messageI18n: toI18n(row.message_i18n),
    link: row.link ?? undefined,
    type: mapAnnouncementType(row.type),
    active: true, // RLS already filtered to active window; browser re-evaluates
    startsAt: row.starts_at,
    expiresAt: row.expires_at ?? null,
  };
}

function adaptSiteSettings(row) {
  if (!row) return null;
  return {
    contactEmail: row.contact_email ?? null,
    phone: row.phone ?? null,
    addressI18n: row.address_i18n ?? null,
    social: row.social ?? null,
    footerTextI18n: row.footer_text_i18n ?? null,
  };
}

/**
 * Adapt a page_sections DB row (snake_case) → snapshot shape.
 * Items are attached separately by the caller.
 */
function adaptSection(row) {
  return {
    id: row.id,
    key: row.key,
    titleI18n: row.title_i18n ? toI18n(row.title_i18n) : null,
    subtitleI18n: row.subtitle_i18n ? toI18n(row.subtitle_i18n) : null,
    bodyI18n: row.body_i18n ? toI18n(row.body_i18n) : null,
    imageUrl: row.image_url ?? null,
    ctaLabelI18n: row.cta_label_i18n ? toI18n(row.cta_label_i18n) : null,
    ctaUrl: row.cta_url ?? null,
    state: row.state,
    needsReview: row.needs_review ?? false,
    items: [], // populated by caller
  };
}

function adaptSectionItem(row) {
  return {
    id: row.id,
    sectionId: row.section_id,
    titleI18n: row.title_i18n ? toI18n(row.title_i18n) : null,
    bodyI18n: row.body_i18n ? toI18n(row.body_i18n) : null,
    icon: row.icon ?? null,
    imageUrl: row.image_url ?? null,
    linkUrl: row.link_url ?? null,
    badgeI18n: row.badge_i18n ? toI18n(row.badge_i18n) : null,
    sortOrder: row.sort_order ?? 0,
    state: row.state,
  };
}

/**
 * Adapt an edition row to the full public Edition type including 013 fields.
 * Used for both the current edition and past editions list.
 */
function adaptEditionFull(row) {
  const base = adaptEdition(row);
  return {
    ...base,
    // ── 013 additions ───────────────────────────────────────────────────────
    subtitleI18n: row.subtitle_i18n ? toI18n(row.subtitle_i18n) : null,
    themeHighlightI18n: row.theme_highlight_i18n ? toI18n(row.theme_highlight_i18n) : null,
    heroPosterUrl: row.hero_poster_url ?? null,
    heroVideoUrl: row.hero_video_url ?? null,
    summaryI18n: row.summary_i18n ? toI18n(row.summary_i18n) : null,
    coverImageUrl: row.cover_image_url ?? null,
    state: row.state ?? 'published',
    // ── 017 additions ───────────────────────────────────────────────────────
    logoUrl: row.logo_url ?? null,
    aboutI18n: row.about_i18n ? toI18n(row.about_i18n) : null,
  };
}

// ─── Seed fallback ───────────────────────────────────────────────────────────

/**
 * Build a minimal seed-only snapshot.
 * Seed fallback must NOT include unverified sections: sponsors, committee,
 * news, gallery and FAQs are empty (so the UI hides those sections).
 */
function seedFallback() {
  return {
    generatedAt: new Date().toISOString(),
    source: 'seed',
    edition: null, // filled by caller
    events: [],
    editionDays: [],
    news: [],
    gallery: [],
    sponsors: [],
    committee: [],
    faqs: [],
    announcements: [],
    siteSettings: null,
    sections: [],
    pastEditions: [],
  };
}

// ─── Main fetch + adapt ──────────────────────────────────────────────────────

async function fetchFreshSnapshot() {
  // 1. Current edition via edition_public view (now includes 013 columns)
  const editions = await fetchTable('edition_public', 'is_current=eq.true&select=*', 15000);
  if (!editions || editions.length === 0) {
    throw new Error('No current edition found');
  }
  const editionRow = editions[0];

  // 2. Published events for the current edition
  const eventRows = await fetchTable(
    'events',
    `edition_id=eq.${editionRow.id}&state=eq.published&order=day.asc,session.asc,sort_order.asc&select=*`,
    15000
  );
  // Attach startDate for day-name computation
  const events = eventRows.map((r) => adaptEvent({ ...r, _startDate: editionRow.start_date }));

  // 2b. Edition days (migration 017) — per-day programme metadata
  let editionDays = [];
  try {
    const editionDayRows = await fetchTable(
      'edition_days',
      `edition_id=eq.${editionRow.id}&order=day.asc&select=*`,
      10000
    );
    editionDays = editionDayRows.map(adaptEditionDay);
  } catch (err) {
    if (err.message && (err.message.includes('PGRST205') || err.message.includes('42P01'))) {
      console.log('  ℹ edition_days table not found — skipping (migration 017 not applied)');
    } else {
      throw err;
    }
  }

  // 3. Published news
  const newsRows = await fetchTable('news', 'state=eq.published&order=pinned.desc,published_at.desc&select=*', 15000);
  const news = newsRows.map(adaptNews);

  // 4. Published gallery items
  const galleryRows = await fetchTable('gallery_items', 'state=eq.published&order=sort_order.asc&select=*', 15000);
  const gallery = galleryRows.map(adaptGallery);

  // 5. Published sponsors
  const sponsorRows = await fetchTable('sponsors', 'state=eq.published&order=sort_order.asc&select=*', 15000);
  const sponsors = sponsorRows.map(adaptSponsor);

  // 6. Published committee members for the current edition (with public contacts)
  const editionId = editionRow.id;
  const committeeRows = await fetchTable(
    'committee_members',
    `edition_id=eq.${editionId}&state=eq.published&order=is_leader.desc,sort_order.asc&select=*`,
    15000
  );
  // Fetch public contact rows for published members (show_public=true only)
  let contactRows = [];
  if (committeeRows.length > 0) {
    const memberIds = committeeRows.map((r) => r.id).join(',');
    try {
      contactRows = await fetchTable(
        'committee_member_contacts',
        `member_id=in.(${memberIds})&show_public=eq.true&select=*`,
        10000
      );
    } catch (err) {
      // Migration 017 not yet applied — contacts table missing
      if (err.message && (err.message.includes('PGRST205') || err.message.includes('42P01'))) {
        console.log('  ℹ committee_member_contacts table not found — skipping contacts (migration 017 not applied)');
      } else {
        throw err;
      }
    }
  }
  const contactsByMemberId = {};
  for (const c of contactRows) {
    contactsByMemberId[c.member_id] = c;
  }
  const committee = committeeRows.map((r) =>
    adaptCommittee({ ...r, contact: contactsByMemberId[r.id] ?? null })
  );

  // 7. Published FAQs
  const faqRows = await fetchTable('faqs', 'state=eq.published&order=sort_order.asc&select=*', 15000);
  const faqs = faqRows.map(adaptFaq);

  // 8. Site settings (single row, public read)
  const settingsRows = await fetchTable('site_settings', 'select=*', 10000);
  const siteSettings = adaptSiteSettings(settingsRows?.[0]);

  // 9. Currently active announcements (RLS filters to published + active window)
  const announcementRows = await fetchTable('announcements', 'state=eq.published&order=created_at.desc&select=*', 15000);
  const announcements = announcementRows.map(adaptAnnouncement);

  // 10. Published page sections (all pages) — optional (requires migration 013)
  let sectionRows = [];
  try {
    sectionRows = await fetchTable('page_sections', 'state=eq.published&select=*', 15000);
  } catch (err) {
    if (err.message && err.message.includes('PGRST205')) {
      // page_sections table does not exist yet (migration 013 not applied) — skip silently
      console.log('  ℹ page_sections table not found — skipping sections (migration 013 not applied)');
    } else {
      throw err; // re-throw unexpected errors
    }
  }

  // 11. Published section items for those sections
  const sectionIds = sectionRows.map((r) => r.id).join(',');
  let sectionItemRows = [];
  if (sectionIds.length > 0) {
    try {
      sectionItemRows = await fetchTable(
        'page_section_items',
        `section_id=in.(${sectionIds})&state=eq.published&order=sort_order.asc&select=*`,
        15000
      );
    } catch (err) {
      if (err.message && err.message.includes('PGRST205')) {
        console.log('  ℹ page_section_items table not found — skipping items');
      } else {
        throw err;
      }
    }
  }
  // Build a map of section_id → items[]
  const itemsBySection = {};
  for (const item of sectionItemRows) {
    if (!itemsBySection[item.section_id]) itemsBySection[item.section_id] = [];
    itemsBySection[item.section_id].push(adaptSectionItem(item));
  }
  // Attach items to each section
  const sections = sectionRows.map((r) => {
    const s = adaptSection(r);
    s.items = itemsBySection[r.id] ?? [];
    return s;
  });

  // 12. All published past editions (for About page timeline)
  //     edition_public view returns all editions; filter status='past'.
  //     The `state` column was added in migration 013; fall back to no state
  //     filter if the column does not exist yet (PostgREST returns a 400).
  let allEditionRows = [];
  try {
    allEditionRows = await fetchTable(
      'edition_public',
      'state=eq.published&order=number.desc&select=*',
      15000
    );
  } catch (err) {
    // state column missing (migration 013 not applied) — fetch without filter
    if (err.message && (err.message.includes('42703') || err.message.includes('PGRST'))) {
      console.log('  ℹ editions.state column not found — fetching past editions without state filter');
      allEditionRows = await fetchTable(
        'edition_public',
        'order=number.desc&select=*',
        15000
      );
    } else {
      throw err;
    }
  }
  const pastEditions = allEditionRows
    .filter((r) => r.status === 'past')
    .map(adaptEditionFull);

  return {
    generatedAt: new Date().toISOString(),
    source: 'supabase',
    edition: adaptEditionFull(editionRow),
    events,
    editionDays,
    news,
    gallery,
    sponsors,
    committee,
    faqs,
    announcements,
    siteSettings,
    sections,
    pastEditions,
  };
}

// ─── Sanity checks ───────────────────────────────────────────────────────────

/**
 * Sanity check the fetched snapshot against the last-good fallback.
 *
 * The "zero events" rule is SKIPPED when the current edition id differs from
 * the edition id stored in the last-good snapshot — a new edition legitimately
 * starts with no published events, so this is an expected state.
 *
 * All other fail-safes remain unchanged.
 *
 * @param {object} snapshot       - The freshly-fetched snapshot to validate.
 * @param {object|null} lastGood  - The last-good snapshot (may be null).
 * @returns {boolean}
 */
function sanityCheck(snapshot, lastGood = null) {
  if (!snapshot.edition) {
    console.warn('  ⚠ Sanity check failed: no edition');
    return false;
  }
  if (!snapshot.events || snapshot.events.length === 0) {
    // Check whether the last-good snapshot used a *different* edition.
    const lastGoodEditionId = lastGood?.edition?.id ?? null;
    const freshEditionId    = snapshot.edition?.id ?? null;

    if (lastGoodEditionId && freshEditionId && freshEditionId !== lastGoodEditionId) {
      // New edition — empty schedule is expected; accept with a notice.
      console.log(
        `  ℹ New edition detected (${freshEditionId} ≠ last-good ${lastGoodEditionId}). ` +
        'Zero published events is acceptable for a new edition — accepting fresh data.'
      );
      return true;
    }

    // Same edition (or no last-good to compare) — zero events is suspicious.
    console.warn('  ⚠ Sanity check failed: zero published events');
    return false;
  }
  return true;
}

// ─── Last-good fallback ─────────────────────────────────────────────────────

function loadLastGood() {
  if (!existsSync(LAST_GOOD_PATH)) return null;
  try {
    const raw = readFileSync(LAST_GOOD_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Seed fallback (reads compiled seed data) ────────────────────────────────

function loadSeedFallback() {
  // We can't easily import the .ts seed file from .mjs, so we read a
  // pre-generated seed snapshot if it exists, or create a minimal one.
  const seedSnapshotPath = join(GENERATED_DIR, 'seed-snapshot.json');
  if (existsSync(seedSnapshotPath)) {
    try {
      return JSON.parse(readFileSync(seedSnapshotPath, 'utf-8'));
    } catch { /* fall through */ }
  }
  // Minimal inline fallback — the predev script should have generated one
  return null;
}

// ─── Sitemap generation ─────────────────────────────────────────────────────

function generateSitemap(snapshot, baseUrl) {
  if (!baseUrl) {
    console.warn('  ⚠ VITE_SITE_URL not set — sitemap will use relative URLs');
    baseUrl = 'https://tourism-week.vercel.app';
  }

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/schedule', priority: '0.9', changefreq: 'daily' },
    { loc: '/events', priority: '0.9', changefreq: 'weekly' },
    { loc: '/gallery', priority: '0.7', changefreq: 'weekly' },
    { loc: '/news', priority: '0.8', changefreq: 'daily' },
    { loc: '/about', priority: '0.6', changefreq: 'monthly' },
    { loc: '/sponsors', priority: '0.6', changefreq: 'monthly' },
    { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
  ];

  // Individual event pages
  for (const evt of snapshot.events || []) {
    urls.push({ loc: `/events/${evt.slug}`, priority: '0.8', changefreq: 'weekly' });
  }
  // Individual news pages
  for (const item of snapshot.news || []) {
    urls.push({ loc: `/news/${item.slug}`, priority: '0.7', changefreq: 'monthly' });
  }

  const lastmod = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return xml;
}

// ─── Gzip size helper ────────────────────────────────────────────────────────

function gzipSize(str) {
  return gzipSync(Buffer.from(str)).length;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

// ─── Build identity (injected by Vercel, or git at build time) ───────────────

const VERCEL_ENV            = process.env.VERCEL_ENV             || '';   // 'production' | 'preview' | ''
const VERCEL_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA  || '';
const BUILD_TIME            = new Date().toISOString();

// Short SHA: Vercel injects VERCEL_GIT_COMMIT_SHA; fall back to `git rev-parse`.
const COMMIT_SHA_SHORT = VERCEL_GIT_COMMIT_SHA
  ? VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  : (() => {
      try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
      } catch {
        return 'local';
      }
    })();

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  build-content — Tourism Week content snapshot generator      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── Environment report ───────────────────────────────────────────────────
  const supabaseHost = SUPABASE_URL
    ? (() => { try { return new URL(SUPABASE_URL).host; } catch { return SUPABASE_URL; } })()
    : '(not set)';
  console.log(`  ℹ VERCEL_ENV        : ${VERCEL_ENV || '(local)'}`);
  console.log(`  ℹ Supabase host     : ${supabaseHost}`);
  console.log(`  ℹ VITE_SUPABASE_URL : ${SUPABASE_URL ? '✓ present' : '✗ MISSING'}`);
  console.log(`  ℹ VITE_SUPABASE_ANON_KEY : ${ANON_KEY ? '✓ present' : '✗ MISSING'}`);
  console.log(`  ℹ Build time        : ${BUILD_TIME}`);
  console.log(`  ℹ Commit SHA        : ${COMMIT_SHA_SHORT}`);

  // ── Hard-fail on Production when env vars are missing ────────────────────
  // Preview builds are allowed to fall back to last-good (branch previews may
  // not have secrets configured); Production must always fetch fresh data.
  if (VERCEL_ENV === 'production' && (!SUPABASE_URL || !ANON_KEY)) {
    console.error('\n  ✖ FATAL: Production Vercel build is missing Supabase environment variables.');
    console.error('  ✖ Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in:');
    console.error('       Vercel dashboard → Your project → Settings → Environment Variables');
    console.error('       (scope: Production — or All Environments)\n');
    process.exit(1);
  }

  mkdirSync(GENERATED_DIR, { recursive: true });
  mkdirSync(join(ROOT, 'public'), { recursive: true });
  mkdirSync(join(ROOT, 'content'), { recursive: true });

  let snapshot = null;
  let source = '';

  // ── Step 1: Fresh data from Supabase ──────────────────────────────────────
  if (SUPABASE_URL && ANON_KEY) {
    console.log(`\n  → Fetching fresh content from ${supabaseHost}…`);
    try {
      snapshot = await fetchFreshSnapshot();
      if (!sanityCheck(snapshot, loadLastGood())) {
        console.warn('  ⚠ Sanity check failed on fresh data — trying fallback');
        snapshot = null;
      } else {
        source = 'supabase';
        console.log(`  ✓ Fetched from Supabase: ${snapshot.events.length} events, ${snapshot.news.length} news, ${snapshot.gallery.length} gallery, ${snapshot.sponsors.length} sponsors, ${snapshot.committee.length} committee, ${snapshot.faqs.length} FAQs, ${snapshot.announcements.length} announcements, ${(snapshot.sections||[]).length} sections, ${(snapshot.pastEditions||[]).length} past editions, ${(snapshot.editionDays||[]).length} edition days`);
      }
    } catch (err) {
      console.warn(`  ⚠ Supabase fetch failed: ${err.message}`);
      // On Production, a fetch failure is fatal — don't ship stale data silently.
      if (VERCEL_ENV === 'production') {
        console.error('\n  ✖ FATAL: Production build could not fetch content from Supabase.');
        console.error(`  ✖ Error: ${err.message}`);
        console.error('  ✖ Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct');
        console.error('    and that the Supabase project is not paused.\n');
        process.exit(1);
      }
      snapshot = null;
    }
  } else {
    console.warn('  ⚠ VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — skipping live fetch');
  }

  // ── Step 2: Last-good fallback ────────────────────────────────────────────
  if (!snapshot) {
    console.log('  → Trying last-good snapshot...');
    const lastGood = loadLastGood();
    if (lastGood && sanityCheck(lastGood, null)) {
      snapshot = { ...lastGood, generatedAt: new Date().toISOString(), source: 'last-good' };
      source = 'last-good';
      console.log(`  ✓ Using last-good snapshot: ${snapshot.events.length} events`);
    } else {
      console.warn('  ⚠ No valid last-good snapshot available');
    }
  }

  // ── Step 3: Seed fallback ──────────────────────────────────────────────────
  if (!snapshot) {
    console.log('  → Falling back to seed data...');
    const seed = loadSeedFallback();
    if (seed && sanityCheck(seed, null)) {
      snapshot = { ...seed, generatedAt: new Date().toISOString(), source: 'seed' };
      source = 'seed';
      console.log(`  ✓ Using seed fallback: ${snapshot.events.length} events`);
    } else {
      // Absolute last resort — create a minimal snapshot with just the
      // edition and events from the compiled seed data
      console.warn('  ⚠ No pre-generated seed snapshot found. Creating minimal fallback.');
      console.warn('  ⚠ Run "npm run snapshot:seed" to generate the seed snapshot, or ensure the predev script ran.');
      // Write a minimal snapshot that the app can handle (empty = all sections hidden)
      snapshot = {
        generatedAt: new Date().toISOString(),
        source: 'seed',
        edition: null,
        events: [],
        editionDays: [],
        news: [],
        gallery: [],
        sponsors: [],
        committee: [],
        faqs: [],
        announcements: [],
        siteSettings: null,
        sections: [],
        pastEditions: [],
      };
      source = 'seed';
    }
  }

  // ── Write snapshot.json ───────────────────────────────────────────────────
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  writeFileSync(SNAPSHOT_PATH, snapshotJson, 'utf-8');
  const rawSize = Buffer.byteLength(snapshotJson, 'utf-8');
  const gzSize = gzipSize(snapshotJson);
  console.log(`\n  📦 snapshot.json: ${formatBytes(rawSize)} raw, ${formatBytes(gzSize)} gzipped`);
  if (gzSize > 150 * 1024) {
    console.warn('  ⚠ Snapshot exceeds 150 kB gzipped — split into core + lazy requests');
  } else if (gzSize > 100 * 1024) {
    console.warn('  ⚠ Snapshot exceeds 100 kB gzipped — approaching the 150 kB limit');
  }

  // ── Write content-meta.json ──────────────────────────────────────────────
  const meta = {
    generatedAt: snapshot.generatedAt,
    source:      snapshot.source,
    editionId:   snapshot.edition?.id ?? null,
    eventCount:  snapshot.events.length,
    commitSha:   COMMIT_SHA_SHORT,
    buildTime:   BUILD_TIME,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`  📄 content-meta.json: source=${meta.source} events=${meta.eventCount} commit=${meta.commitSha}`);

  // ── Generate sitemap.xml ──────────────────────────────────────────────────
  const sitemapXml = generateSitemap(snapshot, SITE_URL);
  writeFileSync(SITEMAP_PATH, sitemapXml, 'utf-8');
  console.log(`  🗺  sitemap.xml: ${snapshot.events.length} event URLs, ${snapshot.news.length} news URLs`);

  // ── Snapshot:save ────────────────────────────────────────────────────────
  if (IS_SAVE && source === 'supabase') {
    copyFileSync(SNAPSHOT_PATH, LAST_GOOD_PATH);
    console.log(`\n  💾 Saved last-good snapshot to content/snapshot.last-good.json`);
  } else if (IS_SAVE) {
    console.warn('\n  ⚠ snapshot:save only saves when source is "supabase" (current source: ' + source + ')');
  }

  console.log(`\n  ✅ Build content complete (source: ${source})\n`);
}

main().catch((err) => {
  console.error('\n  ✖ build-content failed:', err);
  // Even on total failure, write a minimal snapshot so the build can proceed
  try {
    mkdirSync(GENERATED_DIR, { recursive: true });
    const minimal = {
      generatedAt: new Date().toISOString(),
      source: 'seed',
      edition: null,
      events: [],
      news: [],
      gallery: [],
      sponsors: [],
      committee: [],
      faqs: [],
      announcements: [],
      siteSettings: null,
      sections: [],
      pastEditions: [],
    };
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(minimal, null, 2), 'utf-8');
    writeFileSync(META_PATH, JSON.stringify({ generatedAt: minimal.generatedAt, source: 'seed', editionId: null, eventCount: 0 }, null, 2), 'utf-8');
    console.warn('  ⚠ Wrote minimal empty snapshot as last resort');
  } catch { /* give up */ }
  // Exit 0 — the build must SUCCEED even on failure
  process.exit(0);
});
