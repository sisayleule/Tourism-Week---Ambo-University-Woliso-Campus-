/**
 * SetPassword.tsx — /staff/set-password
 *
 * Forced first-login password change.
 * Uses supabaseStaff so the session matches the staff portal.
 * Has a 10 s timeout on the profile update to prevent infinite "Saving…".
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabaseStaff } from '../../lib/supabaseStaff'
import { useAuth } from '../auth/AuthProvider'
import { StaffMeta } from '../components/StaffMeta'

type StrengthLevel = 'tooShort' | 'weak' | 'fair' | 'strong' | 'veryStrong'

function measureStrength(pw: string): StrengthLevel {
  if (pw.length < 12) return 'tooShort'
  let score = 0
  if (/[a-z]/.test(pw)) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (pw.length >= 16) score++
  if (score <= 1) return 'weak'
  if (score === 2) return 'fair'
  if (score === 3) return 'strong'
  return 'veryStrong'
}

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  tooShort:  'bg-red-400',
  weak:      'bg-red-400',
  fair:      'bg-amber-400',
  strong:    'bg-emerald-500',
  veryStrong:'bg-emerald-600',
}
const STRENGTH_WIDTH: Record<StrengthLevel, string> = {
  tooShort: 'w-1/5', weak: 'w-2/5', fair: 'w-3/5', strong: 'w-4/5', veryStrong: 'w-full',
}

export function SetPassword() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)

  const strength = measureStrength(newPw)
  const isValid  = newPw.length >= 12 && newPw === confirmPw

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPw !== confirmPw) { setError(t('staff.setPassword.mismatch')); return }
    if (newPw.length < 12)   return

    setSubmitting(true)
    try {
      // 1. Update password — with 15 s timeout
      const pwPromise = supabaseStaff.auth.updateUser({ password: newPw })
      const timeout   = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15_000)
      )
      const { error: pwErr } = await Promise.race([pwPromise, timeout]) as Awaited<typeof pwPromise>
      if (pwErr) throw pwErr

      // 2. Clear must_change_password — best-effort, don't block on failure
      if (profile?.id) {
        supabaseStaff
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', profile.id)
          .then(() => {/* ignore result */})
      }

      setSuccess(true)
      setTimeout(() => navigate('/staff', { replace: true }), 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === 'timeout'
        ? 'The request timed out. Please try again.'
        : msg
      )
    } finally {
      setSubmitting(false)
    }
  }

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
                {t('staff.setPassword.title')}
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t('staff.setPassword.subtitle')}
              </p>
            </div>
          </div>

          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm space-y-5">

            {success ? (
              <div role="status" className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300 text-center">
                {t('staff.setPassword.successMsg')}
              </div>
            ) : (
              <>
                {error && (
                  <div role="alert" className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {/* New password */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-password" className="block text-sm font-medium text-[var(--text-main)]">
                      {t('staff.setPassword.newPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showNew ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={12}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                        placeholder="••••••••••"
                      />
                      <button type="button" onClick={() => setShowNew(v => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        aria-label={showNew ? t('staff.login.hidePassword') : t('staff.login.showPassword')}>
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPw.length > 0 && (
                      <div aria-live="polite">
                        <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${STRENGTH_COLORS[strength]} ${STRENGTH_WIDTH[strength]}`} />
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {t(`staff.setPassword.strength.${strength}`)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--text-main)]">
                      {t('staff.setPassword.confirmPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                        placeholder="••••••••••"
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        aria-label={showConfirm ? t('staff.login.hidePassword') : t('staff.login.showPassword')}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPw.length > 0 && newPw !== confirmPw && (
                      <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
                        {t('staff.setPassword.mismatch')}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isValid}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
                  >
                    {submitting ? t('staff.setPassword.setting') : t('staff.setPassword.setPassword')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
