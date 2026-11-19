/**
 * liveContent.ts — Live-first content client.
 *
 * Calls get_public_content() via the Supabase PostgREST RPC endpoint (plain
 * fetch, no @supabase/supabase-js).  Returns fully-adapted camelCase data
 * matching the same Snapshot shape already used by the build-time pipeline.
 *
 * Rules enforced here:
 *  · 3-second timeout — a paused project never blocks the page.
 *  · Circuit breaker — on any failure (timeout, network, 5xx) the breaker
 *    trips for 10 minutes, stored in sessionStorage, so the site stops
 *    retrying immediately and reads from the snapshot instead.
 *  · localStorage cache — a successful live fetch is persisted so returning
 *    visitors get recent content on first paint before the next fetch resolves.
 *  · Never throws to callers — always returns null on failure.
 *  · No @supabase/supabase-js import.
 *
 * VITE_LIVE_CONTENT=false disables the whole module (returns null immediately).
 */

import { isAnnouncementVisible } from './contentAdapter';
import type { Snapshot, SiteSettingsSnapshot, SectionSnapshot, SectionItemSnapshot, PastEditionSnapshot } from './snapshot';
import type {
  Announcement,
  CommitteeMember,
  Edition,
  EventItem,
  FAQ,
  GalleryItem,
  I18nString,
  NewsItem,
  Sponsor,
} from '../types';

// ─── Environment ─────────────────────────────────────────────────────────────

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const ANON_KEY     = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const LIVE_ENABLED = import.meta.env.VITE_LIVE_CONTENT !== 'false';

const RPC_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/get_public_content`
  : '';

// ─── Circuit breaker ─────────────────────────────────────────────────────────

const CB_KEY       = 'tw_live_cb';          // sessionStorage key
const CB_DURATION  = 10 * 60 * 1000;        // 10 minutes in ms

export interface CircuitBreakerEntry {
  trippedAt:  number;
  httpStatus: number | null;   // null = network/timeout error
  errorText:  string;
}

export function isBreakerOpen(): boolean {
  try {
    const raw = sessionStorage.getItem(CB_KEY);
    if (!raw) return false;
    const entry: CircuitBreakerEntry = JSON.parse(raw);
    if (Date.now() - entry.trippedAt < CB_DURATION) return true;
    sessionStorage.removeItem(CB_KEY);
    return false;
  } catch {
    return false;
  }
}

export function getBreakerEntry(): CircuitBreakerEntry | null {
  try {
    const raw = sessionStorage.getItem(CB_KEY);
    if (!raw) return null;
    const entry: CircuitBreakerEntry = JSON.parse(raw);
    if (Date.now() - entry.trippedAt < CB_DURATION) return entry;
    return null;
  } catch {
    return null;
  }
}

function tripBreaker(httpStatus: number | null, errorText: string): void {
  try {
    const entry: CircuitBreakerEntry = { trippedAt: Date.now(), httpStatus, errorText };
    sessionStorage.setItem(CB_KEY, JSON.stringify(entry));
  } catch { /* sessionStorage quota — ignore */ }
}

/** Clear the circuit breaker so the next fetch retries immediately. */
export function resetBreaker(): void {
  try { sessionStorage.removeItem(CB_KEY); } catch { /* ignore */ }
}

/**
 * Clear the localStorage live-content cache.
 *
 * Call this after any staff save (section upsert/publish/reset, edition update)
 * so the public site doesn't serve stale data from the cache on the next page
 * load or React Query refetch. The next call to fetchLiveContent() will fetch
 * fresh data from Supabase and re-populate the cache.
 */
export function clearLiveCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

// ─── localStorage cache ───────────────────────────────────────────────────────

const CACHE_KEY = 'tw_live_snapshot';

interface CachedSnapshot {
  snapshot: Snapshot;
  fetchedAt: number;
}

export function getCachedLiveSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CachedSnapshot = JSON.parse(raw);
    return entry.snapshot ?? null;
  } catch {
    return null;
  }
}

export function getCachedFetchedAt(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CachedSnapshot = JSON.parse(raw);
    return entry.fetchedAt ?? null;
  } catch {
    return null;
  }
}

function persistCache(snap: Snapshot): void {
  try {
    const entry: CachedSnapshot = { snapshot: snap, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota — ignore */ }
}

// ─── i18n helpers (mirror build-content.mjs inline adapters) ─────────────────

type RawI18n = { en?: string; am?: string; om?: string } | null | undefined;

function toI18n(raw: RawI18n): I18nString {
  const en = raw?.en ?? '';
  return { en, am: raw?.am || en, om: raw?.om || en };
}

function toI18nOrNull(raw: RawI18n): I18nString | null {
  if (!raw || !raw.en) return null;
  return toI18n(raw);
}

// ─── Row adapters — mirror scripts/build-content.mjs ─────────────────────────
// The DB returns snake_case jsonb; we map to the camelCase public types.
// These run in the browser, not at build time.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function computeEditionStatus(startDateGC: string, endDateGC: string): 'upcoming' | 'live' | 'past' {
  // Compute in Africa/Addis_Ababa (UTC+3, no DST)
  const addisNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const today = addisNow.toISOString().split('T')[0];
  if (today > endDateGC)   return 'past';
  if (today >= startDateGC) return 'live';
  return 'upcoming';
}

function adaptEdition(row: AnyRow): Edition {
  const startDateGC = row.start_date ?? row.startDateGC ?? '';
  const endDateGC   = row.end_date   ?? row.endDateGC   ?? '';
  return {
    id:                   row.id,
    number:               row.number,
    editionNameI18n:      toI18n(row.edition_name_i18n),
    titleI18n:            toI18n(row.title_i18n),
    themeI18n:            toI18n(row.theme_i18n),
    subThemeI18n:         row.sub_theme_i18n ? toI18n(row.sub_theme_i18n) : undefined,
    startDateEC:          row.start_date_ec ?? '',
    endDateEC:            row.end_date_ec   ?? '',
    dateRangeDisplayI18n: toI18n(row.date_range_display_i18n),
    startDateGC,
    endDateGC,
    status:               computeEditionStatus(startDateGC, endDateGC),
    venueI18n:            toI18n(row.venue_i18n),
    hostDepartmentI18n:   toI18n(row.host_department_i18n ?? null) || {
      en: 'Department of Tourism and Hotel Management',
      am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
      om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
    },
    hostUniversityI18n:   toI18n(row.host_university_i18n ?? null) || {
      en: 'Ambo University', am: 'አምቦ ዩኒቨርሲቲ', om: 'Yuunivarsiitii Amboo',
    },
    campusI18n:           toI18n(row.campus_i18n ?? null) || {
      en: 'Woliso Campus', am: 'ወሊሶ ካምፓስ', om: 'Kaampasii Walisoo',
    },
    stats: {
      daysCount:            row.stats?.daysCount  ?? null,
      activitiesCount:      row.stats?.activitiesCount ?? null,
      expectedParticipants: row.stats?.expectedParticipants ?? null,
      exhibitorsCount:      row.stats?.exhibitorsCount ?? null,
    },
  };
}

function adaptEditionFull(row: AnyRow): PastEditionSnapshot {
  return {
    ...adaptEdition(row),
    subtitleI18n:       toI18nOrNull(row.subtitle_i18n),
    themeHighlightI18n: toI18nOrNull(row.theme_highlight_i18n),
    heroPosterUrl:      row.hero_poster_url  ?? null,
    heroVideoUrl:       row.hero_video_url   ?? null,
    summaryI18n:        toI18nOrNull(row.summary_i18n),
    coverImageUrl:      row.cover_image_url  ?? null,
    state:              row.state ?? 'published',
    // Migration 017 additions
    logoUrl:            row.logo_url   ?? null,
    aboutI18n:          toI18nOrNull(row.about_i18n),
  };
}

function computeDayName(day: number, startDateGC: string): I18nString {
  try {
    const start = new Date(startDateGC + 'T00:00:00Z');
    const date  = new Date(start.getTime() + (day - 1) * 86_400_000);
    const dow   = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    return {
      en: `Day ${day} — ${dow}`,
      am: `ቀን ${day} — ${dow}`,
      om: `Guyyaa ${day} — ${dow}`,
    };
  } catch {
    return { en: `Day ${day}`, am: `ቀን ${day}`, om: `Guyyaa ${day}` };
  }
}

function adaptEvent(row: AnyRow, startDateGC: string): EventItem {
  return {
    id:              row.id,
    slug:            row.slug,
    editionId:       row.edition_id,
    day:             row.day,
    dayNameI18n:     computeDayName(row.day, startDateGC),
    session:         row.session,
    startTime:       row.start_time ?? undefined,
    endTime:         row.end_time   ?? undefined,
    titleI18n:       toI18n(row.title_i18n),
    descriptionI18n: toI18n(row.description_i18n),
    category:        row.category,
    venueType:       row.venue_type,
    venueNameI18n:   toI18n(row.venue_name_i18n),
    status:          row.status ?? 'scheduled',
    featured:        row.featured ?? false,
    image:           row.image_url ?? undefined,
    statusNoteI18n:  row.status_note_i18n ? toI18n(row.status_note_i18n) : undefined,
  };
}

function adaptNews(row: AnyRow): NewsItem {
  return {
    id:            row.id,
    slug:          row.slug,
    titleI18n:     toI18n(row.title_i18n),
    // DB column is summary_i18n (not excerpt_i18n)
    excerptI18n:   toI18n(row.summary_i18n ?? row.excerpt_i18n),
    contentI18n:   toI18n(row.body_i18n),
    publishedAt:   row.published_at ?? row.created_at,
    publishedAtEC: row.published_at_ec ?? '',
    categoryI18n:  toI18n(row.category_i18n ?? { en: row.category ?? 'general' }),
    // DB has no author_name column; fall back to a fixed label
    authorI18n:    { en: 'Tourism Week', am: 'ቱሪዝም ሳምንት', om: 'Torban Turizimii' },
    pinned:        row.pinned ?? false,
    // DB column is cover_image_url (not image_url) for news
    image:         row.cover_image_url ?? row.image_url ?? undefined,
  };
}

function adaptGallery(row: AnyRow): GalleryItem {
  return {
    id:          row.id,
    // DB has no title_i18n on gallery_items; use caption as title fallback
    titleI18n:   row.title_i18n ? toI18n(row.title_i18n) : toI18n(row.caption_i18n ?? { en: 'Gallery item' }),
    captionI18n: row.caption_i18n ? toI18n(row.caption_i18n) : undefined,
    year:        row.year ?? new Date().getFullYear(),
    category:    row.category ?? 'highlights',
    // DB media_type values are 'photo' | 'video'; map 'photo' → 'image'
    mediaType:   row.media_type === 'photo' ? 'image' : (row.media_type ?? 'image'),
    url:         row.image_url ?? row.video_url ?? '',
    thumbnail:   row.image_url ?? '',
    eventSlug:   undefined,
  };
}

function adaptSponsor(row: AnyRow): Sponsor {
  const tierMap: Record<string, string> = { title: 'platinum' };
  return {
    id:              row.id,
    name:            row.name ?? '',
    tier:            (tierMap[row.tier] ?? row.tier) as Sponsor['tier'],
    logoPlaceholder: row.logo_url ?? '[SPONSOR LOGO]',
    // DB has no description_i18n on sponsors
    sectorI18n:      { en: '', am: '', om: '' },
    website:         row.website_url ?? undefined,
  };
}

function adaptCommittee(row: AnyRow): CommitteeMember {
  return {
    id:               row.id,
    // DB column is full_name (plain text), not name_i18n
    nameI18n:         { en: row.full_name ?? '', am: row.full_name ?? '', om: row.full_name ?? '' },
    roleI18n:         toI18n(row.role_i18n),
    // DB has no department_i18n column
    departmentI18n:   { en: '', am: '', om: '' },
    photoPlaceholder: row.photo_url ?? '[PHOTO]',
    photo_url:        (row.photo_url as string | null) ?? null,
    // DB has no bio_i18n column
    bioI18n:          undefined,
  };
}

function adaptFaq(row: AnyRow): FAQ {
  return {
    id:           row.id,
    questionI18n: toI18n(row.question_i18n),
    answerI18n:   toI18n(row.answer_i18n),
    category:     row.category ?? 'general',
  };
}

function adaptAnnouncement(row: AnyRow): Announcement {
  return {
    id:           row.id,
    messageI18n:  toI18n(row.message_i18n),
    link:         row.link ?? undefined,
    type:         row.type === 'urgent' ? 'urgent' : 'info',
    active:       true,
    startsAt:     row.starts_at,
    expiresAt:    row.expires_at ?? null,
  };
}

function adaptSectionItem(row: AnyRow): SectionItemSnapshot {
  return {
    id:         row.id,
    sectionId:  row.section_id,
    titleI18n:  row.title_i18n ? toI18n(row.title_i18n) : null,
    bodyI18n:   row.body_i18n  ? toI18n(row.body_i18n)  : null,
    icon:       row.icon       ?? null,
    imageUrl:   row.image_url  ?? null,
    linkUrl:    row.link_url   ?? null,
    badgeI18n:  row.badge_i18n ? toI18n(row.badge_i18n) : null,
    sortOrder:  row.sort_order ?? 0,
    state:      row.state ?? 'published',
  };
}

function adaptSection(row: AnyRow): SectionSnapshot {
  const items: SectionItemSnapshot[] = Array.isArray(row.items)
    ? row.items.map(adaptSectionItem)
    : [];
  return {
    id:           row.id,
    key:          row.key,
    titleI18n:    row.title_i18n    ? toI18n(row.title_i18n)    : null,
    subtitleI18n: row.subtitle_i18n ? toI18n(row.subtitle_i18n) : null,
    bodyI18n:     row.body_i18n     ? toI18n(row.body_i18n)     : null,
    imageUrl:     row.image_url     ?? null,
    ctaLabelI18n: row.cta_label_i18n ? toI18n(row.cta_label_i18n) : null,
    ctaUrl:       row.cta_url       ?? null,
    state:        row.state ?? 'published',
    needsReview:  row.needs_review  ?? false,
    items,
  };
}

function adaptSiteSettings(row: AnyRow | null): SiteSettingsSnapshot | null {
  if (!row) return null;
  return {
    contactEmail:  row.contact_email  ?? null,
    phone:         row.phone          ?? null,
    addressI18n:   row.address_i18n   ?? null,
    social:        row.social         ?? null,
    footerTextI18n: row.footer_text_i18n ?? null,
  };
}

// ─── Main adapter: raw RPC payload → Snapshot ────────────────────────────────

function adaptRpcPayload(raw: AnyRow): Snapshot {
  const editionRow  = raw.edition as AnyRow | null;
  const editionFull = editionRow ? adaptEditionFull(editionRow) : null;
  const startDateGC = editionFull?.startDateGC ?? '2025-04-07';

  const events = Array.isArray(raw.events)
    ? (raw.events as AnyRow[]).map((r) => adaptEvent(r, startDateGC))
    : [];

  const now = Date.now();
  const announcements = Array.isArray(raw.announcements)
    ? (raw.announcements as AnyRow[])
        .map(adaptAnnouncement)
        .filter((a) => isAnnouncementVisible(a, now))
    : [];

  return {
    generatedAt:  (raw.generated_at as string) ?? new Date().toISOString(),
    source:       'supabase',
    edition:      editionFull,
    events,
    news:         Array.isArray(raw.news)      ? (raw.news      as AnyRow[]).map(adaptNews)      : [],
    gallery:      Array.isArray(raw.gallery)   ? (raw.gallery   as AnyRow[]).map(adaptGallery)   : [],
    sponsors:     Array.isArray(raw.sponsors)  ? (raw.sponsors  as AnyRow[]).map(adaptSponsor)   : [],
    committee:    Array.isArray(raw.committee) ? (raw.committee as AnyRow[]).map(adaptCommittee) : [],
    faqs:         Array.isArray(raw.faqs)      ? (raw.faqs      as AnyRow[]).map(adaptFaq)       : [],
    announcements,
    siteSettings: adaptSiteSettings(raw.site_settings as AnyRow | null),
    sections:     Array.isArray(raw.sections)      ? (raw.sections      as AnyRow[]).map(adaptSection)      : [],
    pastEditions: Array.isArray(raw.past_editions) ? (raw.past_editions as AnyRow[]).map(adaptEditionFull) : [],
    editionDays:  Array.isArray(raw.edition_days)  ? (raw.edition_days  as AnyRow[]).map((d) => ({
      id:              d.id,
      editionId:       d.edition_id,
      day:             d.day,
      titleI18n:       d.title_i18n ? (d.title_i18n as { en: string; am: string; om: string }) : null,
      descriptionI18n: d.description_i18n ? (d.description_i18n as { en: string; am: string; om: string }) : null,
    })) : [],
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

// ─── Debug info ──────────────────────────────────────────────────────────────

export interface LiveDebugInfo {
  source:       'supabase-rpc' | 'supabase-rest' | 'localstorage' | 'snapshot' | 'seed' | 'unknown';
  lastFetchAt:  number | null;
  httpStatus:   number | null;
  errorText:    string | null;
  editionId:    string | null;
  eventCount:   number | null;
  hint:         string | null;
  breakerOpen:  boolean;
}

const DEBUG_KEY = 'tw_live_debug';

export function getDebugInfo(): LiveDebugInfo {
  try {
    const raw = localStorage.getItem(DEBUG_KEY);
    if (!raw) return { source: 'unknown', lastFetchAt: null, httpStatus: null, errorText: null, editionId: null, eventCount: null, hint: null, breakerOpen: isBreakerOpen() };
    return { ...JSON.parse(raw), breakerOpen: isBreakerOpen() } as LiveDebugInfo;
  } catch {
    return { source: 'unknown', lastFetchAt: null, httpStatus: null, errorText: null, editionId: null, eventCount: null, hint: null, breakerOpen: isBreakerOpen() };
  }
}

function persistDebug(info: Partial<LiveDebugInfo>): void {
  try {
    const existing = getDebugInfo();
    localStorage.setItem(DEBUG_KEY, JSON.stringify({ ...existing, ...info, breakerOpen: isBreakerOpen() }));
  } catch { /* quota */ }
}

// ─── Fallback: plain REST reads ───────────────────────────────────────────────
// Used when get_public_content() returns 404 (migration 014 not applied yet).
// Plain REST reads hit the same RLS policies; anon sees only published rows.

async function fetchLiveContentViaREST(): Promise<Snapshot | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    Accept: 'application/json',
  };

  const get = async (table: string, params: string): Promise<AnyRow[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${base}/${table}?${params}`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) return [];
      return await res.json() as AnyRow[];
    } catch { return []; } finally { clearTimeout(timer); }
  };

  // Fetch current edition
  const editions = await get('edition_public', 'is_current=eq.true&limit=1');
  if (!editions.length) return null;
  const editionRow = editions[0];
  const editionId = editionRow.id as string;
  const startDateGC = (editionRow.start_date as string) ?? '2025-04-07';

  const [eventRows, newsRows, galleryRows, sponsorRows, committeeRows, faqRows, settingsRows, annRows, pastEditionRows] = await Promise.all([
    get('events', `edition_id=eq.${editionId}&state=eq.published&order=day.asc,session.asc,sort_order.asc`),
    get('news', 'state=eq.published&order=pinned.desc,published_at.desc&limit=50'),
    get('gallery_items', 'state=eq.published&order=sort_order.asc&limit=200'),
    get('sponsors', 'state=eq.published&order=sort_order.asc'),
    get('committee_members', 'state=eq.published&order=sort_order.asc'),
    get('faqs', 'state=eq.published&order=sort_order.asc'),
    get('site_settings', 'limit=1'),
    get('announcements', 'state=eq.published&order=created_at.desc'),
    get('edition_public', 'state=eq.published&status=eq.past&order=number.desc&limit=20'),
  ]);

  const snap: Snapshot = {
    generatedAt:  new Date().toISOString(),
    source:       'supabase',
    edition:      adaptEditionFull(editionRow),
    events:       eventRows.map((r) => adaptEvent(r, startDateGC)),
    news:         newsRows.map(adaptNews),
    gallery:      galleryRows.map(adaptGallery),
    sponsors:     sponsorRows.map(adaptSponsor),
    committee:    committeeRows.map(adaptCommittee),
    faqs:         faqRows.map(adaptFaq),
    announcements: annRows.map(adaptAnnouncement).filter((a) => isAnnouncementVisible(a, Date.now())),
    siteSettings: adaptSiteSettings(settingsRows[0] ?? null),
    sections:     [],
    pastEditions: pastEditionRows.map(adaptEditionFull),
    editionDays:  [],
  };

  persistCache(snap);
  persistDebug({
    source: 'supabase-rest',
    lastFetchAt: Date.now(),
    httpStatus: 200,
    errorText: null,
    editionId: snap.edition?.id ?? null,
    eventCount: snap.events.length,
    hint: 'get_public_content not found: apply migration 014 for faster loads.',
  });
  return snap;
}

/**
 * Fetch the full public content payload from get_public_content() RPC.
 * Falls back to plain REST table reads if the RPC returns 404 (migration 014
 * not yet applied).  On genuine network failure the circuit breaker trips.
 *
 * Returns the adapted Snapshot on success, null on any failure.
 */
export async function fetchLiveContent(): Promise<Snapshot | null> {
  if (!LIVE_ENABLED)        return null;
  if (!RPC_URL || !ANON_KEY) {
    persistDebug({ errorText: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set', hint: 'Set both env vars in .env and in your hosting environment.' });
    return null;
  }
  if (isBreakerOpen()) {
    const entry = getBreakerEntry();
    // If the breaker tripped because the RPC was missing (404), still try REST fallback
    if (entry?.httpStatus === 404) {
      return fetchLiveContentViaREST();
    }
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000); // 3-second timeout

  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        apikey:          ANON_KEY,
        Authorization:   `Bearer ${ANON_KEY}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: '{}',
      signal: controller.signal,
      // Never serve a stale RPC response from the browser's HTTP cache.
      cache: 'no-store',
    });

    if (!res.ok) {
      let errorText = `HTTP ${res.status}`;
      let hint: string | null = null;
      try { const j = await res.json() as AnyRow; errorText = (j.message ?? j.error ?? errorText) as string; } catch { /* ignore */ }

      if (res.status === 404 || res.status === 400) {
        // RPC not found — migration 014 not applied; do NOT trip the breaker for general requests
        hint = 'get_public_content not found: apply migration 014 to your Supabase project.';
        tripBreaker(res.status, errorText);
        persistDebug({ source: 'supabase-rest', httpStatus: res.status, errorText, hint, lastFetchAt: Date.now() });
        // Try REST fallback immediately
        return fetchLiveContentViaREST();
      }
      // 5xx or other — trip the breaker
      tripBreaker(res.status, errorText);
      persistDebug({ httpStatus: res.status, errorText, hint: null, lastFetchAt: Date.now() });
      return null;
    }

    const raw = await res.json() as AnyRow;
    const adapted = adaptRpcPayload(raw);
    persistCache(adapted);
    persistDebug({
      source: 'supabase-rpc',
      lastFetchAt: Date.now(),
      httpStatus: 200,
      errorText: null,
      editionId: adapted.edition?.id ?? null,
      eventCount: adapted.events.length,
      hint: null,
    });
    return adapted;
  } catch (err) {
    // Network error, timeout, or JSON parse failure
    const msg = err instanceof Error ? err.message : String(err);
    tripBreaker(null, msg);
    persistDebug({ httpStatus: null, errorText: msg, hint: 'Network error or Supabase project paused.', lastFetchAt: Date.now() });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Determine whether the live layer should actively poll.
 * Returns true when the edition is live or starts within 14 days.
 */
export function shouldPollLive(startDateGC: string, endDateGC: string): boolean {
  const addisNow  = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const today     = addisNow.toISOString().split('T')[0];

  if (today >= startDateGC && today <= endDateGC) return true;  // live now
  if (today < startDateGC) {
    const diffMs   = new Date(startDateGC + 'T00:00:00Z').getTime() - Date.now();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    return diffDays <= 14;                                       // starts within 14 days
  }
  return false;                                                   // past edition
}
