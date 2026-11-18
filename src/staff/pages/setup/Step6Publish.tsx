/**
 * Step6Publish.tsx — Review and Publish
 *
 * Checklist of required + recommended items with links back to each step.
 * Preview panels: hero headline with gold word, schedule by day, committees.
 * "Save draft" and "Publish" buttons.
 * Publish shows a confirmation → optional "Show as main edition" toggle →
 * calls publish_edition() → success page with public links.
 */

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, XCircle, ExternalLink,
  Loader2, Sparkles, Eye,
} from 'lucide-react'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatError } from '../../services/helpers'
import { buildEditionDays } from '../../../lib/editionDays'
import {
  useSetupEvents,
  useSetupCommittee,
  useEditionDays,
  usePublishEdition,
} from '../../hooks/useSetupQueries'
import {
  computeSetupProgress,
} from '../../services/setupService'
import type { EditionPublic } from '../../../types/database'

const PUBLIC_SITE = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? '').replace(/\/$/, '')

interface Props {
  edition: EditionPublic
  onGoToStep: (step: number) => void
}

// ─── Checklist row ────────────────────────────────────────────────────────────

function CheckRow({
  ok,
  label,
  hint,
  required,
  step,
  onGo,
}: {
  ok:       boolean
  label:    string
  hint?:    string
  required: boolean
  step:     number
  onGo:     (s: number) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`shrink-0 ${ok ? 'text-emerald-500' : required ? 'text-red-500' : 'text-stone-400 dark:text-stone-600'}`}>
        {ok ? <CheckCircle2 size={18} /> : required ? <XCircle size={18} /> : <AlertCircle size={18} />}
      </span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${ok ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
        {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      </div>
      {!ok && (
        <button
          onClick={() => onGo(step)}
          className="shrink-0 text-[11px] text-[#D9A441] hover:underline font-medium"
        >
          Fix →
        </button>
      )}
    </div>
  )
}

// ─── Hero preview ─────────────────────────────────────────────────────────────

function HeroPreview({ edition }: { edition: EditionPublic }) {
  const theme = edition.theme_i18n?.en ?? ''
  const hl    = (edition.theme_highlight_i18n as any)?.en ?? ''
  const idx   = hl ? theme.indexOf(hl) : -1

  return (
    <div className="rounded-xl bg-[#071510] text-white px-6 py-8 space-y-2 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F3D2E]/60 to-transparent pointer-events-none" />
      <p className="relative text-[10px] font-semibold uppercase tracking-widest text-[#D9A441]/80">
        {edition.edition_name_i18n?.en}
      </p>
      <h2 className="relative font-display text-2xl sm:text-3xl font-extrabold leading-tight text-balance">
        {idx >= 0 ? (
          <>
            {theme.slice(0, idx)}
            <em className="text-[#D9A441] not-italic">{hl}</em>
            {theme.slice(idx + hl.length)}
          </>
        ) : theme || <span className="opacity-40 italic">No slogan set</span>}
      </h2>
      <p className="relative text-sm text-stone-300/80">{edition.sub_theme_i18n?.en}</p>
      {(edition as any).logo_url && (
        <img
          src={(edition as any).logo_url}
          alt="Edition logo"
          className="relative h-10 w-auto object-contain mt-2"
        />
      )}
    </div>
  )
}

// ─── Schedule preview ─────────────────────────────────────────────────────────

function SchedulePreview({ edition, events }: { edition: EditionPublic; events: ReturnType<typeof useSetupEvents>['data'] }) {
  const days = buildEditionDays(edition.start_date, edition.end_date)
  const eventsByDay: Record<number, typeof events> = {}
  for (const ev of events ?? []) {
    if (!eventsByDay[ev.day]) eventsByDay[ev.day] = []
    eventsByDay[ev.day]!.push(ev)
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--bg-section-alt)] border-b border-[var(--border-subtle)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Schedule preview</p>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {days.slice(0, 5).map(d => (
          <div key={d.day} className="px-4 py-2.5">
            <p className="text-xs font-semibold text-[var(--text-main)] mb-1">Day {d.day} — {d.dayOfWeek}</p>
            {(eventsByDay[d.day] ?? []).length === 0
              ? <p className="text-[11px] text-[var(--text-muted)] italic">No activities yet</p>
              : (eventsByDay[d.day] ?? []).slice(0, 3).map(ev => (
                  <p key={ev.id} className="text-[11px] text-[var(--text-muted)] truncate">· {ev.title_i18n?.en}</p>
                ))
            }
          </div>
        ))}
        {days.length > 5 && (
          <div className="px-4 py-2 text-[11px] text-[var(--text-muted)]">…and {days.length - 5} more day{days.length - 5 !== 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  )
}

// ─── Main step ────────────────────────────────────────────────────────────────

export function Step6Publish({ edition, onGoToStep }: Props) {
  const { client, basePath } = usePortal()
  const { showToast } = useToast()
  const publishMut = usePublishEdition(client)

  const { data: events  } = useSetupEvents(client, edition.id)
  const { data: members } = useSetupCommittee(client, edition.id)
  const { data: dbDays  } = useEditionDays(client, edition.id)

  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [makeCurrent, setMakeCurrent]   = useState(() => {
    // Default ON when edition is upcoming or live
    const today = new Date().toISOString().split('T')[0]
    return edition.end_date >= today
  })
  const [published,   setPublished]     = useState(false)
  const [result,      setResult]        = useState<{ published_events: number; warnings: string[] } | null>(null)

  const calDays = useMemo(
    () => buildEditionDays(edition.start_date, edition.end_date),
    [edition.start_date, edition.end_date]
  )
  const isPast = edition.end_date < new Date().toISOString().split('T')[0]

  const progress = computeSetupProgress(edition, events ?? [], members ?? [])

  const handlePublish = async () => {
    setConfirmOpen(false)
    try {
      const res = await publishMut.mutateAsync({ editionId: edition.id, makeCurrent })
      setResult({ published_events: res.published_events, warnings: res.warnings })
      setPublished(true)
      showToast({ type: 'success', message: 'Edition published!' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  // ── Success page ─────────────────────────────────────────────────────────────
  if (published && result) {
    return (
      <div className="space-y-6 text-center py-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto">
          <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--text-main)]">Edition published!</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {result.published_events} activit{result.published_events !== 1 ? 'ies' : 'y'} published.
          </p>
        </div>
        {result.warnings.length > 0 && (
          <div className="text-left space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle size={14} /> {w}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {PUBLIC_SITE && (
            <a
              href={PUBLIC_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] transition-colors"
            >
              <ExternalLink size={14} /> View on website
            </a>
          )}
          <Link
            to={`${basePath}/setup`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-semibold hover:bg-[var(--bg-section-alt)] transition-colors"
          >
            Back to editions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero preview */}
      <HeroPreview edition={edition} />

      {/* Checklist */}
      <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--bg-section-alt)] border-b border-[var(--border-subtle)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Required to publish</p>
        </div>
        <div className="px-4 divide-y divide-[var(--border-subtle)]">
          <CheckRow ok={progress.hasTitle}            label="English title"       required step={1} onGo={onGoToStep} />
          <CheckRow ok={progress.hasTheme}            label="English slogan"      required step={1} onGo={onGoToStep} />
          <CheckRow ok={progress.hasDates}            label="Start and end dates" required step={2} onGo={onGoToStep} />
          <CheckRow ok={progress.hasAtLeastOneEvent}  label="At least one activity" required step={4} onGo={onGoToStep} />
        </div>

        <div className="px-4 py-2.5 bg-[var(--bg-section-alt)] border-y border-[var(--border-subtle)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recommended</p>
        </div>
        <div className="px-4 divide-y divide-[var(--border-subtle)]">
          <CheckRow ok={progress.hasLogo}                   label="Edition logo"             required={false} step={1} onGo={onGoToStep} />
          <CheckRow ok={progress.hasLeaderForAllCommittees} label="A leader for each committee" required={false} step={3} onGo={onGoToStep} hint="5 committees" />
          <CheckRow ok={progress.allDaysHaveActivities}     label="Activity on every day"    required={false} step={4} onGo={onGoToStep} hint={`${calDays.length} day${calDays.length !== 1 ? 's' : ''}`} />
          <CheckRow ok={progress.hasAboutText}              label="About this edition text"  required={false} step={5} onGo={onGoToStep} />
        </div>
      </div>

      {/* Schedule preview */}
      {events && events.length > 0 && (
        <SchedulePreview edition={edition} events={events} />
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
        <button
          disabled={publishMut.isPending || !progress.requiredComplete}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D9A441] text-[#0A2A1E] text-sm font-semibold hover:bg-[#C8923A] disabled:opacity-40 transition-colors"
        >
          {publishMut.isPending && <Loader2 size={14} className="animate-spin" />}
          <Sparkles size={14} />
          Publish edition
        </button>
        {!progress.requiredComplete && (
          <p className="text-xs text-red-500 self-center">Complete required items above first.</p>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full sm:max-w-sm bg-[var(--surface-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-[var(--border-subtle)] p-6 space-y-5 max-h-[90dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
            <h3 className="font-display text-lg font-bold text-[var(--text-main)]">Publish this edition?</h3>
            <p className="text-sm text-[var(--text-muted)]">
              All draft activities, days and committee members for this edition will be published at once.
            </p>

            {/* Make current toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                role="switch"
                aria-checked={makeCurrent}
                onClick={() => !isPast && setMakeCurrent(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${makeCurrent ? 'bg-[#0F3D2E]' : 'bg-stone-300 dark:bg-stone-600'} ${isPast ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${makeCurrent ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-[var(--text-main)]">Show as main edition on website</span>
                {isPast && <p className="text-[11px] text-[var(--text-muted)]">Disabled — edition dates are in the past.</p>}
              </div>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishMut.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#D9A441] text-[#0A2A1E] text-sm font-semibold hover:bg-[#C8923A] disabled:opacity-40 transition-colors"
              >
                {publishMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
