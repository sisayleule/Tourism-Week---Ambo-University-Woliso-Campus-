/**
 * useSectionsQueries.ts — TanStack Query hooks for the site-content portal screens.
 *
 * All hooks accept a `client` parameter from PortalContext.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scheduleDeploy } from '../lib/deployScheduler'
import {
  fetchAllSections,
  fetchSectionByKey,
  fetchSectionItems,
  upsertSection,
  publishSection,
  unpublishSection,
  resetSectionToDefault,
  createSectionItem,
  updateSectionItem,
  deleteSectionItem,
  replaceSectionItems,
  updateEditionContent,
  fetchNeedsReviewCount,
  type SectionInput,
  type SectionItemInput,
  type EditionContentPatch,
} from '../services/sectionsService'

// ─── Query key factories ──────────────────────────────────────────────────────

export const sectionKeys = {
  all:         ['sections'] as const,
  byKey:       (key: string)       => ['sections', 'key', key] as const,
  items:       (sectionId: string) => ['sections', 'items', sectionId] as const,
  needsReview: ['sections', 'needs-review'] as const,
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function useAllSections(client: SupabaseClient) {
  return useQuery({
    queryKey: sectionKeys.all,
    queryFn:  () => fetchAllSections(client),
    staleTime: 30_000,
  })
}

export function useSectionByKey(client: SupabaseClient, key: string) {
  return useQuery({
    queryKey: sectionKeys.byKey(key),
    queryFn:  () => fetchSectionByKey(client, key),
    enabled:  Boolean(key),
    staleTime: 30_000,
  })
}

export function useSectionItems(client: SupabaseClient, sectionId: string | null) {
  return useQuery({
    queryKey: sectionId ? sectionKeys.items(sectionId) : ['sections', 'items', 'none'],
    queryFn:  () => sectionId ? fetchSectionItems(client, sectionId) : Promise.resolve([]),
    enabled:  Boolean(sectionId),
    staleTime: 30_000,
  })
}

export function useNeedsReviewCount(client: SupabaseClient) {
  return useQuery({
    queryKey: sectionKeys.needsReview,
    queryFn:  () => fetchNeedsReviewCount(client),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useUpsertSection(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { input: SectionInput; loadedUpdatedAt?: string }) =>
      upsertSection(client, p.input, p.loadedUpdatedAt),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.all })
      qc.invalidateQueries({ queryKey: sectionKeys.byKey(vars.input.key) })
      qc.invalidateQueries({ queryKey: sectionKeys.needsReview })
      scheduleDeploy()
    },
  })
}

export function usePublishSection(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { key: string; loadedUpdatedAt: string }) =>
      publishSection(client, p.key, p.loadedUpdatedAt),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.all })
      qc.invalidateQueries({ queryKey: sectionKeys.byKey(vars.key) })
      qc.invalidateQueries({ queryKey: sectionKeys.needsReview })
      scheduleDeploy()
    },
  })
}

export function useUnpublishSection(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { key: string; loadedUpdatedAt: string }) =>
      unpublishSection(client, p.key, p.loadedUpdatedAt),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.all })
      qc.invalidateQueries({ queryKey: sectionKeys.byKey(vars.key) })
      scheduleDeploy()
    },
  })
}

export function useResetSection(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { key: string; defaultInput: SectionInput }) =>
      resetSectionToDefault(client, p.key, p.defaultInput),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.all })
      qc.invalidateQueries({ queryKey: sectionKeys.byKey(vars.key) })
      scheduleDeploy()
    },
  })
}

export function useCreateSectionItem(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SectionItemInput) => createSectionItem(client, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sectionKeys.items(data.section_id) })
      scheduleDeploy()
    },
  })
}

export function useUpdateSectionItem(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { id: string; sectionId: string; patch: Partial<SectionItemInput> }) =>
      updateSectionItem(client, p.id, p.patch),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.items(vars.sectionId) })
      scheduleDeploy()
    },
  })
}

export function useDeleteSectionItem(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { id: string; sectionId: string }) =>
      deleteSectionItem(client, p.id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.items(vars.sectionId) })
      scheduleDeploy()
    },
  })
}

export function useReplaceSectionItems(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      sectionId: string
      items: Omit<SectionItemInput, 'section_id'>[]
    }) => replaceSectionItems(client, p.sectionId, p.items),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sectionKeys.items(vars.sectionId) })
      scheduleDeploy()
    },
  })
}

export function useUpdateEditionContent(client: SupabaseClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      editionId: string
      loadedUpdatedAt: string
      patch: EditionContentPatch
    }) => updateEditionContent(client, p.editionId, p.loadedUpdatedAt, p.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'editions'] })
      qc.invalidateQueries({ queryKey: ['staff', 'editions'] })
      scheduleDeploy()
    },
  })
}
