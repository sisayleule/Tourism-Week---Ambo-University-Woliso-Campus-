/**
 * Forbidden403.tsx — 403 page shown when an organizer tries to access an admin route.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StaffMeta } from '../components/StaffMeta'

export function Forbidden403() {
  const { t } = useTranslation()

  return (
    <>
      <StaffMeta />
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <ShieldX size={32} aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">
              {t('staff.forbidden.title')}
            </h1>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              {t('staff.forbidden.description')}
            </p>
          </div>

          <Link
            to="/staff"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-medium hover:bg-[#0A2A20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            {t('staff.forbidden.backToDashboard')}
          </Link>
        </div>
      </div>
    </>
  )
}
