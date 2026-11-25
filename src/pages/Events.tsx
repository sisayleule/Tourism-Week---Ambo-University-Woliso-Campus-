import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowUpDown, Calendar, Compass, Filter, MapPin, Search, Sparkles, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSkeleton } from '../components/common/StateViews';
import { StatusBadge } from '../components/common/StatusBadge';
import { useEdition, useEvents } from '../hooks/useTourismQueries';
import { buildEditionDays } from '../lib/editionDays';
import { resolveImage } from '../lib/resolveImage';
import { Language } from '../types';

export const Events: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const { data: events, isLoading } = useEvents();
  const { data: edition } = useEdition();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDay, setSelectedDay]           = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const [sortOrder, setSortOrder]               = useState<'day-asc' | 'day-desc'>('day-asc');

  // ── Day list derived from the edition's start/end dates ──────────────────
  const editionDays = useMemo(
    () => buildEditionDays(edition?.startDateGC, edition?.endDateGC),
    [edition?.startDateGC, edition?.endDateGC],
  );

  // Only show days that have at least one published activity.
  const daysWithEvents = useMemo(() => {
    const nums = new Set((events ?? []).map((e) => e.day));
    return editionDays.filter((d) => nums.has(d.day));
  }, [editionDays, events]);

  // ── Category list derived from actual event data ──────────────────────────
  const availableCategories = useMemo(() => {
    const cats = new Set((events ?? []).map((e) => e.category));
    return Array.from(cats).sort();
  }, [events]);

  // ── Whether any filter is active ─────────────────────────────────────────
  const anyFilterActive = selectedCategory !== 'all' || selectedDay !== 'all' || searchQuery.trim() !== '';

  // ── Filtered + sorted events ──────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!events) return [];

    let result = events.filter((evt) => {
      // Day filter
      if (selectedDay !== 'all' && evt.day !== selectedDay) return false;

      // Category filter
      if (selectedCategory !== 'all' && evt.category !== selectedCategory) return false;

      // Search filter — matches title / description / venue in all three languages
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle =
          evt.titleI18n.en.toLowerCase().includes(q) ||
          evt.titleI18n.am.toLowerCase().includes(q) ||
          evt.titleI18n.om.toLowerCase().includes(q);
        const matchDesc =
          evt.descriptionI18n.en.toLowerCase().includes(q) ||
          evt.descriptionI18n.am.toLowerCase().includes(q) ||
          evt.descriptionI18n.om.toLowerCase().includes(q);
        const matchVenue = evt.venueNameI18n.en.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchVenue) return false;
      }

      return true;
    });

    // Sort: featured first only when no filter is active
    result = result.sort((a, b) => {
      if (!anyFilterActive) {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
      }
      // Primary: day order
      const dayDiff = sortOrder === 'day-asc' ? a.day - b.day : b.day - a.day;
      if (dayDiff !== 0) return dayDiff;
      // Secondary: session order morning → afternoon → evening
      const sessionOrder: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };
      return (sessionOrder[a.session] ?? 3) - (sessionOrder[b.session] ?? 3);
    });

    return result;
  }, [events, selectedDay, selectedCategory, searchQuery, sortOrder, anyFilterActive]);

  // ── Dynamic sort label uses actual max day ────────────────────────────────
  const maxDay = daysWithEvents.length ? daysWithEvents[daysWithEvents.length - 1].day : 1;
  const sortLabel = sortOrder === 'day-asc'
    ? `Day 1 → ${maxDay}`
    : `Day ${maxDay} → 1`;

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedDay('all');
    setSearchQuery('');
  };

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  /* ── Body-scroll lock for filter sheet ── */
  React.useEffect(() => {
    if (filterSheetOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [filterSheetOpen]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-6">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
          <Compass className="h-4 w-4" aria-hidden="true" />
          <span>Full Event Catalogue</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
          {t('events.title')}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          {t('events.subtitle')}
        </p>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="space-y-3">

        {/* Row 1: Search + Sort + Filter button */}
        <div className="flex items-center gap-2">
          {/* Search — grows to fill available space */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('events.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-base sm:text-sm bg-white dark:bg-[#12221C] border border-stone-300 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E] dark:focus:ring-[#D9A441]"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Sort — icon-only on phones */}
          <button
            type="button"
            onClick={() => setSortOrder((p) => (p === 'day-asc' ? 'day-desc' : 'day-asc'))}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-800 bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-200 hover:border-stone-400 shadow-xs shrink-0"
            aria-label={`Sort: ${sortLabel}`}
            title={`Sort: ${sortLabel}`}
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{sortLabel}</span>
          </button>

          {/* Mobile filter toggle */}
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-800 bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-200 hover:border-stone-400 shadow-xs shrink-0 relative"
            aria-expanded={filterSheetOpen}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filters
            {anyFilterActive && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0F3D2E] text-white text-[9px] font-bold flex items-center justify-center">!</span>
            )}
          </button>

          {/* Reset — only on sm+ when filters are active */}
          {anyFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-800 bg-white dark:bg-[#12221C] text-stone-500 hover:text-stone-900 dark:hover:text-white hover:border-stone-400 shadow-xs shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('events.resetFilters')}
            </button>
          )}
        </div>

        {/* Row 2: Day + category chips — hidden on mobile (shown in sheet) */}
        <div className="hidden sm:block space-y-2">
          {daysWithEvents.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 shrink-0">{t('schedule.dayPrefix')}:</span>
              <button
                type="button"
                onClick={() => setSelectedDay('all')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  selectedDay === 'all'
                    ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20] shadow-xs'
                    : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
                }`}
              >
                {t('events.all')}
              </button>
              {daysWithEvents.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDay(d.day)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                    selectedDay === d.day
                      ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20] shadow-xs'
                      : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
                  }`}
                >
                  Day {d.day}<span className="ml-1 opacity-60 font-normal">{d.ecShort}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[36px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20] shadow-xs'
                  : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
              }`}
            >
              {t('events.all')}
            </button>
            {availableCategories.map((cat) => {
              const isActive = selectedCategory === cat;
              const label = t(`events.${cat}`, { defaultValue: '' }) || cat.charAt(0).toUpperCase() + cat.slice(1);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[36px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20] shadow-xs'
                      : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile filter bottom sheet ────────────────────────────────── */}
      {filterSheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="sm:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            aria-hidden="true"
            onClick={() => setFilterSheetOpen(false)}
          />
          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter events"
            className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-[#12221C] rounded-t-3xl border-t border-stone-200 dark:border-stone-800 shadow-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-display font-bold text-base text-stone-900 dark:text-stone-100">Filters</h3>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[60dvh] overflow-y-auto">
              {/* Day filter */}
              {daysWithEvents.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">{t('schedule.dayPrefix')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDay('all')}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        selectedDay === 'all'
                          ? 'bg-[#0F3D2E] text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {t('events.all')}
                    </button>
                    {daysWithEvents.map((d) => (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setSelectedDay(d.day)}
                        className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          selectedDay === d.day
                            ? 'bg-[#0F3D2E] text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        Day {d.day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category filter */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Category</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-[#0F3D2E] text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {t('events.all')}
                  </button>
                  {availableCategories.map((cat) => {
                    const isActive = selectedCategory === cat;
                    const label = t(`events.${cat}`, { defaultValue: '' }) || cat.charAt(0).toUpperCase() + cat.slice(1);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#0F3D2E] text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sheet footer */}
            <div className="flex items-center gap-3 px-5 pt-3 pb-4 border-t border-stone-100 dark:border-stone-800">
              {anyFilterActive && (
                <button
                  type="button"
                  onClick={() => { resetFilters(); setFilterSheetOpen(false); }}
                  className="flex-1 py-3 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-600 dark:text-stone-300"
                >
                  {t('events.resetFilters')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#0F3D2E] text-white text-sm font-bold"
              >
                Show {filteredEvents.length} Result{filteredEvents.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Events Grid ───────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title={t('events.noResults')}
          description="Try adjusting your search query or selecting a different filter."
          action={{ label: t('events.resetFilters'), onClick: resetFilters }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => (
            <article
              key={evt.id}
              className="flex flex-col justify-between rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:shadow-md transition-all group overflow-hidden"
            >
              {/* Image — same fit as Festival Highlights cards */}
              {(() => {
                // These events have portrait/tall photos — contain them so nothing is cropped.
                const containSlugs = new Set([
                  '7-annual-tourism-week-miss-mr-tourism-pageant',
                  '7-annual-tourism-week-guest-tour-woliso-destinations',
                ]);
                const useContain = containSlugs.has(evt.slug);
                const ri = resolveImage(evt.image || '/assets/aistudio/image_b3b470e9.png');
                return (
                  <div
                    className={`w-full overflow-hidden${useContain ? ' bg-stone-200 dark:bg-stone-800' : ' bg-stone-100 dark:bg-stone-900'}`}
                    style={{ aspectRatio: '16/9' }}
                  >
                    <img
                      src={ri.src}
                      srcSet={ri.srcSet || undefined}
                      sizes={ri.srcSet ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw' : undefined}
                      alt={evt.titleI18n.en}
                      loading="lazy"
                      decoding="async"
                      width={800} height={450}
                      className={`w-full h-full ${useContain ? 'object-contain' : 'object-cover group-hover:scale-105 transition-transform duration-500'}`}
                      onError={(e) => {
                        const img = e.currentTarget;
                        const fb = '/assets/optimized/image_b3b470e9-960.webp';
                        if (img.src !== window.location.origin + fb) { img.srcset = ''; img.src = fb; }
                      }}
                    />
                  </div>
                );
              })()}

              <div className="p-6 flex flex-col flex-1">
                {/* Metadata line */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-3">
                  <span className="font-bold text-[#0F3D2E] dark:text-[#D9A441]">
                    Day {evt.day}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{evt.session}</span>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase text-[11px] font-semibold">{evt.category}</span>
                  {evt.featured && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[#D9A441] font-semibold">
                        <Star className="h-3 w-3 fill-current" />
                        Featured
                      </span>
                    </>
                  )}
                  <StatusBadge status={evt.status} />
                </div>

                <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#0F3D2E] dark:group-hover:text-[#D9A441] transition-colors mb-2">
                  {evt.titleI18n[currentLang] || evt.titleI18n.en}
                </h3>

                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 line-clamp-3 leading-relaxed mb-4 flex-1">
                  {evt.descriptionI18n[currentLang] || evt.descriptionI18n.en}
                </p>

                {/* Delayed / Cancelled note */}
                {evt.statusNoteI18n && (evt.status === 'delayed' || evt.status === 'cancelled') && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-3">
                    {evt.statusNoteI18n[currentLang] || evt.statusNoteI18n.en}
                  </p>
                )}

                {evt.subEvents && evt.subEvents.length > 0 && (
                  <div className="mb-4 text-xs text-stone-500 dark:text-stone-400">
                    <span className="font-medium text-stone-700 dark:text-stone-300">Includes: </span>
                    {evt.subEvents.map((s) => s.titleI18n[currentLang] || s.titleI18n.en).join(', ')}
                  </div>
                )}

                <div className="pt-4 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 truncate max-w-[180px]">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{evt.venueNameI18n[currentLang] || evt.venueNameI18n.en}</span>
                  </span>
                  <NavLink
                    to={`/events/${evt.slug}`}
                    className="inline-flex items-center min-h-[44px] px-2 font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline whitespace-nowrap ml-1"
                  >
                    {t('events.viewDetails')} →
                  </NavLink>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
