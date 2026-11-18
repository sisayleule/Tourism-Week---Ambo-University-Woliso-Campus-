/**
 * setupService.ts — Data access layer for the Event Setup wizard.
 *
 * All reads and writes are through the portal's Supabase client so the
 * same service works throughout the staff portal.
 *
 * Rules:
 *  - No service_role key — only the portal client (anon key + user JWT)
 *  - Concurrency checks (updated_at guard) on edition and event updates
 *  - formatError used for all thrown errors
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatError, isConflictError, CONFLICT_MSG } from './helpers'
import type {
  I18nJson,
  Edition,
  EditionPublic,
  EditionDay,
  CommitteeMember,
  CommitteeMemberContact,
  CommitteeKey,
  PublishEditionResult,
  ContentState,
  SessionType,
  EventCategory,
  VenueType,
} from '../../types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetupEdition extends EditionPublic {
  event_count:           number
  published_event_count: number
  day_count:             number
  leader_count:          number   // committee members where is_leader = true
}

export interface SetupCommitteeMemberFull extends CommitteeMember {
  contact: CommitteeMemberContact | null
}

export interface EditionDayPatch {
  title_i18n?:       I18nJson | null
  description_i18n?: I18nJson | null
}

export interface SetupEventInput {
  edition_id:        string
  slug:              string
  day:               number
  session:           SessionType
  start_time?:       string | null
  end_time?:         string | null
  sort_order?:       number
  title_i18n:        I18nJson
  description_i18n?: I18nJson | null
  venue_name_i18n?:  I18nJson | null
  category:          EventCategory
  venue_type:        VenueType
  image_url?:        string | null
  featured?:         boolean
  state?:            ContentState
}

// ─── Editions ─────────────────────────────────────────────────────────────────

export async function fetchSetupEditions(
  client: SupabaseClient
): Promise<SetupEdition[]> {
  const { data, error } = await client
    .from('editions')
    .select(`
      *,
      event_count:events(count),
      published_event_count:events!inner(count)
    `)
    .order('number', { ascending: false })

  if (error) {
    // Fallback: simple select without counts
    const { data: simple, error: err2 } = await client
      .from('editions')
      .select('*')
      .order('number', { ascending: false })
    if (err2) throw new Error(formatError(err2))
    return (simple ?? []).map(e => ({
      ...e,
      status: computeStatus(e.start_date, e.end_date),
      event_count: 0,
      published_event_count: 0,
      leader_count: 0,
      day_count: e.start_date && e.end_date
        ? Math.round((new Date(e.end_date + 'T00:00:00Z').getTime() - new Date(e.start_date + 'T00:00:00Z').getTime()) / 86400000) + 1
        : 0,
    })) as SetupEdition[]
  }

  const editions = ((data ?? []) as unknown as (Edition & {
    event_count: { count: number }[]
    published_event_count: { count: number }[]
  })[]).map(e => ({
    ...e,
    status: computeStatus(e.start_date, e.end_date),
    event_count: e.event_count?.[0]?.count ?? 0,
    published_event_count: e.published_event_count?.[0]?.count ?? 0,
    leader_count: 0,  // filled in below
    day_count: e.start_date && e.end_date
      ? Math.round((new Date(e.end_date + 'T00:00:00Z').getTime() - new Date(e.start_date + 'T00:00:00Z').getTime()) / 86400000) + 1
      : 0,
  })) as SetupEdition[]

  // Fetch leader counts for all editions in one query
  const editionIds = editions.map(e => e.id)
  if (editionIds.length > 0) {
    const { data: leaders } = await client
      .from('committee_members')
      .select('edition_id')
      .in('edition_id', editionIds)
      .eq('is_leader', true)
    if (leaders) {
      const leadersByEdition: Record<string, number> = {}
      for (const l of leaders) {
        leadersByEdition[l.edition_id] = (leadersByEdition[l.edition_id] ?? 0) + 1
      }
      for (const ed of editions) {
        ed.leader_count = leadersByEdition[ed.id] ?? 0
      }
    }
  }

  return editions
}

function computeStatus(start: string, end: string): 'upcoming' | 'live' | 'past' {
  const today = new Date().toISOString().split('T')[0]
  if (today < start) return 'upcoming'
  if (today <= end)  return 'live'
  return 'past'
}

export async function fetchSetupEdition(
  client: SupabaseClient,
  editionId: string
): Promise<EditionPublic> {
  const { data, error } = await client
    .from('editions')
    .select('*')
    .eq('id', editionId)
    .single()
  if (error) throw new Error(formatError(error))
  return { ...data, status: computeStatus(data.start_date, data.end_date) } as EditionPublic
}

export async function updateSetupEdition(
  client: SupabaseClient,
  editionId: string,
  loadedUpdatedAt: string,
  patch: Partial<Omit<Edition, 'id' | 'created_at' | 'updated_at'>>
): Promise<EditionPublic> {
  const { data, error, count } = await client
    .from('editions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', editionId)
    .eq('updated_at', loadedUpdatedAt)
    .select()
    .returns<Edition[]>()

  if (error || isConflictError(error, count ?? (data?.length ?? 0))) {
    if (!error) throw new Error(CONFLICT_MSG)
    throw new Error(formatError(error))
  }
  if (!data || data.length === 0) throw new Error(CONFLICT_MSG)
  return { ...data[0], status: computeStatus(data[0].start_date, data[0].end_date) }
}

// ─── Edition Days ─────────────────────────────────────────────────────────────

export async function fetchEditionDays(
  client: SupabaseClient,
  editionId: string
): Promise<EditionDay[]> {
  const { data, error } = await client
    .from('edition_days')
    .select('*')
    .eq('edition_id', editionId)
    .order('day', { ascending: true })
  if (error) throw new Error(formatError(error))
  return (data ?? []) as EditionDay[]
}

export async function upsertEditionDay(
  client: SupabaseClient,
  editionId: string,
  day: number,
  patch: EditionDayPatch
): Promise<EditionDay> {
  const { data, error } = await client
    .from('edition_days')
    .upsert(
      { edition_id: editionId, day, ...patch },
      { onConflict: 'edition_id,day' }
    )
    .select()
    .single()
  if (error) throw new Error(formatError(error))
  return data as EditionDay
}

export async function deleteEditionDay(
  client: SupabaseClient,
  editionId: string,
  day: number
): Promise<void> {
  const { error } = await client
    .from('edition_days')
    .delete()
    .eq('edition_id', editionId)
    .eq('day', day)
  if (error) throw new Error(formatError(error))
}

// ─── Committee Members ────────────────────────────────────────────────────────

export async function fetchSetupCommittee(
  client: SupabaseClient,
  editionId: string
): Promise<SetupCommitteeMemberFull[]> {
  const { data: members, error } = await client
    .from('committee_members')
    .select('*')
    .eq('edition_id', editionId)
    .order('is_leader', { ascending: false })
    .order('sort_order', { ascending: true })
  if (error) throw new Error(formatError(error))

  if (!members || members.length === 0) return []

  const memberIds = members.map(m => m.id)
  const { data: contacts } = await client
    .from('committee_member_contacts')
    .select('*')
    .in('member_id', memberIds)

  const contactMap: Record<string, CommitteeMemberContact> = {}
  for (const c of contacts ?? []) {
    contactMap[c.member_id] = c as CommitteeMemberContact
  }

  return members.map(m => ({
    ...(m as CommitteeMember),
    contact: contactMap[m.id] ?? null,
  }))
}

export async function createSetupCommitteeMember(
  client: SupabaseClient,
  input: Omit<CommitteeMember, 'id' | 'created_at' | 'updated_at'>
): Promise<CommitteeMember> {
  const { data, error } = await client
    .from('committee_members')
    .insert(input)
    .select()
    .single()
  if (error) throw new Error(formatError(error))
  return data as CommitteeMember
}

export async function updateSetupCommitteeMember(
  client: SupabaseClient,
  memberId: string,
  patch: Partial<Omit<CommitteeMember, 'id' | 'created_at' | 'updated_at'>>
): Promise<CommitteeMember> {
  const { data, error } = await client
    .from('committee_members')
    .update(patch)
    .eq('id', memberId)
    .select()
    .single()
  if (error) throw new Error(formatError(error))
  return data as CommitteeMember
}

export async function deleteSetupCommitteeMember(
  client: SupabaseClient,
  memberId: string
): Promise<void> {
  const { error } = await client
    .from('committee_members')
    .delete()
    .eq('id', memberId)
  if (error) throw new Error(formatError(error))
}

export async function upsertMemberContact(
  client: SupabaseClient,
  memberId: string,
  patch: Omit<CommitteeMemberContact, 'member_id' | 'created_at' | 'updated_at'>
): Promise<CommitteeMemberContact> {
  const { data, error } = await client
    .from('committee_member_contacts')
    .upsert({ member_id: memberId, ...patch }, { onConflict: 'member_id' })
    .select()
    .single()
  if (error) throw new Error(formatError(error))
  return data as CommitteeMemberContact
}

// ─── Events (setup wizard) ────────────────────────────────────────────────────

export async function fetchSetupEvents(
  client: SupabaseClient,
  editionId: string
): Promise<import('../../types/database').Event[]> {
  const { data, error } = await client
    .from('events')
    .select('*')
    .eq('edition_id', editionId)
    .order('day', { ascending: true })
    .order('session', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw new Error(formatError(error))
  return (data ?? []) as import('../../types/database').Event[]
}

export async function createSetupEvent(
  client: SupabaseClient,
  input: SetupEventInput
): Promise<import('../../types/database').Event> {
  const { data, error } = await client
    .from('events')
    .insert({ ...input, state: input.state ?? 'draft', sort_order: input.sort_order ?? 0 })
    .select()
    .single()
  if (error) throw new Error(formatError(error))
  return data as import('../../types/database').Event
}

export async function updateSetupEvent(
  client: SupabaseClient,
  eventId: string,
  patch: Partial<SetupEventInput>
): Promise<import('../../types/database').Event> {
  const { data, error } = await client
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single()
  if (error) throw new Error(formatError(error))
  return data as import('../../types/database').Event
}

export async function deleteSetupEvent(
  client: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await client
    .from('events')
    .delete()
    .eq('id', eventId)
  if (error) throw new Error(formatError(error))
}

export async function reorderSetupEvents(
  client: SupabaseClient,
  moves: { id: string; sort_order: number; day: number; session: SessionType }[]
): Promise<void> {
  await Promise.all(
    moves.map(m =>
      client
        .from('events')
        .update({ sort_order: m.sort_order, day: m.day, session: m.session })
        .eq('id', m.id)
    )
  )
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export async function publishEdition(
  client: SupabaseClient,
  editionId: string,
  makeCurrent: boolean
): Promise<PublishEditionResult> {
  const { data, error } = await client.rpc('publish_edition', {
    p_edition_id:   editionId,
    p_make_current: makeCurrent,
  })
  if (error) throw new Error(formatError(error))
  return data as PublishEditionResult
}

// ─── Create from template (new 9-arg signature with p_copy_committees) ────────

export interface CreateSetupEditionInput {
  sourceId:        string
  number:          number
  slug:            string
  titleI18n:       I18nJson
  themeI18n:       I18nJson
  venueI18n:       I18nJson
  startDate:       string
  endDate:         string
  copyCommittees?: boolean
}

export interface CreateSetupEditionResult {
  new_edition_id:  string
  copied_events:   number
  skipped_events:  number
  copied_days:     number
  copied_members:  number
}

export async function createEditionFromTemplate(
  client: SupabaseClient,
  input: CreateSetupEditionInput
): Promise<CreateSetupEditionResult> {
  const { data, error } = await client.rpc('create_edition_from_template', {
    p_source:           input.sourceId,
    p_number:           input.number,
    p_slug:             input.slug,
    p_title_i18n:       input.titleI18n,
    p_theme_i18n:       input.themeI18n,
    p_venue_i18n:       input.venueI18n,
    p_start:            input.startDate,
    p_end:              input.endDate,
    p_copy_committees:  input.copyCommittees ?? false,
  })
  if (error) throw new Error(formatError(error))
  return data as CreateSetupEditionResult
}

// ─── Setup progress checklist ─────────────────────────────────────────────────

export interface SetupProgress {
  hasTitle:         boolean
  hasTheme:         boolean
  hasDates:         boolean
  hasAtLeastOneEvent: boolean
  hasLogo:          boolean
  hasLeaderForAllCommittees: boolean
  allDaysHaveActivities: boolean
  hasAboutText:     boolean
  score:            number   // 0–100
  requiredComplete: boolean  // the minimum to publish
}

export function computeSetupProgress(
  edition: Edition | null,
  events: import('../../types/database').Event[],
  members: CommitteeMember[]
): SetupProgress {
  const hasTitle  = !!(edition?.title_i18n?.en?.trim())
  const hasTheme  = !!(edition?.theme_i18n?.en?.trim())
  const hasDates  = !!(edition?.start_date && edition?.end_date)
  const hasAtLeastOneEvent = events.length > 0
  const hasLogo   = !!(edition as any)?.logo_url
  const hasAboutText = !!((edition as any)?.about_i18n?.en?.trim())

  const COMMITTEES: CommitteeKey[] = [
    'publicity_promotion',
    'technical_physical',
    'sponsorship_fundraising',
    'award_beauty_contest',
    'documentation',
  ]
  const hasLeaderForAllCommittees = COMMITTEES.every(key =>
    members.some(m => m.committee_key === key && m.is_leader)
  )

  let allDaysHaveActivities = false
  if (hasDates && edition) {
    const startMs = new Date(edition.start_date + 'T00:00:00Z').getTime()
    const endMs   = new Date(edition.end_date   + 'T00:00:00Z').getTime()
    const totalDays = Math.round((endMs - startMs) / 86400000) + 1
    const activeDays = new Set(events.map(e => e.day)).size
    allDaysHaveActivities = activeDays >= totalDays
  }

  // Score: required (40 pts), recommended (60 pts)
  const req  = [hasTitle, hasTheme, hasDates, hasAtLeastOneEvent]
  const rec  = [hasLogo, hasLeaderForAllCommittees, allDaysHaveActivities, hasAboutText]
  const reqPts = req.filter(Boolean).length * 10
  const recPts = rec.filter(Boolean).length * 15
  const score  = Math.min(100, reqPts + recPts)
  const requiredComplete = req.every(Boolean)

  return {
    hasTitle,
    hasTheme,
    hasDates,
    hasAtLeastOneEvent,
    hasLogo,
    hasLeaderForAllCommittees,
    allDaysHaveActivities,
    hasAboutText,
    score,
    requiredComplete,
  }
}
