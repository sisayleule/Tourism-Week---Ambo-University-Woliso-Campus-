/**
 * WebsiteSettingsPage.tsx — /staff/settings
 *
 * Three-tab settings hub for all organizers:
 *
 *   Tab 1: Contact & Links
 *     — contact email, phone, address (3 languages), social links, footer text
 *     — requires password confirmation before saving
 *
 *   Tab 2: Backup
 *     — download backup ZIP, last backup date, stale reminder (> 30 days or
 *       event has ended), privacy note
 *     — requires password confirmation before download
 *
 *   Tab 3: History (activity log in plain language)
 *     — who, what, when; plain labels, no technical jargon
 *     — "Restore this version" button with password confirmation
 *     — no Purge control (admin/SQL only)
 */

import React, { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  SlidersHorizontal, Package, ClipboardList, Download, AlertTriangle,
  Shield, ChevronLeft, ChevronRight, RotateCcw, X, Eye, EyeOff,
  CheckCircle2, XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullPageSpinner } from '../../components/Loading'
import { useConfirmPassword } from '../../components/ConfirmPasswordModal'
import {
  useSiteSettings, useUpdateSiteSettings,
  useSiteState, useSetLastBackupAt, useFetchBackupData,
  useActivityLog, useActivityLogDetail, useRestoreLogEntry, useStaffProfiles,
} from '../../hooks/useAdminQueries'
import type { I18nJson } from '../../../types/database'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'contact' | 'backup' | 'history'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'contact', label: 'Contact & Links',   icon: <SlidersHorizontal size={16} /> },
  { id: 'backup',  label: 'Backup',            icon: <Package size={16} /> },
  { id: 'history', label: 'History',           icon: <ClipboardList size={16} /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
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

function collectImageUrls(data: Record<string, Record<string, unknown>[]>): string[] {
  const urls = new Set<string>()
  const scan = (v: unknown) => {
    if (typeof v === 'string') {
      if ((v.startsWith('http') || v.startsWith('/assets/') || v.startsWith('/images/')) &&
          /\.(png|jpg|jpeg|webp|avif|gif)(\?|$)/i.test(v)) urls.add(v)
    } else if (Array.isArray(v)) { v.forEach(scan) }
    else if (v && typeof v === 'object') { Object.values(v).forEach(scan) }
  }
  Object.values(data).flat().forEach(scan)
  return Array.from(urls).sort()
}

// ─── Shared input style ───────────────────────────────────────────────────────

const ic = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition'
const sc = 'px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]'

// ─── Settings schema ──────────────────────────────────────────────────────────

const httpsUrl = z.string().url().refine(v => v.startsWith('https://'), 'Must start with https://').or(z.literal(''))
const settingsSchema = z.object({
  contact_email: z.string().email('Enter a valid email address').max(320).or(z.literal('')),
  phone:         z.string().max(30).or(z.literal('')),
  address_en: z.string().max(1000).or(z.literal('')),
  address_am: z.string().max(1000).or(z.literal('')),
  address_om: z.string().max(1000).or(z.literal('')),
  facebook:  httpsUrl, telegram:  httpsUrl, whatsapp:  httpsUrl,
  youtube:   httpsUrl, instagram: httpsUrl, tiktok:    httpsUrl,
  footer_en: z.string().max(500).or(z.literal('')),
  footer_am: z.string().max(500).or(z.literal('')),
  footer_om: z.string().max(500).or(z.literal('')),
})
type SettingsForm = z.infer<typeof settingsSchema>

// ─── CONTACT & LINKS TAB ─────────────────────────────────────────────────────

function ContactTab() {
  const { client } = usePortal()
  const { showToast } = useToast()
  const { confirm } = useConfirmPassword()
  const { data: settings, isLoading, error } = useSiteSettings(client)
  const updateMut = useUpdateSiteSettings(client)

  const [form, setForm] = useState<SettingsForm | null>(null)
  const [loadedUpdatedAt, setLoaded] = useState('')
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!settings) return
    setForm({
      contact_email: settings.contact_email ?? '',
      phone:         settings.phone ?? '',
      address_en: settings.address_i18n?.en ?? '',
      address_am: settings.address_i18n?.am ?? '',
      address_om: settings.address_i18n?.om ?? '',
      facebook:  settings.social?.facebook  ?? '',
      telegram:  settings.social?.telegram  ?? '',
      whatsapp:  settings.social?.whatsapp  ?? '',
      youtube:   settings.social?.youtube   ?? '',
      instagram: settings.social?.instagram ?? '',
      tiktok:    settings.social?.tiktok    ?? '',
      footer_en: settings.footer_text_i18n?.en ?? '',
      footer_am: settings.footer_text_i18n?.am ?? '',
      footer_om: settings.footer_text_i18n?.om ?? '',
    })
    setLoaded(settings.updated_at)
    setDirty(false)
  }, [settings])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (isLoading) return <FullPageSpinner label="Loading settings…" />
  if (error || !form) return <ErrBanner msg={error?.message ?? 'Failed to load settings.'} />

  const set = (key: keyof SettingsForm, value: string) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
    setDirty(true)
    setErrors(prev => { const c = { ...prev }; delete c[key]; return c })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const result = settingsSchema.safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string
        if (!errs[key]) errs[key] = issue.message
      }
      setErrors(errs)
      showToast({ type: 'error', message: 'Please fix the errors before saving.' })
      return
    }
    try {
      await confirm()
    } catch { return }
    try {
      await updateMut.mutateAsync({
        loadedUpdatedAt,
        input: {
          contact_email: form.contact_email,
          phone: form.phone || null,
          address_i18n: { en: form.address_en, am: form.address_am || undefined, om: form.address_om || undefined } as I18nJson,
          social: {
            ...(form.facebook  && { facebook:  form.facebook }),
            ...(form.telegram  && { telegram:  form.telegram }),
            ...(form.whatsapp  && { whatsapp:  form.whatsapp }),
            ...(form.youtube   && { youtube:   form.youtube }),
            ...(form.instagram && { instagram: form.instagram }),
            ...(form.tiktok    && { tiktok:    form.tiktok }),
          },
          footer_text_i18n: { en: form.footer_en, am: form.footer_am || undefined, om: form.footer_om || undefined } as I18nJson,
        },
      })
      setDirty(false)
      showToast({ type: 'success', message: 'Settings saved.' })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' })
    }
  }

  const Field = ({ label, name, hint, type = 'text', placeholder = '' }: { label: string; name: keyof SettingsForm; hint?: string; type?: string; placeholder?: string }) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[var(--text-main)]">{label}</label>
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      <input type={type} value={form![name]} onChange={e => set(name, e.target.value)} className={ic} placeholder={placeholder} />
      {errors[name] && <p className="text-xs text-red-600 dark:text-red-400">{errors[name]}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={14} /> You have unsaved changes.
        </div>
      )}

      {/* Contact */}
      <Card legend="Contact details" hint="Shown in the footer and on the Contact page of the public website.">
        <Field label="Contact email" name="contact_email" type="email" placeholder="tourism@example.edu.et" />
        <Field label="Phone number" name="phone" hint="Leave empty to hide it on the public site." placeholder="+251 ..." />
      </Card>

      {/* Address */}
      <Card legend="Address" hint="Enter the address in each language you use. English is required.">
        <Field label="Address (English)" name="address_en" placeholder="Woliso Campus, Ambo University" />
        <Field label="Address (Amharic)" name="address_am" />
        <Field label="Address (Afaan Oromo)" name="address_om" />
      </Card>

      {/* Social links */}
      <Card legend="Social media links" hint="Each link must start with https://. Leave empty to hide it.">
        {(['facebook','telegram','whatsapp','youtube','instagram','tiktok'] as const).map(key => (
          <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} name={key} placeholder="https://" />
        ))}
      </Card>

      {/* Footer */}
      <Card legend="Footer text" hint="Short text shown at the bottom of every page. English is required.">
        <Field label="Footer (English)" name="footer_en" />
        <Field label="Footer (Amharic)" name="footer_am" />
        <Field label="Footer (Afaan Oromo)" name="footer_om" />
      </Card>

      <button
        type="submit"
        disabled={updateMut.isPending || !dirty}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {updateMut.isPending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}

// ─── BACKUP TAB ───────────────────────────────────────────────────────────────

function BackupTab() {
  const { client } = usePortal()
  const { showToast } = useToast()
  const { confirm } = useConfirmPassword()
  const { data: siteState } = useSiteState(client)
  const setBackupAt  = useSetLastBackupAt(client)
  const fetchMut     = useFetchBackupData(client)
  const [generating, setGenerating] = useState(false)

  const lastBackupAt = siteState?.last_backup_at ?? null
  const isStale = lastBackupAt
    ? Date.now() - new Date(lastBackupAt).getTime() > 30 * 24 * 60 * 60 * 1000
    : true

  const handleDownload = async () => {
    try {
      await confirm()
    } catch { return }
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
      zip.file('image-urls.txt', collectImageUrls(data as unknown as Record<string, Record<string, unknown>[]>).join('\n') || '# No image URLs found')
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
      showToast({ type: 'success', message: 'Backup downloaded.' })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Backup failed.' })
    } finally { setGenerating(false) }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {isStale && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {lastBackupAt ? 'Your last backup is more than 30 days old.' : 'No backup has been taken yet.'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {lastBackupAt ? `Last backup: ${fmt(lastBackupAt)}` : 'Download a backup now.'}
            </p>
          </div>
        </div>
      )}

      {lastBackupAt && !isStale && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-section-alt)] text-sm">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-[var(--text-muted)]">Last backup:</span>
          <span className="text-[var(--text-main)] font-medium">{fmt(lastBackupAt)}</span>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-3">
        <h2 className="font-display text-sm font-bold text-[var(--text-main)]">What's included</h2>
        <p className="text-sm text-[var(--text-muted)]">
          A ZIP file with all content tables as JSON, one CSV per table, and a list of every image URL.
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
          {['editions','events','announcements','news','gallery items','sponsors','committee','FAQs','settings','messages','profiles','activity log'].map(t => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441] shrink-0" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--bg-section-alt)] border border-[var(--border-subtle)]">
        <Shield size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--text-main)]">Privacy:</strong> Messages contain private visitor contact details.
          Save this file in the department Drive with restricted access — not in a shared folder.
          Storage images are not included; download them from the Supabase dashboard if needed.
        </p>
      </div>

      <button
        onClick={handleDownload}
        disabled={generating}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download size={16} />
        {generating ? 'Generating backup…' : 'Download backup'}
      </button>
    </div>
  )
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────

const TABLE_PLAIN: Record<string, string> = {
  events: 'Event', announcements: 'Announcement', news: 'News article',
  gallery_items: 'Gallery photo', sponsors: 'Sponsor', committee_members: 'Committee member',
  faqs: 'FAQ', editions: 'Edition', site_settings: 'Website settings',
  profiles: 'Staff profile', messages: 'Message',
}
const ACTION_PLAIN: Record<string, string> = {
  INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Deleted',
}
const RESTORABLE = new Set(['events','announcements','news','gallery_items','sponsors','committee_members','faqs','editions','site_settings'])
const ACTIONS = ['INSERT', 'UPDATE', 'DELETE']
const TABLE_NAMES = Object.keys(TABLE_PLAIN)
const PER_PAGE = 50

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

function ActionBadge({ action }: { action: string }) {
  const cfg: Record<string, string> = {
    INSERT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${cfg[action] ?? 'bg-stone-100 text-stone-600'}`}>{ACTION_PLAIN[action] ?? action}</span>
}

function HistoryTab() {
  const { client } = usePortal()
  const { showToast } = useToast()
  const { confirm } = useConfirmPassword()

  const [page, setPage]       = useState(1)
  const [filters, setFilters] = useState<ActivityLogFilters>({ tableName: null, action: null, actorId: null, dateFrom: null, dateTo: null })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState<ActivityLogEntry | null>(null)

  const { data, isLoading, error } = useActivityLog(client, page, PER_PAGE, filters)
  const restoreMut = useRestoreLogEntry(client)
  const { data: profiles } = useStaffProfiles(client)

  const setF = (patch: Partial<ActivityLogFilters>) => { setPage(1); setFilters(f => ({ ...f, ...patch })) }

  const handleRestore = async () => {
    if (!restoreConfirm) return
    try {
      await confirm()
    } catch { setRestoreConfirm(null); return }
    try {
      const r = await restoreMut.mutateAsync(restoreConfirm.id)
      showToast({ type: 'success', message: `Restored: ${r.message}` })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Restore failed.' })
    } finally { setRestoreConfirm(null) }
  }

  if (isLoading) return <FullPageSpinner label="Loading history…" />
  if (error) return <ErrBanner msg={error.message} />

  const { entries, total, totalPages } = data!
  const setF_ = setF

  return (
    <div className="max-w-5xl space-y-6">
      <p className="text-sm text-[var(--text-muted)]">
        A record of every change made in this portal. Click any row to see what changed and restore a previous version.
      </p>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select value={filters.tableName ?? ''} onChange={e => setF_({ tableName: e.target.value || null })} className={sc} aria-label="Filter by content type">
          <option value="">All content types</option>
          {TABLE_NAMES.map(tb => <option key={tb} value={tb}>{TABLE_PLAIN[tb] ?? tb}</option>)}
        </select>
        <select value={filters.action ?? ''} onChange={e => setF_({ action: e.target.value || null })} className={sc} aria-label="Filter by action">
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{ACTION_PLAIN[a] ?? a}</option>)}
        </select>
        <select value={filters.actorId ?? ''} onChange={e => setF_({ actorId: e.target.value || null })} className={sc} aria-label="Filter by person">
          <option value="">All people</option>
          {(profiles ?? []).map(p => <option key={p.id} value={p.id}>{p.full_name ?? 'Unknown'}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="date" value={filters.dateFrom ?? ''} onChange={e => setF_({ dateFrom: e.target.value || null })} className={`${sc} flex-1`} aria-label="From date" />
          <input type="date" value={filters.dateTo ?? ''} onChange={e => setF_({ dateTo: e.target.value || null })} className={`${sc} flex-1`} aria-label="To date" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">When</th>
                <th className="text-left font-medium px-4 py-3">Who</th>
                <th className="text-left font-medium px-4 py-3">What happened</th>
                <th className="text-left font-medium px-4 py-3">Item</th>
                <th className="text-right font-medium px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">No history entries found.</td></tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-section-alt)] cursor-pointer"
                  onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{fmt(entry.created_at)}</td>
                  <td className="px-4 py-3">{entry.actor_name ?? 'System'}</td>
                  <td className="px-4 py-3"><ActionBadge action={entry.action} /> <span className="text-[var(--text-muted)] ml-1">{TABLE_PLAIN[entry.table_name] ?? entry.table_name}</span></td>
                  <td className="px-4 py-3 truncate max-w-[200px]">{getTitle(entry)}</td>
                  <td className="px-4 py-3 text-right">
                    {RESTORABLE.has(entry.table_name) && entry.action !== 'INSERT' && (
                      <button
                        onClick={e => { e.stopPropagation(); setRestoreConfirm(entry) }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        <RotateCcw size={11} /> Restore this version
                      </button>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-[var(--border-subtle)] disabled:opacity-40 hover:bg-[var(--bg-section-alt)] transition-colors">
                <ChevronLeft size={14} /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-[var(--border-subtle)] disabled:opacity-40 hover:bg-[var(--bg-section-alt)] transition-colors">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedId !== null && (
        <DetailPanel id={selectedId} client={client} onClose={() => setSelectedId(null)} />
      )}

      <ConfirmDialog
        open={!!restoreConfirm}
        title="Restore this version?"
        message={restoreConfirm
          ? restoreConfirm.action === 'DELETE'
            ? 'This will recreate the deleted item.'
            : 'This will undo the change and restore the previous version.'
          : ''}
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setRestoreConfirm(null)}
      />
    </div>
  )
}

function DetailPanel({ id, client, onClose }: { id: number; client: import('@supabase/supabase-js').SupabaseClient; onClose: () => void }) {
  const { data: entry, isLoading } = useActivityLogDetail(client, id)
  if (isLoading) return <div className="text-sm text-[var(--text-muted)] py-4">Loading detail…</div>
  if (!entry) return null

  const before = entry.old_data
  const after  = entry.new_data
  const allKeys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))
  const changed = allKeys.filter(k => JSON.stringify((before as Record<string,unknown> | null)?.[k]) !== JSON.stringify((after as Record<string,unknown> | null)?.[k]))

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-[var(--text-main)]">What changed</h3>
        <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]"><X size={16} /></button>
      </div>
      {changed.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No field changes detected.</p>
      ) : (
        <div className="space-y-3">
          {changed.map(k => (
            <div key={k} className="space-y-1">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{k}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-mono break-all">
                  {JSON.stringify((before as Record<string,unknown> | null)?.[k] ?? null)}
                </div>
                <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-mono break-all">
                  {JSON.stringify((after as Record<string,unknown> | null)?.[k] ?? null)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Card({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-4">
      <legend className="px-1 font-display text-sm font-bold text-[var(--text-main)] -mb-2">{legend}</legend>
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      {children}
    </fieldset>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
      {msg}
    </div>
  )
}

import type { ActivityLogEntry, ActivityLogFilters } from '../../services/adminService'

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function WebsiteSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('contact')

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]">
          <SlidersHorizontal size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)]">Website Settings</h1>
          <p className="text-xs text-[var(--text-muted)]">Contact information, backup, and change history</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-section-alt)] w-fit" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--surface-card)] text-[var(--text-main)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'contact' && <ContactTab />}
        {activeTab === 'backup'  && <BackupTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
