/**
 * useLiveSaveConfirmation.ts
 *
 * After a staff save, polls content_version() until `v` changes (meaning the
 * live public site now reflects the saved change), then returns a human-readable
 * "verified N s ago" message.
 *
 * Usage:
 *   const { state, label, check, reset } = useLiveSaveConfirmation()
 *   // call check() immediately after any successful save/publish/unpublish
 *
 * States:
 *   idle       — not started
 *   saving     — save was just performed; recording baseline version
 *   polling    — checking content_version() every 3 s
 *   confirmed  — v changed; content is live
 *   timeout    — 30 s elapsed with no version change
 *   error      — fetch failed with a known error
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchContentVersionWithTiming } from '../../lib/contentVersion'

export type ConfirmationState = 'idle' | 'saving' | 'polling' | 'confirmed' | 'timeout' | 'error'

export interface LiveSaveConfirmation {
  /** Current state of the confirmation flow. */
  state:        ConfirmationState
  /** Human-readable label suitable for a toast or status bar. */
  label:        string
  /** Error detail when state === 'error' */
  errorDetail:  string | null
  /** Seconds since confirmation (when state === 'confirmed'). */
  verifiedAgo:  number | null
  /** Start the confirmation flow immediately after a save. */
  check:        () => void
  /** Reset to idle (e.g. on page unmount). */
  reset:        () => void
}

const POLL_INTERVAL_MS = 3_000
const TIMEOUT_MS       = 30_000

function humaniseError(error: string | null): string {
  if (!error) return 'Could not reach the live site.'
  if (error.includes('not set'))          return 'Missing Supabase env variables — check Vercel project settings.'
  if (error.includes('404') || error.includes('not found')) return 'content_version() not found — apply migration 021.'
  if (error.includes('403'))              return 'Permission denied — check Supabase RLS.'
  if (error.includes('AbortError') || error.includes('abort')) return 'Request timed out — Supabase project may be paused.'
  return error
}

export function useLiveSaveConfirmation(): LiveSaveConfirmation {
  const [state,       setState      ] = useState<ConfirmationState>('idle')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [verifiedAgo, setVerifiedAgo] = useState<number | null>(null)

  const baselineVersion = useRef<string | null>(null)
  const startedAt       = useRef<number>(0)
  const confirmedAt     = useRef<number | null>(null)
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const agoRef          = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const stopAgo = useCallback(() => {
    if (agoRef.current) { clearInterval(agoRef.current); agoRef.current = null }
  }, [])

  const reset = useCallback(() => {
    stopPolling()
    stopAgo()
    setState('idle')
    setErrorDetail(null)
    setVerifiedAgo(null)
    baselineVersion.current = null
    confirmedAt.current     = null
  }, [stopPolling, stopAgo])

  // Tick "verified N s ago"
  const startAgoTick = useCallback(() => {
    confirmedAt.current = Date.now()
    agoRef.current = setInterval(() => {
      if (confirmedAt.current) {
        setVerifiedAgo(Math.floor((Date.now() - confirmedAt.current) / 1000))
      }
    }, 1_000)
  }, [])

  const doPoll = useCallback(async () => {
    const elapsed = Date.now() - startedAt.current
    if (elapsed >= TIMEOUT_MS) {
      stopPolling()
      setState('timeout')
      return
    }

    const result = await fetchContentVersionWithTiming()

    if (result.error && !result.v) {
      stopPolling()
      setErrorDetail(humaniseError(result.error))
      setState('error')
      return
    }

    // Migration 021 not yet applied — no version available; treat as confirmed
    // so the UI doesn't show a permanent "polling" state.
    if (result.v === null) {
      stopPolling()
      startAgoTick()
      setState('confirmed')
      return
    }

    // Version changed from baseline → content is live
    if (baselineVersion.current !== null && result.v !== baselineVersion.current) {
      stopPolling()
      startAgoTick()
      setState('confirmed')
      return
    }

    // Record baseline on first successful poll
    if (baselineVersion.current === null) {
      baselineVersion.current = result.v
    }

    setState('polling')
  }, [stopPolling, startAgoTick])

  const check = useCallback(() => {
    // Reset any previous run
    stopPolling()
    stopAgo()
    setState('saving')
    setErrorDetail(null)
    setVerifiedAgo(null)
    baselineVersion.current = null
    confirmedAt.current     = null
    startedAt.current       = Date.now()

    // Slight delay so the DB write can propagate before the first poll
    setTimeout(() => {
      setState('polling')
      doPoll()
      intervalRef.current = setInterval(doPoll, POLL_INTERVAL_MS)
    }, 500)
  }, [stopPolling, stopAgo, doPoll])

  // Cleanup on unmount
  useEffect(() => () => { stopPolling(); stopAgo() }, [stopPolling, stopAgo])

  const label: string = (() => {
    switch (state) {
      case 'idle':      return ''
      case 'saving':    return 'Saving…'
      case 'polling':   return 'Checking live site…'
      case 'confirmed': return `Live on the website ✓${verifiedAgo != null ? ` (verified ${verifiedAgo} s ago)` : ''}`
      case 'timeout':   return 'Could not confirm live within 30 s — try "Check live site"'
      case 'error':     return `Not confirmed: ${errorDetail ?? 'unknown error'}`
    }
  })()

  return { state, label, errorDetail, verifiedAgo, check, reset }
}
