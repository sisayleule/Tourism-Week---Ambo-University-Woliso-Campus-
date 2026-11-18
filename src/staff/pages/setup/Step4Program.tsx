/**
 * Step4Program.tsx — Day-by-day programme
 *
 * One section per day. Each day has an optional title/description (3 langs)
 * and a list of events (morning / afternoon / evening).
 * Add, edit, delete, duplicate, drag-to-reorder events.
 * Move-to-another-day via menu (mobile-friendly).
 * "Copy programme from edition…" copies events and day titles as drafts.
 */

import React, { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Copy, ChevronDown, ChevronUp,
  GripVertical, MoveRight, Loader2, ChevronRight,
  Eye, EyeOff,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  useSortable, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { I18nTabs, type I18nLang } from '../../components/I18nTabs'
import { Label, TextInput } from '../../components/StaffForm'
import { formatError, slugify } from '../../services/helpers'
import { buildEditionDays } from '../../../lib/editionDays'
import {
  useEditionDays, useUpsertEditionDay,
  useSetupEvents, useCreateSetupEvent, useUpdateSetupEvent, useDeleteSetupEvent,
  useReorderSetupEvents,
} from '../../hooks/useSetupQueries'
import type { Event, SessionType, EventCategory, VenueType, I18nJson } from '../../../types/database'
import type { EditionPublic } from '../../../types/database'
import type { SetupEventInput } from '../../services/setupService'

const SESSION_LABELS: Record<SessionType, string> = {
  morning:   'Morning',
  afternoon: 'Afternoon',
  evening:   'Evening',
}

const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: 'culture',     label: 'Culture' },
  { value: 'sports',      label: 'Sports' },
  { value: 'academic',    label: 'Academic' },
  { value: 'competition', label: 'Competition' },
  { value: 'community',   label: 'Community' },
]

// ─── Event form dialog ────────────────────────────────────────────────────────

interface EventFormDialogProps {
  editionId:  string
  maxDay:     number
  initial?:   Event
  defaultDay: number
  onClose:    () => void
}

function EventFormDialog({ editionId, maxDay, initial, defaultDay, onClose }: EventFormDialogProps) {
  const { client } = usePortal()
  const { showToast } = useToast()
  const createMut = useCreateSetupEvent(client, editionId)
  const updateMut = useUpdateSetupEvent(client, editionId)
  const isEdit = !!initial

  const [lang,    setLang]    = useState<I18nLang>('en')
  const [titleEn, setTitleEn] = useState(initial?.title_i18n?.en ?? '')
  const [titleAm, setTitleAm] = useState(initial?.title_i18n?.am ?? '')
  const [titleOm, setTitleOm] = useState(initial?.title_i18n?.om ?? '')
  const [descEn,  setDescEn]  = useState(initial?.description_i18n?.en ?? '')
  const [descAm,  setDescAm]  = useState(initial?.description_i18n?.am ?? '')
  const [descOm,  setDescOm]  = useState(initial?.description_i18n?.om ?? '')
  const [venueEn, setVenueEn] = useState(initial?.venue_name_i18n?.en ?? '')
  const [venueAm, setVenueAm] = useState(initial?.venue_name_i18n?.am ?? '')
  const [venueOm, setVenueOm] = useState(initial?.venue_name_i18n?.om ?? '')
  const [day,       setDay]       = useState(initial?.day ?? defaultDay)
  const [session,   setSession]   = useState<SessionType>(initial?.session ?? 'morning')
  const [startTime, setStartTime] = useState(initial?.start_time?.slice(0, 5) ?? '')
  const [endTime,   setEndTime]   = useState(initial?.end_time?.slice(0, 5) ?? '')
  const [category,  setCategory]  = useState<EventCategory>(initial?.category ?? 'culture')
  const [venueType, setVenueType] = useState<VenueType>(initial?.venue_type ?? 'campus')
  const [featured,  setFeatured]  = useState(initial?.featured ?? false)
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  const cls = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]'

  const handleSave = async () => {
    if (!titleEn.trim()) { setErr('English title is required.'); return }
    setSaving(true)
    try {
      const payload: SetupEventInput = {
        edition_id:        editionId,
        slug:              initial?.slug ?? slugify(titleEn),
        day,
        session,
        start_time:        startTime ? startTime + ':00' : null,
        end_time:          endTime   ? endTime   + ':00' : null,
        sort_order:        initial?.sort_order ?? 0,
        title_i18n:        { en: titleEn, am: titleAm || undefined, om: titleOm || undefined } as I18nJson,
        description_i18n:  descEn  ? { en: descEn,  am: descAm  || undefined, om: descOm  || undefined } as I18nJson : null,
        venue_name_i18n:   venueEn ? { en: venueEn, am: venueAm || undefined, om: venueOm || undefined } as I18nJson : null,
        category,
        venue_type:        venueType,
        featured,
        state:             initial?.state ?? 'draft',
      }
      if (isEdit) {
        await updateMut.mutateAsync({ eventId: initial!.id, patch: payload })
      } else {
        await createMut.mutateAsync(payload)
      }
      showToast({ type: 'success', message: isEdit ? 'Activity updated.' : 'Activity added.' })
      onClose()
    } catch (e) {
      showToast({ type: 'error', message: formatError(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[var(--surface-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-[var(--border-subtle)] max-h-[92dvh] overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
        <div className="p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[var(--text-main)]">
            {isEdit ? 'Edit activity' : 'Add activity'}
          </h3>

          <I18nTabs value={lang} onChange={setLang} />

          <div className="space-y-1.5">
            <Label htmlFor="evTitle" required={lang === 'en'}>Title</Label>
            <TextInput id="evTitle"
              value={lang === 'en' ? titleEn : lang === 'am' ? titleAm : titleOm}
              onChange={e => { const v = e.target.value; if (lang === 'en') setTitleEn(v); else if (lang === 'am') setTitleAm(v); else setTitleOm(v) }}
            />
            {err && lang === 'en' && <p className="text-xs text-red-500">{err}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evDesc">Description</Label>
            <textarea id="evDesc" rows={2} className={cls}
              value={lang === 'en' ? descEn : lang === 'am' ? descAm : descOm}
              onChange={e => { const v = e.target.value; if (lang === 'en') setDescEn(v); else if (lang === 'am') setDescAm(v); else setDescOm(v) }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evVenue">Venue name</Label>
            <TextInput id="evVenue"
              value={lang === 'en' ? venueEn : lang === 'am' ? venueAm : venueOm}
              onChange={e => { const v = e.target.value; if (lang === 'en') setVenueEn(v); else if (lang === 'am') setVenueAm(v); else setVenueOm(v) }}
            />
          </div>

          {/* Day / Session / Category — stacks on phones, 3 cols on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evDay">Day</Label>
              <select id="evDay" value={day} onChange={e => setDay(Number(e.target.value))} className={cls}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Day {d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evSess">Session</Label>
              <select id="evSess" value={session} onChange={e => setSession(e.target.value as SessionType)} className={cls}>
                {(['morning', 'afternoon', 'evening'] as SessionType[]).map(s => (
                  <option key={s} value={s}>{SESSION_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evCat">Category</Label>
              <select id="evCat" value={category} onChange={e => setCategory(e.target.value as EventCategory)} className={cls}>
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Start / End time — stacks on phones, 2 cols on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evStart">Start time</Label>
              <TextInput id="evStart" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evEnd">End time</Label>
              <TextInput id="evEnd" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}
                className="rounded border-[var(--border-subtle)] accent-[#D9A441]" />
              Featured activity
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
            <button onClick={onClose}
              className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] disabled:opacity-40 transition-colors">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable event card ──────────────────────────────────────────────────────

function SortableEventCard({
  event, onEdit, onDelete, onDuplicate, onMove, onTogglePublish, maxDay,
}: {
  event: Event
  onEdit:          () => void
  onDelete:        () => void
  onDuplicate:     () => void
  onMove:          () => void
  onTogglePublish: () => void
  maxDay:          number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id })

  const isPublished = event.state === 'published'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--surface-card)] border ${isPublished ? 'border-emerald-200 dark:border-emerald-800' : 'border-[var(--border-subtle)]'} ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-[#D9A441] z-10' : ''}`}
    >
      <button {...attributes} {...listeners}
        className="hidden sm:flex shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-muted)]"
        aria-label="Drag to reorder">
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-main)] truncate">{event.title_i18n?.en}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-muted)]">
          <span className="capitalize">{SESSION_LABELS[event.session]}</span>
          {event.start_time && <span>{event.start_time.slice(0, 5)}</span>}
          <span className="capitalize">{event.category}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${isPublished ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}>
            {event.state}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Publish / Unpublish toggle */}
        <button
          onClick={onTogglePublish}
          className={`p-1.5 rounded-lg transition-colors text-[11px] font-semibold ${
            isPublished
              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              : 'text-stone-400 hover:bg-[var(--bg-section-alt)] hover:text-emerald-600'
          }`}
          title={isPublished ? 'Unpublish (make draft)' : 'Publish'}
        >
          {isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button onClick={onEdit}      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors" title="Edit"><Pencil size={13} /></button>
        <button onClick={onDuplicate} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors" title="Duplicate"><Copy size={13} /></button>
        <button onClick={onMove}      className="sm:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors" title="Move"><MoveRight size={13} /></button>
        <button onClick={onDelete}    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ─── Day section ──────────────────────────────────────────────────────────────

function DaySection({
  day, gcDate, dayOfWeek, editionId,
  titleI18n, descI18n,
  events, maxDay,
}: {
  day:        number
  gcDate:     string
  dayOfWeek:  string
  editionId:  string
  titleI18n:  { en: string; am: string; om: string } | null
  descI18n:   { en: string; am: string; om: string } | null
  events:     Event[]
  maxDay:     number
}) {
  const { client } = usePortal()
  const { showToast } = useToast()
  const upsertDay   = useUpsertEditionDay(client, editionId)
  const createEvent = useCreateSetupEvent(client, editionId)
  const updateEvent = useUpdateSetupEvent(client, editionId)
  const deleteMut   = useDeleteSetupEvent(client, editionId)
  const reorderMut  = useReorderSetupEvents(client, editionId)

  const [open,       setOpen]       = useState(day === 1)
  const [lang,       setLang]       = useState<I18nLang>('en')
  const [titleEn,    setTitleEn]    = useState(titleI18n?.en ?? '')
  const [titleAm,    setTitleAm]    = useState(titleI18n?.am ?? '')
  const [titleOm,    setTitleOm]    = useState(titleI18n?.om ?? '')
  const [descEn,     setDescEn]     = useState(descI18n?.en ?? '')
  const [descAm,     setDescAm]     = useState(descI18n?.am ?? '')
  const [descOm,     setDescOm]     = useState(descI18n?.om ?? '')
  const [metaDirty,  setMetaDirty]  = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [addForm,    setAddForm]    = useState(false)
  const [editEvent,  setEditEvent]  = useState<Event | null>(null)
  const [delEvent,   setDelEvent]   = useState<Event | null>(null)
  const [moveEvent,  setMoveEvent]  = useState<Event | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sortedEvents = useMemo(() =>
    [...events].sort((a, b) => {
      const so = ['morning', 'afternoon', 'evening']
      const si = so.indexOf(a.session) - so.indexOf(b.session)
      return si !== 0 ? si : a.sort_order - b.sort_order
    }), [events])

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = sortedEvents.findIndex(ev => ev.id === active.id)
    const newIdx = sortedEvents.findIndex(ev => ev.id === over.id)
    const reordered = arrayMove(sortedEvents, oldIdx, newIdx)
    const moves = reordered.map((ev, idx) => ({ id: ev.id, sort_order: idx, day: ev.day, session: ev.session }))
    try {
      await reorderMut.mutateAsync(moves)
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  const handleSaveMeta = async () => {
    setSavingMeta(true)
    try {
      await upsertDay.mutateAsync({
        day,
        patch: {
          title_i18n:       titleEn ? { en: titleEn, am: titleAm || undefined, om: titleOm || undefined } : null,
          description_i18n: descEn  ? { en: descEn,  am: descAm  || undefined, om: descOm  || undefined } : null,
        },
      })
      setMetaDirty(false)
      showToast({ type: 'success', message: `Day ${day} info saved.` })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setSavingMeta(false)
    }
  }

  const handleDuplicate = async (ev: Event) => {
    try {
      await createEvent.mutateAsync({
        edition_id:       editionId,
        slug:             ev.slug + '-copy-' + Date.now(),
        day:              ev.day,
        session:          ev.session,
        start_time:       ev.start_time,
        end_time:         ev.end_time,
        sort_order:       ev.sort_order + 1,
        title_i18n:       { en: ev.title_i18n.en + ' (copy)', am: ev.title_i18n.am, om: ev.title_i18n.om } as I18nJson,
        description_i18n: ev.description_i18n,
        venue_name_i18n:  ev.venue_name_i18n,
        category:         ev.category,
        venue_type:       ev.venue_type,
        featured:         ev.featured,
        state:            'draft',
      })
      showToast({ type: 'success', message: 'Activity duplicated.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  const handleDelete = async () => {
    if (!delEvent) return
    try {
      await deleteMut.mutateAsync(delEvent.id)
      showToast({ type: 'success', message: 'Activity deleted.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setDelEvent(null)
    }
  }

  const handleTogglePublish = async (ev: Event) => {
    const newState = ev.state === 'published' ? 'draft' : 'published'
    try {
      await updateEvent.mutateAsync({ eventId: ev.id, patch: { state: newState } })
      showToast({ type: 'success', message: newState === 'published' ? 'Activity published.' : 'Activity set to draft.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  const cls = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]'

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D9A441]"
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold text-[var(--text-main)]">Day {day}</span>
          <span className="text-[11px] text-[var(--text-muted)]">{dayOfWeek} · {gcDate}</span>
          {titleEn && <span className="text-[11px] text-[#D9A441] truncate max-w-[140px]">{titleEn}</span>}
          <span className="text-[10px] text-[var(--text-muted)]">{events.length} activit{events.length !== 1 ? 'ies' : 'y'}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
      </button>

      {open && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-5">
          {/* Day metadata */}
          <div className="space-y-3">
            <I18nTabs value={lang} onChange={setLang} />
            <div className="space-y-1.5">
              <Label htmlFor={`dt-${day}`}>Day title (optional)</Label>
              <TextInput id={`dt-${day}`}
                value={lang === 'en' ? titleEn : lang === 'am' ? titleAm : titleOm}
                onChange={e => { const v = e.target.value; if (lang === 'en') setTitleEn(v); else if (lang === 'am') setTitleAm(v); else setTitleOm(v); setMetaDirty(true) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`dd-${day}`}>Day description (optional)</Label>
              <textarea id={`dd-${day}`} rows={2} className={cls}
                value={lang === 'en' ? descEn : lang === 'am' ? descAm : descOm}
                onChange={e => { const v = e.target.value; if (lang === 'en') setDescEn(v); else if (lang === 'am') setDescAm(v); else setDescOm(v); setMetaDirty(true) }}
              />
            </div>
            {metaDirty && (
              <button onClick={handleSaveMeta} disabled={savingMeta}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-[var(--text-main)] text-xs font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 transition-colors">
                {savingMeta && <Loader2 size={12} className="animate-spin" />}
                Save day info
              </button>
            )}
          </div>

          {/* Event list */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedEvents.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {sortedEvents.map(ev => (
                  <SortableEventCard
                    key={ev.id}
                    event={ev}
                    maxDay={maxDay}
                    onEdit={() => { setEditEvent(ev); setAddForm(false) }}
                    onDelete={() => setDelEvent(ev)}
                    onDuplicate={() => handleDuplicate(ev)}
                    onMove={() => setMoveEvent(ev)}
                    onTogglePublish={() => handleTogglePublish(ev)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add button */}
          {!addForm && (
            <button onClick={() => setAddForm(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:border-[#D9A441]/50 transition-colors">
              <Plus size={14} /> Add activity
            </button>
          )}
        </div>
      )}

      {/* Event form dialogs */}
      {(addForm) && (
        <EventFormDialog
          editionId={editionId}
          maxDay={maxDay}
          defaultDay={day}
          onClose={() => setAddForm(false)}
        />
      )}
      {editEvent && (
        <EventFormDialog
          editionId={editionId}
          maxDay={maxDay}
          initial={editEvent}
          defaultDay={editEvent.day}
          onClose={() => setEditEvent(null)}
        />
      )}

      {/* Move-to-day menu */}
      {moveEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full sm:max-w-xs bg-[var(--surface-card)] rounded-t-2xl sm:rounded-2xl p-5 space-y-3 border border-[var(--border-subtle)]">
            <p className="text-sm font-semibold text-[var(--text-main)]">Move "{moveEvent.title_i18n?.en}" to…</p>
            <div className="space-y-1">
              {(['morning', 'afternoon', 'evening'] as SessionType[]).map(s => (
                <button key={s} onClick={() => {
                  // just update session
                  client.from('events').update({ session: s, day: moveEvent.day }).eq('id', moveEvent.id)
                    .then(() => { setMoveEvent(null); showToast({ type: 'success', message: 'Moved.' }) })
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-[var(--bg-section-alt)] text-sm transition-colors">
                  {SESSION_LABELS[s]} (Day {moveEvent.day})
                </button>
              ))}
              {Array.from({ length: maxDay }, (_, i) => i + 1).filter(d => d !== moveEvent.day).map(d => (
                <button key={d} onClick={() => {
                  client.from('events').update({ day: d }).eq('id', moveEvent.id)
                    .then(() => { setMoveEvent(null); showToast({ type: 'success', message: `Moved to Day ${d}.` }) })
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-[var(--bg-section-alt)] text-sm transition-colors">
                  Day {d}
                </button>
              ))}
            </div>
            <button onClick={() => setMoveEvent(null)}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!delEvent}
        title="Delete activity?"
        message={`"${delEvent?.title_i18n?.en ?? ''}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDelEvent(null)}
      />
    </div>
  )
}

// ─── Main step ────────────────────────────────────────────────────────────────

interface Props {
  edition: EditionPublic
}

export function Step4Program({ edition }: Props) {
  const { client } = usePortal()
  const { data: dbDays }  = useEditionDays(client, edition.id)
  const { data: events }  = useSetupEvents(client, edition.id)

  const calendarDays = useMemo(
    () => buildEditionDays(edition.start_date, edition.end_date),
    [edition.start_date, edition.end_date]
  )

  if (!calendarDays.length) {
    return (
      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        Please complete Step 2 (Dates) before setting up the day programme.
      </div>
    )
  }

  const dayMetaMap: Record<number, { title: { en: string; am: string; om: string } | null; desc: { en: string; am: string; om: string } | null }> = {}
  for (const d of dbDays ?? []) {
    dayMetaMap[d.day] = { title: d.title_i18n as any, desc: d.description_i18n as any }
  }

  const eventsByDay: Record<number, Event[]> = {}
  for (const ev of events ?? []) {
    if (!eventsByDay[ev.day]) eventsByDay[ev.day] = []
    eventsByDay[ev.day].push(ev)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">
        {calendarDays.length} day{calendarDays.length !== 1 ? 's' : ''} · add activities to each day.
      </p>
      {calendarDays.map(d => (
        <DaySection
          key={d.day}
          day={d.day}
          gcDate={d.gc}
          dayOfWeek={d.dayOfWeek}
          editionId={edition.id}
          titleI18n={dayMetaMap[d.day]?.title ?? null}
          descI18n={dayMetaMap[d.day]?.desc ?? null}
          events={eventsByDay[d.day] ?? []}
          maxDay={calendarDays.length}
        />
      ))}
    </div>
  )
}
