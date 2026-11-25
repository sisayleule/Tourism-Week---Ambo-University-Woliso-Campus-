import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  Download,
  MapPin,
  Printer,
  Sparkles,
  Star,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSkeleton } from '../components/common/StateViews';
import { StatusBadge } from '../components/common/StatusBadge';
import { TiletDivider } from '../components/common/TiletDivider';
import { useEdition, useEditionDays, useEvents } from '../hooks/useTourismQueries';
import { buildEditionDays } from '../lib/editionDays';
import { formatDualDate } from '../lib/ethiopianCalendar';
import { downloadICSFile, generateICS } from '../lib/icsGenerator';
import { EventItem, Language } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Today's date string in Africa/Addis_Ababa (UTC+3, no DST). */
function todayAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * Given the edition start date and an array of day numbers that have content,
 * return the 1-based day number to show by default:
 *  - If the edition is live (today falls between start and end), return today's day.
 *  - Otherwise return the first day that has content.
 *  - Falls back to 1.
 */
function defaultDay(
  startDateGC: string | undefined,
  endDateGC: string | undefined,
  contentDays: number[],
): number {
  if (!startDateGC || !contentDays.length) return 1;
  const today = todayAddis();
  if (today >= startDateGC && today <= (endDateGC ?? startDateGC)) {
    const startMs = new Date(startDateGC + 'T00:00:00Z').getTime();
    const todayMs = new Date(today + 'T00:00:00Z').getTime();
    const dayNum  = Math.round((todayMs - startMs) / 86_400_000) + 1;
    // If today's day has content, use it; otherwise fall through to first with content.
    if (contentDays.includes(dayNum)) return dayNum;
  }
  return contentDays[0] ?? 1;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Schedule: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: edition } = useEdition();
  const { data: events, isLoading } = useEvents();
  const { data: editionDaysDb } = useEditionDays();

  // ── Day-title map from edition_days DB rows ───────────────────────────────
  const dayTitleMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const d of editionDaysDb ?? []) {
      const title = (d.titleI18n as Record<string, string> | null)?.[currentLang]
        ?? (d.titleI18n as Record<string, string> | null)?.en ?? '';
      if (title) map[d.day] = title;
    }
    return map;
  }, [editionDaysDb, currentLang]);

  // ── All calendar days derived from edition dates (up to 31) ──────────────
  const allDays = useMemo(
    () => buildEditionDays(edition?.startDateGC, edition?.endDateGC),
    [edition?.startDateGC, edition?.endDateGC],
  );

  // ── Visible days: has a day title OR at least one published activity ───────
  const visibleDays = useMemo(() => {
    const daysWithEvents = new Set((events ?? []).map((e) => e.day));
    return allDays.filter((d) => dayTitleMap[d.day] !== undefined || daysWithEvents.has(d.day));
  }, [allDays, events, dayTitleMap]);

  // ── Today's day number (Africa/Addis_Ababa), for highlight ───────────────
  const todayDayNum = useMemo(() => {
    if (!edition?.startDateGC || !edition?.endDateGC) return null;
    const today = todayAddis();
    if (today < edition.startDateGC || today > edition.endDateGC) return null;
    const startMs = new Date(edition.startDateGC + 'T00:00:00Z').getTime();
    const todayMs = new Date(today + 'T00:00:00Z').getTime();
    return Math.round((todayMs - startMs) / 86_400_000) + 1;
  }, [edition]);

  // ── Default + validated active day ───────────────────────────────────────
  const contentDays = useMemo(() => visibleDays.map((d) => d.day), [visibleDays]);

  const rawDayParam = searchParams.get('day');
  const dayParam    = rawDayParam !== null ? parseInt(rawDayParam, 10) : null;
  const maxDay      = visibleDays.length ? visibleDays[visibleDays.length - 1].day : 1;

  const fallbackDay = useMemo(
    () => defaultDay(edition?.startDateGC, edition?.endDateGC, contentDays),
    [edition?.startDateGC, edition?.endDateGC, contentDays],
  );

  const isInvalidParam =
    dayParam !== null && (isNaN(dayParam) || dayParam < 1 || dayParam > maxDay || !contentDays.includes(dayParam));
  const activeDay = isInvalidParam || dayParam === null ? fallbackDay : dayParam;

  const handleDaySelect = (dayNum: number) => {
    setSearchParams({ day: dayNum.toString() });
  };

  // ── Active day data ───────────────────────────────────────────────────────
  const activeDayMeta    = visibleDays.find((d) => d.day === activeDay) ?? visibleDays[0];
  const activeDayEvents  = (events ?? []).filter((e) => e.day === activeDay);

  // Sort each session: by startTime first, then sort_order (not in type, use original array order)
  const sortByTime = (arr: EventItem[]) =>
    [...arr].sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });

  const morningEvents   = sortByTime(activeDayEvents.filter((e) => e.session === 'morning'));
  const afternoonEvents = sortByTime(activeDayEvents.filter((e) => e.session === 'afternoon'));
  const eveningEvents   = sortByTime(activeDayEvents.filter((e) => e.session === 'evening'));

  // ── Calendar export ───────────────────────────────────────────────────────
  const handleDownloadFullWeekICS = () => {
    if (!events) return;
    const name = edition?.editionNameI18n?.en ?? 'Woliso Tourism Week';
    const icsString = generateICS(events, name, edition?.startDateGC);
    downloadICSFile(icsString, 'woliso-tourism-week-full-programme.ics');
  };

  const handleDownloadSingleEventICS = (event: EventItem) => {
    const icsString = generateICS([event], event.titleI18n.en, edition?.startDateGC);
    downloadICSFile(icsString, `${event.slug}.ics`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
            <span>Ambo University Woliso Campus</span>
            <span>·</span>
            <span>
              {edition?.dateRangeDisplayI18n?.[currentLang] ??
               edition?.dateRangeDisplayI18n?.en ??
               ''}
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
            {t('schedule.title')}
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            {t('schedule.subtitle')}
          </p>
        </div>

        {/* Global utilities */}
        <div className="flex items-center gap-2 shrink-0 print:hidden overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={handleDownloadFullWeekICS}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 hover:border-[#0F3D2E] hover:text-[#0F3D2E] transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-[#0F3D2E] dark:text-[#D9A441]" />
            <span>{t('schedule.addToCalendar')}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 hover:border-[#0F3D2E] transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{t('schedule.printView')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              alert(
                'Official printable PDF brochure will be available for download prior to the celebration opening. Please use the Print Schedule or Calendar Export options.'
              );
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl bg-[#0F3D2E] text-white hover:bg-[#0A2A20] transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t('schedule.downloadPdf')}</span>
          </button>
        </div>
      </div>

      {/* ── Invalid ?day notice ───────────────────────────────────────── */}
      {isInvalidParam && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          Day {dayParam} is not in the programme. Showing{' '}
          {todayDayNum === fallbackDay ? "today's" : 'the first available'} day instead.
        </div>
      )}

      {/* ── Sticky day-tab strip ──────────────────────────────────────── */}
      {/*  top offset matches the three Navbar heights: 60/68/76 px       */}
      <div className="sticky top-[60px] sm:top-[68px] lg:top-[76px] z-30 bg-[#FAF7F0]/95 dark:bg-[#0B1612]/95 backdrop-blur-sm py-2 border-b border-stone-200/80 dark:border-stone-800/80 print:hidden -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div
          className="flex items-stretch gap-1.5 overflow-x-auto pb-1 no-scrollbar"
          role="tablist"
          aria-label="Programme days"
        >
          {visibleDays.map((dayMeta) => {
            const isActive  = activeDay === dayMeta.day;
            const isToday   = todayDayNum === dayMeta.day;
            const dayTitle  = dayTitleMap[dayMeta.day];

            return (
              <button
                key={dayMeta.day}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleDaySelect(dayMeta.day)}
                /* Min-width keeps narrow days touchable on 360 px phones even
                   when there are 12 tabs; overflow-x-auto lets them scroll. */
                className={`relative flex-none min-w-[72px] px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex flex-col items-start gap-0.5 ${
                  isActive
                    ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20] shadow-sm'
                    : 'bg-white dark:bg-stone-900/60 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
                }`}
              >
                {/* "Today" badge */}
                {isToday && (
                  <span
                    className={`absolute -top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/30 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    Today
                  </span>
                )}

                {/* Day number */}
                <span className="text-[11px] font-bold">
                  {t('schedule.dayPrefix')} {dayMeta.day}
                </span>

                {/* E.C. short + weekday */}
                <span
                  className={`text-[10px] font-normal leading-tight ${
                    isActive ? 'text-white/80 dark:text-stone-900/80' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {dayMeta.ecShort} · {dayMeta.dayOfWeek.slice(0, 3)}
                </span>

                {/* Gregorian date */}
                <span
                  className={`text-[9px] font-normal leading-tight ${
                    isActive ? 'text-white/60 dark:text-stone-900/60' : 'text-stone-400 dark:text-stone-500'
                  }`}
                >
                  {dayMeta.gc.slice(5).replace('-', '/')}
                </span>

                {/* Day title (from edition_days) */}
                {dayTitle && (
                  <span
                    className={`text-[9px] leading-tight truncate max-w-[80px] font-medium ${
                      isActive ? 'text-[#D9A441] dark:text-stone-900' : 'text-stone-400 dark:text-stone-500'
                    }`}
                    title={dayTitle}
                  >
                    {dayTitle}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected day info banner ──────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0F3D2E]/10 dark:bg-[#D9A441]/10 flex items-center justify-center text-[#0F3D2E] dark:text-[#D9A441] shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
              {t('schedule.dayPrefix')} {activeDay}
              {dayTitleMap[activeDay] && (
                <> · <span className="text-[#0F3D2E] dark:text-[#D9A441]">{dayTitleMap[activeDay]}</span></>
              )}
              {activeDayMeta && (
                <> · {formatDualDate(activeDayMeta.ec, activeDayMeta.gc, currentLang)}</>
              )}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Free public entry for all sessions · Campus &amp; Woliso Town
            </p>
          </div>
        </div>
      </div>

      {/* ── Sessions ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : activeDayEvents.length === 0 ? (
        <EmptyState
          title={`Day ${activeDay} programme coming soon`}
          description="Events for this day haven't been published yet. Check back shortly or view the full schedule."
        />
      ) : (
        <div className="space-y-12">
          <SessionBlock
            label={t('schedule.morningSession')}
            events={morningEvents}
            currentLang={currentLang}
            t={t}
            onAddToCalendar={handleDownloadSingleEventICS}
          />
          <SessionBlock
            label={t('schedule.afternoonSession')}
            events={afternoonEvents}
            currentLang={currentLang}
            t={t}
            onAddToCalendar={handleDownloadSingleEventICS}
          />
          {/* Evening only shown when it has at least one item */}
          {eveningEvents.length > 0 && (
            <SessionBlock
              label={t('schedule.eveningSession', { defaultValue: 'Evening' })}
              events={eveningEvents}
              currentLang={currentLang}
              t={t}
              onAddToCalendar={handleDownloadSingleEventICS}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── SessionBlock ─────────────────────────────────────────────────────────────

interface SessionBlockProps {
  label: string;
  events: EventItem[];
  currentLang: Language;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, opts?: any) => string;
  onAddToCalendar: (evt: EventItem) => void;
}

const SessionBlock: React.FC<SessionBlockProps> = ({ label, events, currentLang, t, onAddToCalendar }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">{label}</h3>
      <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
    </div>
    {events.length === 0 ? (
      <p className="text-xs text-stone-500 italic py-2">{t('schedule.noEvents')}</p>
    ) : (
      <div className="grid grid-cols-1 gap-4">
        {events.map((evt) => (
          <ScheduleCard
            key={evt.id}
            event={evt}
            currentLang={currentLang}
            onAddToCalendar={() => onAddToCalendar(evt)}
          />
        ))}
      </div>
    )}
  </div>
);

// ─── ScheduleCard ─────────────────────────────────────────────────────────────

interface ScheduleCardProps {
  event: EventItem;
  currentLang: Language;
  onAddToCalendar: () => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({ event, currentLang, onAddToCalendar }) => {
  const { t } = useTranslation();

  return (
    <article className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700 transition-all flex flex-col md:flex-row md:items-start gap-6">

      {/* Optional event image */}
      {event.image && (() => {
        const containSlugs = new Set([
          '7-annual-tourism-week-miss-mr-tourism-pageant',
          '7-annual-tourism-week-guest-tour-woliso-destinations',
        ]);
        const useContain = containSlugs.has(event.slug);
        return (
          <div className={`shrink-0 w-full md:w-40 h-28 rounded-xl overflow-hidden ${useContain ? 'bg-stone-200 dark:bg-stone-800' : 'bg-stone-100 dark:bg-stone-900'}`}>
            <img
              src={event.image}
              alt={event.titleI18n.en}
              className={`w-full h-full ${useContain ? 'object-contain' : 'object-cover'}`}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== window.location.origin + '/assets/aistudio/image_b3b470e9.png') {
                  img.src = '/assets/aistudio/image_b3b470e9.png';
                }
              }}
            />
          </div>
        );
      })()}

      <div className="flex-1 space-y-3 min-w-0 overflow-hidden">
        {/* Metadata line */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <span className="font-semibold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">
            {event.category}
          </span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{event.venueType} Venue</span>
          {event.startTime && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.startTime}{event.endTime && ` – ${event.endTime}`}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <StatusBadge status={event.status} />
          {event.featured && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-[#D9A441] font-semibold">
                <Star className="h-3 w-3 fill-current" />
                Featured
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <h4 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
          {event.titleI18n[currentLang] || event.titleI18n.en}
        </h4>

        {/* Secondary titles */}
        {currentLang !== 'am' && (
          <p className="font-ethiopic text-xs text-stone-500 dark:text-stone-400">{event.titleI18n.am}</p>
        )}
        {currentLang !== 'om' && (
          <p className="text-xs text-stone-500 dark:text-stone-400">{event.titleI18n.om}</p>
        )}

        {/* Description */}
        <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          {event.descriptionI18n[currentLang] || event.descriptionI18n.en}
        </p>

        {/* Delayed / Cancelled note */}
        {event.statusNoteI18n && (event.status === 'delayed' || event.status === 'cancelled') && (
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            {event.statusNoteI18n[currentLang] || event.statusNoteI18n.en}
          </p>
        )}

        {/* Sub-events */}
        {event.subEvents && event.subEvents.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
              Sub-Sessions &amp; Activities:
            </p>
            <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300 pl-4 list-disc">
              {event.subEvents.map((sub, idx) => (
                <li key={idx}>
                  <span className="font-medium">
                    {sub.titleI18n[currentLang] || sub.titleI18n.en}
                  </span>
                  {sub.category && (
                    <span className="ml-2 text-stone-400">({sub.category})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Venue */}
        <div className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300 pt-1">
          <MapPin className="h-4 w-4 text-[#0F3D2E] dark:text-[#D9A441] shrink-0" />
          <span>{event.venueNameI18n[currentLang] || event.venueNameI18n.en}</span>
        </div>
      </div>

      {/* Add to calendar button */}
      <div className="flex md:flex-col items-center gap-2 shrink-0 pt-2 md:pt-0">
        <button
          type="button"
          onClick={onAddToCalendar}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 transition-colors whitespace-nowrap"
          title="Download calendar event file (.ics)"
        >
          <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
          <span>{t('schedule.addToCalendar')}</span>
        </button>
      </div>
    </article>
  );
};
