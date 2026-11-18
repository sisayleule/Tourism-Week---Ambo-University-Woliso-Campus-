/**
 * Step2Dates.tsx — Dates
 *
 * Fields: start date, end date.
 * Shows EC + GC side by side, day count, day list with weekday names.
 * Max 31 days. Warns when shortening would leave events beyond the last day.
 */

import React, { useRef, useState } from 'react'
import { Loader2, AlertTriangle, Calendar } from 'lucide-react'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { Label, TextInput, FormError } from '../../components/StaffForm'
import { formatError } from '../../services/helpers'
import { buildEditionDays, gcToEC } from '../../../lib/editionDays'
import { useUpdateSetupEdition } from '../../hooks/useSetupQueries'
import { useSetupEvents } from '../../hooks/useSetupQueries'
import type { EditionPublic } from '../../../types/database'

interface Props {
  edition: EditionPublic
  onSaved: (updated: EditionPublic) => void
}

export function Step2Dates({ edition, onSaved }: Props) {
  const { client } = usePortal()
  const { showToast } = useToast()
  const updateMut = useUpdateSetupEdition(client)
  const { data: events } = useSetupEvents(client, edition.id)
  const loadedRef = useRef(edition.updated_at)

  const [startDate, setStartDate] = useState(edition.start_date ?? '')
  const [endDate,   setEndDate]   = useState(edition.end_date   ?? '')
  const [dirty,     setDirty]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [errors,    setErrors]    = useState<Record<string, string>>({})

  const startMs = startDate ? new Date(startDate + 'T00:00:00Z').getTime() : NaN
  const endMs   = endDate   ? new Date(endDate   + 'T00:00:00Z').getTime() : NaN
  const daysCount = !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs
    ? Math.round((endMs - startMs) / 86400000) + 1
    : null
  const tooManyDays = daysCount !== null && daysCount > 31

  const editionDays = daysCount && !tooManyDays
    ? buildEditionDays(startDate, endDate)
    : []

  // Events that would be orphaned if the range shrinks
  const maxEventDay = events ? Math.max(0, ...events.map(e => e.day)) : 0
  const orphaned    = daysCount !== null && daysCount < maxEventDay

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!startDate) errs.start = 'Start date is required.'
    if (!endDate)   errs.end   = 'End date is required.'
    if (startDate && endDate && endMs < startMs) errs.end = 'End date must be after start date.'
    if (tooManyDays) errs.end = 'Maximum 31 days per edition.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const updated = await updateMut.mutateAsync({
        editionId:       edition.id,
        loadedUpdatedAt: loadedRef.current,
        patch: {
          start_date:          startDate,
          end_date:            endDate,
          start_date_ec:       gcToEC(startDate),
          end_date_ec:         gcToEC(endDate),
        },
      })
      loadedRef.current = updated.updated_at
      setDirty(false)
      onSaved(updated)
      showToast({ type: 'success', message: 'Dates saved.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="start" required>Start date (Gregorian)</Label>
          <TextInput
            id="start" type="date" value={startDate}
            onChange={e => { setStartDate(e.target.value); setDirty(true) }}
            aria-invalid={!!errors.start ? 'true' : undefined}
          />
          {startDate && (
            <p className="text-[11px] text-[var(--text-muted)]">EC: {gcToEC(startDate)}</p>
          )}
          {errors.start && <FormError message={errors.start} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="end" required>End date (Gregorian)</Label>
          <TextInput
            id="end" type="date" value={endDate}
            onChange={e => { setEndDate(e.target.value); setDirty(true) }}
            aria-invalid={!!errors.end ? 'true' : undefined}
          />
          {endDate && (
            <p className="text-[11px] text-[var(--text-muted)]">EC: {gcToEC(endDate)}</p>
          )}
          {errors.end && <FormError message={errors.end} />}
        </div>
      </div>

      {/* Day count badge */}
      {daysCount !== null && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium ${tooManyDays ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-[var(--bg-section-alt)] text-[var(--text-muted)]'}`}>
          <Calendar size={14} />
          {tooManyDays
            ? `${daysCount} days — maximum is 31`
            : `${daysCount} day${daysCount !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* Orphaned events warning */}
      {orphaned && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Shortening to {daysCount} day{daysCount !== 1 ? 's' : ''} would leave {maxEventDay - (daysCount ?? 0)} existing activit{maxEventDay - (daysCount ?? 0) === 1 ? 'y' : 'ies'} beyond the last day. Move or delete them first.
          </span>
        </div>
      )}

      {/* Day list */}
      {editionDays.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-section-alt)] border-b border-[var(--border-subtle)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {editionDays.length} Days
            </p>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {editionDays.map(d => (
              <div key={d.day} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                <span className="w-14 shrink-0 font-semibold text-[var(--text-main)]">Day {d.day}</span>
                <span className="flex-1 text-[var(--text-muted)]">{d.dayOfWeek}</span>
                <span className="text-xs font-mono text-[var(--text-muted)]">{d.gc}</span>
                <span className="text-xs text-[var(--text-muted)]">EC {d.ecShort}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !dirty || !!errors.start || !!errors.end}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] disabled:opacity-40 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save &amp; continue
        </button>
      </div>
    </div>
  )
}
