/**
 * deployScheduler.ts — Debounced auto-deploy trigger.
 *
 * Rules:
 *  · In local development (import.meta.env.DEV, or hostname is localhost /
 *    127.0.0.1), scheduleDeploy is a silent no-op.  No network call is ever
 *    made in dev, so there are zero console errors from a missing function.
 *  · In production a failed call logs exactly once per backoff window (60 s)
 *    and shows the user a friendly toast-style message rather than flooding
 *    the console with repeated errors.
 *  · A 90-second debounce coalesces rapid saves into a single deploy request,
 *    keeping the site within Vercel Hobby's daily deployment limit.
 */

import { supabase } from '../../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPLOY_DELAY_MS  = 90 * 1000  // debounce: 90 s of no further saves
const BACKOFF_MS       = 60 * 1000  // suppress repeated error logs for 60 s

const TRIGGER_DEPLOY_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')}/functions/v1/trigger-deploy`
  : ''

// ─── Dev detection ────────────────────────────────────────────────────────────

function isDevEnvironment(): boolean {
  if (import.meta.env.DEV) return true
  try {
    const h = window.location.hostname
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.')
  } catch {
    return false
  }
}

// ─── Module-level state ───────────────────────────────────────────────────────

let timer: ReturnType<typeof setTimeout> | null = null
let inFlight = false
let lastErrorLoggedAt = 0   // timestamp of the most recent error log

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule a deploy after 90 seconds of no further calls.  Each call resets
 * the timer (debounce).  Safe to call from any mutation's onSuccess callback.
 *
 * In dev environments this is a complete no-op.
 */
export function scheduleDeploy(): void {
  if (isDevEnvironment()) return
  if (!TRIGGER_DEPLOY_URL) return

  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    timer = null
    await fireDeploy()
  }, DEPLOY_DELAY_MS)
}

/**
 * Fire the deploy request immediately (bypasses the debounce timer).
 * Also a no-op in dev.
 */
export async function fireDeploy(): Promise<{ success: boolean; message: string }> {
  if (isDevEnvironment()) {
    return { success: false, message: 'No-op in local development' }
  }
  if (!TRIGGER_DEPLOY_URL) {
    return { success: false, message: 'Deploy URL not configured' }
  }
  if (inFlight) {
    return { success: false, message: 'A deploy is already in progress' }
  }

  inFlight = true
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      return { success: false, message: 'Not authenticated' }
    }

    const res = await fetch(TRIGGER_DEPLOY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await res.json().catch(() => ({}))

    if (res.status === 202) {
      // Reset backoff on success so the next failure is logged immediately.
      lastErrorLoggedAt = 0
      return { success: true, message: data.message ?? 'Deploy triggered' }
    }
    if (res.status === 429) {
      // Rate-limited — not an error, just informational.
      return { success: false, message: data.error ?? 'A deploy was recently requested. Please wait.' }
    }

    // Any other non-success: log once per backoff window.
    const msg: string = data.error ?? `HTTP ${res.status}`
    logErrorOnce(`[deployScheduler] fireDeploy failed: ${msg}`)
    return { success: false, message: msg }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorOnce(`[deployScheduler] fireDeploy error: ${msg}`)
    return { success: false, message: 'Could not reach the deploy service' }
  } finally {
    inFlight = false
  }
}

/** Cancel any pending deploy timer. */
export function cancelDeploy(): void {
  if (timer) { clearTimeout(timer); timer = null }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Log an error message at most once per BACKOFF_MS window. */
function logErrorOnce(message: string): void {
  const now = Date.now()
  if (now - lastErrorLoggedAt >= BACKOFF_MS) {
    console.error(message)
    lastErrorLoggedAt = now
  }
}
