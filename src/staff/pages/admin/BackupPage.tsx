/**
 * BackupPage.tsx — /admin/backup
 *
 * Downloads a ZIP: tourism-week-data.json + CSV per table + image-urls.txt.
 * JSZip loaded lazily. Sets last_backup_at after download.
 * Shows stale-backup banner.
 */

import React, { useState } from 'react'
import { Download, AlertTriangle, Shield, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { useSiteState, useSetLastBackupAt, useFetchBackupData } from '../../hooks/useAdminQueries'
import type { BackupData } from '../../services/adminService'

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n')
}

function collectImageUrls(data: BackupData): string[] {
  const urls = new Set<string>()
  const scan = (v: unknown) => {
    if (typeof v === 'string') {
      if ((v.startsWith('http') || v.startsWith('/assets/') || v.startsWith('/images/') || v.startsWith('/news-')) &&
          /\.(png|jpg|jpeg|webp|avif|gif)(\?|$)/i.test(v)) {
        urls.add(v)
      }
    } else if (Array.isArray(v)) { v.forEach(scan) }
    else if (v && typeof v === 'object') { Object.values(v).forEach(scan) }
  }
  Object.values(data).flat().forEach(scan)
  return Array.from(urls).sort()
}

export function BackupPage() {
  const { t } = useTranslation()
  const { client } = usePortal()
  const { showToast } = useToast()
  const { data: siteState } = useSiteState(client)
  const setBackupAt = useSetLastBackupAt(client)
  const fetchMut    = useFetchBackupData(client)
  const [generating, setGenerating] = useState(false)

  const lastBackupAt = siteState?.last_backup_at ?? null
  const isStale = lastBackupAt
    ? Date.now() - new Date(lastBackupAt).getTime() > 30 * 24 * 60 * 60 * 1000
    : true

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const data = await fetchMut.mutateAsync()
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      zip.file('tourism-week-data.json', JSON.stringify(data, null, 2))
      const csv = zip.folder('csv')!
      for (const [table, rows] of Object.entries(data)) {
        const c = toCsv(rows as Record<string, unknown>[])
        if (c) csv.file(`${table}.csv`, c)
      }
      zip.file('image-urls.txt', collectImageUrls(data).join('\n') || '# No image URLs found')
      zip.file('README.txt', [
        'Tourism Week Backup',
        '===================',
        `Generated: ${new Date().toISOString()}`,
        '',
        'WARNING: Contains messages with private visitor contact details.',
        'Store safely (department Drive, restricted access).',
      ].join('\n'))

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `tourism-week-backup-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(a.href)

      await setBackupAt.mutateAsync()
      showToast({ type: 'success', message: t('staff.admin.backup.successMsg') })
    } catch (err) {
      showToast({ type: 'error', message: t('staff.admin.backup.errorMsg', { message: err instanceof Error ? err.message : 'Unknown' }) })
    } finally { setGenerating(false) }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]"><Package size={20} /></div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.backup.title')}</h1>
      </div>

      {isStale && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {lastBackupAt ? t('staff.admin.dashboard.backupStale') : 'No backup has been taken yet.'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {lastBackupAt ? `Last backup: ${fmt(lastBackupAt)}` : 'Download a backup now.'}
            </p>
          </div>
        </div>
      )}

      {lastBackupAt && !isStale && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>{t('staff.admin.backup.lastBackup')}:</span>
          <span className="text-[var(--text-main)] font-medium">{fmt(lastBackupAt)}</span>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-3">
        <h2 className="font-display text-sm font-bold text-[var(--text-main)]">{t('staff.admin.backup.contents')}</h2>
        <p className="text-sm text-[var(--text-muted)]">{t('staff.admin.backup.contentsDesc')}</p>
        <ul className="space-y-1 text-sm text-[var(--text-muted)]">
          {['editions','events','announcements','news','gallery_items','sponsors','committee_members','faqs','site_settings','messages','profiles','activity_log'].map(table => (
            <li key={table} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441] shrink-0" /> {table}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <Shield size={18} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t('staff.admin.backup.privacyWarn')}</p>
          <p className="text-xs text-red-700 dark:text-red-300">{t('staff.admin.backup.storageNote')}</p>
        </div>
      </div>

      <button onClick={handleDownload} disabled={generating}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2">
        <Download size={18} />
        {generating ? t('staff.admin.backup.generating') : t('staff.admin.backup.downloadBtn')}
      </button>
    </div>
  )
}
