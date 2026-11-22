/**
 * useLiveContent.ts — Live-first content layer for the public site.
 *
 * Fetches the complete public content payload from get_public_content() and
 * writes it into the TanStack Query cache so every useEdition / useEvents / …
 * hook picks it up without change to the calling components.
 *
 * Behaviour:
 *  · Renders the build-time snapshot immediately (via initialData in useTourismQueries).
 *  · Fetches live data once on mount (bypasses any stale circuit-breaker entry
 *    from a previous session).
 *  · Polls content_version() (tiny, cheap) every 30 s when the edition is live
 *    or starts within 3 days; every 120 s otherwise; polls only while the tab
 *    is visible.
 *  · Only when the version changes (or on the first successful poll) downloads
 *    the full get_public_content payload.
 *  · Stops polling after 30 minutes of no user interaction; resumes on the
 *    next interaction event.
 *  · Refetches on window focus and on network reconnect.
 *  · On failure the circuit breaker in liveContent.ts eventually trips; the
 *    hook silently keeps existing cache values — no error shown to visitors.
 *
 * Uses plain fetch only — no @supabase/supabase-js.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchLiveContent,
  getCachedLiveSnapshot,
  shouldPollLive,
  isEditionImminent,
} from '../lib/liveContent';
import { fetchContentVersion } from '../lib/contentVersion';
import { isAnnouncementVisible } from '../lib/contentAdapter';
import type { Snapshot } from '../lib/snapshot';
import { QUERY_KEYS, QUERY_KEYS_EXTRA } from './useTourismQueries';
import { getSimulatedStatus } from '../services/tourismService';

const FORCE_LIVE   = import.meta.env.VITE_FORCE_LIVE_OVERLAY === 'true';
const LIVE_ENABLED = import.meta.env.VITE_LIVE_CONTENT !== 'false';

// Poll intervals (ms)
const POLL_IMMINENT_MS = 30_000;   // 30 s — edition live or starting within 3 days
const POLL_NORMAL_MS   = 120_000;  // 120 s — otherwise

// Stop polling after this many ms of no user interaction
const INACTIVITY_STOP_MS = 30 * 60_000; // 30 minutes

// ─── Cache-population helper ──────────────────────────────────────────────────

/**
 * Write an adapted live Snapshot into every relevant TanStack Query cache key.
 * Preserves the status override (dev/preview mode) on the edition.
 */
export function populateCache(qc: ReturnType<typeof useQueryClient>, snap: Snapshot): void {
  const override = getSimulatedStatus();

  if (snap.edition) {
    const edition = override ? { ...snap.edition, status: override } : snap.edition;
    qc.setQueryData(QUERY_KEYS.edition, edition);
  }

  qc.setQueryData(QUERY_KEYS.events, snap.events);
  for (const evt of snap.events) {
    qc.setQueryData(QUERY_KEYS.event(evt.slug), evt);
  }

  qc.setQueryData(QUERY_KEYS.news, snap.news);
  for (const article of snap.news) {
    qc.setQueryData(QUERY_KEYS.newsArticle(article.slug), article);
  }

  qc.setQueryData(QUERY_KEYS.gallery,    snap.gallery);
  qc.setQueryData(QUERY_KEYS.sponsors,   snap.sponsors);
  qc.setQueryData(QUERY_KEYS.committee,  snap.committee);
  qc.setQueryData(QUERY_KEYS.faqs,       snap.faqs);

  const now = Date.now();
  const visibleAnnouncements = snap.announcements.filter((a) => isAnnouncementVisible(a, now));
  qc.setQueryData(QUERY_KEYS.announcements, visibleAnnouncements);

  if (snap.siteSettings) {
    qc.setQueryData(['site-settings'], snap.siteSettings);
  }

  if (snap.sections?.length) {
    qc.setQueryData(QUERY_KEYS_EXTRA.sections, snap.sections);
    for (const section of snap.sections) {
      qc.setQueryData(QUERY_KEYS_EXTRA.section(section.key), section);
    }
  }

  if (snap.pastEditions?.length) {
    const published = snap.pastEditions.filter((e) => e.state === 'published');
    qc.setQueryData(QUERY_KEYS_EXTRA.pastEditions, published);
  }

  if (snap.editionDays !== undefined) {
    qc.setQueryData(QUERY_KEYS_EXTRA.editionDays, snap.editionDays);
    if (snap.edition?.id) {
      qc.setQueryData([...QUERY_KEYS_EXTRA.editionDays, snap.edition.id], snap.editionDays);
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveContent(): void {
  const qc = useQueryClient();

  // Last content version string we saw
  const lastVersionRef   = useRef<string | null>(null);
  // Interval handle
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timestamp of last user interaction
  const lastInteractRef  = useRef<number>(Date.now());
  // Whether polling is currently paused due to inactivity
  const pausedRef        = useRef<boolean>(false);
  // Guard: only run effect once
  const mountedRef       = useRef<boolean>(false);

  // Helper: resolve the poll interval based on the current edition dates
  const getPollInterval = useCallback((): number => {
    const edition = qc.getQueryData<{ startDateGC?: string; endDateGC?: string }>(QUERY_KEYS.edition);
    if (FORCE_LIVE) return POLL_IMMINENT_MS;
    if (!edition?.startDateGC) return POLL_NORMAL_MS;
    return isEditionImminent(edition.startDateGC, edition.endDateGC ?? '') ? POLL_IMMINENT_MS : POLL_NORMAL_MS;
  }, [qc]);

  // ── Full-payload fetch ───────────────────────────────────────────────────
  const doFullFetch = useCallback(async (): Promise<void> => {
    const snap = await fetchLiveContent();
    if (snap) {
      populateCache(qc, snap);
    }
  }, [qc]);

  // ── Version-check poll ────────────────────────────────────────────────────
  // Fetches content_version() (tiny) and only triggers a full fetch when v changes.
  const doVersionCheck = useCallback(async (): Promise<void> => {
    if (document.hidden) return; // skip hidden tabs
    if (pausedRef.current) return; // skip while paused for inactivity

    const v = await fetchContentVersion();
    if (v === null) {
      // content_version() not yet available (migration 021 not applied) — fall back
      // to polling the full payload directly (old behaviour).
      await doFullFetch();
      return;
    }

    if (lastVersionRef.current === null || v !== lastVersionRef.current) {
      lastVersionRef.current = v;
      await doFullFetch();
    }
  }, [doFullFetch]);

  // ── Restart interval with current interval duration ───────────────────────
  const restartInterval = useCallback((): void => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(doVersionCheck, getPollInterval());
  }, [doVersionCheck, getPollInterval]);

  // ── Resume from inactivity pause ──────────────────────────────────────────
  const resumePolling = useCallback((): void => {
    lastInteractRef.current = Date.now();
    if (pausedRef.current) {
      pausedRef.current = false;
      // Fetch immediately on resume so the user doesn't see stale data
      doVersionCheck();
      restartInterval();
    } else {
      lastInteractRef.current = Date.now();
    }
  }, [doVersionCheck, restartInterval]);

  useEffect(() => {
    if (!LIVE_ENABLED) return;
    if (mountedRef.current) return;
    mountedRef.current = true;

    // ── 1. Seed cache from localStorage before first network fetch ───────────
    const cached = getCachedLiveSnapshot();
    if (cached) populateCache(qc, cached);

    // ── 2. Check whether to poll at all ──────────────────────────────────────
    const edition = qc.getQueryData<{ startDateGC?: string; endDateGC?: string }>(QUERY_KEYS.edition);
    const startGC = edition?.startDateGC ?? '';
    const endGC   = edition?.endDateGC   ?? '';
    const shouldRun = FORCE_LIVE || (startGC ? shouldPollLive(startGC, endGC) : true);

    // ── 3. First fetch on mount (always — bypasses stale breaker entry) ──────
    doFullFetch().then(() => {
      // After first fetch, record the current version
      fetchContentVersion().then((v) => {
        if (v !== null) lastVersionRef.current = v;
      });
    });

    if (!shouldRun) return;

    // ── 4. Start version-check polling ───────────────────────────────────────
    restartInterval();

    // ── 5. Inactivity watchdog — pause after 30 min of no interaction ────────
    const inactivityTimer = setInterval(() => {
      if (Date.now() - lastInteractRef.current > INACTIVITY_STOP_MS) {
        if (!pausedRef.current) {
          pausedRef.current = true;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    }, 60_000); // check every minute

    // ── 6. Interaction events — resume polling + reset inactivity clock ──────
    const interactionEvents: (keyof WindowEventMap)[] = [
      'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'pointerdown',
    ];
    for (const ev of interactionEvents) {
      window.addEventListener(ev, resumePolling, { passive: true });
    }

    // ── 7. Visibility change — fetch when tab becomes visible ────────────────
    const onVisible = (): void => {
      if (!document.hidden) {
        resumePolling();
        doVersionCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // ── 8. Network reconnect ─────────────────────────────────────────────────
    const onOnline = (): void => { doFullFetch(); };
    window.addEventListener('online', onOnline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(inactivityTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      for (const ev of interactionEvents) {
        window.removeEventListener(ev, resumePolling);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
}
