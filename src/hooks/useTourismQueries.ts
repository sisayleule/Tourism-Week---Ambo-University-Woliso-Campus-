import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAnnouncements,
  getAllSections,
  getCommittee,
  getEdition,
  getEventBySlug,
  getEvents,
  getFAQs,
  getGallery,
  getNews,
  getNewsBySlug,
  getSection,
  getSimulatedStatus,
  getSiteSettings,
  getSponsors,
  setSimulatedStatus,
  submitContact,
  submitSponsorInquiry,
} from '../services/tourismService';
import { snapshot } from '../lib/snapshot';
import { getCachedLiveSnapshot } from '../lib/liveContent';
import { ContactFormPayload, EditionStatus, SponsorInquiryPayload } from '../types';
import type { SectionSnapshot, PastEditionSnapshot, EditionDaySnapshot } from '../lib/snapshot';

// ─── staleTime: 30 s — live layer refreshes the cache; snapshot is the floor ─
const STALE_MS = 30_000;

// Setting initialDataUpdatedAt to 0 makes TanStack Query treat the
// initialData as already-stale on first mount, so it triggers a background
// fetch immediately instead of waiting for staleTime to elapse.  The
// snapshot/localStorage value is shown instantly (no flicker) while the live
// fetch races in behind it.
const INITIAL_DATA_UPDATED_AT = 0;

export const QUERY_KEYS = {
  edition: ['edition'] as const,
  events: ['events'] as const,
  event: (slug: string) => ['event', slug] as const,
  news: ['news'] as const,
  newsArticle: (slug: string) => ['news-article', slug] as const,
  gallery: ['gallery'] as const,
  sponsors: ['sponsors'] as const,
  committee: ['committee'] as const,
  faqs: ['faqs'] as const,
  announcements: ['announcements'] as const,
};

export const QUERY_KEYS_EXTRA = {
  section:      (key: string) => ['section', key] as const,
  sections:     ['sections'] as const,
  pastEditions: ['past-editions'] as const,
  editionDays:  ['edition-days'] as const,
};

// Helper: return the localStorage-cached live snapshot if fresher, else the
// build-time snapshot, as the initialData for a query.
// initialDataUpdatedAt:0 is set on every query so TanStack Query treats this
// data as already-stale and fires a background fetch on first mount.
function bestInitial<T>(
  snapValue: T,
  liveSelector: (s: ReturnType<typeof getCachedLiveSnapshot>) => T | undefined,
): T {
  const cached = getCachedLiveSnapshot();
  if (!cached) return snapValue;
  return liveSelector(cached) ?? snapValue;
}

export function useEdition() {
  return useQuery({
    queryKey: QUERY_KEYS.edition,
    queryFn: getEdition,
    staleTime: STALE_MS,
    initialData: () => bestInitial(
      snapshot.edition ?? undefined,
      (c) => c?.edition ?? undefined,
    ),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: QUERY_KEYS.events,
    queryFn: getEvents,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.events, (c) => c?.events),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useEvent(slug: string) {
  return useQuery({
    queryKey: QUERY_KEYS.event(slug),
    queryFn: () => getEventBySlug(slug),
    enabled: Boolean(slug),
    staleTime: STALE_MS,
    initialData: () => {
      const cached = getCachedLiveSnapshot();
      return (cached?.events ?? snapshot.events).find((e) => e.slug === slug) ?? undefined;
    },
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useNews() {
  return useQuery({
    queryKey: QUERY_KEYS.news,
    queryFn: getNews,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.news, (c) => c?.news),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useNewsArticle(slug: string) {
  return useQuery({
    queryKey: QUERY_KEYS.newsArticle(slug),
    queryFn: () => getNewsBySlug(slug),
    enabled: Boolean(slug),
    staleTime: STALE_MS,
    initialData: () => {
      const cached = getCachedLiveSnapshot();
      return (cached?.news ?? snapshot.news).find((n) => n.slug === slug) ?? undefined;
    },
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useGallery() {
  return useQuery({
    queryKey: QUERY_KEYS.gallery,
    queryFn: getGallery,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.gallery, (c) => c?.gallery),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useSponsors() {
  return useQuery({
    queryKey: QUERY_KEYS.sponsors,
    queryFn: getSponsors,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.sponsors, (c) => c?.sponsors),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useCommittee() {
  return useQuery({
    queryKey: QUERY_KEYS.committee,
    queryFn: getCommittee,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.committee, (c) => c?.committee),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useFAQs() {
  return useQuery({
    queryKey: QUERY_KEYS.faqs,
    queryFn: getFAQs,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.faqs, (c) => c?.faqs),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: QUERY_KEYS.announcements,
    queryFn: getAnnouncements,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.announcements, (c) => c?.announcements),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'] as const,
    queryFn: getSiteSettings,
    staleTime: STALE_MS,
    initialData: () => bestInitial(snapshot.siteSettings, (c) => c?.siteSettings),
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

/**
 * Look up a single published section by its registry key.
 * Returns undefined when no published row exists — components fall back to
 * their built-in default copy via the section registry.
 */
export function useSection(key: string) {
  return useQuery({
    queryKey: QUERY_KEYS_EXTRA.section(key),
    queryFn: () => Promise.resolve(getSection(key)),
    staleTime: STALE_MS,
    initialData: (): SectionSnapshot | undefined => {
      const cached = getCachedLiveSnapshot();
      const sections = cached?.sections ?? snapshot.sections ?? [];
      return sections.find((s) => s.key === key && s.state === 'published');
    },
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

/** All sections (for the portal content list). */
export function useSections() {
  return useQuery({
    queryKey: QUERY_KEYS_EXTRA.sections,
    queryFn: getAllSections,
    staleTime: STALE_MS,
    initialData: (): SectionSnapshot[] => {
      const cached = getCachedLiveSnapshot();
      return cached?.sections ?? snapshot.sections ?? [];
    },
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

/** Published past editions for the About page timeline. */
export function usePastEditions() {
  return useQuery({
    queryKey: QUERY_KEYS_EXTRA.pastEditions,
    // Always read the live localStorage cache first so organizer edits
    // appear immediately without waiting for staleTime to expire.
    queryFn: (): PastEditionSnapshot[] => {
      const cached = getCachedLiveSnapshot();
      const source = cached?.pastEditions?.length ? cached.pastEditions : (snapshot.pastEditions ?? []);
      return source.filter((e) => e.state === 'published') as PastEditionSnapshot[];
    },
    staleTime: STALE_MS,
    initialData: (): PastEditionSnapshot[] => {
      const cached = getCachedLiveSnapshot();
      return (cached?.pastEditions ?? snapshot.pastEditions ?? []).filter(
        (e) => e.state === 'published',
      ) as PastEditionSnapshot[];
    },
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

/**
 * Edition days (titles/descriptions) for the current edition.
 *
 * Key includes the edition id so the cache is invalidated automatically
 * when the organizer switches editions.  queryFn reads the live snapshot
 * stored in localStorage (best available data short of a network call) so
 * a cache-miss after a live fetch always returns fresh rows.
 */
export function useEditionDays() {
  // Include edition id in the key so a new edition busts the cache.
  const { data: edition } = useEdition();
  const editionId = edition?.id ?? 'default';

  return useQuery({
    queryKey: [...QUERY_KEYS_EXTRA.editionDays, editionId] as const,
    queryFn: (): EditionDaySnapshot[] => {
      // Prefer the localStorage-cached live snapshot; fall back to build snapshot.
      const cached = getCachedLiveSnapshot();
      return cached?.editionDays ?? snapshot.editionDays ?? [];
    },
    staleTime: STALE_MS,
    initialData: (): EditionDaySnapshot[] => {
      const cached = getCachedLiveSnapshot();
      return cached?.editionDays ?? snapshot.editionDays ?? [];
    },
    initialDataUpdatedAt: INITIAL_DATA_UPDATED_AT,
  });
}

export function useEventStatusSwitcher() {
  const queryClient = useQueryClient();
  const currentOverride = getSimulatedStatus();

  const changeStatus = (status: EditionStatus | null) => {
    setSimulatedStatus(status);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.edition });
  };

  return {
    currentOverride,
    changeStatus,
  };
}

export function useSubmitContact() {
  return useMutation({
    mutationFn: (payload: ContactFormPayload) => submitContact(payload),
  });
}

export function useSubmitSponsorInquiry() {
  return useMutation({
    mutationFn: (payload: SponsorInquiryPayload) => submitSponsorInquiry(payload),
  });
}
