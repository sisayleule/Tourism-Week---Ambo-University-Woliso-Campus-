/**
 * AnnouncementsListPage.tsx — /staff/announcements
 *
 * List with badges: Live now / Scheduled / Expired / Draft
 * Shows which announcement is currently the pinned banner on the public site
 * (newest live urgent, otherwise newest live normal).
 * Add new, edit, unpublish, delete.
 */

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, Plus, Pin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAnnouncements, useUnpublishAnnouncement, useDeleteAnnouncement } from '../../hooks/useStaffQueries'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadingSkeleton, EmptyState, FullPageSpinner } from '../../components/Loading'
import { formatError } from '../../services/helpers'
import type { Announcement } from '../../../types/database'

// ─── Compute announcement display state ──────────────────────────────────────

type DisplayState = 'live' | 'scheduled' | 'expired' | 'draft'

function getDisplayState(a: Announcement): DisplayState {
  if (a.state === 'draft') return 'draft'
  const now = Date.now()
  const start = new Date(a.starts_at).getTime()
  const expire = a.expires_at ? new Date(a.expires_at).getTime() : null
  if (start > now) return 'scheduled'
  if (expire !== null && expire <= now) return 'expired'
  return 'live'
}

// ─── Badge component ──────────────────────────────────────────────────────────

function AnnouncementBadge({ state }: { state: DisplayState }) {
  const config: Record<DisplayState, { label: string; classes: string }> = {
    live:     { label: 'Live now',  classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    scheduled:{ label: 'Scheduled', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    expired:  { label: 'Expired',   classes: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400' },
    draft:    { label: 'Draft',      classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  }
  const c = config[state]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${c.classes}`}>
      {c.label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AnnouncementsListPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { data: announcements, isLoading, error } = useAnnouncements()
  const unpublishMut = useUnpublishAnnouncement()
  const deleteMut = useDeleteAnnouncement()
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null)

  // ── Find pinned banner (newest live urgent, else newest live normal) ──────
  const pinnedBanner = useMemo(() => {
    if (!announcements) return null
    const live = announcements.filter(a => getDisplayState(a) === 'live')
    if (live.length === 0) return null
    // Newest urgent first, then newest normal
    const urgent = live.filter(a => a.type === 'urgent')
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    if (urgent.length > 0) return urgent[0]
    return live
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0]
  }, [announcements])

  const handleUnpublish = async (a: Announcement) => {
    try {
      await unpublishMut.mutateAsync(a.id)
      showToast({ type: 'success', message: t('staff.announcements.unpublished') })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setConfirmDelete(null)
    try {
      await deleteMut.mutateAsync(confirmDelete.id)
      showToast({ type: 'success', message: t('staff.announcements.deleted') })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  if (error) {
    return (
      <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
        {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-[var(--text-main)] flex items-center gap-2.5">
          <Megaphone size={22} className="text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
          {t('staff.announcements.title')}
        </h1>
        <Link
          to="/staff/announcements/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" />
          {t('staff.announcements.addNew')}
        </Link>
      </div>

      {/* Pinned banner notice */}
      {pinnedBanner && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#D9A441]/10 border border-[#D9A441]/30">
          <Pin size={16} className="text-[#D9A441] shrink-0" aria-hidden="true" />
          <p className="text-xs text-[var(--text-main)]">
            <span className="font-semibold">{t('staff.announcements.pinnedBanner')}:</span>{' '}
            {pinnedBanner.message_i18n.en}
          </p>
        </div>
      )}

      {/* List */}
      {!announcements || announcements.length === 0 ? (
        <EmptyState
          title={t('staff.announcements.title')}
          action={
            <Link
              to="/staff/announcements/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors"
            >
              <Plus size={16} aria-hidden="true" />
              {t('staff.announcements.addNew')}
            </Link>
          }
        />
      ) : (
        <div className="space-y-1.5">
          {announcements.map(a => {
            const state = getDisplayState(a)
            return (
              <div
                key={a.id}
                className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-main)]">{a.message_i18n.en}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <AnnouncementBadge state={state} />
                      {a.type === 'urgent' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          Urgent
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {new Date(a.starts_at).toLocaleDateString()} →
                        {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : '∞'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    to={`/staff/announcements/${a.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#0F3D2E] dark:text-[#D9A441] border border-[var(--border-subtle)] hover:bg-[var(--bg-section-alt)]"
                  >
                    {t('staff.announcements.edit')}
                  </Link>
                  {state === 'live' && (
                    <button
                      onClick={() => handleUnpublish(a)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] border border-[var(--border-subtle)] hover:bg-[var(--bg-section-alt)]"
                    >
                      {t('staff.announcements.unpublish')}
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(a)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {t('staff.announcements.delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('staff.announcements.deleteConfirmTitle')}
        message={t('staff.announcements.deleteConfirmMsg')}
        confirmLabel={t('staff.announcements.delete')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
