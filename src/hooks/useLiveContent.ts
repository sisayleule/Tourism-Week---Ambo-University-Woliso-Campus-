/**
 * useLiveContent.ts — Live-first content layer for the public site.
 *
 * Replaces the old useLiveOverlay (which only patched event status/notes).
 * This hook fetches the *complete* public content payload from
 * get_public_content() and writes it into the TanStack Query cache so every
 * useEdition / useEvents / useNews / … hook picks it up without any change to
 * the calling components.
 *
 * Behaviour:
 *  · Uses the build-time snapshot as initialData — first paint is instant.
 *  · After mount, fetches live data and replaces cache keys.
 *  · Refetches on window focus and on network reconnect.
 *  · Polls every 60 s while the tab is visible AND the edition is live or
 *    starts within 14 days (or VITE_FORCE_LIVE_OVERLAY=true).
 *  · On any failure the circuit breaker in liveContent.ts trips for 10 min;
 *    the hook silently keeps existing cache values — no error shown to visitors.
 *  · A previous successful live result is loaded from localStorage so returning
 *    visitors get recent content immediately (before the first fetch resolves).
 *
 * This module uses plain fetch only — no @supabase/supabase-js.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchLiveContent,
  getCachedLiveSnapshot,
  shouldPollLive,
} from '../lib/liveContent';
import { isAnnouncementVisible } from '../lib/contentAdapter';
import type { Snapshot } from '../lib/snapshot';
import { QUERY_KEYS, QUERY_KEYS_EXTRA } from './useTourismQueries';
import { getSimulatedStatus } from '../services/tourismService';

const FORCE_LIVE  = import.meta.env.VITE_FORCE_LIVE_OVERLAY === 'true';
const LIVE_ENABLED = import.meta.env.VITE_LIVE_CONTENT !== 'false';

// Interval between polls while the tab is visible (ms)
const POLL_INTERVAL_MS = 60_000;

// ─── Cache-population helper ─────────────────────────────────────────────────

/**
 * Write an adapted live Snapshot into every relevant TanStack Query cache key.
 * Preserves the status override (dev/preview mode) on the edition.
 */
function populateCache(qc: ReturnType<typeof useQueryClient>, snap: Snapshot): void {
  const override = getSimulatedStatus();

  // Edition
  if (snap.edition) {
    const edition = override
      ? { ...snap.edition, status: override }
      : snap.edition;
    qc.setQueryData(QUERY_KEYS.edition, edition);
  }

  // Events
  qc.setQueryData(QUERY_KEYS.events, snap.events);

  // Individual event slug cache
  for (const evt of snap.events) {
    qc.setQueryData(QUERY_KEYS.event(evt.slug), evt);
  }

  // News list
  qc.setQueryData(QUERY_KEYS.news, snap.news);

  // Individual news article cache
  for (const article of snap.news) {
    qc.setQueryData(QUERY_KEYS.newsArticle(article.slug), article);
  }

  // Gallery
  qc.setQueryData(QUERY_KEYS.gallery, snap.gallery);

  // Sponsors
  qc.setQueryData(QUERY_KEYS.sponsors, snap.sponsors);

  // Committee
  qc.setQueryData(QUERY_KEYS.committee, snap.committee);

  // FAQs
  qc.setQueryData(QUERY_KEYS.faqs, snap.faqs);

  // Announcements — re-filter by time window in the browser
  const now = Date.now();
  const visibleAnnouncements = snap.announcements.filter((a) =>
    isAnnouncementVisible(a, now)
  );
  qc.setQueryData(QUERY_KEYS.announcements, visibleAnnouncements);

  // Site settings
  if (snap.siteSettings) {
    qc.setQueryData(['site-settings'], snap.siteSettings);
  }

  // Sections — both the aggregated list and per-key entries
  if (snap.sections?.length) {
    qc.setQueryData(QUERY_KEYS_EXTRA.sections, snap.sections);
    for (const section of snap.sections) {
      qc.setQueryData(QUERY_KEYS_EXTRA.section(section.key), section);
    }
  }

  // Past editions
  if (snap.pastEditions?.length) {
    const published = snap.pastEditions.filter((e) => e.state === 'published');
    qc.setQueryData(QUERY_KEYS_EXTRA.pastEditions, published);
  }

  // Edition days — day titles / descriptions set by organizers
  if (snap.editionDays !== undefined) {
    // Write to both the base key and the edition-specific key so whichever
    // variant useEditionDays is currently subscribed to gets the update.
    qc.setQueryData(QUERY_KEYS_EXTRA.editionDays, snap.editionDays);
    if (snap.edition?.id) {
      qc.setQueryData([...QUERY_KEYS_EXTRA.editionDays, snap.edition.id], snap.editionDays);
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveContent(): void {
  const qc           = useQueryClient();
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef   = useRef(false);

  useEffect(() => {
    if (!LIVE_ENABLED) return;

    // ── 1. Seed cache from localStorage before first network fetch ──────────
    if (!mountedRef.current) {
      mountedRef.current = true;
      const cached = getCachedLiveSnapshot();
      if (cached) {
        populateCache(qc, cached);
      }
    }

    // ── 2. Determine whether live polling should run ──────────────────────
    // We read the edition from the query cache; it was already populated by
    // the snapshot initialData or the localStorage cache seed above.
    const edition = qc.getQueryData<{ startDateGC?: string; endDateGC?: string }>(QUERY_KEYS.edition);
    const startGC = edition?.startDateGC ?? '';
    const endGC   = edition?.endDateGC   ?? '';
    const shouldRun = FORCE_LIVE || (startGC ? shouldPollLive(startGC, endGC) : true);

    if (!shouldRun) return;

    // ── 3. Fetch once immediately ──────────────────────────────────────────
    const doFetch = async () => {
      const snap = await fetchLiveContent();
      if (snap) populateCache(qc, snap);
    };
    doFetch();

    // ── 4. Poll every 60 s while the tab is visible ───────────────────────
    intervalRef.current = setInterval(() => {
      if (!document.hidden) doFetch();
    }, POLL_INTERVAL_MS);

    // ── 5. Refetch on visibility change (tab focus) ───────────────────────
    const onVisible = () => {
      if (!document.hidden) doFetch();
    };
    document.addEventListener('visibilitychange', onVisible);

    // ── 6. Refetch on network reconnect ───────────────────────────────────
    const onOnline = () => doFetch();
    window.addEventListener('online', onOnline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  // We intentionally run this effect once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
}
