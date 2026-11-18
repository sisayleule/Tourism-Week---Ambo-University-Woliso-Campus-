/**
 * Login.tsx — /staff/login
 *
 * Accepts any active account. Session is set immediately after sign-in
 * (no DB wait), so the button unblocks fast. Profile loads in background
 * and the redirect fires as soon as both are ready.
 */

import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { StaffMeta } from '../components/StaffMeta'

export function Login() {
  const { t } = useTranslation()
  const { signIn, session, profile, loading, inactiveRejected, clearRejection } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/staff'

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [credErr,    setCredErr]    = useState<string | null>(null)

  // Redirect as soon as session + profile are both ready
  useEffect(() => {
    if (loading) return
    if (session && profile) {
      clearRejection()
      if (profile.must_change_password) {
        navigate('/staff/set-password', { replace: true })
      } else {
        navigate(from === '/staff/login' ? '/staff' : from, { replace: true })
      }
    }
  }, [session, profile, loading, navigate, from, clearRejection])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCredErr(null)
    clearRejection()
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      // signIn() returns immediately after signInWithPassword succeeds.
      // onAuthStateChange fires, sets session instantly, then loads profile.
      // The useEffect above redirects when profile arrives (~1 s on cold DB).
    } catch {
      setCredErr(t('staff.login.errorInvalid'))
    } finally {
      setSubmitting(false)
    }
  }

  const error = inactiveRejected ? t('staff.login.errorInactive') : credErr

  return (
    <>
      <StaffMeta />
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
        <div className="w-full max-w-sm space-y-8">

          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F3D2E] text-[#D9A441] mx-auto">
              <ShieldCheck size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">
                {t('staff.login.title')}
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t('staff.login.subtitle')}
              </p>
            </div>
          </div>

          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm space-y-5">

            {error && (
              <div role="alert" className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-sm font-medium text-[var(--text-main)]">
                  {t('staff.login.emailLabel')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); setCredErr(null); clearRejection() }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-[var(--text-main)]">
                  {t('staff.login.passwordLabel')}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => { setPassword(e.target.value); setCredErr(null); clearRejection() }}
                    className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                    placeholder="••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:outline-none rounded-r-xl"
                    aria-label={showPw ? t('staff.login.hidePassword') : t('staff.login.showPassword')}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
              >
                {submitting ? t('staff.login.signingIn') : t('staff.login.signIn')}
              </button>
            </form>

            <div className="text-center">
              <Link
                to="/staff/forgot-password"
                className="text-sm text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
              >
                {t('staff.login.forgotPassword')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
