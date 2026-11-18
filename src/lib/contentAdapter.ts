/**
 * contentAdapter.ts — Maps Supabase REST API rows (snake_case, *_i18n jsonb)
 * to the public-site types (camelCase, *I18n I18nString).
 *
 * Used by the live overlay hook to map runtime-fetched event status and
 * announcements. The build script (scripts/build-content.mjs) has its own
 * inline copy of this mapping for build-time snapshot generation.
 *
 * This module must NOT import @supabase/supabase-js — it only works with
 * plain JSON objects returned by fetch().
 */

import type {
  Announcement,
  EventItem,
  EventStatus,
  I18nString,
  Language,
} from '../types';

// ─── Raw DB row shapes (what the REST API returns) ───────────────────────────

export interface RawEventStatus {
  id: string;
  status: EventStatus;
  status_note_i18n: { en: string; am?: string; om?: string } | null;
}

export interface RawAnnouncement {
  id: string;
  message_i18n: { en: string; am?: string; om?: string };
  type: 'normal' | 'urgent';
  link: string | null;
  starts_at: string;
  expires_at: string | null;
  state: 'draft' | 'published';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise a jsonb i18n object into a full I18nString (am/om fall back to en). */
function toI18nString(
  raw: { en: string; am?: string; om?: string } | null | undefined
): I18nString {
  const en = raw?.en ?? '';
  return {
    en,
    am: raw?.am || en,
    om: raw?.om || en,
  };
}

/** Resolve a text field by language with fallback to English. */
export function resolveI18n(
  field: I18nString | undefined,
  lang: Language
): string {
  if (!field) return '';
  return field[lang] || field.en || '';
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

/**
 * Patch an existing EventItem with live status data from the REST API.
 * Only status and statusNoteI18n are updated — everything else stays from
 * the build-time snapshot.
 */
export function patchEventStatus(
  event: EventItem,
  raw: RawEventStatus
): EventItem {
  return {
    ...event,
    status: raw.status,
    statusNoteI18n: raw.status_note_i18n
      ? toI18nString(raw.status_note_i18n)
      : undefined,
  };
}

/**
 * Map a raw announcement row to the public Announcement type.
 * The `active` flag is NOT pre-computed — it is evaluated at render time
 * against starts_at / expires_at so expired announcements disappear without
 * a rebuild.
 */
export function mapAnnouncement(raw: RawAnnouncement): Announcement {
  // DB type 'normal' → public 'info'; 'urgent' → 'urgent'.
  // 'alert' is not used by the DB but exists in the public type for future use.
  const type: Announcement['type'] = raw.type === 'urgent' ? 'urgent' : 'info';

  return {
    id: raw.id,
    messageI18n: toI18nString(raw.message_i18n),
    link: raw.link ?? undefined,
    type,
    // active is always true for published rows that passed the RLS window check;
    // the browser re-evaluates starts_at/expires_at for precise expiry.
    active: true,
    startsAt: raw.starts_at,
    expiresAt: raw.expires_at,
  };
}

/**
 * Evaluate whether an announcement is currently visible based on the
 * browser's current time. Expired announcements disappear without a rebuild.
 */
export function isAnnouncementVisible(
  ann: { startsAt?: string; expiresAt?: string | null },
  now: number = Date.now()
): boolean {
  const start = ann.startsAt ? new Date(ann.startsAt).getTime() : 0;
  const expire = ann.expiresAt ? new Date(ann.expiresAt).getTime() : null;
  return start <= now && (expire === null || expire > now);
}
