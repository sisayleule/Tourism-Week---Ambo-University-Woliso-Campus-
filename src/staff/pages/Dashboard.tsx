/**
 * Dashboard.tsx — /staff (index)
 *
 * Phase 3 real dashboard:
 *  - Edition status card (upcoming: days until start, live: today's agenda, past: finished)
 *  - Today's events (Africa/Addis_Ababa date) with live status badges
 *  - Alerts: anything Live, Delayed or Cancelled right now
 *  - Draft events count
 *  - Live announcements count
 *  - Unread messages count (links to Messages placeholder)
 *  - Quick actions: Add event, Change live status, Post announcement
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Radio,
  Megaphone,
  FileText,
  MessageSquare,
  PlusCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileEdit,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDashboardData } from '../hooks/useStaffQueries'
import { useNeedsReviewCount } from '../hooks/useSectionsQueries'
import { computeTodayDay, daysUntilStart } from '../services/dashboardService'
import { useAuth } from '../auth/AuthProvider'
import { EventStatusBadge } from '../components/StatusBadge'
import { WebsiteSyncDashboardCard } from '../components/WebsiteSyncBar'
import { LoadingSkeleton, FullPageSpinner } from '../components/Loading'
import { usePortal } from '../context/PortalContext'

export function Dashboard() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { client, basePath } = usePortal()
  const { data, isLoading, error } = useDashboardData(null)
  const { data: needsReview = 0 } = useNeedsReviewCount(client)

  const greeting = profile?.full_name ? `Welcome, ${profile.full_name}` : 'Welcome'

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  if (error || !data) {
    return (
      <div className="space-y-6">
        <DashboardHeader greeting={greeting} role={profile?.role} />
        <ErrorBanner message={error?.message ?? t('staff.common.errorTitle')} />
      </div>
    )
  }

  const { edition, events, announcements, unreadMessages } = data

  // ── Edition status computation ──────────────────────────────────────────────
  const editionStatus = edition?.status ?? 'upcoming'
  const todayDay = edition
    ? computeTodayDay(edition.start_date, edition.end_date)
    : null
  const daysLeft = edition ? daysUntilStart(edition.start_date) : null

  // Today's events
  const todayEvents = todayDay
    ? events.filter(e => e.day === todayDay).sort((a, b) =>
        a.session === b.session
          ? a.sort_order - b.sort_order
          : a.session === 'morning' ? -1 : 1
      )
    : []

  // Alerts: live, delayed, cancelled
  const alerts = events.filter(
    e => e.status === 'live' || e.status === 'delayed' || e.status === 'cancelled'
  )

  // Draft events
  const draftCount = events.filter(e => e.state === 'draft').length

  // Live announcements (published, within window, not expired)
  const now = Date.now()
  const liveAnnouncements = announcements.filter(a => {
    if (a.state !== 'published') return false
    const start = new Date(a.starts_at).getTime()
    const expire = a.expires_at ? new Date(a.expires_at).getTime() : null
    return start <= now && (expire === null || expire > now)
  })

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Greeting ─────────────────────────────────────────────────────────── */}
      <DashboardHeader greeting={greeting} role={profile?.role} />

      {/* ── Edition status card ──────────────────────────────────────────────── */}
      {edition ? (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CalendarDays size={20} className="text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-base font-bold text-[var(--text-main)]">
                  {edition.title_i18n.en}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {edition.date_range_display_i18n?.en ?? `${edition.start_date} — ${edition.end_date}`}
                </p>
              </div>
            </div>
            <EditionStatusBadge status={editionStatus} />
          </div>

          {/* Status-specific content */}
          {editionStatus === 'upcoming' && daysLeft !== null && daysLeft > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <Clock size={18} className="text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <p className="text-sm text-[var(--text-main)]">
                <span className="font-bold text-2xl">{daysLeft}</span>
                <span className="ml-1.5">{t('staff.dashboard.daysLeft')} · {t('staff.dashboard.editionUpcoming')}</span>
              </p>
            </div>
          )}
          {editionStatus === 'live' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <Radio size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <p className="text-sm text-[var(--text-main)]">{t('staff.dashboard.editionLive')}</p>
            </div>
          )}
          {editionStatus === 'past' && (
            <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-[var(--bg-section-alt)]">
              <p className="text-sm text-[var(--text-muted)]">{t('staff.dashboard.editionPast')}</p>
              <Link
                to="/staff/events"
                className="text-sm font-medium text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
              >
                {t('staff.dashboard.reviewEvents')}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5">
          <p className="text-sm text-[var(--text-muted)]">{t('staff.dashboard.noEdition')}</p>
        </div>
      )}

      {/* ── Website sync ─────────────────────────────────────────────────────── */}
      <WebsiteSyncDashboardCard />

      {/* ── Content needing review ─────────────────────────────────────── */}
      {needsReview > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <div className="flex items-center gap-2">
            <FileEdit size={18} className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Content needing review: <strong>{needsReview}</strong> section{needsReview !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            to={`${basePath}/site`}
            className="text-xs font-semibold text-amber-700 dark:text-amber-300 underline hover:no-underline shrink-0"
          >
            Review →
          </Link>
        </div>
      )}

      {/* ── Quick actions ────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
          {t('staff.dashboard.quickActions')}
        </h3>
        <div className="flex flex-wrap gap-2.5">
          <QuickActionLink to="/staff/events/new" icon={<PlusCircle size={16} />} label={t('staff.dashboard.addEvent')} />
          <QuickActionLink to="/staff/live" icon={<Radio size={16} />} label={t('staff.dashboard.changeLiveStatus')} />
          <QuickActionLink to="/staff/announcements" icon={<Megaphone size={16} />} label={t('staff.dashboard.postAnnouncement')} />
        </div>
      </div>

      {/* ── Stats grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<FileText size={20} />}
          label={t('staff.dashboard.draftCount')}
          value={draftCount}
          color="amber"
          linkTo="/staff/events"
        />
        <StatCard
          icon={<Megaphone size={20} />}
          label={t('staff.dashboard.liveAnnouncements')}
          value={liveAnnouncements.length}
          color="emerald"
          linkTo="/staff/announcements"
        />
        {/* Messages stat — shown to everyone */}
        <StatCard
          icon={<MessageSquare size={20} />}
          label={t('staff.dashboard.unreadMessages')}
          value={unreadMessages}
          color="blue"
          linkTo="/staff/messages"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label={t('staff.dashboard.liveAlerts')}
          value={alerts.length}
          color={alerts.length > 0 ? 'red' : 'muted'}
          linkTo="/staff/live"
        />
      </div>

      {/* ── Alerts (status changes) ─────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" aria-hidden="true" />
            {t('staff.dashboard.liveAlerts')}
          </h3>
          <div className="space-y-1.5">
            {alerts.map(ev => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)]"
              >
                <span className="text-sm text-[var(--text-main)] truncate">{ev.title_i18n.en}</span>
                <EventStatusBadge status={ev.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Today's events ───────────────────────────────────────────────────── */}
      {editionStatus === 'live' && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
            <CalendarDays size={16} className="text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
            {t('staff.dashboard.todayEvents')}
          </h3>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4">{t('staff.dashboard.noEventsToday')}</p>
          ) : (
            <div className="space-y-1.5">
              {todayEvents.map(ev => (
                <Link
                  key={ev.id}
                  to={`/staff/events/${ev.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-section-alt)] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-main)] truncate">{ev.title_i18n.en}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {ev.session === 'morning' ? t('staff.events.sessionMorning') : t('staff.events.sessionAfternoon')}
                      {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''}
                    </p>
                  </div>
                  <EventStatusBadge status={ev.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DashboardHeader({ greeting, role }: { greeting: string; role?: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F3D2E] text-[#D9A441] shrink-0">
        <CheckCircle2 size={22} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">{greeting}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Organizer · Organizer Portal
        </p>
      </div>
    </div>
  )
}

function EditionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    upcoming: { label: 'Upcoming', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    live:     { label: 'Live', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 animate-pulse' },
    past:     { label: 'Past', classes: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400' },
  }
  const c = config[status] ?? config.upcoming
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${c.classes}`}>
      {c.label}
    </span>
  )
}

function QuickActionLink({
  to,
  icon,
  label,
}: {
  to:   string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-medium hover:bg-[#0A2A20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
    >
      {icon}
      {label}
    </Link>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
  linkTo,
}: {
  icon:    React.ReactNode
  label:   string
  value:   number
  color:   'amber' | 'emerald' | 'blue' | 'red' | 'muted'
  linkTo:  string
}) {
  const colorMap: Record<string, string> = {
    amber:   'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20',
    blue:    'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
    red:     'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
    muted:   'text-[var(--text-muted)] bg-[var(--bg-section-alt)]',
  }
  return (
    <Link
      to={linkTo}
      className="flex flex-col gap-2 p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[#D9A441] transition-colors"
    >
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-[var(--text-main)]">{value}</p>
        <p className="text-xs text-[var(--text-muted)] leading-tight">{label}</p>
      </div>
    </Link>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
      {message}
    </div>
  )
}
