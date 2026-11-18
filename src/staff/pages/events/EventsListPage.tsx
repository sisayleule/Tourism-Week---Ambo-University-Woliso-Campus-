/**
 * EventsListPage.tsx — /staff/events
 *
 * Lists all events for the selected edition with:
 *  - Search by title
 *  - Filters: day, category, status, draft/published
 *  - Draft / Published badge on every row
 *  - Click to edit
 *  - "Add event" button
 *  - Link to Agenda Builder
 */

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, CalendarDays, Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrentEdition, useEvents } from '../../hooks/useStaffQueries'
import { EventStatusBadge, ContentStateBadge } from '../../components/StatusBadge'
import { LoadingSkeleton, EmptyState, FullPageSpinner } from '../../components/Loading'
import { TextInput, SelectField } from '../../components/StaffForm'
import type { EventCategory, EventStatus } from '../../../types/database'

export function EventsListPage() {
  const { t } = useTranslation()
  const { data: edition } = useCurrentEdition()
  const editionId = edition?.id ?? null
  const { data: events, isLoading, error } = useEvents(editionId)

  // Filters
  const [search,  setSearch]  = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')

  // Compute max day from edition stats or events
  const maxDay = edition?.stats?.daysCount ?? 5

  const filtered = useMemo(() => {
    if (!events) return []
    return events.filter(e => {
      if (search) {
        const q = search.toLowerCase()
        if (!e.title_i18n.en.toLowerCase().includes(q) &&
            !(e.title_i18n.am?.toLowerCase().includes(q)) &&
            !(e.title_i18n.om?.toLowerCase().includes(q))) return false
      }
      if (dayFilter && String(e.day) !== dayFilter) return false
      if (catFilter && e.category !== catFilter) return false
      if (statusFilter && e.status !== statusFilter) return false
      if (stateFilter && e.state !== stateFilter) return false
      return true
    })
  }, [events, search, dayFilter, catFilter, statusFilter, stateFilter])

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  if (error) {
    return (
      <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
        {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-xl font-bold text-[var(--text-main)] flex items-center gap-2.5">
          <CalendarDays size={22} className="text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
          {t('staff.events.title')}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to="/staff/events/agenda"
            className="px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
          >
            {t('staff.events.agenda')}
          </Link>
          <Link
            to="/staff/events/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            <Plus size={16} aria-hidden="true" />
            {t('staff.events.addEvent')}
          </Link>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('staff.events.searchPlaceholder')}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent"
            aria-label={t('staff.events.searchPlaceholder')}
          />
        </div>

        <SelectField
          value={dayFilter}
          onChange={e => setDayFilter(e.target.value)}
          aria-label={t('staff.events.filterDay')}
          className="sm:w-32"
        >
          <option value="">{t('staff.events.allDays')}</option>
          {Array.from({ length: maxDay }).map((_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {t('staff.agenda.dayPrefix')} {i + 1}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          aria-label={t('staff.events.filterCategory')}
          className="sm:w-36"
        >
          <option value="">{t('staff.events.allCategories')}</option>
          <option value="culture">{t('staff.events.catCulture')}</option>
          <option value="sports">{t('staff.events.catSports')}</option>
          <option value="academic">{t('staff.events.catAcademic')}</option>
          <option value="competition">{t('staff.events.catCompetition')}</option>
          <option value="community">{t('staff.events.catCommunity')}</option>
        </SelectField>

        <SelectField
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label={t('staff.events.filterStatus')}
          className="sm:w-32"
        >
          <option value="">{t('staff.events.allStatuses')}</option>
          <option value="scheduled">{t('staff.live.statusScheduled')}</option>
          <option value="live">{t('staff.live.statusLive')}</option>
          <option value="delayed">{t('staff.live.statusDelayed')}</option>
          <option value="cancelled">{t('staff.live.statusCancelled')}</option>
        </SelectField>

        <SelectField
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          aria-label={t('staff.events.filterState')}
          className="sm:w-32"
        >
          <option value="">{t('staff.events.all')}</option>
          <option value="draft">{t('staff.events.draftsOnly')}</option>
          <option value="published">{t('staff.events.publishedOnly')}</option>
        </SelectField>
      </div>

      {/* List */}
      {isLoading ? (
        <LoadingSkeleton lines={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('staff.common.noResults')}
          description={t('staff.events.searchPlaceholder')}
          action={
            <Link
              to="/staff/events/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors"
            >
              <Plus size={16} aria-hidden="true" />
              {t('staff.events.addEvent')}
            </Link>
          }
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(ev => (
            <Link
              key={ev.id}
              to={`/staff/events/${ev.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[#D9A441] hover:bg-[var(--bg-section-alt)] transition-colors"
            >
              {/* Day/session badge */}
              <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[var(--bg-section-alt)] text-[var(--text-main)]">
                <span className="text-[10px] uppercase text-[var(--text-muted)]">{t('staff.agenda.dayPrefix')}</span>
                <span className="font-display text-lg font-bold leading-none">{ev.day}</span>
              </div>

              {/* Title + meta */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-main)] truncate">{ev.title_i18n.en}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {ev.session === 'morning' ? t('staff.events.sessionMorning') : t('staff.events.sessionAfternoon')}
                  {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''}
                  {' · '}{t(`staff.events.cat${ev.category.charAt(0).toUpperCase()}${ev.category.slice(1)}`)}
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                <EventStatusBadge status={ev.status} />
                <ContentStateBadge state={ev.state} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
