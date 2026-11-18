/**
 * announcementsService.ts — Announcement CRUD for the staff portal.
 *
 * Announcements default to state='published' (instant publish).
 * Any staff member (is_staff) can create, update, and delete.
 */

import { supabase } from '../../lib/supabase'
import type {
  Announcement,
  I18nJson,
  AnnouncementType,
  ContentState,
} from '../../types/database'
import {
  isUnreachable,
  UNREACHABLE_MSG,
  formatError,
} from './helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnnouncementInput {
  message_i18n: I18nJson
  type:         AnnouncementType
  link:         string | null
  starts_at:    string  // ISO timestamp
  expires_at:   string | null
  state:        ContentState
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Fetch all announcements, newest first. Staff sees all regardless of window. */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw new Error(formatError(error))
  }
  return (data ?? []) as unknown as Announcement[]
}

/** Fetch a single announcement by id. */
export async function fetchAnnouncementById(id: string): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as unknown as Announcement
}

// ─── Creates ──────────────────────────────────────────────────────────────────

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .insert(input)
    .select('*')
    .single()

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
  return data as unknown as Announcement
}

// ─── Updates ──────────────────────────────────────────────────────────────────

export async function updateAnnouncement(
  id: string,
  patch: Partial<Omit<Announcement, 'id' | 'created_at' | 'updated_at'>>
): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
  return data as unknown as Announcement
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw error
  }
}

// ─── Unpublish ─────────────────────────────────────────────────────────────────

/** Set an announcement to draft (unpublish it). */
export async function unpublishAnnouncement(id: string): Promise<void> {
  await updateAnnouncement(id, { state: 'draft' })
}
