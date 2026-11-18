/**
 * StatusBadge.tsx — Coloured pill for event status, content state, and announcement state.
 */

import React from 'react'
import type { EventStatus, ContentState } from '../../types/database'

const EVENT_STATUS_STYLES: Record<EventStatus, { label: string; classes: string }> = {
  scheduled:  { label: 'Scheduled', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  live:       { label: 'Live now',   classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 animate-pulse' },
  delayed:    { label: 'Delayed',    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  cancelled:  { label: 'Cancelled',  classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const s = EVENT_STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${s.classes}`}>
      {s.label}
    </span>
  )
}

export function ContentStateBadge({ state }: { state: ContentState }) {
  if (state === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-[#0F3D2E]/10 text-[#0F3D2E] dark:bg-[#D9A441]/15 dark:text-[#D9A441]">
        Published
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-[var(--text-muted)]">
      Draft
    </span>
  )
}
