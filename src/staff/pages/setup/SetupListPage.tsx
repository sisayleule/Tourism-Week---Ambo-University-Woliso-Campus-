/**
 * SetupListPage.tsx — /staff/setup and /admin/content/setup
 *
 * Lists all editions as cards with:
 *  - Number, year, theme/slogan, dates, status badge
 *  - Setup progress bar (required items scored 0–100)
 *  - "Continue setup" button → wizard
 *  - "Create new year's event" button (with optional copy from earlier edition)
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarPlus, ChevronRight, Loader2, PlusCircle,
  Sparkles, CheckCircle2, AlertCircle, Clock, Radio,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { FullPageSpinner } from '../../components/Loading'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatError } from '../../services/helpers'
import { buildEditionDays } from '../../../lib/editionDays'
import {
  useSetupEditions,
  useCreateEditionFromTemplate,
} from '../../hooks/useSetupQueries'
import {
  computeSetupProgress,
} from '../../services/setupService'
import type { SetupEdition } from '../../services/setupService'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusChip({ status, state }: { status: string; state: string }) {
  if (state === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider">
        Draft
      </span>
    )
  }
  const cfg: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    live:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    past:     'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
  }
  const labels: Record<string, { icon: React.ReactNode; text: string }> = {
    upcoming: { icon: <Clock size={10} />, text: 'Upcoming' },
    live:     { icon: <Radio size={10} className="animate-pulse" />, text: 'Live' },
    past:     { icon: null, text: 'Past' },
  }
  const info = labels[status] ?? labels.past
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg[status] ?? cfg.past}`}>
      {info.icon}{info.text}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ score, requiredComplete }: { score: number; requiredComplete: boolean }) {
  const color = requiredComplete
    ? 'bg-emerald-500'
    : score >= 40
    ? 'bg-amber-500'
    : 'bg-red-400'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-medium">
        <span className="text-[var(--text-muted)]">Setup progress</span>
        <span className={requiredComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'}>
          {score}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--bg-section-alt)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ─── Edition card ─────────────────────────────────────────────────────────────

function EditionCard({
  edition,
  onContinue,
}: {
  edition: SetupEdition
  onContinue: () => void
}) {
  const days = buildEditionDays(edition.start_date, edition.end_date)

  // Build synthetic proxies from the counts already on SetupEdition so we
  // don't need extra queries per card.
  const syntheticEvents = edition.event_count > 0
    ? Array.from({ length: edition.event_count }, (_, i) => ({
        day: i < edition.day_count ? i + 1 : 1,
      } as import('../../../types/database').Event))
    : []
  // 5 committees — leader_count >= 5 means all have a leader
  const COMMITTEE_KEYS: import('../../../types/database').CommitteeKey[] = [
    'publicity_promotion', 'technical_physical',
    'sponsorship_fundraising', 'award_beauty_contest', 'documentation',
  ]
  const syntheticMembers = Array.from({ length: edition.leader_count }, (_, i) => ({
    committee_key: COMMITTEE_KEYS[i % COMMITTEE_KEYS.length],
    is_leader: true,
  } as import('../../../types/database').CommitteeMember))

  const progress = computeSetupProgress(edition, syntheticEvents, syntheticMembers)

  const dateStr = edition.start_date && edition.end_date
    ? `${edition.start_date} — ${edition.end_date} (${days.length} day${days.length !== 1 ? 's' : ''})`
    : 'Dates not set'

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-4 hover:border-[#D9A441]/40 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Edition #{edition.number}
            </span>
            <StatusChip status={edition.status} state={edition.state} />
            {edition.is_current && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D9A441]/20 text-[#C8923A] uppercase tracking-wider">
                <Sparkles size={9} /> Live on website
              </span>
            )}
          </div>
          <p className="font-display text-base font-bold text-[var(--text-main)] truncate">
            {edition.theme_i18n?.en ?? edition.title_i18n?.en ?? `Edition ${edition.number}`}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{dateStr}</p>
        </div>
        <button
          onClick={onContinue}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
        >
          Continue <ChevronRight size={14} />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-[var(--text-muted)]">
        <span>{edition.published_event_count} published activities</span>
        <span>{edition.event_count - edition.published_event_count} drafts</span>
      </div>

      {/* Progress */}
      <ProgressBar score={progress.score} requiredComplete={progress.requiredComplete} />

      {/* Checklist summary */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[
          { ok: progress.hasTheme,   label: 'Slogan' },
          { ok: progress.hasDates,   label: 'Dates' },
          { ok: progress.hasAtLeastOneEvent, label: 'Activities' },
          { ok: progress.hasLogo,    label: 'Logo' },
          { ok: progress.hasLeaderForAllCommittees, label: 'All leaders' },
        ].map(({ ok, label }) => (
          <span key={label} className={`flex items-center gap-1 text-[10px] font-medium ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'}`}>
            {ok
              ? <CheckCircle2 size={11} />
              : <AlertCircle size={11} />
            }
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Create new dialog ────────────────────────────────────────────────────────

function CreateNewDialog({
  editions,
  onClose,
  onCreated,
}: {
  editions: SetupEdition[]
  onClose: () => void
  onCreated: (newId: string) => void
}) {
  const { client } = usePortal()
  const { showToast } = useToast()
  const createMut = useCreateEditionFromTemplate(client)

  const [sourceId,     setSourceId]     = useState(editions[0]?.id ?? '')
  const [number,       setNumber]       = useState(String((editions[0]?.number ?? 0) + 1))
  const [slug,         setSlug]         = useState('')
  const [titleEn,      setTitleEn]      = useState('')
  const [themeEn,      setThemeEn]      = useState('')
  const [venueEn,      setVenueEn]      = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [copyProgram,  setCopyProgram]  = useState(true)
  const [copyCommittees, setCopyCommittees] = useState(false)

  // Auto-slug
  React.useEffect(() => {
    if (titleEn.trim())
      setSlug(`${number}-annual-${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`)
  }, [titleEn, number])

  const startMs = startDate ? new Date(startDate + 'T00:00:00Z').getTime() : NaN
  const endMs   = endDate   ? new Date(endDate   + 'T00:00:00Z').getTime() : NaN
  const daysCount = !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs
    ? Math.round((endMs - startMs) / 86400000) + 1
    : null
  const tooManyDays = daysCount !== null && daysCount > 31

  const valid = titleEn.trim() && themeEn.trim() && venueEn.trim() &&
    slug.trim() && startDate && endDate &&
    !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs &&
    !tooManyDays && parseInt(number, 10) > 0

  const handleCreate = async () => {
    if (!valid) return
    try {
      const result = await createMut.mutateAsync({
        sourceId:        copyProgram ? sourceId : (editions[0]?.id ?? ''),
        number:          parseInt(number, 10),
        slug:            slug.trim(),
        titleI18n:       { en: titleEn },
        themeI18n:       { en: themeEn },
        venueI18n:       { en: venueEn },
        startDate,
        endDate,
        copyCommittees,
      })
      onCreated(result.new_edition_id)
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  const inp = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]'
  const lbl = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--surface-card)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-[var(--text-main)]">Create new year's event</h2>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Edition #</label>
              <input type="number" min="1" value={number} onChange={e => setNumber(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Slug</label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className={inp} /></div>
          </div>

          <div><label className={lbl}>Title (English) *</label>
            <input type="text" value={titleEn} onChange={e => setTitleEn(e.target.value)} className={inp} /></div>

          <div><label className={lbl}>Slogan / Theme (English) *</label>
            <input type="text" value={themeEn} onChange={e => setThemeEn(e.target.value)} className={inp} /></div>

          <div><label className={lbl}>Venue (English) *</label>
            <input type="text" value={venueEn} onChange={e => setVenueEn(e.target.value)} className={inp} /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Start date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>End date *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} /></div>
          </div>

          {daysCount !== null && (
            <p className={`text-xs ${tooManyDays ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>
              {tooManyDays ? `⚠ ${daysCount} days — maximum is 31.` : `${daysCount} day${daysCount !== 1 ? 's' : ''}`}
            </p>
          )}

          {/* Copy options */}
          {editions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={copyProgram} onChange={e => setCopyProgram(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] accent-[#D9A441]" />
                <span>Copy day programme from</span>
                <select value={sourceId} onChange={e => setSourceId(e.target.value)}
                  disabled={!copyProgram}
                  className="ml-1 text-sm border border-[var(--border-subtle)] rounded-lg px-2 py-1 bg-[var(--bg-canvas)] text-[var(--text-main)] disabled:opacity-40">
                  {editions.map(e => (
                    <option key={e.id} value={e.id}>
                      #{e.number} — {e.theme_i18n?.en ?? e.title_i18n?.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={copyCommittees} onChange={e => setCopyCommittees(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] accent-[#D9A441]" />
                <span>Also copy committee members (as drafts)</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!valid || createMut.isPending}
              className="px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
              {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
              Create &amp; start setup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SetupListPage() {
  const { client, basePath } = usePortal()
  const navigate = useNavigate()
  const { data: editions, isLoading, error } = useSetupEditions(client)
  const [showCreate, setShowCreate] = useState(false)

  if (isLoading) return <FullPageSpinner label="Loading editions…" />

  if (error) {
    return (
      <div className="max-w-3xl space-y-4">
        <PageHeader onCreateNew={() => setShowCreate(true)} />
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader onCreateNew={() => setShowCreate(true)} />

      {(!editions || editions.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-10 text-center space-y-3">
          <CalendarPlus size={32} className="mx-auto text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)] text-sm">No editions yet. Create the first one to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] transition-colors">
            <PlusCircle size={15} /> Create first edition
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {editions.map(ed => (
            <EditionCard
              key={ed.id}
              edition={ed}
              onContinue={() => navigate(`${basePath}/setup/${ed.id}`)}
            />
          ))}
        </div>
      )}

      {showCreate && editions && (
        <CreateNewDialog
          editions={editions}
          onClose={() => setShowCreate(false)}
          onCreated={newId => {
            setShowCreate(false)
            navigate(`${basePath}/setup/${newId}`)
          }}
        />
      )}
    </div>
  )
}

function PageHeader({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]">
          <CalendarPlus size={20} />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)]">Event Setup</h1>
          <p className="text-xs text-[var(--text-muted)]">Create and publish a full year's edition in one guided flow</p>
        </div>
      </div>
      <button
        onClick={onCreateNew}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">
        <PlusCircle size={15} /> New year's event
      </button>
    </div>
  )
}
