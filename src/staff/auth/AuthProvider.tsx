/**
 * AuthProvider.tsx — Organizer Portal authentication context.
 *
 * Performance: the auth listener sets the session immediately (no DB wait),
 * then fetches the profile in the background. The login redirect fires as
 * soon as both session and profile are ready. This prevents the "Signing in…
 * forever" freeze on cold Supabase free-plan starts.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabaseStaff as supabase } from '../../lib/supabaseStaff'
import type { Profile } from '../../types/database'

export interface StaffProfile {
  id:                   string
  full_name:            string | null
  role:                 Profile['role']
  is_active:            boolean
  must_change_password: boolean
}

export interface AuthContextValue {
  session:               Session | null
  profile:               StaffProfile | null
  loading:               boolean
  signIn:                (email: string, password: string) => Promise<void>
  signOut:               () => Promise<void>
  showInactivityWarning: boolean
  resetInactivityTimer:  () => void
  inactiveRejected:      boolean
  clearRejection:        () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const INACTIVITY_WARN_MS  = 25 * 60 * 1000
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000

const ACTIVITY_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,  setSession]  = useState<Session | null>(null)
  const [profile,  setProfile]  = useState<StaffProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)
  const [inactiveRejected, setInactiveRejected] = useState(false)

  const warnTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // ── Fetch profile with a 10 s timeout so cold DB doesn't freeze the UI ──
  const fetchProfile = useCallback(async (userId: string): Promise<StaffProfile | null> => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active, must_change_password')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single()
      clearTimeout(timer)
      if (error || !data) return null
      return data as StaffProfile
    } catch {
      return null
    }
  }, [])

  const signOut = useCallback(async () => {
    clearTimeout(warnTimerRef.current ?? undefined)
    clearTimeout(logoutTimerRef.current ?? undefined)
    setShowInactivityWarning(false)
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const startInactivityTimers = useCallback(() => {
    clearTimeout(warnTimerRef.current ?? undefined)
    clearTimeout(logoutTimerRef.current ?? undefined)
    setShowInactivityWarning(false)
    warnTimerRef.current  = setTimeout(() => setShowInactivityWarning(true), INACTIVITY_WARN_MS)
    logoutTimerRef.current = setTimeout(() => { void signOut() }, INACTIVITY_LIMIT_MS)
  }, [signOut])

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    setShowInactivityWarning(false)
    startInactivityTimers()
  }, [startInactivityTimers])

  useEffect(() => {
    if (!session) return
    const handler = () => {
      if (Date.now() - lastActivityRef.current > 30_000) {
        lastActivityRef.current = Date.now()
        resetInactivityTimer()
      }
    }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }))
    startInactivityTimers()
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler))
      clearTimeout(warnTimerRef.current ?? undefined)
      clearTimeout(logoutTimerRef.current ?? undefined)
    }
  }, [session, resetInactivityTimer, startInactivityTimers])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!mounted) return

      if (s) {
        // Set session immediately so the UI unblocks
        setSession(s)
        // Fetch profile in background
        const p = await fetchProfile(s.user.id)
        if (!mounted) return

        if (!p || !p.is_active) {
          await supabase.auth.signOut()
          setSession(null); setProfile(null)
        } else {
          setProfile(p)
        }
      }
      setLoading(false)
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'PASSWORD_RECOVERY' ||
          event === 'USER_UPDATED'
        ) {
          // Set session immediately — no DB wait, UI responds at once
          setSession(newSession)
          setLoading(false)

          // Fetch profile in background
          fetchProfile(newSession.user.id).then(p => {
            if (!mounted) return

            if (!p) {
              // Profile not ready yet (new user trigger delay) — retry after 1 s
              setTimeout(() => {
                fetchProfile(newSession.user.id).then(p2 => {
                  if (!mounted) return
                  if (!p2 || !p2.is_active) {
                    if (p2 && !p2.is_active) setInactiveRejected(true)
                    supabase.auth.signOut()
                    setSession(null); setProfile(null)
                  } else {
                    setProfile(p2)
                  }
                })
              }, 1000)
              return
            }

            if (!p.is_active) {
              setInactiveRejected(true)
              supabase.auth.signOut()
              setSession(null); setProfile(null)
              return
            }

            setProfile(p)
          })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setInactiveRejected(false)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // onAuthStateChange fires immediately after this and sets session
  }, [])

  const clearRejection = useCallback(() => setInactiveRejected(false), [])

  return (
    <AuthContext.Provider value={{
      session, profile, loading,
      signIn, signOut,
      showInactivityWarning, resetInactivityTimer,
      inactiveRejected, clearRejection,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
