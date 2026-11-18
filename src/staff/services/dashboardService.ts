/**
 * dashboardService.ts — Aggregated dashboard data.
 *
 * Fetches everything needed for the dashboard in a single batch:
 * current edition, all events for it, live announcements,
 * and the unread (unhandled) messages count.
 */

import { supabase } from '../../lib/supabase'
import type { Event, Announcement, EditionPublic } from '../../types/database'
import { UNREACHABLE_MSG } from './helpers'

export interface DashboardData {
  edition:       EditionPublic | null
  events:         Event[]
  announcements:  Announcement[]
  unreadMessages: number
}

/** Fetch all dashboard data in parallel. */
export async function fetchDashboardData(
  editionId: string | null
): Promise<DashboardData> {
  // Step 1: resolve the edition first so we always have an edition_id for events.
  const editionResult = editionId
    ? await supabase.from('edition_public').select('*').eq('id', editionId).single()
    : await supabase.from('edition_public').select('*').eq('is_current', true).single()

  const edition = (editionResult.data ?? null) as unknown as EditionPublic | null
  const resolvedEditionId = edition?.id ?? editionId

  // Step 2: fetch events, announcements, and messages in parallel now that we
  // have the real edition_id.  Events default to empty only when truly no edition exists.
  const [eventsResult, announcementsResult, messagesResult] =
    await Promise.all([
      resolvedEditionId
        ? supabase
            .from('events')
            .select('*')
            .eq('edition_id', resolvedEditionId)
            .order('day', { ascending: true })
            .order('session', { ascending: true })
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('handled', false),
    ])

  // Check for hard errors (unreachable)
  const anyError = eventsResult.error ?? announcementsResult.error ?? messagesResult.error
  if (anyError && (anyError as Error).message?.includes('Failed to fetch')) {
    throw new Error(UNREACHABLE_MSG)
  }

  const events = (eventsResult.data ?? []) as unknown as Event[]
  const announcements = (announcementsResult.data ?? []) as unknown as Announcement[]
  const unreadMessages = messagesResult.count ?? 0

  return { edition, events, announcements, unreadMessages }
}

/** Compute the today's day number (1-based) for an edition in Africa/Addis_Ababa. */
export function computeTodayDay(
  startDate: string,
  endDate: string
): number | null {
  // Today in Addis Ababa timezone
  const now = new Date()
  const addisStr = now.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
  const today = new Date(addisStr)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  if (todayDate < start || todayDate > end) return null

  const diffMs = todayDate.getTime() - start.getTime()
  const dayNum = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1
  return dayNum
}

/** Days until the edition starts (0 if today, negative if past). */
export function daysUntilStart(startDate: string): number {
  const now = new Date()
  const addisStr = now.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
  const today = new Date(addisStr)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(startDate + 'T00:00:00')
  const diffMs = start.getTime() - todayDate.getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}
