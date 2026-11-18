/**
 * useLiveOverlay.ts — Runtime live status overlay (Part B).
 *
 * After first render (never blocking it), fetches event statuses and
 * announcements from the Supabase REST API with a 3-second timeout and
 * patches the React Query cache so the UI shows live updates without a rebuild.
 *
 * Runs only when the edition is live or starts within 14 days (computed from
 * dates in the Africa/Addis_Ababa timezone). Refreshes every 60 seconds while
 * the tab is visible and on tab focus. On any failure, silently keeps the
 * snapshot values.
 *
 * A VITE_FORCE_LIVE_OVERLAY=true flag forces the overlay to run for testing.
 *
 * This module uses plain fetch() — no @supabase/supabase-js.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, useEdition } from './useTourismQueries';
import {
  isAnnouncementVisible,
  mapAnnouncement,
  patchEventStatus,
  type RawAnnouncement,
  type RawEventStatus,
} from '../lib/contentAdapter';
import type { Announcement, EventItem } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const FORCE_LIVE = import.meta.env.VITE_FORCE_LIVE_OVERLAY === 'true';
const REST = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : '';

// ─── Timezone helpers ────────────────────────────────────────────────────────

/**
 * Get today's date (YYYY-MM-DD) in the Africa/Addis_Ababa timezone.
 * Addis Ababa is UTC+3 (EAT) with no daylight saving.
 */
function getAddisTodayString(): string {
  const now = new Date();
  // Shift to UTC+3 and extract the date part
  const addis = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return addis.toISOString().split('T')[0];
}

/**
 * Determine if the overlay should run: the edition is live or starts within
 * 14 days, based on dates in the Africa/Addis_Ababa timezone.
 */
function shouldRunOverlay(startDateGC: string, endDateGC: string): boolean {
  const today = getAddisTodayString();

  // Live: today is between start and end (inclusive)
  if (today >= startDateGC && today <= endDateGC) return true;

  // Upcoming: starts within 14 days
  if (today < startDateGC) {
    const start = new Date(startDateGC + 'T00:00:00Z').getTime();
    const nowMs = new Date(today + 'T00:00:00Z').getTime();
    const diffDays = (start - nowMs) / (24 * 60 * 60 * 1000);
    return diffDays <= 14;
  }

  // Past: don't run
  return false;
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  if (!REST || !ANON_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // silently keep snapshot values
  } finally {
    clearTimeout(timer);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveOverlay(): void {
  const qc = useQueryClient();
  const { data: edition } = useEdition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!edition) return;

    // Check if the overlay should run (live or within 14 days, or forced)
    const shouldRun = FORCE_LIVE || shouldRunOverlay(edition.startDateGC, edition.endDateGC);
    if (!shouldRun) return;

    const editionId = edition.id;

    // ── Fetch live data and patch the query cache ────────────────────────────
    const fetchLive = async () => {
      try {
        // Fetch event statuses (id, status, status_note_i18n) with 3s timeout
        const eventRows = await fetchJson(
          `${REST}/events?edition_id=eq.${editionId}&state=eq.published&select=id,status,status_note_i18n&order=day.asc,session.asc,sort_order.asc`,
          3000
        );

        if (Array.isArray(eventRows)) {
          const rawEvents = eventRows as RawEventStatus[];
          const currentEvents = qc.getQueryData<EventItem[]>(QUERY_KEYS.events);
          if (currentEvents && currentEvents.length > 0) {
            // Patch existing events with live status — only update status fields
            const patched = currentEvents.map((evt) => {
              const raw = rawEvents.find((r) => r.id === evt.id);
              return raw ? patchEventStatus(evt, raw) : evt;
            });
            qc.setQueryData(QUERY_KEYS.events, patched);
          }
        }

        // Fetch announcements with 3s timeout
        const annRows = await fetchJson(
          `${REST}/announcements?state=eq.published&select=*&order=created_at.desc`,
          3000
        );

        if (Array.isArray(annRows)) {
          const rawAnns = annRows as RawAnnouncement[];
          const now = Date.now();
          // Map and evaluate time window in the browser
          const announcements: Announcement[] = rawAnns
            .map(mapAnnouncement)
            .filter((a) => isAnnouncementVisible(a, now));
          qc.setQueryData(QUERY_KEYS.announcements, announcements);
        }
      } catch {
        // Silently keep snapshot values on any failure
      }
    };

    // Initial fetch — runs after first render (useEffect is already non-blocking)
    fetchLive();

    // Refresh every 60 seconds while the tab is visible
    intervalRef.current = setInterval(() => {
      if (!document.hidden) fetchLive();
    }, 60000);

    // Refresh on tab focus / visibility change
    const onVisibilityChange = () => {
      if (!document.hidden) fetchLive();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [edition, qc]);
}
