/**
 * Profile.tsx — /staff/profile
 *
 * Fully working: edit own full_name + change password.
 * The RLS policy (migration 008) allows a staff member to UPDATE their own
 * profiles row for full_name and must_change_password only.
 */

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserCircle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

// ─── Password strength (reuse logic from SetPassword) ─────────────────────────

type StrengthLevel = 'tooShort' | 'weak' | 'fair' | 'strong' | 'veryStrong'

function measureStrength(pw: string): StrengthLevel {
  if (pw.length < 10) return 'tooShort'
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

// ─── Component ────────────────────────────────────────────────────────────────

export function Profile() {
  const { t } = useTranslation()
  const { profile, session } = useAuth()

  // ── Profile form state ────────────────────────────────────────────────────
  const [fullName,      setFullName]      = useState(profile?.full_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg,    setProfileMsg]    = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setFullName(profile?.full_name ?? '')
  }, [profile?.full_name])

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    setSavingProfile(true)
    setProfileMsg(null)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', profile.id)

    if (error) {
      setProfileMsg({ type: 'error', text: error.message })
    } else {
      setProfileMsg({ type: 'success', text: t('staff.profile.savedSuccess') })
    }
    setSavingProfile(false)
  }

  // ── Password form state ───────────────────────────────────────────────────
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPw,    setSavingPw]    = useState(false)
  const [pwMsg,       setPwMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const strength  = measureStrength(newPw)
  const pwIsValid = newPw.length >= 10 && newPw === confirmPw

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwIsValid) return
    setSavingPw(true)
    setPwMsg(null)

    const { error } = await supabase.auth.updateUser({ password: newPw })

    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: t('staff.profile.passwordUpdated') })
      setNewPw('')
      setConfirmPw('')
    }
    setSavingPw(false)
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E]/10 dark:bg-[#D9A441]/10 text-[#0F3D2E] dark:text-[#D9A441] shrink-0">
          <UserCircle size={20} aria-hidden="true" />
        </div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">
          {t('staff.profile.title')}
        </h1>
      </div>

      {/* ── Profile details ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="profile-details-heading"
        className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5"
      >
        <h2 id="profile-details-heading" className="font-display text-base font-semibold text-[var(--text-main)]">
          Account details
        </h2>

        {/* Read-only email */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--text-muted)]">
            {t('staff.profile.email')}
          </label>
          <p className="px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-section-alt)] text-sm text-[var(--text-muted)] select-all">
            {session?.user?.email ?? '—'}
          </p>
        </div>

        {/* Read-only role */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--text-muted)]">
            {t('staff.profile.role')}
          </label>
          <p className="px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-section-alt)] text-sm text-[var(--text-muted)]">
            {t(`staff.layout.role.${profile?.role ?? 'organizer'}`)}
          </p>
        </div>

        {/* Editable full_name */}
        {profileMsg && (
          <div
            role={profileMsg.type === 'error' ? 'alert' : 'status'}
            className={[
              'px-4 py-3 rounded-xl border text-sm',
              profileMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
            ].join(' ')}
          >
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleProfileSave} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="profile-fullname" className="block text-sm font-medium text-[var(--text-main)]">
              {t('staff.profile.fullName')}
            </label>
            <input
              id="profile-fullname"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
              placeholder="Your full name"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            {savingProfile ? t('staff.profile.saving') : t('staff.profile.saveChanges')}
          </button>
        </form>
      </section>

      {/* ── Change password ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="change-password-heading"
        className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5"
      >
        <h2 id="change-password-heading" className="font-display text-base font-semibold text-[var(--text-main)]">
          {t('staff.profile.changePassword')}
        </h2>

        {pwMsg && (
          <div
            role={pwMsg.type === 'error' ? 'alert' : 'status'}
            className={[
              'px-4 py-3 rounded-xl border text-sm',
              pwMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
            ].join(' ')}
          >
            {pwMsg.text}
          </div>
        )}

        <form onSubmit={handlePasswordSave} noValidate className="space-y-4">
          {/* New password */}
          <div className="space-y-1.5">
            <label htmlFor="profile-new-pw" className="block text-sm font-medium text-[var(--text-main)]">
              {t('staff.profile.newPassword')}
            </label>
            <div className="relative">
              <input
                id="profile-new-pw"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={10}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:outline-none"
                aria-label={showNew ? t('staff.login.hidePassword') : t('staff.login.showPassword')}
              >
                {showNew ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            {newPw.length > 0 && (
              <div className="space-y-1" aria-live="polite">
                <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${STRENGTH_COLORS[strength]} ${STRENGTH_WIDTH[strength]}`} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {t(`staff.setPassword.strength.${strength}`)}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="profile-confirm-pw" className="block text-sm font-medium text-[var(--text-main)]">
              {t('staff.profile.confirmPassword')}
            </label>
            <div className="relative">
              <input
                id="profile-confirm-pw"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                placeholder="••••••••••"
                aria-invalid={confirmPw.length > 0 && newPw !== confirmPw ? 'true' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:outline-none"
                aria-label={showConfirm ? t('staff.login.hidePassword') : t('staff.login.showPassword')}
              >
                {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
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
            disabled={savingPw || !pwIsValid}
            className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            {savingPw ? t('staff.profile.updatingPassword') : t('staff.profile.updatePassword')}
          </button>
        </form>
      </section>
    </div>
  )
}
