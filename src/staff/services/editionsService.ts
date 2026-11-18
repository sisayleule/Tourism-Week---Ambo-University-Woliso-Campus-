/**
 * editionsService.ts — Edition queries for the staff portal.
 *
 * Uses the edition_public view (which adds the computed `status` field)
 * and the editions table directly.
 */

import { supabase } from '../../lib/supabase'
import type { EditionPublic, Edition } from '../../types/database'
import { UNREACHABLE_MSG } from './helpers'

/** Fetch all editions with computed status, newest first by number. */
export async function fetchEditions(): Promise<EditionPublic[]> {
  const { data, error } = await supabase
    .from('edition_public')
    .select('*')
    .order('number', { ascending: false })

  if (error) throw new Error(UNREACHABLE_MSG)
  return (data ?? []) as unknown as EditionPublic[]
}

/** Fetch a single edition by id with computed status. */
export async function fetchEditionById(id: string): Promise<EditionPublic | null> {
  const { data, error } = await supabase
    .from('edition_public')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(UNREACHABLE_MSG)
  return data as unknown as EditionPublic
}

/** Fetch the current edition (is_current = true). */
export async function fetchCurrentEdition(): Promise<EditionPublic | null> {
  const { data, error } = await supabase
    .from('edition_public')
    .select('*')
    .eq('is_current', true)
    .single()

  if (error || !data) return null
  return data as unknown as EditionPublic
}
