/**
 * helpers.ts — Shared utilities for the staff service layer.
 *
 * - isConflictError: detects Postgres/PgREST "updated_at changed" race condition
 * - isUnreachable: detects network-level errors (Supabase paused, DNS, offline)
 * - formatError: turns any thrown value into a readable string; recognises
 *   "missing update" error codes and maps them to the migration that creates
 *   the missing column, table or function.
 */

import type { PostgrestError } from '@supabase/postgrest-js'

// ─── Migration hint map ───────────────────────────────────────────────────────
// Maps known column names, table names and function names to the migration
// number that introduces them.  Used by formatError to produce actionable
// "apply migration NNN" messages instead of raw Postgres error strings.

const MIGRATION_HINT_MAP: Array<{ pattern: RegExp; migration: string; kind: string }> = [
  // Migration 008 — profiles.must_change_password
  { pattern: /must_change_password/i, migration: '008', kind: 'column' },

  // Migration 009 — events.status_note_i18n
  { pattern: /status_note_i18n/i, migration: '009', kind: 'column' },

  // Migration 011 — site_state table, message_rate_limits table, touch_site_state()
  { pattern: /site_state/i,          migration: '011', kind: 'table' },
  { pattern: /message_rate_limits/i, migration: '011', kind: 'table' },
  { pattern: /touch_site_state/i,    migration: '011', kind: 'function' },

  // Migration 012 — set_current_edition(), create_edition_from_template(),
  //                 restore_log_entry(), purge_activity_log(), set_last_backup_at()
  //                 site_state.last_backup_at
  { pattern: /set_current_edition/i,          migration: '012', kind: 'function' },
  { pattern: /create_edition_from_template.*8/i, migration: '012', kind: 'function' },
  { pattern: /create_edition_from_template/i, migration: '017', kind: 'function' },
  { pattern: /restore_log_entry/i,            migration: '012', kind: 'function' },
  { pattern: /purge_activity_log/i,           migration: '012', kind: 'function' },
  { pattern: /set_last_backup_at/i,           migration: '012', kind: 'function' },
  { pattern: /last_backup_at/i,               migration: '012', kind: 'column' },

  // Migration 013 — editions.state, editions.subtitle_i18n, editions.theme_highlight_i18n,
  //                 editions.hero_poster_url, editions.hero_video_url, editions.summary_i18n,
  //                 editions.cover_image_url, page_sections, page_section_items,
  //                 guard_edition_is_current(), set_current_edition updated
  { pattern: /subtitle_i18n/i,         migration: '013', kind: 'column' },
  { pattern: /theme_highlight_i18n/i,  migration: '013', kind: 'column' },
  { pattern: /hero_poster_url/i,        migration: '013', kind: 'column' },
  { pattern: /hero_video_url/i,         migration: '013', kind: 'column' },
  { pattern: /cover_image_url/i,        migration: '013', kind: 'column' },
  { pattern: /page_sections/i,          migration: '013', kind: 'table' },
  { pattern: /page_section_items/i,     migration: '013', kind: 'table' },
  { pattern: /guard_edition_is_current/i, migration: '013', kind: 'function' },
  // editions.state column (but not content_state type)
  { pattern: /\beditions\b.*\bstate\b|\bstate\b.*\beditions\b/i, migration: '013', kind: 'column' },

  // Migration 014 — get_public_content()
  { pattern: /get_public_content/i, migration: '014', kind: 'function' },

  // Migration 015 — committee_members.committee_key, committee_members.is_leader,
  //                 committee_members.edition_id, gallery_items.thumb_url,
  //                 committee_key_enum
  { pattern: /committee_key/i,         migration: '015', kind: 'column' },
  { pattern: /is_leader/i,             migration: '015', kind: 'column' },
  { pattern: /committee_key_enum/i,    migration: '015', kind: 'type' },
  { pattern: /thumb_url/i,             migration: '015', kind: 'column' },
  // edition_id on committee_members (the column itself; FK)
  { pattern: /committee_members.*edition_id|edition_id.*committee_members/i, migration: '015', kind: 'column' },

  // Migration 016 — system_check()
  { pattern: /system_check/i, migration: '016', kind: 'function' },

  // Migration 017 — edition_days, committee_member_contacts, logo_url, about_i18n,
  //                 bio_i18n, department, publish_edition(), validate_event_day_range()
  { pattern: /edition_days/i,                 migration: '017', kind: 'table' },
  { pattern: /committee_member_contacts/i,    migration: '017', kind: 'table' },
  { pattern: /logo_url.*editions|editions.*logo_url/i, migration: '017', kind: 'column' },
  { pattern: /about_i18n/i,                   migration: '017', kind: 'column' },
  { pattern: /bio_i18n/i,                     migration: '017', kind: 'column' },
  { pattern: /\bdepartment\b.*committee|\bcommittee\b.*\bdepartment\b/i, migration: '017', kind: 'column' },
  { pattern: /publish_edition/i,              migration: '017', kind: 'function' },
  { pattern: /validate_event_day_range/i,     migration: '017', kind: 'function' },
  { pattern: /show_public/i,                  migration: '017', kind: 'column' },
]

// PostgREST / Postgres error codes that mean "schema is out of date"
const MISSING_UPDATE_CODES = new Set([
  'PGRST204', // column not in schema cache
  'PGRST202', // function not found
  '42703',    // column does not exist
  '42P01',    // table or view does not exist
  '42883',    // function does not exist (Postgres native)
])

function isMissingUpdate(code: string | null | undefined): boolean {
  return !!code && MISSING_UPDATE_CODES.has(code.trim().toUpperCase())
}

function migrationHint(text: string): string | null {
  for (const entry of MIGRATION_HINT_MAP) {
    if (entry.pattern.test(text)) {
      return `Your database is missing an update (${entry.kind} from migration ${entry.migration}). Ask the administrator to apply migration ${entry.migration}.`
    }
  }
  return null
}

/** A conflict occurs when the row was updated by someone else after we loaded it. */
export function isConflictError(
  error: unknown,
  affectedRows: number
): boolean {
  if (error) {
    const pgErr = error as PostgrestError
    // 409 Conflict or 42501 when the WITH CHECK fails after USING passes
    if (pgErr.code === '409' || pgErr.code === '23505') return true
  }
  // Update returned 0 rows = the updated_at guard didn't match
  return affectedRows === 0
}

/** Detect network / paused-project errors. */
export function isUnreachable(error: unknown): boolean {
  if (!error) return false
  const msg = (error as Error).message ?? ''
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ERR_NAME_NOT_RESOLVED') ||
    msg.includes('timeout') ||
    msg.includes('fetch') && msg.includes('failed')
  )
}

/** Friendly message for Supabase connection issues. */
export const UNREACHABLE_MSG =
  'The database is not reachable. It may be paused: ask an administrator to resume the Supabase project.'

/** Conflict message for optimistic-concurrency. */
export const CONFLICT_MSG =
  'Someone else changed this item. Reload to see their changes.'

/**
 * Turn any thrown value into a human-readable string.
 *
 * Priority:
 *  1. If the error code indicates a missing schema update (PGRST204, 42703,
 *     42P01, PGRST202), return an actionable "apply migration NNN" message.
 *  2. Otherwise surface message, details, hint, code from PostgREST / Error.
 *  3. Fall back to JSON stringify to avoid "[object Object]".
 */
export function formatError(err: unknown): string {
  if (!err) return 'An unknown error occurred.'

  if (typeof err === 'object') {
    const e = err as Record<string, unknown>

    // Extract code, message, details, hint regardless of object shape
    const code    = typeof e.code    === 'string' ? e.code    : null
    const rawMsg  = typeof e.message === 'string' ? e.message : null
    const detail  = typeof e.details === 'string' ? e.details : null
    const hint    = typeof e.hint    === 'string' ? e.hint    : null

    // ── Missing-update detection ──
    // Check the error code first, then search the combined text for known names.
    if (isMissingUpdate(code)) {
      const combined = [rawMsg, detail, hint, code].filter(Boolean).join(' ')
      const h = migrationHint(combined)
      if (h) return h
      // Unknown column/table/function — generic message
      return `Your database is missing an update (${combined || code}). Ask the administrator to apply the latest migrations.`
    }

    // Also catch cases where PostgREST doesn't return a code but the message
    // contains keywords like "column ... does not exist" or "relation ... does not exist"
    if (rawMsg) {
      const isSchemaMsg = /column\b.*\bdoes not exist|relation\b.*\bdoes not exist|function\b.*\bdoes not exist|schema cache/i.test(rawMsg)
      if (isSchemaMsg) {
        const h = migrationHint(rawMsg + ' ' + (detail ?? '') + ' ' + (hint ?? ''))
        if (h) return h
        return `Your database is missing an update (${rawMsg}). Ask the administrator to apply the latest migrations.`
      }
    }

    // ── Standard error formatting ──
    if (err instanceof Error) {
      const parts = [rawMsg ?? '']
      if (detail) parts.push(`Details: ${detail}`)
      if (hint)   parts.push(`Hint: ${hint}`)
      if (code)   parts.push(`Code: ${code}`)
      return parts.join(' · ')
    }

    if (rawMsg) {
      const parts = [rawMsg]
      if (detail) parts.push(`Details: ${detail}`)
      if (hint)   parts.push(`Hint: ${hint}`)
      if (code)   parts.push(`Code: ${code}`)
      return parts.join(' · ')
    }

    try { return JSON.stringify(err) } catch { return 'An unknown error occurred.' }
  }

  if (typeof err === 'string') return err || 'An unknown error occurred.'
  return 'An unknown error occurred.'
}

/**
 * Slugify a string into a URL-safe slug.
 * "Street Cultural Show" → "street-cultural-show"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')      // remove non-word chars
    .replace(/\s+/g, '-')          // spaces to hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')       // trim leading/trailing hyphens
}
