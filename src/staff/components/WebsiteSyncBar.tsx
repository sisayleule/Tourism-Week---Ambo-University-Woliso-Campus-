/**
 * WebsiteSyncBar — Thin bar shown at the top of every staff page.
 *
 * States:
 *   loading          — hidden (avoid flash)
 *   up-to-date       — hidden (no noise when everything is fine)
 *   changes-waiting  — amber bar: "Changes pending — Update website"
 *   updating         — blue bar: "Updating… (1–2 min)"
 *   error            — red bar with plain-language error message
 *
 * WebsiteSyncDashboardCard — richer card for the dashboard (includes
 *   "Check live site" button powered by useLiveSaveConfirmation).
 */

import React, { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Globe } from 'lucide-react'
import { useWebsiteSync } from '../hooks/useWebsiteSync'
import { useLiveSaveConfirmation } from '../hooks/useLiveSaveConfirmation'

// ─── Error plain-language mapper ─────────────────────────────────────────────

function humaniseError(raw: string): string {
  if (!raw) return 'The update could not be triggered. Try again in a moment.'
  if (raw.includes('Deploy hook URL not configured') || raw.includes('not configured'))
    return 'Deploy hook URL not configured — add VERCEL_DEPLOY_HOOK_URL to your Supabase Edge Function secrets.'
  if (raw.includes('401') || raw.includes('Unauthorized') || raw.includes('Invalid token'))
    return 'Authentication error — sign out and sign back in, then try again.'
  if (raw.includes('403') || raw.includes('Access denied'))
    return 'Your account does not have permission to trigger a website update.'
  if (raw.includes('429') || raw.includes('wait'))
    return 'A rebuild was requested recently. Wait 60 seconds and try again.'
  if (raw.includes('502') || raw.includes('Deploy hook request failed'))
    return 'The Vercel deploy hook returned an error. Check that the hook URL is valid.'
  if (raw.includes('Could not reach') || raw.includes('Not authenticated'))
    return 'Could not reach the deploy service. Check your internet connection.'
  return raw
}

// ─── Sync bar ─────────────────────────────────────────────────────────────────

export const WebsiteSyncBar: React.FC = () => {
  const { status, deployError, isLocalDev, triggerDeploy } = useWebsiteSync()
  const [triggering, setTriggering] = useState(false)

  const handleTrigger = async () => {
    setTriggering(true)
    await triggerDeploy()
    setTriggering(false)
  }

  if (status === 'loading' || status === 'up-to-date') return null

  if (deployError) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400">
        <span className="flex items-center gap-2 min-w-0">
          <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
          <span className="break-words">{humaniseError(deployError)}</span>
        </span>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="shrink-0 font-semibold hover:underline disabled:opacity-60"
        >
          Retry
        </button>
      </div>
    )
  }

  if (status === 'updating') {
    return (
      <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400">
        <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden="true" />
        <span>Updating the website… usually takes 1–2 minutes.</span>
      </div>
    )
  }

  if (status === 'changes-waiting') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-400">
        <span>Unpublished changes are waiting.</span>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="shrink-0 inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-60"
        >
          {triggering
            ? <><Loader2 size={11} className="animate-spin" /> Updating…</>
            : <><RefreshCw size={11} /> Update website</>}
        </button>
      </div>
    )
  }

  return null
}

// ─── Dashboard card ───────────────────────────────────────────────────────────

export const WebsiteSyncDashboardCard: React.FC = () => {
  const {
    status, generatedAt, lastChangeAt,
    deployError, triggerDeploy,
  } = useWebsiteSync()
  const [triggering, setTriggering] = useState(false)
  const { state: cvState, label: cvLabel, check: checkLive } = useLiveSaveConfirmation()

  const handleTrigger = async () => {
    setTriggering(true)
    await triggerDeploy()
    setTriggering(false)
  }

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  const statusLabel = status === 'loading'    ? 'Checking…'
    : status === 'updating'   ? 'Updating…'
    : status === 'up-to-date' ? 'Up to date'
    : 'Changes waiting'

  const statusColor = status === 'up-to-date' ? 'text-emerald-600 dark:text-emerald-400'
    : status === 'updating'   ? 'text-blue-600 dark:text-blue-400'
    : 'text-amber-600 dark:text-amber-400'

  const icon = status === 'up-to-date'    ? <CheckCircle2 size={14} />
    : status === 'updating'      ? <Loader2 size={14} className="animate-spin" />
    : status === 'loading'       ? <Loader2 size={14} className="animate-spin" />
    : <AlertCircle size={14} />

  // Colour the live-check result
  const cvColor = cvState === 'confirmed'
    ? 'text-emerald-600 dark:text-emerald-400'
    : cvState === 'error' || cvState === 'timeout'
    ? 'text-red-600 dark:text-red-400'
    : 'text-stone-500 dark:text-stone-400'

  return (
    <div className="bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Website
        </h3>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${statusColor}`}>
          {icon}
          {statusLabel}
        </span>
      </div>

      {deployError && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-2.5 py-1.5">
          {humaniseError(deployError)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-500 dark:text-stone-400">
        <span>Last built: <strong className="text-stone-700 dark:text-stone-300">{fmtTime(generatedAt)}</strong></span>
        <span>Last change: <strong className="text-stone-700 dark:text-stone-300">{fmtTime(lastChangeAt)}</strong></span>
      </div>

      {/* Check live site */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={checkLive}
          disabled={cvState === 'saving' || cvState === 'polling'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-60 transition-colors"
        >
          {cvState === 'polling' || cvState === 'saving'
            ? <Loader2 size={11} className="animate-spin" />
            : <Globe size={11} />}
          Check live site
        </button>
        {cvState !== 'idle' && (
          <span className={`text-[11px] ${cvColor}`}>{cvLabel}</span>
        )}
      </div>

      {status === 'changes-waiting' && (
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F3D2E] text-white text-xs font-semibold hover:bg-[#0A2A20] disabled:opacity-60 transition-colors"
        >
          {triggering
            ? <><Loader2 size={12} className="animate-spin" /> Updating…</>
            : <><RefreshCw size={12} /> Update website now</>}
        </button>
      )}
    </div>
  )
}
