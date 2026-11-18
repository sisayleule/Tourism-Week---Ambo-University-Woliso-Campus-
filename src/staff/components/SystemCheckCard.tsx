/**
 * SystemCheckCard.tsx
 *
 * Admin-dashboard card that calls system_check() and pings the three Edge
 * Functions.  Collapsed by default; expands on "Run check".
 *
 * Green   = present / reachable
 * Red     = missing / not deployed
 * Amber   = CORS blocked (function exists but browser can't reach it)
 * Grey    = not yet checked
 *
 * Each red row shows the exact "apply migration NNN" or "deploy function" fix.
 */

import React, { useState } from 'react'
import { ShieldCheck, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, Minus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePortal } from '../context/PortalContext'
import { useSystemCheck, useFunctionPings } from '../hooks/useAdminQueries'
import type { SystemCheckRow, FunctionPingResult } from '../services/adminService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusIcon({ present }: { present: boolean | null }) {
  if (present === null) return <Minus size={14} className="text-[var(--text-muted)]" />
  return present
    ? <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
    : <XCircle     size={14} className="text-red-600    dark:text-red-400    shrink-0" />
}

function PingIcon({ status }: { status: FunctionPingResult['status'] | null }) {
  if (!status) return <Minus size={14} className="text-[var(--text-muted)]" />
  if (status === 'reachable')     return <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
  if (status === 'cors_blocked')  return <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
  return <XCircle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
}

function fixText(row: SystemCheckRow): string {
  return `Ask the administrator to apply migration ${row.migration} (adds ${row.kind} ${row.item}).`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SystemCheckCard() {
  const { client } = usePortal()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [runEnabled, setRunEnabled] = useState(false)

  const { data: rows, isFetching: checkFetching, error: checkError } =
    useSystemCheck(client, runEnabled)
  const { data: pings, isFetching: pingFetching, error: pingError } =
    useFunctionPings(runEnabled)

  const fetching = checkFetching || pingFetching

  const missingCount = (rows ?? []).filter(r => !r.present).length
  const badPings     = (pings ?? []).filter(p => p.status !== 'reachable').length
  const totalBad     = missingCount + badPings

  const handleRun = () => {
    setRunEnabled(true)
    setExpanded(true)
    qc.removeQueries({ queryKey: ['admin', 'system-check'] })
    qc.removeQueries({ queryKey: ['admin', 'function-pings'] })
    // Re-enable queries by toggling — they will refetch automatically
    setTimeout(() => setRunEnabled(true), 0)
  }

  // Group rows by migration
  const byMigration: Record<string, SystemCheckRow[]> = {}
  for (const row of rows ?? []) {
    if (!byMigration[row.migration]) byMigration[row.migration] = []
    byMigration[row.migration].push(row)
  }

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={18} className={
            !runEnabled ? 'text-[var(--text-muted)]' :
            totalBad > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
          } />
          <h3 className="font-display text-base font-bold text-[var(--text-main)]">System Check</h3>
          {runEnabled && !fetching && (
            <span className={[
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              totalBad === 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            ].join(' ')}>
              {totalBad === 0 ? 'All OK' : `${totalBad} issue${totalBad !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={fetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Checking…' : runEnabled ? 'Re-check' : 'Run check'}
          </button>
          {runEnabled && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {expanded && runEnabled && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-5">
          {(checkError || pingError) && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {(checkError as Error | null)?.message ?? (pingError as Error | null)?.message}
            </p>
          )}

          {/* Migration items */}
          {Object.keys(byMigration).sort().map(mig => (
            <div key={mig} className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Migration {mig}
              </p>
              {byMigration[mig].map(row => (
                <div key={row.item} className="flex items-start gap-2.5 py-0.5">
                  <StatusIcon present={row.present} />
                  <div className="min-w-0">
                    <span className={[
                      'text-xs font-mono',
                      row.present
                        ? 'text-[var(--text-main)]'
                        : 'text-red-700 dark:text-red-400 font-semibold',
                    ].join(' ')}>
                      {row.item}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1.5">({row.kind})</span>
                    {!row.present && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 leading-relaxed">
                        {fixText(row)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Function pings */}
          {pings && pings.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Edge Functions
              </p>
              {pings.map(p => (
                <div key={p.name} className="flex items-start gap-2.5 py-0.5">
                  <PingIcon status={p.status} />
                  <div className="min-w-0">
                    <span className={[
                      'text-xs font-mono',
                      p.status === 'reachable'
                        ? 'text-[var(--text-main)]'
                        : p.status === 'cors_blocked'
                        ? 'text-amber-700 dark:text-amber-400 font-semibold'
                        : 'text-red-700 dark:text-red-400 font-semibold',
                    ].join(' ')}>
                      {p.name}
                    </span>
                    {p.status !== 'reachable' && (
                      <p className={[
                        'text-[11px] mt-0.5 leading-relaxed',
                        p.status === 'cors_blocked'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400',
                      ].join(' ')}>
                        {p.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
