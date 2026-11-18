/**
 * ForgotPassword.tsx — /staff/forgot-password
 *
 * Sends a password-reset email via Supabase.
 * If sending fails (SMTP not configured), shows a fallback message telling
 * the user to contact a department administrator.
 *
 * Always shows the same success message regardless of whether the email
 * exists, to prevent user enumeration.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { StaffMeta } from '../components/StaffMeta'

export function ForgotPassword() {
  const { t } = useTranslation()

  const [email,      setEmail]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent,       setSent]       = useState(false)
  const [smtpError,  setSmtpError]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSmtpError(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/staff/reset-password`,
      })

      if (error) {
        // Common SMTP-not-configured codes
        const isSmtp =
          error.message.toLowerCase().includes('smtp') ||
          error.message.toLowerCase().includes('email') ||
          error.status === 500
        if (isSmtp) {
          setSmtpError(true)
        } else {
          // Surface unexpected errors (rate limit, etc.)
          setSmtpError(true)
        }
      }
      // Show success either way (prevent enumeration)
      setSent(true)
    } catch {
      setSmtpError(true)
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <StaffMeta />
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
        <div className="w-full max-w-sm space-y-8">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F3D2E] text-[#D9A441] mx-auto">
              <ShieldCheck size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">
                {t('staff.forgotPassword.title')}
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t('staff.forgotPassword.subtitle')}
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm space-y-5">

            {sent ? (
              <div
                role="status"
                className="text-center space-y-3"
              >
                <p className="text-sm text-[var(--text-main)] leading-relaxed">
                  {smtpError
                    ? t('staff.forgotPassword.noSmtp')
                    : t('staff.forgotPassword.successMsg')
                  }
                </p>
                <Link
                  to="/staff/login"
                  className="inline-block text-sm text-[#0F3D2E] dark:text-[#D9A441] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] rounded"
                >
                  {t('staff.forgotPassword.backToLogin')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-[var(--text-main)]">
                    {t('staff.forgotPassword.emailLabel')}
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
                >
                  {submitting ? t('staff.forgotPassword.sending') : t('staff.forgotPassword.sendLink')}
                </button>

                <div className="text-center">
                  <Link
                    to="/staff/login"
                    className="text-sm text-[#0F3D2E] dark:text-[#D9A441] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] rounded"
                  >
                    {t('staff.forgotPassword.backToLogin')}
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
