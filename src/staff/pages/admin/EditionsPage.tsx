/**
 * EditionsPage.tsx — /admin/editions
 *
 * Lists all editions with status badges, event counts, EC+GC dates.
 * Create from template, edit, set as current, no delete.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, PlusCircle, Pencil, Star, Info, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullPageSpinner } from '../../components/Loading'
import {
  useAdminEditions,
  useAdminEdition,
  useCreateEditionFromTemplate,
  useSetCurrentEdition,
  useUpdateEdition,
} from '../../hooks/useAdminQueries'
import type { AdminEditionWithCounts } from '../../services/adminService'
import type { EditionPublic, I18nJson } from '../../../types/database'

export function EditionsPage() {
  const { t } = useTranslation()
  const { client, basePath } = usePortal()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const { data: editions, isLoading, error } = useAdminEditions(client)
  const setCurrentMut = useSetCurrentEdition(client)

  const [view, setView] = useState<'list' | 'create' | { type: 'edit'; id: string }>('list')
  const [setCurrentConfirm, setSetCurrentConfirm] = useState<AdminEditionWithCounts | null>(null)

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />
  if (error) {
    return (
      <div className="max-w-5xl space-y-4">
        <PageHeader onCreateNew={() => setView('create')} />
        <ErrBanner msg={error.message} />
      </div>
    )
  }

  if (view === 'create') {
    return (
      <CreateView
        editions={editions ?? []}
        onCancel={() => setView('list')}
        onCreated={(newId, copied, skipped) => {
          setView('list')
          showToast({ type: 'success', message: t('staff.admin.editions.createdMsg', { copied, skipped }) })
          navigate(`${basePath}/content/events?edition=${newId}`)
        }}
      />
    )
  }

  if (typeof view === 'object' && view.type === 'edit') {
    return (
      <EditView
        editionId={view.id}
        onCancel={() => setView('list')}
        onSaved={() => { setView('list'); showToast({ type: 'success', message: t('staff.admin.editions.savedMsg') }) }}
      />
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader onCreateNew={() => setView('create')} />

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
        {(editions ?? []).length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">No editions yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {(editions ?? []).map(ed => (
              <EditionRow
                key={ed.id} edition={ed}
                onEdit={() => setView({ type: 'edit', id: ed.id })}
                onSetCurrent={() => setSetCurrentConfirm(ed)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--bg-section-alt)] text-sm text-[var(--text-muted)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>{t('staff.admin.editions.noDelete')}</span>
      </div>

      <ConfirmDialog
        open={!!setCurrentConfirm}
        title={t('staff.admin.editions.setCurrentTitle')}
        message={t('staff.admin.editions.setCurrentMsg')}
        confirmLabel={t('staff.admin.editions.setCurrentBtn')}
        onConfirm={async () => {
          if (!setCurrentConfirm) return
          try {
            await setCurrentMut.mutateAsync(setCurrentConfirm.id)
            showToast({ type: 'success', message: t('staff.admin.editions.setCurrentDone') })
          } catch (err) {
            showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
          } finally { setSetCurrentConfirm(null) }
        }}
        onCancel={() => setSetCurrentConfirm(null)}
      />
    </div>
  )
}

function PageHeader({ onCreateNew }: { onCreateNew: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]"><BookOpen size={20} /></div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.editions.title')}</h1>
      </div>
      <button onClick={onCreateNew} className={primaryBtn}>
        <PlusCircle size={16} /> {t('staff.admin.editions.createNew')}
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const cfg: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    live:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 animate-pulse',
    past:     'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${cfg[status] ?? cfg.past}`}>
      {t(`staff.admin.editions.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
    </span>
  )
}

function EditionRow({ edition, onEdit, onSetCurrent }: {
  edition: AdminEditionWithCounts; onEdit: () => void; onSetCurrent: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-sm font-bold text-[var(--text-main)]">{edition.title_i18n?.en ?? `Edition ${edition.number}`}</span>
          <StatusBadge status={edition.status} />
          {edition.is_current && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Star size={12} /> {t('staff.admin.editions.current')}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 text-xs text-[var(--text-muted)]">
          <span>{t('staff.admin.editions.gcLabel')}: {edition.start_date} — {edition.end_date}</span>
          {(edition.start_date_ec || edition.end_date_ec) && (
            <span>{t('staff.admin.editions.ecLabel')}: {edition.start_date_ec ?? '?'} — {edition.end_date_ec ?? '?'}</span>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {t('staff.admin.editions.events')}: {edition.event_count} · {t('staff.admin.editions.publishedEvents')}: {edition.published_event_count}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!edition.is_current && (
          <button onClick={onSetCurrent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9A441] text-[#D9A441] text-xs font-semibold hover:bg-[#D9A441]/10 transition-colors">
            <Star size={12} /> {t('staff.admin.editions.setCurrentBtn')}
          </button>
        )}
        <button onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors">
          <Pencil size={14} /> {t('staff.common.edit')}
        </button>
      </div>
    </div>
  )
}

function CreateView({ editions, onCancel, onCreated }: {
  editions: AdminEditionWithCounts[]
  onCancel: () => void
  onCreated: (id: string, copied: number, skipped: number) => void
}) {
  const { t } = useTranslation()
  const { client } = usePortal()
  const { showToast } = useToast()
  const createMut = useCreateEditionFromTemplate(client)

  const [sourceId, setSourceId] = useState(editions[0]?.id ?? '')
  const [number,   setNumber]   = useState(String((editions[0]?.number ?? 0) + 1))
  const [slug,     setSlug]     = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [titleAm, setTitleAm] = useState('')
  const [titleOm, setTitleOm] = useState('')
  const [themeEn, setThemeEn] = useState('')
  const [themeAm, setThemeAm] = useState('')
  const [themeOm, setThemeOm] = useState('')
  const [venueEn, setVenueEn] = useState('')
  const [venueAm, setVenueAm] = useState('')
  const [venueOm, setVenueOm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')

  useEffect(() => {
    if (!titleEn) return
    setSlug(`${number}th-annual-${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`)
  }, [titleEn, number])

  const sourceEdition = useMemo(() => editions.find(e => e.id === sourceId), [editions, sourceId])

  // Compare real Date objects — avoids string-lexicographic surprises
  const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : NaN
  const endMs   = endDate   ? new Date(endDate   + 'T00:00:00').getTime() : NaN
  const datesValid = !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs
  const days = datesValid ? Math.floor((endMs - startMs) / 86400000) + 1 : null

  const preview = days !== null && sourceEdition
    ? { total: sourceEdition.event_count, copied: sourceEdition.event_count, skipped: 0 }
    : null

  const valid = titleEn.trim() && themeEn.trim() && venueEn.trim() && slug.trim() && startDate && endDate && datesValid && parseInt(number, 10) > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!datesValid) {
      showToast({ type: 'error', message: `End date (${endDate}) must not be before start date (${startDate}).` })
      return
    }
    try {
      const result = await createMut.mutateAsync({
        sourceId, number: parseInt(number, 10), slug: slug.trim(),
        titleI18n: { en: titleEn, am: titleAm || undefined, om: titleOm || undefined } as I18nJson,
        themeI18n: { en: themeEn, am: themeAm || undefined, om: themeOm || undefined } as I18nJson,
        venueI18n: { en: venueEn, am: venueAm || undefined, om: venueOm || undefined } as I18nJson,
        startDate, endDate,
      })
      onCreated(result.new_edition_id, result.copied, result.skipped)
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors" aria-label={t('staff.common.back')}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.editions.createTitle')}</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t('staff.admin.editions.sourceEdition')} id="src">
          <select id="src" value={sourceId} onChange={e => setSourceId(e.target.value)} className={fullSelectCls}>
            {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.title_i18n?.en ?? `Edition ${ed.number}`} (#{ed.number})</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t('staff.admin.editions.editionNumber')} *`} id="num">
            <input id="num" type="number" min="1" value={number} onChange={e => setNumber(e.target.value)} className={fullInputCls} required />
          </Field>
          <Field label={`${t('staff.admin.editions.slug')} *`} id="slug">
            <input id="slug" type="text" value={slug} onChange={e => setSlug(e.target.value)} className={fullInputCls} required />
          </Field>
        </div>
        <FieldSet legend="Title">
          <Field label={`${t('staff.admin.editions.titleEn')} *`} id="ten"><input id="ten" type="text" value={titleEn} onChange={e => setTitleEn(e.target.value)} className={fullInputCls} required /></Field>
          <Field label={t('staff.admin.editions.titleAm')} id="tam"><input id="tam" type="text" value={titleAm} onChange={e => setTitleAm(e.target.value)} className={fullInputCls} /></Field>
          <Field label={t('staff.admin.editions.titleOm')} id="tom"><input id="tom" type="text" value={titleOm} onChange={e => setTitleOm(e.target.value)} className={fullInputCls} /></Field>
        </FieldSet>
        <FieldSet legend="Theme">
          <Field label={`${t('staff.admin.editions.themeEn')} *`} id="then"><input id="then" type="text" value={themeEn} onChange={e => setThemeEn(e.target.value)} className={fullInputCls} required /></Field>
          <Field label={t('staff.admin.editions.themeAm')} id="tham"><input id="tham" type="text" value={themeAm} onChange={e => setThemeAm(e.target.value)} className={fullInputCls} /></Field>
          <Field label={t('staff.admin.editions.themeOm')} id="thom"><input id="thom" type="text" value={themeOm} onChange={e => setThemeOm(e.target.value)} className={fullInputCls} /></Field>
        </FieldSet>
        <FieldSet legend="Venue">
          <Field label={`${t('staff.admin.editions.venueEn')} *`} id="ven"><input id="ven" type="text" value={venueEn} onChange={e => setVenueEn(e.target.value)} className={fullInputCls} required /></Field>
          <Field label={t('staff.admin.editions.venueAm')} id="vam"><input id="vam" type="text" value={venueAm} onChange={e => setVenueAm(e.target.value)} className={fullInputCls} /></Field>
          <Field label={t('staff.admin.editions.venueOm')} id="vom"><input id="vom" type="text" value={venueOm} onChange={e => setVenueOm(e.target.value)} className={fullInputCls} /></Field>
        </FieldSet>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t('staff.admin.editions.startDateLabel')} *`} id="sd"><input id="sd" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fullInputCls} required /></Field>
          <Field label={`${t('staff.admin.editions.endDateLabel')} *`} id="ed"><input id="ed" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fullInputCls} required /></Field>
        </div>
        {preview && (
          <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm space-y-1">
            <p className="font-medium text-blue-800 dark:text-blue-200">{t('staff.admin.editions.previewTitle')}</p>
            <p className="text-blue-700 dark:text-blue-300">✓ {t('staff.admin.editions.previewCopied', { count: preview.copied })}</p>
            {preview.skipped > 0 && <p className="text-amber-700 dark:text-amber-400">⚠ {t('staff.admin.editions.previewSkipped', { count: preview.skipped })}</p>}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">
          <button type="button" onClick={onCancel} className={cancelBtn}>{t('staff.common.cancel')}</button>
          <button type="submit" disabled={createMut.isPending || !valid} className={primaryBtn}>
            {createMut.isPending ? t('staff.admin.editions.creating') : t('staff.admin.editions.createBtn')}
          </button>
        </div>
      </form>
    </div>
  )
}

function EditView({ editionId, onCancel, onSaved }: { editionId: string; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { client } = usePortal()
  const { showToast } = useToast()
  const { data: edition, isLoading, error } = useAdminEdition(client, editionId)
  const updateMut = useUpdateEdition(client)

  const [titleEn, setTitleEn] = useState('')
  const [titleAm, setTitleAm] = useState('')
  const [titleOm, setTitleOm] = useState('')
  const [themeEn, setThemeEn] = useState('')
  const [themeAm, setThemeAm] = useState('')
  const [themeOm, setThemeOm] = useState('')
  const [venueEn, setVenueEn] = useState('')
  const [venueAm, setVenueAm] = useState('')
  const [venueOm, setVenueOm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [startEc,   setStartEc]   = useState('')
  const [endEc,     setEndEc]     = useState('')
  const [expPart,   setExpPart]   = useState('')
  const [exhib,     setExhib]     = useState('')
  // ── Phase 6B fields ──
  const [hlEn, setHlEn] = useState('')   // theme highlight word
  const [hlAm, setHlAm] = useState('')
  const [hlOm, setHlOm] = useState('')
  const [subtitleEn, setSubEn] = useState('')
  const [subtitleAm, setSubAm] = useState('')
  const [subtitleOm, setSubOm] = useState('')
  const [summaryEn, setSumEn] = useState('')
  const [summaryAm, setSumAm] = useState('')
  const [summaryOm, setSumOm] = useState('')
  const [heroPosterUrl, setHeroPoster] = useState('')
  const [heroVideoUrl,  setHeroVideo ] = useState('')
  const [coverImageUrl, setCoverImage] = useState('')
  const [edState, setEdState] = useState<'draft' | 'published'>('published')
  const [dirty,     setDirty]     = useState(false)
  // Guard: don't let the useEffect that fills form state trigger a dirty=true
  // before we've had a chance to call setDirty(false) at the end of that effect.
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!edition) return
    loadedRef.current = false   // pause dirty tracking during load
    setTitleEn(edition.title_i18n?.en ?? ''); setTitleAm(edition.title_i18n?.am ?? ''); setTitleOm(edition.title_i18n?.om ?? '')
    setThemeEn(edition.theme_i18n?.en ?? ''); setThemeAm(edition.theme_i18n?.am ?? ''); setThemeOm(edition.theme_i18n?.om ?? '')
    setVenueEn(edition.venue_i18n?.en ?? ''); setVenueAm(edition.venue_i18n?.am ?? ''); setVenueOm(edition.venue_i18n?.om ?? '')
    setStartDate(edition.start_date ?? ''); setEndDate(edition.end_date ?? '')
    setStartEc(edition.start_date_ec ?? ''); setEndEc(edition.end_date_ec ?? '')
    setExpPart(edition.stats?.expectedParticipants ?? ''); setExhib(edition.stats?.exhibitorsCount ?? '')
    // Phase 6B
    const ext = edition as typeof edition & {
      theme_highlight_i18n?: { en?: string; am?: string; om?: string } | null
      subtitle_i18n?:        { en?: string; am?: string; om?: string } | null
      summary_i18n?:         { en?: string; am?: string; om?: string } | null
      hero_poster_url?:      string | null
      hero_video_url?:       string | null
      cover_image_url?:      string | null
      state?:                string
    }
    setHlEn(ext.theme_highlight_i18n?.en ?? ''); setHlAm(ext.theme_highlight_i18n?.am ?? ''); setHlOm(ext.theme_highlight_i18n?.om ?? '')
    setSubEn(ext.subtitle_i18n?.en ?? ''); setSubAm(ext.subtitle_i18n?.am ?? ''); setSubOm(ext.subtitle_i18n?.om ?? '')
    setSumEn(ext.summary_i18n?.en ?? ''); setSumAm(ext.summary_i18n?.am ?? ''); setSumOm(ext.summary_i18n?.om ?? '')
    setHeroPoster(ext.hero_poster_url ?? ''); setHeroVideo(ext.hero_video_url ?? ''); setCoverImage(ext.cover_image_url ?? '')
    setEdState((ext.state as 'draft' | 'published') ?? 'published')
    setDirty(false)
    // Re-enable dirty tracking after React has committed the state batch
    setTimeout(() => { loadedRef.current = true }, 0)
  }, [edition])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const mark = () => { if (loadedRef.current) setDirty(true) }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />
  if (error || !edition) return <ErrBanner msg={error?.message ?? 'Edition not found'} />

  // Compare real Date objects — string compare is unreliable for edge cases
  const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : NaN
  const endMs   = endDate   ? new Date(endDate   + 'T00:00:00').getTime() : NaN
  const datesValid = !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs
  const daysCount  = datesValid ? Math.floor((endMs - startMs) / 86400000) + 1 : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titleEn.trim() || !themeEn.trim() || !venueEn.trim()) return showToast({ type: 'error', message: 'English fields required.' })
    if (!startDate || !endDate || !datesValid) {
      return showToast({
        type: 'error',
        message: `End date (${endDate || '—'}) must not be before start date (${startDate || '—'}).`,
      })
    }
    try {
      await updateMut.mutateAsync({
        editionId,
        loadedUpdatedAt: edition.updated_at,
        patch: Object.assign(
          {
            title_i18n: { en: titleEn.trim(), am: titleAm || undefined, om: titleOm || undefined } as I18nJson,
            theme_i18n: { en: themeEn.trim(), am: themeAm || undefined, om: themeOm || undefined } as I18nJson,
            venue_i18n: { en: venueEn.trim(), am: venueAm || undefined, om: venueOm || undefined } as I18nJson,
            start_date: startDate, end_date: endDate,
            start_date_ec: startEc || null, end_date_ec: endEc || null,
            stats: { daysCount, activitiesCount: null, expectedParticipants: expPart || null, exhibitorsCount: exhib || null },
          },
          // Phase 6B fields (cast to bypass strict patch type until adminService is updated)
          {
            theme_highlight_i18n: hlEn ? { en: hlEn, am: hlAm || undefined, om: hlOm || undefined } : null,
            subtitle_i18n:        subtitleEn ? { en: subtitleEn, am: subtitleAm || undefined, om: subtitleOm || undefined } : null,
            summary_i18n:         summaryEn ? { en: summaryEn, am: summaryAm || undefined, om: summaryOm || undefined } : null,
            hero_poster_url:      heroPosterUrl || null,
            hero_video_url:       heroVideoUrl  || null,
            cover_image_url:      coverImageUrl || null,
            state:                edState,
          } as Record<string, unknown>
        ),
      })
      setDirty(false); onSaved()
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors" aria-label={t('staff.common.back')}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.editions.editTitle')} — {edition.title_i18n?.en}</h1>
      </div>
      {dirty && <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle size={14} /> {t('staff.events.unsavedWarning')}</div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <FieldSet legend="Title">
          <Field label={`${t('staff.admin.editions.titleEn')} *`} id="eten"><input id="eten" type="text" value={titleEn} onChange={e => { setTitleEn(e.target.value); mark() }} className={fullInputCls} required /></Field>
          <Field label={t('staff.admin.editions.titleAm')} id="etam"><input id="etam" type="text" value={titleAm} onChange={e => { setTitleAm(e.target.value); mark() }} className={fullInputCls} /></Field>
          <Field label={t('staff.admin.editions.titleOm')} id="etom"><input id="etom" type="text" value={titleOm} onChange={e => { setTitleOm(e.target.value); mark() }} className={fullInputCls} /></Field>
        </FieldSet>
        <FieldSet legend="Theme">
          <Field label={`${t('staff.admin.editions.themeEn')} *`} id="ethen"><input id="ethen" type="text" value={themeEn} onChange={e => { setThemeEn(e.target.value); mark() }} className={fullInputCls} required /></Field>
          <Field label={t('staff.admin.editions.themeAm')} id="etham"><input id="etham" type="text" value={themeAm} onChange={e => { setThemeAm(e.target.value); mark() }} className={fullInputCls} /></Field>
          <Field label={t('staff.admin.editions.themeOm')} id="ethom"><input id="ethom" type="text" value={themeOm} onChange={e => { setThemeOm(e.target.value); mark() }} className={fullInputCls} /></Field>
        </FieldSet>
        <FieldSet legend="Venue">
          <Field label={`${t('staff.admin.editions.venueEn')} *`} id="even"><input id="even" type="text" value={venueEn} onChange={e => { setVenueEn(e.target.value); mark() }} className={fullInputCls} required /></Field>
          <Field label={t('staff.admin.editions.venueAm')} id="evam"><input id="evam" type="text" value={venueAm} onChange={e => { setVenueAm(e.target.value); mark() }} className={fullInputCls} /></Field>
          <Field label={t('staff.admin.editions.venueOm')} id="evom"><input id="evom" type="text" value={venueOm} onChange={e => { setVenueOm(e.target.value); mark() }} className={fullInputCls} /></Field>
        </FieldSet>
        <FieldSet legend={t('staff.admin.editions.gcLabel')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`${t('staff.admin.editions.startDateLabel')} *`} id="esd"><input id="esd" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); mark() }} className={fullInputCls} required /></Field>
            <Field label={`${t('staff.admin.editions.endDateLabel')} *`} id="eed"><input id="eed" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); mark() }} className={fullInputCls} required /></Field>
          </div>
          {daysCount !== null && <p className="text-xs text-[var(--text-muted)]">{daysCount} day{daysCount !== 1 ? 's' : ''}</p>}
        </FieldSet>
        <FieldSet legend={`${t('staff.admin.editions.ecLabel')} (display only)`}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('staff.admin.editions.startEc')} id="esec"><input id="esec" type="text" value={startEc} onChange={e => { setStartEc(e.target.value); mark() }} className={fullInputCls} /></Field>
            <Field label={t('staff.admin.editions.endEc')} id="eeec"><input id="eeec" type="text" value={endEc} onChange={e => { setEndEc(e.target.value); mark() }} className={fullInputCls} /></Field>
          </div>
        </FieldSet>
        <FieldSet legend="Stats">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('staff.admin.editions.expectedParticipants')} id="ep"><input id="ep" type="text" value={expPart} onChange={e => { setExpPart(e.target.value); mark() }} className={fullInputCls} placeholder="2,000+" /></Field>
            <Field label={t('staff.admin.editions.exhibitorsCount')} id="ex"><input id="ex" type="text" value={exhib} onChange={e => { setExhib(e.target.value); mark() }} className={fullInputCls} placeholder="30+" /></Field>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{t('staff.admin.editions.daysCount')}: {daysCount ?? '—'}</p>
        </FieldSet>
        {/* ── Phase 6B — Hero content ── */}
        <FieldSet legend="Hero highlight word (gold italic in headline)">
          <p className="text-xs text-[var(--text-muted)] -mt-1 mb-2">The word or phrase within the theme text to show in gold italic. Leave empty to use the default.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="English" id="hlen"><input id="hlen" type="text" value={hlEn} onChange={e => { setHlEn(e.target.value); mark() }} className={fullInputCls} placeholder="Peace" /></Field>
            <Field label="Amharic" id="hlam"><input id="hlam" type="text" value={hlAm} onChange={e => { setHlAm(e.target.value); mark() }} className={fullInputCls} placeholder="ሰላምና" /></Field>
            <Field label="Afaan Oromo" id="hlom"><input id="hlom" type="text" value={hlOm} onChange={e => { setHlOm(e.target.value); mark() }} className={fullInputCls} placeholder="Nageenyaa" /></Field>
          </div>
          {/* Live preview */}
          {themeEn && (
            <div className="mt-3 px-4 py-2 rounded-xl bg-[#071510] text-white text-sm font-editorial font-bold">
              {themeEn.includes(hlEn) && hlEn ? (
                <>
                  {themeEn.slice(0, themeEn.indexOf(hlEn))}
                  <em className="not-italic text-[#D9A441]">{hlEn}</em>
                  {themeEn.slice(themeEn.indexOf(hlEn) + hlEn.length)}
                </>
              ) : themeEn}
              {hlEn && !themeEn.includes(hlEn) && (
                <span className="ml-2 text-amber-400 text-xs font-normal">(word not found in theme)</span>
              )}
            </div>
          )}
        </FieldSet>
        <FieldSet legend="Hero subtitle (shown under headline)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="English" id="suben"><input id="suben" type="text" value={subtitleEn} onChange={e => { setSubEn(e.target.value); mark() }} className={fullInputCls} /></Field>
            <Field label="Amharic" id="subam"><input id="subam" type="text" value={subtitleAm} onChange={e => { setSubAm(e.target.value); mark() }} className={fullInputCls} /></Field>
            <Field label="Afaan Oromo" id="subom"><input id="subom" type="text" value={subtitleOm} onChange={e => { setSubOm(e.target.value); mark() }} className={fullInputCls} /></Field>
          </div>
        </FieldSet>
        <FieldSet legend="Summary (Past Editions Timeline)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="English" id="sumen"><textarea id="sumen" rows={3} value={summaryEn} onChange={e => { setSumEn(e.target.value); mark() }} className={fullInputCls + ' resize-none'} /></Field>
            <Field label="Amharic" id="sumam"><textarea id="sumam" rows={3} value={summaryAm} onChange={e => { setSumAm(e.target.value); mark() }} className={fullInputCls + ' resize-none'} /></Field>
            <Field label="Afaan Oromo" id="sumom"><textarea id="sumom" rows={3} value={summaryOm} onChange={e => { setSumOm(e.target.value); mark() }} className={fullInputCls + ' resize-none'} /></Field>
          </div>
        </FieldSet>
        <FieldSet legend="Media URLs (leave empty to use defaults)">
          <Field label="Hero poster image URL (site-content bucket or /assets/…)" id="hpurl">
            <input id="hpurl" type="text" value={heroPosterUrl} onChange={e => { setHeroPoster(e.target.value); mark() }} className={fullInputCls} placeholder="https://…" />
          </Field>
          <Field label="Hero background video URL (MP4)" id="hvurl">
            <input id="hvurl" type="text" value={heroVideoUrl} onChange={e => { setHeroVideo(e.target.value); mark() }} className={fullInputCls} placeholder="https://…" />
            <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
              Use a short loop (10 to 12 seconds), 720p or smaller, under 5 MB, no sound.
              Large videos stutter on phones.{' '}
              <strong className="text-amber-600 dark:text-amber-400">Do not host videos in Supabase Storage</strong>
              {' '}— use a CDN or leave blank for the default.
            </p>
          </Field>
          <Field label="Cover image URL (shown in timeline)" id="ciurl">
            <input id="ciurl" type="text" value={coverImageUrl} onChange={e => { setCoverImage(e.target.value); mark() }} className={fullInputCls} placeholder="https://…" />
          </Field>
        </FieldSet>
        <FieldSet legend="Visibility">
          <Field label="State" id="estat">
            <select id="estat" value={edState} onChange={e => { setEdState(e.target.value as 'draft' | 'published'); mark() }} className={fullSelectCls}>
              <option value="published">Published (visible to public)</option>
              <option value="draft">Draft (staff only)</option>
            </select>
          </Field>
        </FieldSet>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">
          <button type="button" onClick={onCancel} className={cancelBtn}>{t('staff.common.cancel')}</button>
          <button type="submit" disabled={updateMut.isPending} className={primaryBtn}>
            {updateMut.isPending ? t('staff.admin.editions.saving') : t('staff.admin.editions.editBtn')}
          </button>
        </div>
      </form>
    </div>
  )
}

function FieldSet({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 p-4 rounded-xl border border-[var(--border-subtle)]">
      <legend className="text-sm font-semibold text-[var(--text-main)] px-1">{legend}</legend>
      {children}
    </fieldset>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-main)]">{label}</label>
      {children}
    </div>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{msg}</div>
}

const primaryBtn = 'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2'
const cancelBtn  = 'px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors'
const fullInputCls  = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition'
const fullSelectCls = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441]'
