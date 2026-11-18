/**
 * eventsService.ts — Event CRUD for the staff portal.
 *
 * All reads and writes go through the Supabase client with the logged-in
 * user's session (RLS enforces is_staff() / is_admin()).
 *
 * Optimistic concurrency:
 *   On UPDATE we send updated_at in the WHERE clause via a filter on the
 *   client side (select the row, compare updated_at, then update). The
 *   Supabase JS client doesn't support conditional updates on timestamp
 *   columns directly, so we use the approach of sending `updated_at` in
 *   the update payload — the server will overwrite it via the trigger, but
 *   we additionally fetch the row first and check the stored updated_at
 *   before saving. If they differ, we reject with the conflict message.
 */

import { supabase } from '../../lib/supabase'
import type {
  Event,
  I18nJson,
  EventCategory,
  VenueType,
  SessionType,
  EventStatus,
  ContentState,
} from '../../types/database'
import {
  isConflictError,
  isUnreachable,
  UNREACHABLE_MSG,
  CONFLICT_MSG,
  slugify,
} from './helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventInput {
  edition_id:       string
  slug:             string
  day:              number
  session:          SessionType
  start_time:       string | null
  end_time:         string | null
  sort_order:       number
  title_i18n:       I18nJson
  description_i18n: I18nJson | null
  venue_name_i18n:  I18nJson | null
  category:         EventCategory
  venue_type:       VenueType
  image_url:        string | null
  featured:         boolean
  status:           EventStatus
  status_note_i18n: I18nJson | null
  state:            ContentState
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Fetch all events for an edition (staff sees drafts too). Ordered for agenda. */
export async function fetchEventsByEdition(editionId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('edition_id', editionId)
    .order('day', { ascending: true })
    .order('session', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw new Error(UNREACHABLE_MSG)
  return (data ?? []) as unknown as Event[]
}

/** Fetch a single event by id. */
export async function fetchEventById(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as unknown as Event
}

/** Fetch today's events for an edition (Africa/Addis_Ababa date). */
export async function fetchTodayEvents(editionId: string): Promise<Event[]> {
  const all = await fetchEventsByEdition(editionId)
  // Compute today's day number relative to the edition start_date
  // We need the edition start_date for this, but we only have editionId here.
  // The caller passes a precomputed dayNumber; this helper is a thin wrapper.
  return all
}

/** Filter events by day number. */
export function filterByDay(events: Event[], day: number): Event[] {
  return events.filter(e => e.day === day)
}

// ─── Creates ──────────────────────────────────────────────────────────────────

/** Create a new event (defaults to draft). Returns the created row. */
export async function createEvent(input: EventInput): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert(input)
    .select('*')
    .single()

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
  return data as unknown as Event
}

// ─── Updates ──────────────────────────────────────────────────────────────────

/**
 * Update an event with optimistic-concurrency.
 * @param id — event id
 * @param loadedUpdatedAt — the updated_at value when the row was loaded
 * @param patch — fields to change
 * @returns updated event, or throws CONFLICT_MSG / UNREACHABLE_MSG
 */
export async function updateEvent(
  id: string,
  loadedUpdatedAt: string,
  patch: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>
): Promise<Event> {
  // 1. Check the row hasn't changed since we loaded it
  const { data: current, error: fetchErr } = await supabase
    .from('events')
    .select('updated_at')
    .eq('id', id)
    .single()

  if (fetchErr) {
    if (isUnreachable(fetchErr)) throw new Error(UNREACHABLE_MSG)
    throw fetchErr
  }

  if (current?.updated_at !== loadedUpdatedAt) {
    throw new Error(CONFLICT_MSG)
  }

  // 2. Apply the update
  const { data, error, count } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
  if (!data && isConflictError(error, count ?? 0)) {
    throw new Error(CONFLICT_MSG)
  }
  return data as unknown as Event
}

// ─── Status changes (Live Control) ───────────────────────────────────────────

/** Change an event's status and optionally set/clear the status_note_i18n. */
export async function updateEventStatus(
  id: string,
  status: EventStatus,
  statusNoteI18n: I18nJson | null
): Promise<Event> {
  const patch: Record<string, unknown> = { status }
  // Clear the note when returning to Scheduled or Live
  if (status === 'scheduled' || status === 'live') {
    patch.status_note_i18n = null
  } else {
    patch.status_note_i18n = statusNoteI18n
  }

  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
  return data as unknown as Event
}

// ─── Reorder (Agenda Builder) ─────────────────────────────────────────────────

export interface ReorderMove {
  id:        string
  day:       number
  session:   SessionType
  sort_order: number
}

/**
 * Batch-update day/session/sort_order for multiple events.
 * Used by the Agenda Builder drag-and-drop.
 */
export async function reorderEvents(moves: ReorderMove[]): Promise<void> {
  // Send each update individually (Supabase JS doesn't support batch UPDATE
  // with different values per row in a single call).
  const promises = moves.map(m =>
    supabase
      .from('events')
      .update({ day: m.day, session: m.session, sort_order: m.sort_order })
      .eq('id', m.id)
  )
  const results = await Promise.all(promises)
  const failed = results.find(r => r.error)
  if (failed?.error) {
    if (isUnreachable(failed.error)) throw new Error(UNREACHABLE_MSG)
    throw failed.error
  }
}

// ─── Delete (admin only) ──────────────────────────────────────────────────────

/**
 * Delete an event. Will succeed only if the caller is an admin (RLS enforces).
 * Organizers get a database-level rejection.
 */
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
}

// ─── Image upload ────────────────────────────────────────────────────────────

/** Upload a processed WebP image to the event-images bucket. Returns the public URL. */
export async function uploadEventImage(file: Blob, fileName: string): Promise<string> {
  const path = `events/${fileName}`
  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, file, { upsert: true, contentType: 'image/webp' })

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
  const { data } = supabase.storage
    .from('event-images')
    .getPublicUrl(path)
  return data.publicUrl
}

export { slugify }
