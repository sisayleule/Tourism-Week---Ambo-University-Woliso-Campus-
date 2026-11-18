/**
 * LivePage.tsx — /staff/live
 *
 * The most important screen during the event. Designed for one-handed phone use.
 *
 * Features:
 *  - Shows today's events grouped Morning and Afternoon (day selector)
 *  - Each event has 4 large buttons: Scheduled, Live, Delayed, Cancelled
 *  - One tap changes status instantly (optimistic update with rollback)
 *  - Cancelled asks for confirmation
 *  - When Delayed, offer optional status_note_i18n in 3 languages
 *  - Clear note when returning to Scheduled or Live
 *  - "Updated {time ago}" on each event
 *  - Auto-refresh every 30s and on tab focus
 *  - Large text, 48px touch targets, high contrast, works at 360px
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Clock,
  CalendarClock,
  AlertCircle,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import {
  useCurrentEdition,
  useEvents,
  useUpdateEventStatus,
} from '../hooks/useStaffQueries'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { I18nTabs, type I18nLang, LANG_NOTE } from '../components/I18nTabs'
import { TextInput, TextArea } from '../components/StaffForm'
import { FullPageSpinner } from '../components/Loading'
import { computeTodayDay } from '../services/dashboardService'
import type { Event, EventStatus, I18nJson } from '../../types/database'

// ─── Time ago formatter ───────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

// ─── Status button ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EventStatus, { label: string; activeClass: string }> = {
  scheduled: {
    label: 'Scheduled',
    activeClass: 'bg-blue-600 text-white border-blue-600',
  },
  live: {
    label: 'Live now',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 animate-pulse',
  },
  delayed: {
    label: 'Delayed',
    activeClass: 'bg-amber-500 text-white border-amber-500',
  },
  cancelled: {
    label: 'Cancelled',
    activeClass: 'bg-red-600 text-white border-red-600',
  },
}

// ─── Main component ──────────────────────────────────────────────────────────

export function LivePage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { data: edition } = useCurrentEdition()
  const editionId = edition?.id ?? null
  const { data: events, isLoading, refetch, dataUpdatedAt } = useEvents(editionId)
  const statusMut = useUpdateEventStatus(editionId ?? '')

  // Day selector — default to today
  const maxDay = edition?.stats?.daysCount ?? 5
  const todayDay = edition ? computeTodayDay(edition.start_date, edition.end_date) : null
  const [selectedDay, setSelectedDay] = useState<number>(todayDay ?? 1)

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => refetch(), 30_000)
    return () => clearInterval(interval)
  }, [refetch])

  // Refresh on tab focus
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch])

  // ── Cancel confirmation ─────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<Event | null>(null)

  // ── Delayed note editor ───────────────────────────────────────────────────
  const [noteTarget, setNoteTarget] = useState<Event | null>(null)
  const [noteLang, setNoteLang] = useState<I18nLang>('en')
  const [noteEn, setNoteEn] = useState('')
  const [noteAm, setNoteAm] = useState('')
  const [noteOm, setNoteOm] = useState('')

  // ── Filter events for selected day ────────────────────────────────────────
  const dayEvents = useMemo(
    () => (events ?? []).filter(e => e.day === selectedDay).sort((a, b) =>
      a.session === b.session
        ? a.sort_order - b.sort_order
        : a.session === 'morning' ? -1 : 1
    ),
    [events, selectedDay]
  )

  const morningEvents = dayEvents.filter(e => e.session === 'morning')
  const afternoonEvents = dayEvents.filter(e => e.session === 'afternoon')

  // ── Status change handler ─────────────────────────────────────────────────
  const handleStatusChange = async (event: Event, status: EventStatus, note?: I18nJson | null) => {
    try {
      await statusMut.mutateAsync({
        id: event.id,
        status,
        statusNoteI18n: note ?? null,
      })
      // Toast handled implicitly by the optimistic update; show feedback
      if (status === 'scheduled' || status === 'live') {
        // If previous was delayed with a note, clear it
        if (event.status_note_i18n) {
          showToast({ type: 'info', message: t('staff.live.clearingNote') })
        }
      }
    } catch {
      showToast({ type: 'error', message: t('staff.common.errorTitle') })
    }
  }

  // ── Open delayed note editor ────────────────────────────────────────────────
  const openNoteEditor = (event: Event) => {
    setNoteTarget(event)
    setNoteEn(event.status_note_i18n?.en ?? '')
    setNoteAm(event.status_note_i18n?.am ?? '')
    setNoteOm(event.status_note_i18n?.om ?? '')
    setNoteLang('en')
  }

  // ── Save delay note ─────────────────────────────────────────────────────────
  const saveDelayNote = async () => {
    if (!noteTarget) return
    if (!noteEn.trim()) {
      showToast({ type: 'error', message: t('staff.live.noteHint') })
      return
    }
    const note: I18nJson = { en: noteEn.trim() }
    if (noteAm.trim()) note.am = noteAm.trim()
    if (noteOm.trim()) note.om = noteOm.trim()
    await handleStatusChange(noteTarget, 'delayed', note)
    setNoteTarget(null)
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441] shrink-0">
          <CalendarClock size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.live.title')}</h1>
          <p className="text-xs text-[var(--text-muted)]">{t('staff.live.oneHandedHint')}</p>
        </div>
      </div>

      {/* Day selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {Array.from({ length: maxDay }).map((_, i) => {
          const day = i + 1
          const isToday = day === todayDay
          const isActive = day === selectedDay
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={[
                'shrink-0 px-4 py-2.5 min-h-[48px] rounded-xl text-sm font-medium transition-colors min-w-[3.5rem]',
                isActive
                  ? 'bg-[#0F3D2E] text-white'
                  : 'border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]',
                isToday && !isActive ? 'ring-2 ring-[#D9A441]' : '',
              ].join(' ')}
            >
              {`Day ${day}`}
              {isToday && <span className="ml-1 text-[10px] block">Today</span>}
            </button>
          )
        })}
      </div>

      {/* Last updated */}
      <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
        <Clock size={12} aria-hidden="true" />
        {t('staff.live.updated', { time: dataUpdatedAt ? timeAgo(new Date(dataUpdatedAt).toISOString()) : 'now' })}
      </p>

      {/* Morning events */}
      <EventGroup
        title={t('staff.events.sessionMorning')}
        events={morningEvents}
        onStatusChange={handleStatusChange}
        onCancelConfirm={setCancelTarget}
        onAddNote={openNoteEditor}
        t={t}
      />

      {/* Afternoon events */}
      <EventGroup
        title={t('staff.events.sessionAfternoon')}
        events={afternoonEvents}
        onStatusChange={handleStatusChange}
        onCancelConfirm={setCancelTarget}
        onAddNote={openNoteEditor}
        t={t}
      />

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={!!cancelTarget}
        title={t('staff.live.cancelConfirmTitle')}
        message={t('staff.live.cancelConfirmMsg')}
        confirmLabel={t('staff.live.statusCancelled')}
        variant="danger"
        onConfirm={async () => {
          if (cancelTarget) await handleStatusChange(cancelTarget, 'cancelled')
          setCancelTarget(null)
        }}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Delayed note editor dialog */}
      {noteTarget && (
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end sm:items-center sm:justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-title"
          onClick={() => setNoteTarget(null)}
        >
          <div
            className="bg-[var(--surface-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] w-full sm:max-w-md p-5 space-y-4 sm:mx-4"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar (mobile only) */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-[var(--border-subtle)] mx-auto -mt-1 mb-1" aria-hidden="true" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-500" aria-hidden="true" />
                <h2 id="note-title" className="font-display text-base font-bold text-[var(--text-main)]">
                  {t('staff.live.addNote')}
                </h2>
              </div>
              <button
                onClick={() => setNoteTarget(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]"
                aria-label={t('staff.common.close')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] truncate">{noteTarget.title_i18n.en}</p>

            <I18nTabs value={noteLang} onChange={setNoteLang} />
            <p className="text-[11px] text-[var(--text-muted)]">{LANG_NOTE[noteLang]}</p>

            <TextArea
              value={noteLang === 'en' ? noteEn : noteLang === 'am' ? noteAm : noteOm}
              onChange={e => {
                if (noteLang === 'en') setNoteEn(e.target.value)
                else if (noteLang === 'am') setNoteAm(e.target.value)
                else setNoteOm(e.target.value)
              }}
              rows={3}
              placeholder="e.g. Starts 30 minutes late"
            />

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => setNoteTarget(null)}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
              >
                {t('staff.common.cancel')}
              </button>
              <button
                onClick={saveDelayNote}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
              >
                {t('staff.live.saveNote')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Event group ──────────────────────────────────────────────────────────────

interface EventGroupProps {
  title:     string
  events:    Event[]
  onStatusChange:  (event: Event, status: EventStatus, note?: I18nJson | null) => Promise<void>
  onCancelConfirm: (event: Event) => void
  onAddNote:        (event: Event) => void
  t:        (key: string, opts?: Record<string, unknown>) => string
}

function EventGroup({ title, events, onStatusChange, onCancelConfirm, onAddNote, t }: EventGroupProps) {
  if (events.length === 0) return null
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{title}</h2>
      {events.map(ev => (
        <EventCard
          key={ev.id}
          event={ev}
          onStatusChange={onStatusChange}
          onCancelConfirm={onCancelConfirm}
          onAddNote={onAddNote}
          t={t}
        />
      ))}
    </div>
  )
}

// ─── Event card with status buttons ───────────────────────────────────────────

interface EventCardProps extends Omit<EventGroupProps, 'title' | 'events'> {
  event: Event
}

function EventCard({ event, onStatusChange, onCancelConfirm, onAddNote, t }: EventCardProps) {
  const statuses: EventStatus[] = ['scheduled', 'live', 'delayed', 'cancelled']

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-4 space-y-3">
      {/* Title + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[var(--text-main)] leading-snug">
            {event.title_i18n.en}
          </p>
          {event.start_time && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {event.start_time.slice(0, 5)}{event.end_time ? ` — ${event.end_time.slice(0, 5)}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Status note (if exists) */}
      {event.status_note_i18n?.en && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200">
          {event.status_note_i18n.en}
        </div>
      )}

      {/* Status buttons — large, min 48px touch targets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statuses.map(status => {
          const config = STATUS_CONFIG[status]
          const isActive = event.status === status
          return (
            <button
              key={status}
              onClick={() => {
                if (status === 'cancelled') {
                  onCancelConfirm(event)
                } else if (status === 'delayed' && !event.status_note_i18n) {
                  onAddNote(event)
                } else {
                  onStatusChange(event, status)
                }
              }}
              className={[
                'min-h-[48px] px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2',
                isActive
                  ? config.activeClass
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]',
              ].join(' ')}
              aria-pressed={isActive}
            >
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Updated time */}
      <p className="text-[11px] text-[var(--text-muted)]">
        {t('staff.live.updated', { time: timeAgo(event.updated_at) })}
      </p>

      {/* Add note link when delayed */}
      {event.status === 'delayed' && (
        <button
          onClick={() => onAddNote(event)}
          className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
        >
          {t('staff.live.addNote')}
        </button>
      )}
    </div>
  )
}
