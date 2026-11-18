/**
 * useWebsiteSync — Live deploy status for the sync bar.
 *
 * Reads site_state (last_change_at, last_deploy_requested_at) from Supabase
 * via the staff session JWT, then compares with content-meta.json generatedAt
 * to decide whether the live site is up-to-date.
 *
 * Status values:
 *   loading          — initial fetch not complete
 *   up-to-date       — generatedAt >= last_change_at (or no changes logged)
 *   changes-waiting  — last_change_at > generatedAt (unpublished changes exist)
 *   updating         — deploy was requested and < 120 s ago
 *
 * Local dev detection: when VITE_SITE_URL is empty or starts with 'http://localhost'
 * the bar shows "Local mode: changes appear after you refresh the public page"
 * and skips the deploy hook call.
 *
 * Uses the staff supabase client (authenticated), never the anon key.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fireDeploy } from '../lib/deployScheduler'

export type SyncStatus = 'up-to-date' | 'changes-waiting' | 'updating' | 'loading'

export interface WebsiteSyncState {
  status:                 SyncStatus
  /** ISO string from content-meta.json — when the live bundle was last built. */
  generatedAt:            string | null
  /** ISO string from site_state — when content last changed. */
  lastChangeAt:           string | null
  /** ISO string from site_state — when deploy was last requested. */
  lastDeployRequestedAt:  string | null
  /** Human-readable error from the last deploy attempt, if any. */
  deployError:            string | null
  /** True when VITE_SITE_URL is absent or localhost. */
  isLocalDev:             boolean
  /** Manually trigger a deploy. Resolves with success/message. */
  triggerDeploy:          () => Promise<{ success: boolean; message: string }>
  /** Force a re-read of site_state. */
  refresh:                () => void
}

const SITE_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/$/, '')
const PUBLIC_SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? '').replace(/\/$/, '')
const META_URL = PUBLIC_SITE_URL
  ? `${PUBLIC_SITE_URL}/content-meta.json`
  : '/content-meta.json' // relative — works in local dev

const isLocalDev = !PUBLIC_SITE_URL || PUBLIC_SITE_URL.startsWith('http://localhost')

const POLL_MS = 30_000 // re-check every 30 s

/** Fetch the generatedAt timestamp from the deployed public site. */
async function fetchGeneratedAt(): Promise<string | null> {
  try {
    const res = await fetch(META_URL + '?_=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as { generatedAt?: string }
    return data.generatedAt ?? null
  } catch {
    return null
  }
}

export function useWebsiteSync(autoTrigger = false): WebsiteSyncState {
  const [status,                setStatus               ] = useState<SyncStatus>('loading')
  const [generatedAt,           setGeneratedAt          ] = useState<string | null>(null)
  const [lastChangeAt,          setLastChangeAt         ] = useState<string | null>(null)
  const [lastDeployRequestedAt, setLastDeployRequestedAt] = useState<string | null>(null)
  const [deployError,           setDeployError          ] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoTriggeredRef = useRef(false)

  const load = useCallback(async () => {
    try {
      // Fetch site_state from DB (requires staff auth)
      const { data, error } = await supabase
        .from('site_state')
        .select('last_change_at, last_deploy_requested_at')
        .eq('id', true)
        .single()

      if (error || !data) {
        setStatus('up-to-date') // fall back gracefully if table missing
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const change  = (data as any).last_change_at          as string | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deploy  = (data as any).last_deploy_requested_at as string | null
      setLastChangeAt(change)
      setLastDeployRequestedAt(deploy)

      // Fetch the live site's generatedAt
      const genAt = await fetchGeneratedAt()
      setGeneratedAt(genAt)

      // Decide status
      if (deploy) {
        const deployMs = new Date(deploy).getTime()
        const sinceDeployS = (Date.now() - deployMs) / 1000
        if (sinceDeployS < 120) {
          // Deploy was requested recently — build is likely in progress
          setStatus('updating')
          return
        }
      }

      if (change && genAt) {
        const changeMs  = new Date(change).getTime()
        const generatedMs = new Date(genAt).getTime()
        setStatus(changeMs > generatedMs ? 'changes-waiting' : 'up-to-date')
      } else {
        setStatus('up-to-date')
      }
    } catch {
      setStatus('up-to-date') // silent — sync bar is advisory only
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  // Auto-trigger a deploy if changes are waiting (only once per mount)
  useEffect(() => {
    if (autoTrigger && status === 'changes-waiting' && !autoTriggeredRef.current && !isLocalDev) {
      autoTriggeredRef.current = true
      fireDeploy().then((result) => {
        if (!result.success) setDeployError(result.message)
        load()
      })
    }
  }, [autoTrigger, status, load])

  const triggerDeploy = useCallback(async () => {
    setDeployError(null)
    setStatus('updating')
    const result = await fireDeploy()
    if (!result.success) {
      setDeployError(result.message)
      setStatus('changes-waiting')
    } else {
      setLastDeployRequestedAt(new Date().toISOString())
      setStatus('updating')
    }
    return result
  }, [])

  return {
    status,
    generatedAt,
    lastChangeAt,
    lastDeployRequestedAt,
    deployError,
    isLocalDev,
    triggerDeploy,
    refresh: load,
  }
}
