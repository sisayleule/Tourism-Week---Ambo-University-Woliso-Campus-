/**
 * SetupWizardPage.tsx — /staff/setup/:editionId and /admin/content/setup/:editionId
 *
 * Six-step wizard with:
 *  - Progress bar and step list in a sidebar / top strip
 *  - Autosave: each step saves on its own (no extra save needed)
 *  - Resume later (URL contains the edition id; step in query param)
 *  - Unsaved-changes warning only after a real edit (each step owns dirty state)
 *  - Mobile-friendly: sidebar collapses to a stepper strip on small screens
 */

import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, ChevronRight,
  Fingerprint, Calendar, Users2, CalendarDays, Info, Sparkles,
} from 'lucide-react'
import { usePortal } from '../../context/PortalContext'
import { FullPageSpinner } from '../../components/Loading'
import { useSetupEdition } from '../../hooks/useSetupQueries'
import { Step1Identity }   from './Step1Identity'
import { Step2Dates }      from './Step2Dates'
import { Step3Committees } from './Step3Committees'
import { Step4Program }    from './Step4Program'
import { Step5MoreInfo }   from './Step5MoreInfo'
import { Step6Publish }    from './Step6Publish'
import type { EditionPublic } from '../../../types/database'

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Slogan & Identity', icon: <Fingerprint size={16} /> },
  { num: 2, label: 'Dates',             icon: <Calendar size={16} /> },
  { num: 3, label: 'Committees',        icon: <Users2 size={16} /> },
  { num: 4, label: 'Programme',         icon: <CalendarDays size={16} /> },
  { num: 5, label: 'More info',         icon: <Info size={16} /> },
  { num: 6, label: 'Review & Publish',  icon: <Sparkles size={16} /> },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepStrip({
  current,
  onChange,
  completed,
}: {
  current:   number
  onChange:  (n: number) => void
  completed: Set<number>
}) {
  const totalSteps = STEPS.length

  // Scroll the active circle into view on mobile when step changes
  const activeCircleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeCircleRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [current])

  return (
    <>
      {/* ── Desktop sidebar (lg+): full step list ── */}
      <div className="hidden lg:flex flex-col w-52 shrink-0 space-y-1" aria-label="Wizard steps">
        {STEPS.map(s => {
          const isCurrent = s.num === current
          const isDone    = completed.has(s.num)
          return (
            <button
              key={s.num}
              onClick={() => onChange(s.num)}
              aria-current={isCurrent ? 'step' : undefined}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]',
                isCurrent
                  ? 'bg-[#0F3D2E] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)]',
              ].join(' ')}
            >
              <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                {isDone && !isCurrent ? <CheckCircle2 size={16} className="text-emerald-500" /> : s.icon}
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Mobile compact indicator (< lg): label + scrollable circles + bar ──
           Lives ONLY here; the parent must NOT render a second StepStrip.
           Width is constrained to the containing block — never causes overflow. ── */}
      <div className="lg:hidden w-full min-w-0 space-y-2" aria-label="Wizard progress">

        {/* Single-line "Step N of 6 — Title" — truncates at ellipsis */}
        <p
          className="text-sm font-semibold text-[var(--text-main)] truncate"
          aria-live="polite"
        >
          Step {current} of {totalSteps}
          <span className="ml-1.5 text-[var(--text-muted)] font-normal">
            — {STEPS[current - 1]?.label}
          </span>
        </p>

        {/* Horizontally-scrollable circle row — never forces the page wider */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          role="group"
          aria-label="Jump to step"
        >
          {STEPS.map(s => {
            const isCurrent = s.num === current
            const isDone    = completed.has(s.num)
            return (
              <button
                key={s.num}
                ref={isCurrent ? activeCircleRef : undefined}
                type="button"
                onClick={() => onChange(s.num)}
                aria-label={`Step ${s.num}: ${s.label}${isDone ? ' (done)' : isCurrent ? ' (current)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'shrink-0 w-7 h-7 rounded-full text-[10px] font-bold transition-all flex items-center justify-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]',
                  isCurrent
                    ? 'bg-[#0F3D2E] text-white scale-110'
                    : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[var(--bg-section-alt)] text-[var(--text-muted)]',
                ].join(' ')}
              >
                {isDone && !isCurrent ? '✓' : s.num}
              </button>
            )
          })}
        </div>

        {/* Thin progress bar */}
        <div
          className="h-1.5 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label={`Step ${current} of ${totalSteps}`}
        >
          <div
            className="h-full rounded-full bg-[#D9A441] transition-all duration-300"
            style={{ width: `${((current - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SetupWizardPage() {
  const { editionId } = useParams<{ editionId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { client, basePath } = usePortal()

  const { data: edition, isLoading, error } = useSetupEdition(client, editionId ?? null)

  // Local edition mirror so steps can update it after save without a full refetch latency
  const [localEdition, setLocalEdition] = useState<EditionPublic | null>(null)
  useEffect(() => { if (edition) setLocalEdition(edition) }, [edition])

  const stepParam = parseInt(searchParams.get('step') ?? '1', 10)
  const [currentStep, setCurrentStep] = useState(() => (stepParam >= 1 && stepParam <= 6) ? stepParam : 1)
  const [completed,   setCompleted]   = useState<Set<number>>(new Set())

  const goToStep = (n: number) => {
    setCurrentStep(n)
    setSearchParams({ step: String(n) }, { replace: true })
  }

  const handleSaved = (updated: EditionPublic) => {
    setLocalEdition(updated)
    setCompleted(prev => new Set(prev).add(currentStep))
    if (currentStep < 6) goToStep(currentStep + 1)
  }

  if (isLoading) return <FullPageSpinner label="Loading edition…" />
  if (error || !localEdition) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link to={`${basePath}/setup`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">
          <ArrowLeft size={16} /> All editions
        </Link>
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error?.message ?? 'Edition not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl w-full min-w-0 space-y-6">
      {/* Header — truncates long edition titles on small screens */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to={`${basePath}/setup`}
          className="shrink-0 p-1.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors"
          aria-label="Back to editions"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold text-[var(--text-main)] truncate">
            Setup — {localEdition.theme_i18n?.en ?? localEdition.title_i18n?.en ?? `Edition #${localEdition.number}`}
          </h1>
          <p className="text-xs text-[var(--text-muted)] truncate">
            Edition #{localEdition.number} · {localEdition.state === 'published' ? '✓ Published' : 'Draft'}
          </p>
        </div>
      </div>

      {/* Body: single column on phones, sidebar + content row on lg+ */}
      {/*
        IMPORTANT: StepStrip is rendered ONCE here — inside this flex wrapper.
        On lg+ its `hidden lg:flex` sidebar appears as the left column.
        On < lg its `lg:hidden` mobile bar appears at the top of the column,
        above the form card. There is no second StepStrip call.
      */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 min-w-0">

        {/* StepStrip: sidebar on desktop, compact bar on mobile */}
        <StepStrip current={currentStep} onChange={goToStep} completed={completed} />

        {/* Step content card — always full width on phones */}
        <div className="flex-1 min-w-0 w-full">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-6">
            <h2 className="font-display text-base font-bold text-[var(--text-main)] mb-5">
              {STEPS[currentStep - 1]?.label}
            </h2>

            {currentStep === 1 && (
              <Step1Identity edition={localEdition} onSaved={handleSaved} />
            )}
            {currentStep === 2 && (
              <Step2Dates edition={localEdition} onSaved={handleSaved} />
            )}
            {currentStep === 3 && (
              <Step3Committees edition={{ id: localEdition.id }} />
            )}
            {currentStep === 4 && (
              <Step4Program edition={localEdition} />
            )}
            {currentStep === 5 && (
              <Step5MoreInfo edition={localEdition} onSaved={handleSaved} />
            )}
            {currentStep === 6 && (
              <Step6Publish edition={localEdition} onGoToStep={goToStep} />
            )}

            {/* Step 3 and 4 have their own save logic; show a "Next" button */}
            {(currentStep === 3 || currentStep === 4) && currentStep < 6 && (
              <div className="flex justify-end pt-6 border-t border-[var(--border-subtle)] mt-6">
                <button
                  onClick={() => goToStep(currentStep + 1)}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] transition-colors"
                >
                  Continue <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
