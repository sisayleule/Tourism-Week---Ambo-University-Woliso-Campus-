/**
 * AgendaPage.tsx — /staff/events/agenda
 *
 * Day-by-day board with Morning / Afternoon columns.
 * Drag and drop to reorder within a session and to move between sessions/days.
 * Keyboard accessible via dnd-kit. On phones, a "Move to…" menu instead.
 * Soft warning when a day has more than MAX_ITEMS_PER_DAY items.
 * Every move saved immediately with undo on the toast.
 */

import React, { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, GripVertical, MoveRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrentEdition, useEvents, useReorderEvents } from '../../hooks/useStaffQueries'
import { useToast } from '../../components/Toast'
import { EventStatusBadge, ContentStateBadge } from '../../components/StatusBadge'
import { FullPageSpinner, EmptyState } from '../../components/Loading'
import { buildEditionDays } from '../../../lib/editionDays'
import type { Event, SessionType } from '../../../types/database'
import type { ReorderMove } from '../../services/eventsService'

const MAX_ITEMS_PER_DAY = 6

// ─── Day tabs ─────────────────────────────────────────────────────────────────

function DayTabs({
  maxDay,
  selectedDay,
  onChange,
  dayCounts,
}: {
  maxDay:      number
  selectedDay: number
  onChange:    (day: number) => void
  dayCounts:   Record<number, number>
}) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-[var(--border-subtle)] pb-px" role="tablist">
      {Array.from({ length: maxDay }).map((_, i) => {
        const day = i + 1
        const isActive = day === selectedDay
        const count = dayCounts[day] ?? 0
        const isCrowded = count > MAX_ITEMS_PER_DAY
        return (
          <button
            key={day}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(day)}
            className={[
              'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] rounded-t-lg',
              isActive
                ? 'border-[#D9A441] text-[var(--text-main)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]',
              isCrowded ? 'text-amber-600' : '',
            ].join(' ')}
          >
            {`Day ${day}`}
            {count > 0 && (
              <span className="ml-1 text-xs text-[var(--text-muted)]">({count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Droppable session column ─────────────────────────────────────────────────

interface SessionColumnProps {
  id:      string
  label:   string
  items:   Event[]
  children: React.ReactNode
}

function SessionColumn({ id, label, items, children }: SessionColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={[
        'flex-1 min-h-[200px] rounded-xl border-2 border-dashed transition-colors',
        isOver ? 'border-[#D9A441] bg-[#D9A441]/5' : 'border-[var(--border-subtle)]',
      ].join(' ')}
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
        {label}
        <span className="text-[10px]">{items.length}</span>
      </div>
      <div className="space-y-1.5 p-2">
        {items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">{label} — empty</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// ─── Sortable event card ──────────────────────────────────────────────────────

interface SortableCardProps {
  event: Event
  onMove: (event: Event) => void
}

function SortableCard({ event, onMove }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        'group flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)]',
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-[#D9A441] z-10' : '',
      ].join(' ')}
    >
      {/* Drag handle (hidden on small screens, visible on desktop) */}
      <button
        {...attributes}
        {...listeners}
        className="hidden sm:flex shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-main)]"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text-main)] truncate">{event.title_i18n.en}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <EventStatusBadge status={event.status} />
          <ContentStateBadge state={event.state} />
          {event.start_time && (
            <span className="text-[10px] text-[var(--text-muted)]">{event.start_time.slice(0, 5)}</span>
          )}
        </div>
      </div>

      {/* Move-to menu (visible on small screens) */}
      <button
        onClick={() => onMove(event)}
        className="sm:hidden shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]"
        aria-label="Move to another session or day"
      >
        <MoveRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { data: edition } = useCurrentEdition()
  const editionId = edition?.id ?? null
  const { data: events, isLoading } = useEvents(editionId)
  const reorderMut = useReorderEvents(editionId ?? '')

  // Use buildEditionDays for maxDay so any number of days (up to 31) works.
  const maxDay = useMemo(() => {
    if (edition?.start_date && edition?.end_date) {
      return buildEditionDays(edition.start_date, edition.end_date).length
    }
    return edition?.stats?.daysCount ?? 5
  }, [edition])
  const [selectedDay, setSelectedDay] = useState(1)
  const [moveMenuFor, setMoveMenuFor] = useState<Event | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Day count for warning ──────────────────────────────────────────────────
  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    if (events) {
      events.forEach(e => { counts[e.day] = (counts[e.day] ?? 0) + 1 })
    }
    return counts
  }, [events])

  const dayEvents = useMemo(
    () => (events ?? []).filter(e => e.day === selectedDay),
    [events, selectedDay]
  )

  const morningEvents = useMemo(
    () => dayEvents.filter(e => e.session === 'morning').sort((a, b) => a.sort_order - b.sort_order),
    [dayEvents]
  )
  const afternoonEvents = useMemo(
    () => dayEvents.filter(e => e.session === 'afternoon').sort((a, b) => a.sort_order - b.sort_order),
    [dayEvents]
  )
  const eveningEvents = useMemo(
    () => dayEvents.filter(e => e.session === 'evening').sort((a, b) => a.sort_order - b.sort_order),
    [dayEvents]
  )

  // ── Save reordered events ───────────────────────────────────────────────────
  const saveReorder = async (moves: ReorderMove[], previousState: Event[]) => {
    try {
      await reorderMut.mutateAsync(moves)
      showToast({
        type: 'success',
        message: t('staff.agenda.saved'),
        undoFn: () => {
          // Undo: restore previous sort orders
          const undoMoves: ReorderMove[] = previousState.map(e => ({
            id: e.id,
            day: e.day,
            session: e.session,
            sort_order: e.sort_order,
          }))
          reorderMut.mutate(undoMoves)
        },
      })
    } catch {
      showToast({ type: 'error', message: t('staff.agenda.saveError') })
    }
  }

  // ── Drag end handler ───────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over)

    // Determine which column and position
    const activeEvent = (events ?? []).find(e => e.id === activeId)
    if (!activeEvent) return

    // Check if over is a column or a card
    const isColumnDrop = overId.startsWith('col-')
    const overEvent = isColumnDrop ? null : (events ?? []).find(e => e.id === overId)

    let newDay = activeEvent.day
    let newSession = activeEvent.session
    let targetList: Event[]

    if (isColumnDrop) {
      // Dropped on a column — parse day+session from id "col-{day}-{session}"
      const [, dayStr, sessionStr] = overId.split('-')
      newDay = Number(dayStr)
      newSession = sessionStr as SessionType
      targetList = (events ?? []).filter(e => e.day === newDay && e.session === newSession)
    } else if (overEvent) {
      newDay = overEvent.day
      newSession = overEvent.session
      targetList = (events ?? []).filter(e => e.day === newDay && e.session === newSession)
    } else {
      return
    }

    // Compute new sort orders
    const oldIndex = targetList.findIndex(e => e.id === activeId)
    const newIndex = targetList.findIndex(e => e.id === overId)

    let reordered: Event[]
    if (oldIndex !== -1 && newIndex !== -1) {
      // Same column reorder
      reordered = arrayMove(targetList, oldIndex, newIndex)
    } else {
      // Different column — insert at end
      reordered = [...targetList, activeEvent]
    }

    // Build moves
    const moves: ReorderMove[] = reordered.map((e, i) => ({
      id: e.id,
      day: newDay,
      session: newSession,
      sort_order: i + 1,
    }))

    // Only include changed moves
    const actualMoves = moves.filter(m => {
      const orig = (events ?? []).find(e => e.id === m.id)
      return orig && (orig.day !== m.day || orig.session !== m.session || orig.sort_order !== m.sort_order)
    })

    if (actualMoves.length > 0) {
      saveReorder(actualMoves, events ?? [])
    }
  }

  // ── Move-to menu (mobile) ────────────────────────────────────────────────────
  const handleMoveTo = (event: Event, day: number, session: SessionType) => {
    const targetList = (events ?? []).filter(e => e.day === day && e.session === session)
    const moves: ReorderMove[] = [{
      id: event.id,
      day,
      session,
      sort_order: targetList.length + 1,
    }]
    saveReorder(moves, events ?? [])
    setMoveMenuFor(null)
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-[var(--text-main)] flex items-center gap-2.5">
          <CalendarDays size={22} className="text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
          {t('staff.agenda.title')}
        </h1>
      </div>

      <p className="text-xs text-[var(--text-muted)] hidden sm:block">{t('staff.agenda.dragHint')}</p>

      {/* Day tabs */}
      <DayTabs maxDay={maxDay} selectedDay={selectedDay} onChange={setSelectedDay} dayCounts={dayCounts} />

      {/* Crowded warning */}
      {(dayCounts[selectedDay] ?? 0) > MAX_ITEMS_PER_DAY && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">
          <span className="text-base">⚠️</span>
          {t('staff.agenda.crowdedWarning')}
        </div>
      )}

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3">
          {/* Morning column */}
          <SortableContext
            items={morningEvents.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <SessionColumn
              id={`col-${selectedDay}-morning`}
              label={t('staff.agenda.morning')}
              items={morningEvents}
            >
              {morningEvents.map(ev => (
                <SortableCard key={ev.id} event={ev} onMove={setMoveMenuFor} />
              ))}
            </SessionColumn>
          </SortableContext>

          {/* Afternoon column */}
          <SortableContext
            items={afternoonEvents.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <SessionColumn
              id={`col-${selectedDay}-afternoon`}
              label={t('staff.agenda.afternoon')}
              items={afternoonEvents}
            >
              {afternoonEvents.map(ev => (
                <SortableCard key={ev.id} event={ev} onMove={setMoveMenuFor} />
              ))}
            </SessionColumn>
          </SortableContext>

          {/* Evening column */}
          <SortableContext
            items={eveningEvents.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <SessionColumn
              id={`col-${selectedDay}-evening`}
              label="Evening"
              items={eveningEvents}
            >
              {eveningEvents.map(ev => (
                <SortableCard key={ev.id} event={ev} onMove={setMoveMenuFor} />
              ))}
            </SessionColumn>
          </SortableContext>
        </div>
      </DndContext>

      {/* Move-to dialog (mobile) */}
      {moveMenuFor && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4"
          onClick={() => setMoveMenuFor(null)}
        >
          <div
            className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-xs p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-[var(--text-main)]">
              {t('staff.agenda.moveMenu')}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">{moveMenuFor.title_i18n.en}</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {Array.from({ length: maxDay }).map((_, i) => {
                const day = i + 1
                return (
                  <div key={day} className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)] px-2 pt-1">
                      {t('staff.agenda.dayPrefix')} {day}
                    </p>
                    <button
                      onClick={() => handleMoveTo(moveMenuFor, day, 'morning')}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
                    >
                      {t('staff.agenda.morning')}
                    </button>
                    <button
                      onClick={() => handleMoveTo(moveMenuFor, day, 'afternoon')}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
                    >
                      {t('staff.agenda.afternoon')}
                    </button>
                    <button
                      onClick={() => handleMoveTo(moveMenuFor, day, 'evening')}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
                    >
                      Evening
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setMoveMenuFor(null)}
              className="w-full px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]"
            >
              {t('staff.common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
