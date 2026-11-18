/**
 * useSetupQueries.ts — TanStack Query hooks for the Event Setup wizard.
 *
 * All hooks accept a `client` parameter from PortalContext.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scheduleDeploy } from '../lib/deployScheduler'
import {
  fetchSetupEditions,
  fetchSetupEdition,
  updateSetupEdition,
  fetchEditionDays,
  upsertEditionDay,
  deleteEditionDay,
  fetchSetupCommittee,
  createSetupCommitteeMember,
  updateSetupCommitteeMember,
  deleteSetupCommitteeMember,
  upsertMemberContact,
  fetchSetupEvents,
  createSetupEvent,
  updateSetupEvent,
  deleteSetupEvent,
  reorderSetupEvents,
  publishEdition,
  createEditionFromTemplate,
  type EditionDayPatch,
  type SetupEventInput,
  type CreateSetupEditionInput,
} from '../services/setupService'
import type {
  CommitteeMember,
  CommitteeMemberContact,
  EditionDay,
  SessionType,
} from '../../types/database'

// ─── Query key factories ──────────────────────────────────────────────────────

export const setupKeys = {
  editions:  ['setup', 'editions'] as const,
  edition:   (id: string) => ['setup', 'edition', id] as const,
  days:      (editionId: string) => ['setup', 'days', editionId] as const,
  committee: (editionId: string) => ['setup', 'committee', editionId] as const,
  events:    (editionId: string) => ['setup', 'events', editionId] as const,
}

// ─── Editions list ────────────────────────────────────────────────────────────

export function useSetupEditions(client: SupabaseClient) {
  return useQuery({
    queryKey: setupKeys.editions,
    queryFn:  () => fetchSetupEditions(client),
    staleTime: 30_000,
  })
}

export function useSetupEdition(client: SupabaseClient, editionId: string | null) {
  return useQuery({
    queryKey: editionId ? setupKeys.edition(editionId) : ['setup', 'edition', 'none'],
    queryFn:  () => editionId ? fetchSetupEdition(client, editionId) : Promise.resolve(null),
    enabled:  !!editionId,
    staleTime: 10_000,
  })
}

export function useUpdateSetupEdition(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      editionId:       string
      loadedUpdatedAt: string
      patch:           Parameters<typeof updateSetupEdition>[3]
    }) => updateSetupEdition(client, p.editionId, p.loadedUpdatedAt, p.patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: setupKeys.editions })
      qc.invalidateQueries({ queryKey: setupKeys.edition(vars.editionId) })
      scheduleDeploy()
    },
  })
}

export function useCreateEditionFromTemplate(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSetupEditionInput) =>
      createEditionFromTemplate(client, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.editions })
      scheduleDeploy()
    },
  })
}

// ─── Edition days ─────────────────────────────────────────────────────────────

export function useEditionDays(client: SupabaseClient, editionId: string | null) {
  return useQuery({
    queryKey: editionId ? setupKeys.days(editionId) : ['setup', 'days', 'none'],
    queryFn:  () =>
      editionId ? fetchEditionDays(client, editionId) : Promise.resolve([] as EditionDay[]),
    enabled:  !!editionId,
    staleTime: 10_000,
  })
}

export function useUpsertEditionDay(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { day: number; patch: EditionDayPatch }) =>
      upsertEditionDay(client, editionId, p.day, p.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.days(editionId) })
      scheduleDeploy()
    },
  })
}

export function useDeleteEditionDay(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (day: number) => deleteEditionDay(client, editionId, day),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.days(editionId) })
      scheduleDeploy()
    },
  })
}

// ─── Committee ────────────────────────────────────────────────────────────────

export function useSetupCommittee(client: SupabaseClient, editionId: string | null) {
  return useQuery({
    queryKey: editionId ? setupKeys.committee(editionId) : ['setup', 'committee', 'none'],
    queryFn:  () => editionId ? fetchSetupCommittee(client, editionId) : Promise.resolve([]),
    enabled:  !!editionId,
    staleTime: 15_000,
  })
}

export function useCreateSetupCommitteeMember(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CommitteeMember, 'id' | 'created_at' | 'updated_at'>) =>
      createSetupCommitteeMember(client, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.committee(editionId) })
      scheduleDeploy()
    },
  })
}

export function useUpdateSetupCommitteeMember(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      memberId: string
      patch:    Parameters<typeof updateSetupCommitteeMember>[2]
    }) => updateSetupCommitteeMember(client, p.memberId, p.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.committee(editionId) })
      scheduleDeploy()
    },
  })
}

export function useDeleteSetupCommitteeMember(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => deleteSetupCommitteeMember(client, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.committee(editionId) })
      scheduleDeploy()
    },
  })
}

export function useUpsertMemberContact(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      memberId: string
      patch:    Omit<CommitteeMemberContact, 'member_id' | 'created_at' | 'updated_at'>
    }) => upsertMemberContact(client, p.memberId, p.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.committee(editionId) })
      scheduleDeploy()
    },
  })
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function useSetupEvents(client: SupabaseClient, editionId: string | null) {
  return useQuery({
    queryKey: editionId ? setupKeys.events(editionId) : ['setup', 'events', 'none'],
    queryFn:  () => editionId ? fetchSetupEvents(client, editionId) : Promise.resolve([]),
    enabled:  !!editionId,
    staleTime: 10_000,
  })
}

export function useCreateSetupEvent(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetupEventInput) => createSetupEvent(client, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.events(editionId) })
      scheduleDeploy()
    },
  })
}

export function useUpdateSetupEvent(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { eventId: string; patch: Partial<SetupEventInput> }) =>
      updateSetupEvent(client, p.eventId, p.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.events(editionId) })
      scheduleDeploy()
    },
  })
}

export function useDeleteSetupEvent(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) => deleteSetupEvent(client, eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.events(editionId) })
      scheduleDeploy()
    },
  })
}

export function useReorderSetupEvents(client: SupabaseClient, editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (moves: { id: string; sort_order: number; day: number; session: SessionType }[]) =>
      reorderSetupEvents(client, moves),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupKeys.events(editionId) })
      scheduleDeploy()
    },
  })
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export function usePublishEdition(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { editionId: string; makeCurrent: boolean }) =>
      publishEdition(client, p.editionId, p.makeCurrent),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: setupKeys.editions })
      qc.invalidateQueries({ queryKey: setupKeys.edition(vars.editionId) })
      scheduleDeploy()
    },
  })
}
