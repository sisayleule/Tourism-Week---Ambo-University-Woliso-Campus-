/**
 * ActivityPage.tsx — /admin/activity
 *
 * Paged activity log (50/page), filters, side-by-side diff drawer,
 * restore with action-specific confirmation, purge with typed confirmation.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardList, ChevronLeft, ChevronRight, RotateCcw, Trash2, X, AlertTriangle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullPageSpinner } from '../../components/Loading'
import {
  useActivityLog, useActivityLogDetail,
  useRestoreLogEntry, usePurgeActivityLog, useStaffProfiles,
} from '../../hooks/useAdminQueries'
import type { ActivityLogEntry, ActivityLogFilters } from '../../services/adminService'

const PER_PAGE = 50

const TABLE_LABELS: Record<string, string> = {
  events: 'staff.admin.activity.tableEvents',
  announcements: 'staff.admin.activity.tableAnnouncements',
  news: 'staff.admin.activity.tableNews',
  gallery_items: 'staff.admin.activity.tableGallery',
  sponsors: 'staff.admin.activity.tableSponsors',
  committee_members: 'staff.admin.activity.tableCommittee',
  faqs: 'staff.admin.activity.tableFaqs',
  editions: 'staff.admin.activity.tableEditions',
  site_settings: 'staff.admin.activity.tableSettings',
  profiles: 'staff.admin.activity.tableProfiles',
  messages: 'staff.admin.activity.tableMessages',
}
const TABLE_NAMES = Object.keys(TABLE_LABELS)
const ACTIONS = ['INSERT', 'UPDATE', 'DELETE']
const RESTORABLE = new Set(['events','announcements','news','gallery_items','sponsors','committee_members','faqs','editions','site_settings'])

function getTitle(e: ActivityLogEntry): string {
  const d = e.old_data ?? e.new_data
  if (!d) return '—'
  const i18n = d.title_i18n as { en?: string } | undefined
  if (i18n?.en) return i18n.en
  if (d.name) return d.name as string
  if (d.slug) return d.slug as string
  if (d.full_name) return d.full_name as string
  if (d.contact_email) return d.contact_email as string
  const msg = d.message_i18n as { en?: string } | undefined
  if (msg?.en) return msg.en
  if (d.message) return String(d.message).slice(0, 60)
  return '—'
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function ActionBadge({ action }: { action: string }) {
  const cfg: Record<string, string> = {
    INSERT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${cfg[action] ?? 'bg-stone-100 text-stone-600'}`}>{action}</span>
}

export function ActivityPage() {
  const { t } = useTranslation()
  const { client } = usePortal()
  const { showToast } = useToast()

  const [page, setPage]       = useState(1)
  const [filters, setFilters] = useState<ActivityLogFilters>({ tableName: null, action: null, actorId: null, dateFrom: null, dateTo: null })
  const [selectedId, setSelectedId]       = useState<number | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState<ActivityLogEntry | null>(null)
  const [purgeOpen, setPurgeOpen]           = useState(false)

  const { data, isLoading, error } = useActivityLog(client, page, PER_PAGE, filters)
  const restoreMut = useRestoreLogEntry(client)
  const purgeMut   = usePurgeActivityLog(client)
  const { data: profiles } = useStaffProfiles(client)

  const handleRestore = async () => {
    if (!restoreConfirm) return
    try {
      const r = await restoreMut.mutateAsync(restoreConfirm.id)
      showToast({ type: 'success', message: t('staff.admin.activity.restoreSuccess', { message: r.message }) })
    } catch (err) {
      showToast({ type: 'error', message: t('staff.admin.activity.restoreError', { message: err instanceof Error ? err.message : 'Failed' }) })
    } finally { setRestoreConfirm(null) }
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />
  if (error) {
    return (
      <div className="max-w-5xl space-y-4">
        <PageHeader onPurge={() => setPurgeOpen(true)} />
        <ErrBanner msg={error.message} />
      </div>
    )
  }

  const { entries, total, totalPages } = data!

  const setF = (patch: Partial<ActivityLogFilters>) => { setPage(1); setFilters(f => ({ ...f, ...patch })) }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader onPurge={() => setPurgeOpen(true)} />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select value={filters.tableName ?? ''} onChange={e => setF({ tableName: e.target.value || null })} className={sc} aria-label={t('staff.admin.activity.filterTable')}>
          <option value="">{t('staff.admin.activity.allTables')}</option>
          {TABLE_NAMES.map(tb => <option key={tb} value={tb}>{TABLE_LABELS[tb] ? t(TABLE_LABELS[tb]) : tb}</option>)}
        </select>
        <select value={filters.action ?? ''} onChange={e => setF({ action: e.target.value || null })} className={sc} aria-label={t('staff.admin.activity.filterAction')}>
          <option value="">{t('staff.admin.activity.allActions')}</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.actorId ?? ''} onChange={e => setF({ actorId: e.target.value || null })} className={sc} aria-label={t('staff.admin.activity.filterPerson')}>
          <option value="">{t('staff.admin.activity.allPersons')}</option>
          {(profiles ?? []).map(p => <option key={p.id} value={p.id}>{p.full_name ?? 'Unknown'}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="date" value={filters.dateFrom ?? ''} onChange={e => setF({ dateFrom: e.target.value || null })} className={sc} aria-label={t('staff.admin.activity.filterDateFrom')} />
          <input type="date" value={filters.dateTo ?? ''} onChange={e => setF({ dateTo: e.target.value || null })} className={sc} aria-label={t('staff.admin.activity.filterDateTo')} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">{t('staff.admin.activity.time')}</th>
                <th className="text-left font-medium px-4 py-3">{t('staff.admin.activity.person')}</th>
                <th className="text-left font-medium px-4 py-3">{t('staff.admin.activity.action')}</th>
                <th className="text-left font-medium px-4 py-3">{t('staff.admin.activity.table')}</th>
                <th className="text-left font-medium px-4 py-3">{t('staff.admin.activity.item')}</th>
                <th className="text-right font-medium px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">{t('staff.admin.activity.noEntries')}</td></tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-section-alt)] cursor-pointer"
                  onClick={() => setSelectedId(entry.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{fmt(entry.created_at)}</td>
                  <td className="px-4 py-3">{entry.actor_name ?? t('staff.admin.activity.system')}</td>
                  <td className="px-4 py-3"><ActionBadge action={entry.action} /></td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{TABLE_LABELS[entry.table_name] ? t(TABLE_LABELS[entry.table_name]) : entry.table_name}</td>
                  <td className="px-4 py-3 truncate max-w-[200px]">{getTitle(entry)}</td>
                  <td className="px-4 py-3 text-right">
                    {RESTORABLE.has(entry.table_name) && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{t('staff.admin.activity.restorableHint')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">{total} entries · page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} icon={<ChevronLeft size={14} />} label="Previous" />
              <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} icon={<ChevronRight size={14} />} label="Next" right />
            </div>
          </div>
        )}
      </div>

      {selectedId !== null && (
        <DetailDrawer
          id={selectedId}
          client={client}
          onClose={() => setSelectedId(null)}
          onRestore={entry => setRestoreConfirm(entry)}
        />
      )}

      <ConfirmDialog
        open={!!restoreConfirm}
        title={t('staff.admin.activity.restoreTitle')}
        message={restoreConfirm
          ? restoreConfirm.action === 'DELETE'
              ? t('staff.admin.activity.restoreMsgDelete')
              : restoreConfirm.action === 'INSERT'
                  ? t('staff.admin.activity.restoreMsgInsert')
                  : t('staff.admin.activity.restoreMsgUpdate')
          : ''}
        confirmLabel={t('staff.admin.activity.restoreBtn')}
        onConfirm={handleRestore}
        onCancel={() => setRestoreConfirm(null)}
      />

      {purgeOpen && (
        <PurgeDialog
          totalRows={total}
          onClose={() => setPurgeOpen(false)}
          onPurge={async (months) => {
            try {
              const r = await purgeMut.mutateAsync(months * 30)
              showToast({ type: 'success', message: t('staff.admin.activity.purgeSuccess', { count: r.deleted }) })
              setPurgeOpen(false)
            } catch (err) {
              showToast({ type: 'error', message: t('staff.admin.activity.purgeError', { message: err instanceof Error ? err.message : 'Failed' }) })
            }
          }}
          loading={purgeMut.isPending}
        />
      )}
    </div>
  )
}

function PageHeader({ onPurge }: { onPurge: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]"><ClipboardList size={20} /></div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.activity.title')}</h1>
      </div>
      <button onClick={onPurge}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        <Trash2 size={16} /> {t('staff.admin.activity.purgeTitle')}
      </button>
    </div>
  )
}

function PageBtn({ onClick, disabled, icon, label, right }: { onClick: () => void; disabled: boolean; icon: React.ReactNode; label: string; right?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      {!right && icon}{label}{right && icon}
    </button>
  )
}

function DetailDrawer({ id, client, onClose, onRestore }: {
  id: number; client: ReturnType<typeof usePortal>['client']
  onClose: () => void; onRestore: (e: ActivityLogEntry) => void
}) {
  const { t } = useTranslation()
  const { data: entry, isLoading } = useActivityLogDetail(client, id)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const canRestore = entry ? RESTORABLE.has(entry.table_name) : false
  const allKeys = useMemo(() => {
    if (!entry) return []
    const s = new Set<string>()
    if (entry.old_data) Object.keys(entry.old_data).forEach(k => s.add(k))
    if (entry.new_data) Object.keys(entry.new_data).forEach(k => s.add(k))
    return Array.from(s).sort()
  }, [entry])

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-lg bg-[var(--surface-card)] border-l border-[var(--border-subtle)] overflow-y-auto"
        role="dialog" aria-modal="true" aria-labelledby="act-detail-title">
        <div className="sticky top-0 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-5 py-4 flex items-center justify-between">
          <h2 id="act-detail-title" className="font-display text-lg font-bold text-[var(--text-main)]">{t('staff.admin.activity.detailTitle')}</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]" aria-label={t('staff.common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {isLoading || !entry ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Clock size={16} className="animate-spin" /> {t('staff.common.loading')}</div>
          ) : (
            <>
              <div className="space-y-1.5 text-sm">
                <MetaRow label={t('staff.admin.activity.time')} value={fmt(entry.created_at)} />
                <MetaRow label={t('staff.admin.activity.person')} value={entry.actor_name ?? t('staff.admin.activity.system')} />
                <div className="flex gap-2"><span className="text-[var(--text-muted)] w-24 shrink-0">{t('staff.admin.activity.action')}:</span><ActionBadge action={entry.action} /></div>
                <MetaRow label={t('staff.admin.activity.table')} value={TABLE_LABELS[entry.table_name] ? t(TABLE_LABELS[entry.table_name]) : entry.table_name} />
              </div>

              {/* Diff */}
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-[var(--border-subtle)]">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('staff.admin.activity.oldValues')}</p>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('staff.admin.activity.newValues')}</p>
                </div>
                {allKeys.map(key => {
                  const ov = entry.old_data?.[key]
                  const nv = entry.new_data?.[key]
                  const changed = JSON.stringify(ov) !== JSON.stringify(nv)
                  return (
                    <div key={key} className={`grid grid-cols-2 gap-2 py-1.5 px-2 rounded-lg ${changed ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-[var(--text-muted)]">{key}</p>
                        <p className="text-xs text-[var(--text-main)] break-all font-mono">{fv(ov)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-[var(--text-muted)]">
                          {key} {changed && <span className="text-amber-600 dark:text-amber-400 font-bold">• {t('staff.admin.activity.changed')}</span>}
                        </p>
                        <p className="text-xs text-[var(--text-main)] break-all font-mono">{fv(nv)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {canRestore && (
                <button onClick={() => onRestore(entry)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors">
                  <RotateCcw size={16} /> {t('staff.admin.activity.restoreBtn')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--text-muted)] w-24 shrink-0">{label}:</span>
      <span className="text-[var(--text-main)]">{value}</span>
    </div>
  )
}

function fv(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v.length > 200 ? v.slice(0, 200) + '…' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v).slice(0, 200) } catch { return String(v) }
}

function PurgeDialog({ totalRows, onClose, onPurge, loading }: {
  totalRows: number; onClose: () => void
  onPurge: (months: number) => void; loading: boolean
}) {
  const { t } = useTranslation()
  const [months, setMonths]     = useState('6')
  const [confirm, setConfirm]   = useState('')
  const monthsNum = parseInt(months, 10)
  const valid = monthsNum >= 6 && confirm === months

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-[var(--border-subtle)]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0"><AlertTriangle size={20} /></span>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-main)]">{t('staff.admin.activity.purgeTitle')}</h2>
            <p className="text-sm text-[var(--text-muted)]">{t('staff.admin.activity.purgeConfirmMsg')}</p>
          </div>
        </div>
        <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
          {t('staff.admin.activity.purgeCountApprox', { count: totalRows })}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="purge-m" className="block text-sm font-medium text-[var(--text-main)]">
            {t('staff.admin.activity.purgeLabel')} <span className="text-[var(--text-muted)]">({t('staff.admin.activity.purgeMin')})</span>
          </label>
          <input id="purge-m" type="number" min="6" value={months} onChange={e => setMonths(e.target.value)} className={FullInput} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="purge-c" className="block text-sm font-medium text-[var(--text-main)]">
            {t('staff.admin.activity.purgeConfirmMsg')} <span className="font-bold">{months}</span>
          </label>
          <input id="purge-c" type="text" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder={t('staff.admin.activity.purgeTypePlaceholder')} className={FullInput} />
        </div>
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-section-alt)] text-xs text-[var(--text-muted)]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {t('staff.admin.activity.purgeDbNote')}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button onClick={onClose} className={cancelBtn}>{t('staff.common.cancel')}</button>
          <button onClick={() => onPurge(monthsNum)} disabled={loading || !valid}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? t('staff.admin.activity.purging') : t('staff.admin.activity.purgeBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{msg}</div>
}

const sc = 'px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441]'
const FullInput = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441]'
const cancelBtn = 'px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors'
