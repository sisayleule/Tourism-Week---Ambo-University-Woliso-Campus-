/**
 * useAdminQueries.ts — TanStack Query hooks for admin-level operations
 * (editions, settings, activity log, backup).
 *
 * Every hook factory accepts a `client` parameter (the portal's own
 * Supabase client) so the same hooks work for all accounts.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scheduleDeploy } from '../lib/deployScheduler'
import {
  fetchAdminUsers,
  createStaffUser,
  resetStaffPassword,
  setStaffRole,
  setStaffActive,
  updateStaffName,
  fetchAdminEditions,
  fetchAdminEditionById,
  createEditionFromTemplate,
  setCurrentEdition,
  updateEdition,
  fetchSiteSettings,
  updateSiteSettings,
  fetchActivityLog,
  fetchActivityLogById,
  restoreLogEntry,
  purgeActivityLog,
  fetchSiteState,
  setLastBackupAt,
  fetchBackupData,
  fetchAdminDashboardData,
  fetchStaffProfiles,
  type CreateEditionInput,
  type SettingsInput,
  type ActivityLogFilters,
} from '../services/adminService'

// ─── Query key factories ──────────────────────────────────────────────────────

export const adminKeys = {
  users:          ['admin', 'users']          as const,
  editions:       ['admin', 'editions']        as const,
  edition:         (id: string) => ['admin', 'edition', id] as const,
  settings:       ['admin', 'settings']        as const,
  activity:        (page: number, perPage: number, filters: ActivityLogFilters) =>
    ['admin', 'activity', page, perPage, filters] as const,
  activityDetail:  (id: number) => ['admin', 'activity', 'detail', id] as const,
  siteState:      ['admin', 'site-state']      as const,
  dashboard:      ['admin', 'dashboard']       as const,
  staffProfiles:  ['admin', 'staff-profiles']  as const,
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useAdminUsers(client: SupabaseClient) {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn:  () => fetchAdminUsers(client),
    staleTime: 30_000,
  })
}

export function useCreateStaffUser(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { email: string; fullName: string; role: 'organizer' | 'admin' }) =>
      createStaffUser(client, p.email, p.fullName, p.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users })
      qc.invalidateQueries({ queryKey: adminKeys.dashboard })
    },
  })
}

export function useResetStaffPassword(client: SupabaseClient) {
  return useMutation({
    mutationFn: (userId: string) => resetStaffPassword(client, userId),
    onSuccess: () => { /* result returned directly */ },
  })
}

export function useSetStaffRole(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { userId: string; role: 'organizer' | 'admin' }) =>
      setStaffRole(client, p.userId, p.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users })
      qc.invalidateQueries({ queryKey: adminKeys.dashboard })
    },
  })
}

export function useSetStaffActive(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { userId: string; active: boolean }) =>
      setStaffActive(client, p.userId, p.active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users })
      qc.invalidateQueries({ queryKey: adminKeys.dashboard })
    },
  })
}

export function useUpdateStaffName(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { userId: string; fullName: string }) =>
      updateStaffName(client, p.userId, p.fullName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.users }) },
  })
}

// ─── Editions ─────────────────────────────────────────────────────────────────

export function useAdminEditions(client: SupabaseClient) {
  return useQuery({
    queryKey: adminKeys.editions,
    queryFn:  () => fetchAdminEditions(client),
    staleTime: 30_000,
  })
}

export function useAdminEdition(client: SupabaseClient, id: string | null) {
  return useQuery({
    queryKey: id ? adminKeys.edition(id) : ['admin', 'edition', 'none'],
    queryFn:  () => id ? fetchAdminEditionById(client, id) : Promise.resolve(null),
    enabled:  !!id,
  })
}

export function useCreateEditionFromTemplate(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEditionInput) => createEditionFromTemplate(client, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.editions })
      scheduleDeploy()
    },
  })
}

export function useSetCurrentEdition(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setCurrentEdition(client, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.editions })
      scheduleDeploy()
    },
  })
}

export function useUpdateEdition(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      editionId: string
      loadedUpdatedAt: string
      patch: Parameters<typeof updateEdition>[3]
    }) => updateEdition(client, p.editionId, p.loadedUpdatedAt, p.patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.editions })
      qc.invalidateQueries({ queryKey: adminKeys.edition(vars.editionId) })
      scheduleDeploy()
    },
  })
}

// ─── Site Settings ─────────────────────────────────────────────────────────────

export function useSiteSettings(client: SupabaseClient) {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn:  () => fetchSiteSettings(client),
  })
}

export function useUpdateSiteSettings(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { loadedUpdatedAt: string; input: SettingsInput }) =>
      updateSiteSettings(client, p.loadedUpdatedAt, p.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.settings })
      scheduleDeploy()
    },
  })
}

// ─── Activity Log ──────────────────────────────────────────────────────────────

export function useActivityLog(
  client: SupabaseClient,
  page: number,
  perPage: number,
  filters: ActivityLogFilters
) {
  return useQuery({
    queryKey: adminKeys.activity(page, perPage, filters),
    queryFn:  () => fetchActivityLog(client, page, perPage, filters),
    staleTime: 10_000,
  })
}

export function useActivityLogDetail(client: SupabaseClient, id: number | null) {
  return useQuery({
    queryKey: id ? adminKeys.activityDetail(id) : ['admin', 'activity', 'detail', 'none'],
    queryFn:  () => id ? fetchActivityLogById(client, id) : Promise.resolve(null),
    enabled:  !!id,
  })
}

export function useRestoreLogEntry(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => restoreLogEntry(client, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'activity'] }) },
  })
}

export function usePurgeActivityLog(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (days: number) => purgeActivityLog(client, days),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'activity'] }) },
  })
}

// ─── Site State ────────────────────────────────────────────────────────────────

export function useSiteState(client: SupabaseClient) {
  return useQuery({
    queryKey: adminKeys.siteState,
    queryFn:  () => fetchSiteState(client),
    staleTime: 30_000,
  })
}

export function useSetLastBackupAt(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => setLastBackupAt(client),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.siteState })
      qc.invalidateQueries({ queryKey: adminKeys.dashboard })
    },
  })
}

// ─── Backup ────────────────────────────────────────────────────────────────────

export function useFetchBackupData(client: SupabaseClient) {
  return useMutation({ mutationFn: () => fetchBackupData(client) })
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export function useAdminDashboardData(client: SupabaseClient) {
  return useQuery({
    queryKey: adminKeys.dashboard,
    queryFn:  () => fetchAdminDashboardData(client),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ─── Staff Profiles ───────────────────────────────────────────────────────────

export function useStaffProfiles(client: SupabaseClient) {
  return useQuery({
    queryKey: adminKeys.staffProfiles,
    queryFn:  () => fetchStaffProfiles(client),
    staleTime: 60_000,
  })
}

// ─── System Check (migration 016) ─────────────────────────────────────────────

import { fetchSystemCheck, pingEdgeFunction } from '../services/adminService'

export function useSystemCheck(client: SupabaseClient, enabled = false) {
  return useQuery({
    queryKey: ['admin', 'system-check'] as const,
    queryFn:  () => fetchSystemCheck(client),
    enabled,
    staleTime: 0,  // always refetch on demand
    gcTime: 60_000,
  })
}

export function useFunctionPings(enabled = false) {
  return useQuery({
    queryKey: ['admin', 'function-pings'] as const,
    queryFn: async () => Promise.all([
      pingEdgeFunction('trigger-deploy'),
      pingEdgeFunction('submit-message'),
    ]),
    enabled,
    staleTime: 0,
    gcTime: 60_000,
  })
}
