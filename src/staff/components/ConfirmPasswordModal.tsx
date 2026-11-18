/**
 * ConfirmPasswordModal.tsx
 *
 * Re-authenticates the current organizer before a sensitive action.
 * Uses a Supabase sign-in check with supabaseStaff — does NOT persist a
 * new session; it only verifies the password server-side.
 * Confirmation is valid for 5 minutes.
 *
 * Actions requiring confirmation:
 *   delete any item, download backup, save website settings,
 *   set current edition, publish edition as main, restore from History.
 *
 * Usage:
 *   const { confirm } = useConfirmPassword()
 *   await confirm()   // throws if cancelled or wrong password
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { supabaseStaff } from '../../lib/supabaseStaff'
import { useAuth } from '../auth/AuthProvider'

const VALID_FOR_MS = 5 * 60 * 1000  // 5 minutes

interface ConfirmPasswordContextValue {
  confirm: () => Promise<void>
}

const ConfirmPasswordContext = createContext<ConfirmPasswordContextValue | null>(null)

export function ConfirmPasswordProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [open,    setOpen]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const [pw,      setPw]      = useState('')

  const lastConfirmedAt  = useRef<number | null>(null)
  const pendingResolve   = useRef<(() => void) | null>(null)
  const pendingReject    = useRef<((e: Error) => void) | null>(null)

  const confirm = useCallback((): Promise<void> => {
    if (lastConfirmedAt.current && Date.now() - lastConfirmedAt.current < VALID_FOR_MS) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      pendingResolve.current = resolve
      pendingReject.current  = reject
      setPw(''); setError(null); setOpen(true)
    })
  }, [])

  const handleCancel = () => {
    setOpen(false)
    pendingReject.current?.(new Error('cancelled'))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw.trim() || !session?.user.email) return
    setLoading(true); setError(null)
    try {
      const { error: authError } = await supabaseStaff.auth.signInWithPassword({
        email: session.user.email,
        password: pw,
      })
      if (authError) {
        setError('Incorrect password. Please try again.')
        setLoading(false)
        return
      }
      lastConfirmedAt.current = Date.now()
      setOpen(false)
      pendingResolve.current?.()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmPasswordContext.Provider value={{ confirm }}>
      {children}

      {open && (
        <div
          className="fixed inset-0 z-[300] flex flex-col justify-end sm:items-center sm:justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-pw-title"
          onClick={handleCancel}
        >
          <div
            className={[
              'w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-2xl',
              'rounded-t-3xl sm:rounded-2xl',
              'sm:max-w-sm sm:mx-4',
              'p-6 space-y-5',
              'pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pb-6',
            ].join(' ')}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle (mobile only) */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-[var(--border-subtle)] mx-auto -mt-1 mb-2" aria-hidden="true" />

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E]/10 text-[#0F3D2E] dark:bg-[#D9A441]/20 dark:text-[#D9A441] shrink-0">
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 id="confirm-pw-title" className="font-display text-lg font-bold text-[var(--text-main)]">
                  Confirm your password
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Required before this action.</p>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="confirm-pw-input" className="block text-sm font-medium text-[var(--text-main)]">
                  Your password
                </label>
                <div className="relative">
                  <input
                    id="confirm-pw-input"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent"
                    style={{ fontSize: '16px' }}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !pw.trim()}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ConfirmPasswordContext.Provider>
  )
}

export function useConfirmPassword(): ConfirmPasswordContextValue {
  const ctx = useContext(ConfirmPasswordContext)
  if (!ctx) throw new Error('useConfirmPassword must be used within <ConfirmPasswordProvider>')
  return ctx
}
