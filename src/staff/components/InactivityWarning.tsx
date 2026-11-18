/**
 * InactivityWarning.tsx — Modal dialog shown 5 minutes before auto-logout.
 * Appears at the 55-minute inactivity mark.  Stays until the user acts or
 * the auto-logout fires at 60 minutes.
 */

import React from 'react'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'

export function InactivityWarning() {
  const { t } = useTranslation()
  const { showInactivityWarning, resetInactivityTimer, signOut } = useAuth()

  if (!showInactivityWarning) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      aria-describedby="inactivity-desc"
    >
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 border border-[var(--border-subtle)]">
        {/* Icon */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
            <Clock size={20} aria-hidden="true" />
          </span>
          <h2 id="inactivity-title" className="font-display text-lg font-bold text-[var(--text-main)]">
            {t('staff.inactivity.warningTitle')}
          </h2>
        </div>

        <p id="inactivity-desc" className="text-sm text-[var(--text-muted)] leading-relaxed">
          {t('staff.inactivity.warningMsg')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={resetInactivityTimer}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-medium hover:bg-[#0A2A20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            {t('staff.inactivity.staySignedIn')}
          </button>
          <button
            onClick={signOut}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] text-sm font-medium hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            {t('staff.inactivity.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
