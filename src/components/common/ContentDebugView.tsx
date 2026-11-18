/**
 * ContentDebugView — shown only when ?debug=content is in the URL.
 *
 * Displays: source, last live fetch time, HTTP status, error text,
 * edition id, event count, circuit breaker state, and actionable hints.
 *
 * Renders nothing when ?debug=content is absent.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, RefreshCw } from 'lucide-react';
import { useEdition, useEvents } from '../../hooks/useTourismQueries';
import { getCachedFetchedAt, getDebugInfo, resetBreaker } from '../../lib/liveContent';
import { snapshot } from '../../lib/snapshot';

// ─── Fetch the deployed content-meta.json at runtime ─────────────────────────

interface ContentMeta {
  generatedAt: string | null;
  source: string | null;
  editionId: string | null;
  eventCount: number | null;
}

async function fetchDeployedMeta(): Promise<ContentMeta> {
  try {
    const res = await fetch('/content-meta.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return { generatedAt: null, source: null, editionId: null, eventCount: null };
    return await res.json() as ContentMeta;
  } catch {
    return { generatedAt: null, source: null, editionId: null, eventCount: null };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ContentDebugView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get('debug') === 'content';

  const [deployedMeta, setDeployedMeta] = useState<ContentMeta | null>(null);
  const [debugInfo, setDebugInfo] = useState(getDebugInfo());
  const [dismissed, setDismissed] = useState(false);

  const { data: edition } = useEdition();
  const { data: events } = useEvents();

  useEffect(() => {
    if (!isDebug) return;
    fetchDeployedMeta().then(setDeployedMeta);
    const id = setInterval(() => setDebugInfo(getDebugInfo()), 2000);
    return () => clearInterval(id);
  }, [isDebug]);

  if (!isDebug || dismissed) return null;

  const cachedAt = getCachedFetchedAt();

  const fmtTime = (ms: number | null | undefined) => {
    if (!ms) return '—';
    try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
  };
  const fmtIso = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const Row: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean; warn?: boolean }> = ({ label, value, highlight, warn }) => (
    <tr className={highlight ? 'bg-red-50 dark:bg-red-950/30' : warn ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
      <td className="py-1 pr-4 text-stone-500 dark:text-stone-400 whitespace-nowrap align-top">{label}</td>
      <td className="py-1 font-mono text-stone-900 dark:text-stone-100 break-all">{value ?? '—'}</td>
    </tr>
  );

  const handleResetBreaker = () => {
    resetBreaker();
    setDebugInfo(getDebugInfo());
    // Trigger a re-fetch by reloading the page
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[520px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0D1117] border border-stone-300 dark:border-stone-700 rounded-2xl shadow-2xl text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
        <span className="font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider text-[10px]">
          Content Debug — ?debug=content
        </span>
        <div className="flex items-center gap-2">
          {debugInfo.breakerOpen && (
            <button
              onClick={handleResetBreaker}
              title="Reset circuit breaker and reload"
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200"
            >
              <RefreshCw size={11} /> Reset CB
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-stone-500 hover:text-stone-900 dark:hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 max-h-[85vh] overflow-y-auto">

        {/* Live fetch status */}
        <section>
          <p className="font-semibold text-[10px] uppercase tracking-wider text-stone-500 mb-1">Last live fetch</p>
          <table className="w-full">
            <tbody>
              <Row label="source"      value={debugInfo.source}       warn={debugInfo.source === 'supabase-rest'} />
              <Row label="fetchedAt"   value={fmtTime(debugInfo.lastFetchAt)} />
              <Row label="httpStatus"  value={debugInfo.httpStatus}   highlight={!!debugInfo.httpStatus && debugInfo.httpStatus >= 400} />
              <Row label="errorText"   value={debugInfo.errorText}    highlight={!!debugInfo.errorText} />
              <Row label="editionId"   value={debugInfo.editionId} />
              <Row label="eventCount"  value={debugInfo.eventCount} />
              <Row label="circuit CB"  value={debugInfo.breakerOpen ? '⚠ OPEN (live fetch paused)' : 'closed'} highlight={debugInfo.breakerOpen} />
              {debugInfo.hint && (
                <Row label="hint"      value={debugInfo.hint} warn />
              )}
            </tbody>
          </table>
        </section>

        {/* Build-time snapshot */}
        <section>
          <p className="font-semibold text-[10px] uppercase tracking-wider text-stone-500 mb-1">Build-time snapshot (bundled)</p>
          <table className="w-full">
            <tbody>
              <Row label="source"      value={snapshot.source} warn={snapshot.source !== 'supabase'} />
              <Row label="generatedAt" value={fmtIso(snapshot.generatedAt)} />
              <Row label="editionId"   value={snapshot.edition?.id ?? null} />
              <Row label="events"      value={snapshot.events.length} />
            </tbody>
          </table>
        </section>

        {/* Deployed content-meta.json */}
        <section>
          <p className="font-semibold text-[10px] uppercase tracking-wider text-stone-500 mb-1">
            Deployed content-meta.json
          </p>
          <table className="w-full">
            <tbody>
              <Row label="source"      value={deployedMeta?.source ?? 'loading…'} warn={deployedMeta?.source !== 'supabase'} />
              <Row label="generatedAt" value={fmtIso(deployedMeta?.generatedAt)} />
              <Row label="editionId"   value={deployedMeta?.editionId} />
              <Row label="eventCount"  value={deployedMeta?.eventCount ?? '—'} />
            </tbody>
          </table>
        </section>

        {/* localStorage live cache */}
        <section>
          <p className="font-semibold text-[10px] uppercase tracking-wider text-stone-500 mb-1">
            localStorage live cache
          </p>
          <table className="w-full">
            <tbody>
              <Row label="cachedAt" value={cachedAt ? fmtTime(cachedAt) : 'never'} />
            </tbody>
          </table>
        </section>

        {/* Active TanStack Query cache */}
        <section>
          <p className="font-semibold text-[10px] uppercase tracking-wider text-stone-500 mb-1">
            Active data (TanStack Query cache)
          </p>
          <table className="w-full">
            <tbody>
              <Row label="editionId"   value={edition?.id ?? null} />
              <Row label="endDateGC"   value={(edition as { endDateGC?: string } | undefined)?.endDateGC ?? null} />
              <Row label="eventCount"  value={events?.length ?? '—'} />
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
};

// ─── Fetch the deployed content-meta.json at runtime ─────────────────────────

interface ContentMeta {
  generatedAt: string | null;
  source: string | null;
  editionId: string | null;
  eventCount: number | null;
}


