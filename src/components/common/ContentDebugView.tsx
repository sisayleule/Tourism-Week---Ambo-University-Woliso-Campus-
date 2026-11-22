/**
 * ContentDebugView — shown only when ?debug=content is in the URL.
 *
 * Displays all diagnostics required by the content-freshness spec:
 *   · Environment: VITE_SUPABASE_URL host, anon key presence, build commit + time
 *   · Live fetch: source, URL, HTTP status, duration, last attempt, error, hint
 *   · Circuit breaker: open/closed, opens-until time, failure count
 *   · Content version: current v token, last checked time
 *   · Service worker: registration state (or "none")
 *   · CSP violations: captured since page load via securitypolicyviolation
 *   · Build snapshot: source, generatedAt, editionId, event count
 *   · Deployed content-meta.json: same fields plus commitSha + buildTime
 *   · localStorage live cache: cachedAt
 *   · TanStack Query cache: editionId, endDateGC, event count
 *   · Hero video debug snapshot
 *
 * Buttons:
 *   · "Run live test"  — fires fetchLiveContent() right now, shows result
 *   · "Reset CB"       — clears the circuit breaker and reloads
 *
 * Renders nothing when ?debug=content is absent.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, RefreshCw, Play } from 'lucide-react';
import { useEdition, useEvents } from '../../hooks/useTourismQueries';
import {
  getCachedFetchedAt,
  getDebugInfo,
  resetBreaker,
  fetchLiveContent,
  breakerOpenUntil,
} from '../../lib/liveContent';
import { fetchContentVersionWithTiming } from '../../lib/contentVersion';
import { snapshot } from '../../lib/snapshot';
import { getHeroVideoDebugSnapshot } from '../../lib/heroVideoDebugStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentMeta {
  generatedAt: string | null;
  source:      string | null;
  editionId:   string | null;
  eventCount:  number | null;
  commitSha:   string | null;
  buildTime:   string | null;
}

interface SwInfo {
  registered:    boolean;
  controlling:   boolean;
  cacheName:     string | null;
  scriptUrl:     string | null;
}

interface LiveTestResult {
  running:    boolean;
  source:     string | null;
  httpStatus: number | null;
  durationMs: number | null;
  error:      string | null;
  eventCount: number | null;
  editionId:  string | null;
}

interface CspViolation {
  time:          number;
  blockedUri:    string;
  violatedDir:   string;
  documentUri:   string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchDeployedMeta(): Promise<ContentMeta> {
  try {
    const res = await fetch('/content-meta.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return { generatedAt: null, source: null, editionId: null, eventCount: null, commitSha: null, buildTime: null };
    return await res.json() as ContentMeta;
  } catch {
    return { generatedAt: null, source: null, editionId: null, eventCount: null, commitSha: null, buildTime: null };
  }
}

function getSwInfo(): SwInfo {
  if (!('serviceWorker' in navigator)) {
    return { registered: false, controlling: false, cacheName: null, scriptUrl: null };
  }
  const ctrl = navigator.serviceWorker.controller;
  return {
    registered:  true,
    controlling: ctrl !== null,
    cacheName:   null, // can't read cache name synchronously; shown as n/a
    scriptUrl:   ctrl?.scriptURL ?? null,
  };
}

// ─── CSP violation collector — module-level so it starts at page load ─────────

const cspViolations: CspViolation[] = [];
if (typeof window !== 'undefined') {
  document.addEventListener('securitypolicyviolation', (e) => {
    cspViolations.push({
      time:        Date.now(),
      blockedUri:  e.blockedURI,
      violatedDir: e.violatedDirective,
      documentUri: e.documentURI,
    });
    // Keep only last 20
    if (cspViolations.length > 20) cspViolations.splice(0, cspViolations.length - 20);
  });
}

// ─── Build-time env (Vite replaces at build) ──────────────────────────────────

const BUILD_SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const BUILD_ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function supabaseHost(): string {
  if (!BUILD_SUPABASE_URL) return '(not set)';
  try { return new URL(BUILD_SUPABASE_URL).host; } catch { return BUILD_SUPABASE_URL; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ContentDebugView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get('debug') === 'content';

  const [deployedMeta,  setDeployedMeta ] = useState<ContentMeta | null>(null);
  const [debugInfo,     setDebugInfo    ] = useState(getDebugInfo());
  const [dismissed,     setDismissed    ] = useState(false);
  const [heroSnap,      setHeroSnap     ] = useState(getHeroVideoDebugSnapshot());
  const [swInfo,        setSwInfo       ] = useState<SwInfo | null>(null);
  const [cspList,       setCspList      ] = useState<CspViolation[]>([]);
  const [liveTest,      setLiveTest     ] = useState<LiveTestResult>({
    running: false, source: null, httpStatus: null, durationMs: null,
    error: null, eventCount: null, editionId: null,
  });
  const [versionTest,   setVersionTest  ] = useState<{ v: string | null; durationMs: number | null; error: string | null } | null>(null);

  const { data: edition } = useEdition();
  const { data: events  } = useEvents();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDebug) return;

    // Initial loads
    fetchDeployedMeta().then(setDeployedMeta);
    setSwInfo(getSwInfo());

    // Poll debug state every 2 s
    pollRef.current = setInterval(() => {
      setDebugInfo(getDebugInfo());
      setHeroSnap(getHeroVideoDebugSnapshot());
      setCspList([...cspViolations]);
    }, 2000);

    // Initial CSP list
    setCspList([...cspViolations]);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isDebug]);

  const handleResetBreaker = useCallback(() => {
    resetBreaker();
    setDebugInfo(getDebugInfo());
    window.location.reload();
  }, []);

  const handleRunLiveTest = useCallback(async () => {
    setLiveTest((p) => ({ ...p, running: true, error: null }));
    const t0 = Date.now();
    // Run version check first
    const vt = await fetchContentVersionWithTiming();
    setVersionTest({ v: vt.v, durationMs: vt.durationMs, error: vt.error });

    // Run full content fetch
    const snap = await fetchLiveContent();
    const durationMs = Date.now() - t0;
    const info = getDebugInfo();
    setDebugInfo(info);
    setLiveTest({
      running:    false,
      source:     info.source,
      httpStatus: info.httpStatus,
      durationMs,
      error:      info.errorText,
      eventCount: snap?.events.length ?? null,
      editionId:  snap?.edition?.id ?? null,
    });
    // Refresh deployed meta after fetch
    fetchDeployedMeta().then(setDeployedMeta);
  }, []);

  if (!isDebug || dismissed) return null;

  const cachedAt = getCachedFetchedAt();
  const untilMs  = breakerOpenUntil();

  const fmtTime = (ms: number | null | undefined): string => {
    if (!ms) return '—';
    try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
  };
  const fmtIso = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
  };
  const fmtMs = (ms: number | null | undefined): string =>
    ms != null ? `${ms} ms` : '—';

  const Row: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean; warn?: boolean }> =
    ({ label, value, highlight, warn }) => (
      <tr className={highlight ? 'bg-red-50 dark:bg-red-950/30' : warn ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
        <td className="py-1 pr-4 text-stone-500 dark:text-stone-400 whitespace-nowrap align-top">{label}</td>
        <td className="py-1 font-mono text-stone-900 dark:text-stone-100 break-all">{value ?? '—'}</td>
      </tr>
    );

  const SectionHead: React.FC<{ title: string }> = ({ title }) => (
    <p className="font-semibold text-[10px] uppercase tracking-wider text-stone-500 mb-1">{title}</p>
  );

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[560px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0D1117] border border-stone-300 dark:border-stone-700 rounded-2xl shadow-2xl text-xs overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
        <span className="font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider text-[10px]">
          Content Debug — ?debug=content
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunLiveTest}
            disabled={liveTest.running}
            title="Run a live fetch right now and show the result"
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 disabled:opacity-60"
          >
            <Play size={10} /> {liveTest.running ? 'Running…' : 'Run live test'}
          </button>
          {debugInfo.breakerOpen && (
            <button
              onClick={handleResetBreaker}
              title="Reset circuit breaker and reload"
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200"
            >
              <RefreshCw size={10} /> Reset CB
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-stone-500 hover:text-stone-900 dark:hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4 max-h-[88vh] overflow-y-auto">

        {/* ── 1. Environment ── */}
        <section>
          <SectionHead title="Environment (build time)" />
          <table className="w-full">
            <tbody>
              <Row label="VITE_SUPABASE_URL"      value={BUILD_SUPABASE_URL ? `✓ ${supabaseHost()}` : '✗ NOT SET'} highlight={!BUILD_SUPABASE_URL} />
              <Row label="VITE_SUPABASE_ANON_KEY"  value={BUILD_ANON_KEY ? '✓ present' : '✗ NOT SET'} highlight={!BUILD_ANON_KEY} />
              <Row label="commitSha"               value={deployedMeta?.commitSha ?? 'loading…'} />
              <Row label="buildTime"               value={fmtIso(deployedMeta?.buildTime)} />
            </tbody>
          </table>
        </section>

        {/* ── 2. Live content fetch ── */}
        <section>
          <SectionHead title="Live content fetch" />
          <table className="w-full">
            <tbody>
              <Row label="source"       value={debugInfo.source}       warn={debugInfo.source === 'supabase-rest'} />
              <Row label="requestURL"   value={debugInfo.requestUrl}   warn={!debugInfo.requestUrl} />
              <Row label="httpStatus"   value={debugInfo.httpStatus}   highlight={!!debugInfo.httpStatus && debugInfo.httpStatus >= 400} />
              <Row label="duration"     value={fmtMs(debugInfo.durationMs)} />
              <Row label="lastAttempt"  value={fmtTime(debugInfo.lastAttemptAt)} />
              <Row label="lastSuccess"  value={fmtTime(debugInfo.lastFetchAt)} />
              <Row label="errorText"    value={debugInfo.errorText}    highlight={!!debugInfo.errorText} />
              <Row label="editionId"    value={debugInfo.editionId} />
              <Row label="eventCount"   value={debugInfo.eventCount} />
              {debugInfo.hint && <Row label="hint" value={debugInfo.hint} warn />}
            </tbody>
          </table>
        </section>

        {/* ── 3. Circuit breaker ── */}
        <section>
          <SectionHead title="Circuit breaker" />
          <table className="w-full">
            <tbody>
              <Row label="state"       value={debugInfo.breakerOpen ? '⚠ OPEN — fetches paused' : '✓ closed'} highlight={debugInfo.breakerOpen} />
              <Row label="opensUntil"  value={untilMs ? fmtTime(untilMs) : '—'} warn={!!untilMs} />
              <Row label="failCount"   value={debugInfo.failCount}   warn={(debugInfo.failCount ?? 0) > 0} highlight={(debugInfo.failCount ?? 0) >= 3} />
            </tbody>
          </table>
        </section>

        {/* ── 4. Run live test result ── */}
        {(liveTest.httpStatus !== null || liveTest.error) && (
          <section>
            <SectionHead title="Last 'Run live test' result" />
            <table className="w-full">
              <tbody>
                <Row label="source"      value={liveTest.source} />
                <Row label="httpStatus"  value={liveTest.httpStatus}  highlight={!!liveTest.httpStatus && liveTest.httpStatus >= 400} />
                <Row label="duration"    value={fmtMs(liveTest.durationMs)} />
                <Row label="error"       value={liveTest.error}        highlight={!!liveTest.error} />
                <Row label="eventCount"  value={liveTest.eventCount} />
                <Row label="editionId"   value={liveTest.editionId} />
              </tbody>
            </table>
            {versionTest && (
              <>
                <p className="mt-1 text-[10px] text-stone-400">content_version() check:</p>
                <table className="w-full">
                  <tbody>
                    <Row label="v"         value={versionTest.v ?? '(null — migration 021 not applied)'} warn={!versionTest.v} />
                    <Row label="duration"  value={fmtMs(versionTest.durationMs)} />
                    <Row label="error"     value={versionTest.error} highlight={!!versionTest.error} />
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}

        {/* ── 5. Service worker ── */}
        <section>
          <SectionHead title="Service worker" />
          {swInfo ? (
            <table className="w-full">
              <tbody>
                <Row label="registered"  value={swInfo.registered ? 'yes' : 'none'} />
                <Row label="controlling" value={swInfo.controlling ? 'yes' : 'no'} warn={swInfo.registered && !swInfo.controlling} />
                <Row label="scriptURL"   value={swInfo.scriptUrl} />
              </tbody>
            </table>
          ) : (
            <p className="text-stone-400 italic">checking…</p>
          )}
        </section>

        {/* ── 6. CSP violations ── */}
        <section>
          <SectionHead title={`CSP violations since page load (${cspList.length})`} />
          {cspList.length === 0 ? (
            <p className="text-stone-400 italic text-[11px]">None ✓</p>
          ) : (
            <table className="w-full">
              <tbody>
                {cspList.map((v, i) => (
                  <tr key={i} className="bg-red-50 dark:bg-red-950/30">
                    <td className="py-0.5 pr-3 text-stone-500 whitespace-nowrap">{new Date(v.time).toLocaleTimeString()}</td>
                    <td className="py-0.5 font-mono text-red-700 dark:text-red-400 break-all">
                      {v.violatedDir}: {v.blockedUri}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── 7. Build-time snapshot (bundled) ── */}
        <section>
          <SectionHead title="Build-time snapshot (bundled)" />
          <table className="w-full">
            <tbody>
              <Row label="source"      value={snapshot.source}        warn={snapshot.source !== 'supabase'} />
              <Row label="generatedAt" value={fmtIso(snapshot.generatedAt)} />
              <Row label="editionId"   value={snapshot.edition?.id ?? null} />
              <Row label="events"      value={snapshot.events.length} />
            </tbody>
          </table>
        </section>

        {/* ── 8. Deployed content-meta.json ── */}
        <section>
          <SectionHead title="Deployed content-meta.json" />
          <table className="w-full">
            <tbody>
              <Row label="source"      value={deployedMeta?.source ?? 'loading…'} warn={!!deployedMeta && deployedMeta.source !== 'supabase'} />
              <Row label="generatedAt" value={fmtIso(deployedMeta?.generatedAt)} />
              <Row label="editionId"   value={deployedMeta?.editionId} />
              <Row label="eventCount"  value={deployedMeta?.eventCount ?? '—'} />
              <Row label="commitSha"   value={deployedMeta?.commitSha ?? '—'} />
              <Row label="buildTime"   value={fmtIso(deployedMeta?.buildTime)} />
            </tbody>
          </table>
        </section>

        {/* ── 9. localStorage live cache ── */}
        <section>
          <SectionHead title="localStorage live cache" />
          <table className="w-full">
            <tbody>
              <Row label="cachedAt" value={cachedAt ? fmtTime(cachedAt) : 'never'} />
            </tbody>
          </table>
        </section>

        {/* ── 10. TanStack Query cache ── */}
        <section>
          <SectionHead title="Active data (TanStack Query cache)" />
          <table className="w-full">
            <tbody>
              <Row label="editionId"  value={edition?.id ?? null} />
              <Row label="endDateGC"  value={(edition as { endDateGC?: string } | undefined)?.endDateGC ?? null} />
              <Row label="eventCount" value={events?.length ?? '—'} />
            </tbody>
          </table>
        </section>

        {/* ── 11. Hero video ── */}
        <section>
          <SectionHead title="Hero video" />
          {heroSnap == null ? (
            <p className="text-stone-400 italic text-[11px]">No video mounted (poster-only mode or not yet rendered).</p>
          ) : (
            <table className="w-full">
              <tbody>
                <Row label="chosenSrc"     value={heroSnap.chosenSrc || '—'} />
                <Row label="reason"        value={heroSnap.chosenReason || '—'} />
                <Row label="readyState"    value={heroSnap.readyState}
                  highlight={heroSnap.readyState >= 0 && heroSnap.readyState < 2}
                  warn={heroSnap.readyState === 2} />
                <Row label="buffered"      value={
                  heroSnap.bufferedRanges.length === 0
                    ? 'none'
                    : heroSnap.bufferedRanges.map(r => `${r.start.toFixed(1)}–${r.end.toFixed(1)}s`).join(', ')
                } />
                <Row label="stallCount"    value={heroSnap.stallCount}
                  warn={heroSnap.stallCount > 0} highlight={heroSnap.stallCount >= 3} />
                <Row label="guardFired"    value={heroSnap.stallGuardFired ? '⚠ YES — showing poster' : 'no'}
                  highlight={heroSnap.stallGuardFired} />
                <Row label="isPlaying"     value={heroSnap.isPlaying ? 'yes' : 'no'} />
                <Row label="timeToFirst♟"  value={
                  heroSnap.timeToFirstPlaying != null
                    ? `${heroSnap.timeToFirstPlaying.toFixed(0)} ms`
                    : 'not played yet'
                } warn={heroSnap.timeToFirstPlaying != null && heroSnap.timeToFirstPlaying > 3000} />
                <Row label="droppedFrames" value={
                  heroSnap.droppedFrames != null && heroSnap.totalFrames != null
                    ? `${heroSnap.droppedFrames} / ${heroSnap.totalFrames}`
                    : '—'
                } warn={(heroSnap.droppedFrames ?? 0) > 10} />
              </tbody>
            </table>
          )}
        </section>

      </div>
    </div>
  );
};
