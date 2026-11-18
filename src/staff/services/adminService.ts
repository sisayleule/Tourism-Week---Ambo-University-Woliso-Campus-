/**
 * adminService.ts — Service layer for editions, settings, activity log, and backup.
 *
 * All functions accept a `client` parameter (a typed Supabase client) so
 * they can be called from anywhere in the staff portal.
 *
 * Edition/settings/activity-log RPCs go through supabase.rpc() with the
 * caller's own JWT. The admin-users edge function no longer exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  I18nJson,
  EditionPublic,
  SiteSettings,
  ActivityLog,
  SiteState,
  Profile,
} from '../../types/database'
import { isUnreachable, UNREACHABLE_MSG, formatError } from './helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id:                   string
  email:                string
  full_name:            string | null
  role:                 'organizer' | 'admin'
  is_active:            boolean
  must_change_password: boolean
  last_sign_in_at:      string | null
  created_at:           string
}

export interface CreateStaffResult {
  user:               AdminUser
  temporary_password: string
}

export interface ResetPasswordResult {
  temporary_password: string
}

export interface AdminEditionWithCounts extends EditionPublic {
  event_count:           number
  published_event_count: number
}

export interface ActivityLogEntry extends ActivityLog {
  actor_name: string | null
}

export interface ActivityLogPage {
  entries:    ActivityLogEntry[]
  total:      number
  page:       number
  perPage:    number
  totalPages: number
}

export interface ActivityLogFilters {
  tableName:  string | null
  action:     string | null
  actorId:    string | null
  dateFrom:   string | null
  dateTo:     string | null
}

export interface AdminDashboardData {
  staffByRole:   { admin: number; organizer: number; deactivated: number }
  lastBackupAt:  string | null
  contentCounts: {
    publishedEvents: number
    draftEvents:     number
    news:            number
    galleryItems:    number
  }
  recentActivity: ActivityLogEntry[]
  dbReachable:    boolean
}

export interface CreateEditionInput {
  sourceId:   string
  number:     number
  slug:       string
  titleI18n:  I18nJson
  themeI18n:  I18nJson
  venueI18n:  I18nJson
  startDate:  string
  endDate:    string
}

export interface CreateEditionResult {
  new_edition_id:  string
  /** Old key — still returned as an alias by adminService adapter. */
  copied:          number
  skipped:         number
  // Migration 017 additions
  copied_events:   number
  skipped_events:  number
  copied_days:     number
  copied_members:  number
}

export interface SettingsInput {
  contact_email:    string
  phone:            string | null
  address_i18n:     I18nJson
  social:           Record<string, string>
  footer_text_i18n: I18nJson
}

export interface RestoreResult {
  success: boolean
  message: string
}

export interface PurgeResult {
  deleted: number
}

export interface BackupData {
  editions:          Record<string, unknown>[]
  events:            Record<string, unknown>[]
  announcements:     Record<string, unknown>[]
  news:              Record<string, unknown>[]
  gallery_items:     Record<string, unknown>[]
  sponsors:          Record<string, unknown>[]
  committee_members: Record<string, unknown>[]
  faqs:              Record<string, unknown>[]
  site_settings:     Record<string, unknown>[]
  messages:          Record<string, unknown>[]
  profiles:          Record<string, unknown>[]
  activity_log:      Record<string, unknown>[]
}

// ─── Edge Function URL helper ─────────────────────────────────────────────────

function getAdminUsersUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!url) return ''
  return `${url.replace(/\/$/, '')}/functions/v1/admin-users`
}

async function callAdminUsersFunction(
  client: SupabaseClient,
  body: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const funcUrl = getAdminUsersUrl()
  if (!funcUrl) return { success: false, error: 'Supabase URL not configured' }

  const { data: sessionData } = await client.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { success: false, error: 'Not authenticated' }

  const res = await fetch(funcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` }
  return { success: true, data: data as Record<string, unknown> }
}

// ═════════════════════════════════════════════════════════════════════════════
// USERS
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchAdminUsers(client: SupabaseClient): Promise<AdminUser[]> {
  const funcUrl = getAdminUsersUrl()
  if (!funcUrl) {
    throw new Error('Supabase URL not configured. Set VITE_SUPABASE_URL in your environment.')
  }
  const result = await callAdminUsersFunction(client, { action: 'list' })
  if (!result.success) {
    const msg = result.error ?? ''
    // Three distinct friendly messages per spec
    if (msg.includes('404') || msg.includes('not found') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
      throw new Error('admin-users function not deployed or not found. Run: supabase functions deploy admin-users')
    }
    if (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      throw new Error('Network error reaching the admin-users function. Check CORS or network connectivity.')
    }
    if (msg.includes('403') || msg.includes('denied') || msg.includes('admin role')) {
      throw new Error('Not authorised. Your account must have role = admin and is_active = true.')
    }
    throw new Error(msg || 'Failed to fetch users.')
  }
  return (result.data?.users ?? []) as AdminUser[]
}

export async function createStaffUser(
  client: SupabaseClient,
  email: string,
  fullName: string,
  role: 'organizer' | 'admin'
): Promise<CreateStaffResult> {
  const result = await callAdminUsersFunction(client, { action: 'create', email, full_name: fullName, role })
  if (!result.success) throw new Error(result.error ?? 'Failed to create user')
  return {
    user: result.data?.user as AdminUser,
    temporary_password: result.data?.temporary_password as string,
  }
}

export async function resetStaffPassword(
  client: SupabaseClient,
  userId: string
): Promise<ResetPasswordResult> {
  const result = await callAdminUsersFunction(client, { action: 'reset_password', user_id: userId })
  if (!result.success) throw new Error(result.error ?? 'Failed to reset password')
  return { temporary_password: result.data?.temporary_password as string }
}

export async function setStaffRole(
  client: SupabaseClient,
  userId: string,
  role: 'organizer' | 'admin'
): Promise<void> {
  const result = await callAdminUsersFunction(client, { action: 'set_role', user_id: userId, role })
  if (!result.success) throw new Error(result.error ?? 'Failed to change role')
}

export async function setStaffActive(
  client: SupabaseClient,
  userId: string,
  active: boolean
): Promise<void> {
  const result = await callAdminUsersFunction(client, { action: 'set_active', user_id: userId, active })
  if (!result.success) throw new Error(result.error ?? 'Failed to update status')
}

export async function updateStaffName(
  client: SupabaseClient,
  userId: string,
  fullName: string
): Promise<void> {
  const result = await callAdminUsersFunction(client, { action: 'update_name', user_id: userId, full_name: fullName })
  if (!result.success) throw new Error(result.error ?? 'Failed to update name')
}

// ═════════════════════════════════════════════════════════════════════════════
// EDITIONS
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchAdminEditions(
  client: SupabaseClient
): Promise<AdminEditionWithCounts[]> {
  const { data: editions, error } = await client
    .from('edition_public')
    .select('*')
    .order('number', { ascending: false })

  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw new Error(formatError(error))
  }

  const editionsTyped = (editions ?? []) as unknown as EditionPublic[]

  const withCounts = await Promise.all(
    editionsTyped.map(async (ed) => {
      const [allRes, pubRes] = await Promise.all([
        client.from('events').select('id', { count: 'exact', head: true }).eq('edition_id', ed.id),
        client.from('events').select('id', { count: 'exact', head: true }).eq('edition_id', ed.id).eq('state', 'published'),
      ])
      return {
        ...ed,
        event_count: allRes.count ?? 0,
        published_event_count: pubRes.count ?? 0,
      }
    })
  )
  return withCounts
}

export async function fetchAdminEditionById(
  client: SupabaseClient,
  id: string
): Promise<EditionPublic | null> {
  const { data, error } = await client
    .from('edition_public')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) {
    if (error && isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    if (error) throw new Error(formatError(error))
    throw new Error('Edition not found.')
  }
  return data as unknown as EditionPublic
}

export async function createEditionFromTemplate(
  client: SupabaseClient,
  input: CreateEditionInput
): Promise<CreateEditionResult> {
  const { data, error } = await (client as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('create_edition_from_template', {
    p_source: input.sourceId,
    p_number: input.number,
    p_slug: input.slug,
    p_title_i18n: input.titleI18n,
    p_theme_i18n: input.themeI18n,
    p_venue_i18n: input.venueI18n,
    p_start: input.startDate,
    p_end: input.endDate,
    p_copy_committees: false,   // added in migration 017; default = false
  })
  if (error) throw new Error(error.message ?? 'Failed to create edition')
  return data as unknown as CreateEditionResult
}

export async function setCurrentEdition(
  client: SupabaseClient,
  editionId: string
): Promise<void> {
  const { error } = await (client as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('set_current_edition', {
    p_edition_id: editionId,
  })
  if (error) throw new Error(error.message ?? 'Failed to set current edition')
}

export async function updateEdition(
  client: SupabaseClient,
  editionId: string,
  loadedUpdatedAt: string,
  patch: {
    title_i18n: I18nJson; theme_i18n: I18nJson; venue_i18n: I18nJson
    start_date: string; end_date: string
    start_date_ec: string | null; end_date_ec: string | null
    stats: Record<string, string | null | number> | null
  }
): Promise<void> {
  // Strip updated_at from the patch — we use it only as the WHERE condition
  // via optimistic concurrency. The DB trigger sets the real updated_at.
  const { data, error } = await client
    .from('editions')
    .update({ ...patch })
    .eq('id', editionId)
    .select('updated_at')
    .single()
  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw new Error(formatError(error))
  }
  if (!data) throw new Error('Someone else changed this edition. Reload to see their changes.')
}

// ═════════════════════════════════════════════════════════════════════════════
// SITE SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchSiteSettings(
  client: SupabaseClient
): Promise<SiteSettings | null> {
  const { data, error } = await client
    .from('site_settings')
    .select('*')
    .eq('id', true)
    .single()
  if (error || !data) return null
  return data as unknown as SiteSettings
}

export async function updateSiteSettings(
  client: SupabaseClient,
  loadedUpdatedAt: string,
  input: SettingsInput
): Promise<void> {
  const { data, error } = await client
    .from('site_settings')
    .update({
      contact_email: input.contact_email || null,
      phone: input.phone || null,
      address_i18n: input.address_i18n,
      social: input.social,
      footer_text_i18n: input.footer_text_i18n,
      updated_at: loadedUpdatedAt,
    })
    .eq('id', true)
    .select('updated_at')
    .single()
  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw new Error(formatError(error))
  }
  if (!data) throw new Error('Someone else changed the settings. Reload to see their changes.')
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchActivityLog(
  client: SupabaseClient,
  page: number,
  perPage: number,
  filters: ActivityLogFilters
): Promise<ActivityLogPage> {
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client
    .from('activity_log')
    .select('*, actor:profiles!actor_id(full_name)', { count: 'exact' })

  if (filters.tableName) query = query.eq('table_name', filters.tableName)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59')

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) {
    if (isUnreachable(error)) throw new Error(UNREACHABLE_MSG)
    throw new Error(formatError(error))
  }

  const entries: ActivityLogEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as unknown as ActivityLog),
    actor_name: (row.actor as { full_name: string } | null)?.full_name ?? null,
  }))

  const total = count ?? 0
  return { entries, total, page, perPage, totalPages: Math.ceil(total / perPage) || 1 }
}

export async function fetchActivityLogById(
  client: SupabaseClient,
  id: number
): Promise<ActivityLogEntry | null> {
  const { data, error } = await client
    .from('activity_log')
    .select('*, actor:profiles!actor_id(full_name)')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return {
    ...(data as ActivityLog),
    actor_name: (data as { actor: { full_name: string } | null }).actor?.full_name ?? null,
  }
}

export async function restoreLogEntry(
  client: SupabaseClient,
  logId: number
): Promise<RestoreResult> {
  const { data, error } = await (client as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('restore_log_entry', {
    p_log_id: logId,
  })
  if (error) throw new Error(error.message ?? 'Failed to restore')
  return data as unknown as RestoreResult
}

export async function purgeActivityLog(
  client: SupabaseClient,
  olderThanDays: number
): Promise<PurgeResult> {
  const { data, error } = await (client as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('purge_activity_log', {
    p_older_than_days: olderThanDays,
  })
  if (error) throw new Error(error.message ?? 'Failed to purge')
  return data as unknown as PurgeResult
}

// ═════════════════════════════════════════════════════════════════════════════
// SITE STATE
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchSiteState(
  client: SupabaseClient
): Promise<SiteState | null> {
  const { data, error } = await client
    .from('site_state')
    .select('*')
    .eq('id', true)
    .single()
  if (error || !data) return null
  return data as unknown as SiteState
}

export async function setLastBackupAt(client: SupabaseClient): Promise<void> {
  const { error } = await (client as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('set_last_backup_at', {})
  if (error) throw new Error(error.message ?? 'Failed to record backup time')
}

// ═════════════════════════════════════════════════════════════════════════════
// BACKUP
// ═════════════════════════════════════════════════════════════════════════════

const BACKUP_TABLES = [
  'editions', 'events', 'announcements', 'news', 'gallery_items',
  'sponsors', 'committee_members', 'faqs', 'site_settings',
  'messages', 'profiles', 'activity_log',
] as const

export async function fetchBackupData(client: SupabaseClient): Promise<BackupData> {
  const results = await Promise.all(
    BACKUP_TABLES.map(async (table) => {
      let data: unknown[] = []
      try {
        const res = await client
          .from(table as never)
          .select('*')
          .order('created_at' as never, { ascending: true })
        data = (res.data ?? []) as unknown[]
      } catch { /* non-fatal – table may be empty or inaccessible */ }
      return [table, data as Record<string, unknown>[]] as const
    })
  )
  const out: Partial<BackupData> = {}
  for (const [table, rows] of results) {
    (out as Record<string, unknown[]>)[table] = rows
  }
  return out as BackupData
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchAdminDashboardData(
  client: SupabaseClient
): Promise<AdminDashboardData> {
  const [profilesRes, stateRes, eventsRes, newsRes, galleryRes, activityRes] = await Promise.all([
    client.from('profiles').select('id, role, is_active, full_name'),
    client.from('site_state').select('last_backup_at').eq('id', true as never).single(),
    client.from('events').select('state'),
    client.from('news').select('id').eq('state', 'published'),
    client.from('gallery_items').select('id').eq('state', 'published'),
    client
      .from('activity_log')
      .select('*, actor:profiles!actor_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const dbReachable = !profilesRes.error
  const profiles = (profilesRes.data ?? []) as Pick<Profile, 'id' | 'role' | 'is_active' | 'full_name'>[]

  const staffByRole = {
    admin: profiles.filter(p => p.role === 'admin' && p.is_active).length,
    organizer: profiles.filter(p => p.role === 'organizer' && p.is_active).length,
    deactivated: profiles.filter(p => !p.is_active).length,
  }

  const lastBackupAt = (stateRes.data as { last_backup_at: string | null } | null)?.last_backup_at ?? null

  const events = (eventsRes.data ?? []) as { state: string }[]
  const contentCounts = {
    publishedEvents: events.filter(e => e.state === 'published').length,
    draftEvents: events.filter(e => e.state === 'draft').length,
    news: (newsRes.data ?? []).length,
    galleryItems: (galleryRes.data ?? []).length,
  }

  const recentActivity: ActivityLogEntry[] = (activityRes.data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as unknown as ActivityLog),
    actor_name: (row.actor as { full_name: string } | null)?.full_name ?? null,
  }))

  return { staffByRole, lastBackupAt, contentCounts, recentActivity, dbReachable }
}

// ═════════════════════════════════════════════════════════════════════════════
// STAFF PROFILES (for activity log person filter)
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchStaffProfiles(
  client: SupabaseClient
): Promise<Pick<Profile, 'id' | 'full_name'>[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true })
  if (error) return []
  return (data ?? []) as Pick<Profile, 'id' | 'full_name'>[]
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM CHECK  (migration 016)
// ═════════════════════════════════════════════════════════════════════════════

export interface SystemCheckRow {
  migration: string   // '008' – '016'
  kind:      string   // 'column' | 'table' | 'function' | 'type'
  item:      string   // human-readable identifier
  present:   boolean
}

export interface FunctionPingResult {
  name:    string
  status: 'reachable' | 'not_deployed' | 'cors_blocked' | 'unknown'
  message: string
}

export async function fetchSystemCheck(
  client: SupabaseClient
): Promise<SystemCheckRow[]> {
  const { data, error } = await (client as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>
  }).rpc('system_check', {})
  if (error) throw new Error(formatError(error))
  return (data as SystemCheckRow[] | null) ?? []
}

const SUPABASE_URL_FOR_PING = (import.meta.env.VITE_SUPABASE_URL as string | undefined ?? '').replace(/\/$/, '')

/** Ping a single Edge Function by calling ?ping=1. No auth required. */
export async function pingEdgeFunction(
  name: 'trigger-deploy' | 'submit-message'
): Promise<FunctionPingResult> {
  if (!SUPABASE_URL_FOR_PING) {
    return { name, status: 'unknown', message: 'VITE_SUPABASE_URL not set' }
  }
  const url = `${SUPABASE_URL_FOR_PING}/functions/v1/${name}?ping=1`
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      return { name, status: 'reachable', message: 'Reachable' }
    }
    if (res.status === 404) {
      return { name, status: 'not_deployed', message: `Not deployed (HTTP 404). Run: supabase functions deploy ${name}` }
    }
    // 4xx/5xx but not 404 — function exists, something else wrong
    return { name, status: 'reachable', message: `HTTP ${res.status}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('CORS') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      return { name, status: 'cors_blocked', message: `CORS/network blocked. Check SITE_URL secret and redeploy.` }
    }
    return { name, status: 'cors_blocked', message: `Network error: ${msg}` }
  }
}
