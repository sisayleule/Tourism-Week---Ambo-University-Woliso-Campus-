/**
 * useStaffQueries.ts — TanStack Query hooks for the staff portal.
 *
 * All data fetching and mutations go through these hooks. They wrap the
 * service layer and integrate with React Query's cache, optimistic updates,
 * and invalidation.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { scheduleDeploy } from '../lib/deployScheduler'
import { notifySaved } from '../lib/saveEvents'
import {
  fetchEditions,
  fetchCurrentEdition,
} from '../services/editionsService'
import {
  fetchEventsByEdition,
  fetchEventById,
  createEvent,
  updateEvent,
  updateEventStatus,
  reorderEvents,
  deleteEvent,
  uploadEventImage,
  type EventInput,
  type ReorderMove,
} from '../services/eventsService'
import {
  fetchAnnouncements,
  fetchAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  unpublishAnnouncement,
  type AnnouncementInput,
} from '../services/announcementsService'
import {
  fetchDashboardData,
} from '../services/dashboardService'
import type {
  Event,
  Announcement,
  I18nJson,
  EventStatus,
  ContentState,
} from '../../types/database'

// ─── Query key factories ──────────────────────────────────────────────────────

export const staffKeys = {
  editions:       ['staff', 'editions'] as const,
  currentEdition: ['staff', 'editions', 'current'] as const,
  events:         (editionId: string) => ['staff', 'events', editionId] as const,
  event:          (id: string) => ['staff', 'event', id] as const,
  announcements:  ['staff', 'announcements'] as const,
  announcement:   (id: string) => ['staff', 'announcement', id] as const,
  dashboard:       (editionId: string | null) => ['staff', 'dashboard', editionId ?? 'current'] as const,
}

// ─── Editions ──────────────────────────────────────────────────────────────────

export function useEditions() {
  return useQuery({
    queryKey: staffKeys.editions,
    queryFn:  fetchEditions,
  })
}

export function useCurrentEdition() {
  return useQuery({
    queryKey: staffKeys.currentEdition,
    queryFn:  fetchCurrentEdition,
  })
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function useEvents(editionId: string | null) {
  return useQuery({
    queryKey: editionId ? staffKeys.events(editionId) : ['staff', 'events', 'none'],
    queryFn:  () => editionId ? fetchEventsByEdition(editionId) : Promise.resolve([]),
    enabled:  !!editionId,
  })
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: id ? staffKeys.event(id) : ['staff', 'event', 'none'],
    queryFn:  () => id ? fetchEventById(id) : Promise.resolve(null),
    enabled:  !!id,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: staffKeys.events(vars.edition_id) })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      scheduleDeploy()
      notifySaved()
    },
  })
}

export function useUpdateEvent(editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      id: string
      loadedUpdatedAt: string
      patch: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>
    }) => updateEvent(params.id, params.loadedUpdatedAt, params.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.events(editionId) })
      qc.invalidateQueries({ queryKey: ['staff', 'event'] })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      scheduleDeploy()
      notifySaved()
    },
  })
}

export function useUpdateEventStatus(editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      id: string
      status: EventStatus
      statusNoteI18n: I18nJson | null
    }) => updateEventStatus(params.id, params.status, params.statusNoteI18n),
    // Optimistic update
    onMutate: async (params) => {
      const queryKey = staffKeys.events(editionId)
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Event[]>(queryKey)
      if (previous) {
        const optimistic = previous.map(e =>
          e.id === params.id
            ? {
                ...e,
                status: params.status,
                status_note_i18n:
                  params.status === 'scheduled' || params.status === 'live'
                    ? null
                    : params.statusNoteI18n,
              }
            : e
        )
        qc.setQueryData(queryKey, optimistic)
      }
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      // Rollback on error
      if (ctx?.previous) {
        qc.setQueryData(staffKeys.events(editionId), ctx.previous)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: staffKeys.events(editionId) })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      // Status changes are served live; notify even though no rebuild fires
      notifySaved()
    },
  })
}

export function useReorderEvents(editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (moves: ReorderMove[]) => reorderEvents(moves),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: staffKeys.events(editionId) })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      scheduleDeploy()
      notifySaved()
    },
  })
}

export function useDeleteEvent(editionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.events(editionId) })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      scheduleDeploy()
      notifySaved()
    },
  })
}

export function useUploadEventImage() {
  return useMutation({
    mutationFn: (params: { blob: Blob; fileName: string }) =>
      uploadEventImage(params.blob, params.fileName),
  })
}

// ─── Announcements ────────────────────────────────────────────────────────────

export function useAnnouncements() {
  return useQuery({
    queryKey: staffKeys.announcements,
    queryFn:  fetchAnnouncements,
  })
}

export function useAnnouncement(id: string | null) {
  return useQuery({
    queryKey: id ? staffKeys.announcement(id) : ['staff', 'announcement', 'none'],
    queryFn:  () => id ? fetchAnnouncementById(id) : Promise.resolve(null),
    enabled:  !!id,
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AnnouncementInput) => createAnnouncement(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.announcements })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      notifySaved()
    },
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      id: string
      patch: Partial<Omit<Announcement, 'id' | 'created_at' | 'updated_at'>>
    }) => updateAnnouncement(params.id, params.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.announcements })
      qc.invalidateQueries({ queryKey: ['staff', 'announcement'] })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      notifySaved()
    },
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.announcements })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      notifySaved()
    },
  })
}

export function useUnpublishAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unpublishAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.announcements })
      qc.invalidateQueries({ queryKey: ['staff', 'dashboard'] })
      notifySaved()
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboardData(editionId: string | null) {
  return useQuery({
    queryKey: staffKeys.dashboard(editionId),
    queryFn:  () => fetchDashboardData(editionId),
    // Refresh every 30s for live control awareness
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}
