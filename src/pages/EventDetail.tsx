import React, { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  Facebook,
  MapPin,
  Send,
  Share2,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSkeleton } from '../components/common/StateViews';
import { StatusBadge } from '../components/common/StatusBadge';
import { useEdition, useEvent, useEvents } from '../hooks/useTourismQueries';
import { formatDualDate } from '../lib/ethiopianCalendar';
import { buildEditionDays } from '../lib/editionDays';
import { downloadICSFile, generateICS } from '../lib/icsGenerator';
import { resolveImage, resolveImageSrc } from '../lib/resolveImage';
import { Language } from '../types';

// ─── SEO head helper (no extra dep — just mutate document.head) ──────────────
function useSeoMeta(opts: {
  title: string;
  description: string;
  imageUrl: string | undefined;
  url: string;
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = opts.title ? `${opts.title} | Tourism Week` : 'Tourism Week';

    const setMeta = (property: string, content: string, attr = 'property') => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (opts.description) setMeta('description', opts.description, 'name');
    if (opts.title)       setMeta('og:title',       opts.title);
    if (opts.description) setMeta('og:description', opts.description);
    if (opts.url)         setMeta('og:url',          opts.url);
    if (opts.imageUrl)    setMeta('og:image',        opts.imageUrl);
    setMeta('og:type', 'article');

    if (opts.title)       setMeta('twitter:title',       opts.title,       'name');
    if (opts.description) setMeta('twitter:description', opts.description, 'name');
    if (opts.imageUrl)    setMeta('twitter:image',       opts.imageUrl,    'name');
    setMeta('twitter:card', 'summary_large_image', 'name');

    return () => {
      document.title = prev;
    };
  }, [opts.title, opts.description, opts.imageUrl, opts.url]);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const EventDetail: React.FC = () => {
  const { slug }     = useParams<{ slug: string }>();
  const { t, i18n }  = useTranslation();
  const currentLang  = (i18n.language as Language) || 'en';
  const [copied, setCopied] = useState(false);

  const { data: event, isLoading } = useEvent(slug || '');
  const { data: allEvents }        = useEvents();
  const { data: edition }          = useEdition();

  // ── SEO / social meta ─────────────────────────────────────────────────────
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  useSeoMeta({
    title:       event ? (event.titleI18n[currentLang] || event.titleI18n.en) : '',
    description: event ? (event.descriptionI18n[currentLang] || event.descriptionI18n.en).slice(0, 160) : '',
    imageUrl:    event?.image ? resolveImageSrc(event.image) : undefined,
    url:         currentUrl,
  });

  // ── Day metadata for the dual-date display ───────────────────────────────
  const dayMeta = React.useMemo(() => {
    if (!event || !edition?.startDateGC) return null;
    const days = buildEditionDays(edition.startDateGC, edition.endDateGC);
    return days.find((d) => d.day === event.day) ?? null;
  }, [event, edition]);

  // ── Prev / next across all days (sorted array order) ─────────────────────
  const { prevEvent, nextEvent } = React.useMemo(() => {
    if (!event || !allEvents) return { prevEvent: null, nextEvent: null };
    const idx = allEvents.findIndex((e) => e.slug === event.slug);
    return {
      prevEvent: idx > 0 ? allEvents[idx - 1] : null,
      nextEvent: idx >= 0 && idx < allEvents.length - 1 ? allEvents[idx + 1] : null,
    };
  }, [event, allEvents]);

  // ── Related: same day, different session — up to 3 ───────────────────────
  const relatedEvents = React.useMemo(() => {
    if (!event || !allEvents) return [];
    return allEvents
      .filter((e) => e.day === event.day && e.id !== event.id)
      .slice(0, 3);
  }, [event, allEvents]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCalendarExport = () => {
    if (!event) return;
    const icsContent = generateICS([event], event.titleI18n.en, edition?.startDateGC);
    downloadICSFile(icsContent, `${event.slug}.ics`);
  };

  const shareText = event
    ? encodeURIComponent(`${event.titleI18n.en} — Ambo University Woliso Campus Tourism Week`)
    : '';

  // ── Loading / not-found states ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title="Event Not Found"
          description="This event is not in the current edition's schedule."
          action={{ label: t('eventDetail.backToEvents'), onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10">

      {/* Back */}
      <NavLink
        to="/events"
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 hover:text-[#0F3D2E] dark:hover:text-[#D9A441] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t('eventDetail.backToEvents')}</span>
      </NavLink>

      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">

        {/* Hero image */}
        <div className="w-full overflow-hidden bg-stone-100 dark:bg-stone-900" style={{ aspectRatio: '16/7' }}>
          {(() => { const ri = resolveImage(event.image || '/assets/aistudio/image_b3b470e9.png'); return (
          <img
            src={ri.src}
            srcSet={ri.srcSet || undefined}
            sizes={ri.srcSet ? '(min-width: 1024px) 896px, 100vw' : undefined}
            alt={event.titleI18n.en}
            fetchPriority="high"
            decoding="async"
            width={896} height={392}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              const fb = '/assets/optimized/image_b3b470e9-960.webp';
              if (img.src !== window.location.origin + fb) { img.srcset = ''; img.src = fb; }
            }}
          />); })()}
        </div>

        <div className="p-6 sm:p-10 space-y-6">

          {/* Header metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[#0F3D2E] dark:text-[#D9A441]">Day {event.day}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{event.session}</span>
              <span aria-hidden="true">·</span>
              <span className="uppercase text-[11px] font-semibold">{event.category}</span>
              {event.featured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 text-[#D9A441] font-semibold">
                    <Star className="h-3 w-3 fill-current" />Featured
                  </span>
                </>
              )}
            </div>
            <StatusBadge status={event.status} />
          </div>

          {/* Delayed / Cancelled note */}
          {event.statusNoteI18n && (event.status === 'delayed' || event.status === 'cancelled') && (
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5 border border-amber-200 dark:border-amber-800/50">
              {event.statusNoteI18n[currentLang] || event.statusNoteI18n.en}
            </p>
          )}

          {/* Title */}
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
              {event.titleI18n[currentLang] || event.titleI18n.en}
            </h1>
            <div className="space-y-1 pt-1 text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              {currentLang !== 'am' && <p className="font-ethiopic">{event.titleI18n.am}</p>}
              {currentLang !== 'om' && <p>{event.titleI18n.om}</p>}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/80 dark:border-stone-800 text-xs sm:text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0 mt-0.5" />
              <div>
                <span className="block font-semibold text-stone-900 dark:text-stone-100">{t('eventDetail.venue')}</span>
                <span className="text-stone-600 dark:text-stone-400">
                  {event.venueNameI18n[currentLang] || event.venueNameI18n.en}{' '}
                  (<span className="capitalize">{event.venueType}</span>)
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0 mt-0.5" />
              <div>
                <span className="block font-semibold text-stone-900 dark:text-stone-100">{t('eventDetail.session')}</span>
                <span className="text-stone-600 dark:text-stone-400 capitalize">
                  {event.session}
                  {event.startTime && ` · ${event.startTime}`}
                  {event.endTime && ` – ${event.endTime}`}
                </span>
              </div>
            </div>
            {dayMeta && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <Calendar className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0 mt-0.5" />
                <div>
                  <span className="block font-semibold text-stone-900 dark:text-stone-100">Date</span>
                  <span className="text-stone-600 dark:text-stone-400">
                    {formatDualDate(dayMeta.ec, dayMeta.gc, currentLang)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-4 pt-2">
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Overview &amp; Context
            </h2>
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
              {event.descriptionI18n[currentLang] || event.descriptionI18n.en}
            </p>
          </div>

          {/* Sub-events */}
          {event.subEvents && event.subEvents.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                Detailed Event Components
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {event.subEvents.map((sub, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60"
                  >
                    <p className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      {sub.titleI18n[currentLang] || sub.titleI18n.en}
                    </p>
                    {sub.category && (
                      <span className="text-[11px] uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441] font-medium mt-1 block">
                        {sub.category}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Venue directions */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
              Venue &amp; Assembly Directions
            </h3>
            <div className="p-6 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center">
              <MapPin className="h-8 w-8 text-[#0F3D2E] dark:text-[#D9A441] mx-auto mb-2" />
              <p className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                {event.venueNameI18n[currentLang] || event.venueNameI18n.en}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto">
                Ambo University Woliso Campus grounds and central municipal thoroughfares. Open public gathering — security and student guides will direct attendees at main gates.
              </p>
            </div>
          </div>

          {/* Action ribbon */}
          <div className="pt-6 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleCalendarExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white font-semibold text-xs hover:bg-[#0A2A20] transition-colors"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>Add Event to Calendar (.ics)</span>
            </button>

            {/* Social share */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 font-medium mr-1 hidden sm:inline">
                {t('eventDetail.share')}:
              </span>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${shareText}`}
                target="_blank" rel="noopener noreferrer"
                aria-label="Share on Telegram"
                className="p-2 rounded-lg border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
              >
                <Send className="h-4 w-4 text-[#229ED9]" />
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(currentUrl)}`}
                target="_blank" rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                className="p-2 rounded-lg border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
              >
                <Share2 className="h-4 w-4 text-[#25D366]" />
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`}
                target="_blank" rel="noopener noreferrer"
                aria-label="Share on Facebook"
                className="p-2 rounded-lg border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
              >
                <Facebook className="h-4 w-4 text-[#1877F2]" />
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy link"
                className="p-2 rounded-lg border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                title={copied ? t('eventDetail.linkCopied') : t('eventDetail.copyLink')}
              >
                {copied
                  ? <Check className="h-4 w-4 text-emerald-600" />
                  : <Copy  className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related activities (same day) ─────────────────────────────── */}
      {relatedEvents.length > 0 && (
        <section aria-label="Related activities">
          <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 mb-4">
            Other Day {event.day} Activities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedEvents.map((rel) => (
              <NavLink
                key={rel.id}
                to={`/events/${rel.slug}`}
                className="p-4 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:border-[#0F3D2E] dark:hover:border-[#D9A441] transition-colors group"
              >
                {rel.image && (
                  <div className="w-full h-24 rounded-xl overflow-hidden mb-3 bg-stone-100 dark:bg-stone-900">
                    {(() => { const ri = resolveImage(rel.image); return (
                    <img
                      src={ri.src}
                      srcSet={ri.srcSet || undefined}
                      sizes={ri.srcSet ? '(min-width: 1024px) 280px, (min-width: 640px) 45vw, 100vw' : undefined}
                      alt={rel.titleI18n.en}
                      loading="lazy"
                      decoding="async"
                      width={280} height={96}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />); })()}
                  </div>
                )}
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0F3D2E] dark:text-[#D9A441] block mb-1">
                  {rel.session} · {rel.category}
                </span>
                <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-[#0F3D2E] dark:group-hover:text-[#D9A441] transition-colors">
                  {rel.titleI18n[currentLang] || rel.titleI18n.en}
                </span>
              </NavLink>
            ))}
          </div>
        </section>
      )}

      {/* ── Prev / Next navigation across ALL days ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        {prevEvent ? (
          <NavLink
            to={`/events/${prevEvent.slug}`}
            className="p-4 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:border-[#0F3D2E] transition-colors"
          >
            <span className="text-[11px] font-semibold text-stone-400 block mb-1">
              ← {t('eventDetail.prevEvent')}
            </span>
            <span className="font-display font-semibold text-sm text-stone-900 dark:text-stone-100 truncate block">
              {prevEvent.titleI18n[currentLang] || prevEvent.titleI18n.en}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5 block">
              Day {prevEvent.day} · {prevEvent.session}
            </span>
          </NavLink>
        ) : <div />}

        {nextEvent && (
          <NavLink
            to={`/events/${nextEvent.slug}`}
            className="p-4 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:border-[#0F3D2E] transition-colors text-right"
          >
            <span className="text-[11px] font-semibold text-stone-400 block mb-1">
              {t('eventDetail.nextEvent')} →
            </span>
            <span className="font-display font-semibold text-sm text-stone-900 dark:text-stone-100 truncate block">
              {nextEvent.titleI18n[currentLang] || nextEvent.titleI18n.en}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5 block">
              Day {nextEvent.day} · {nextEvent.session}
            </span>
          </NavLink>
        )}
      </div>
    </div>
  );
};
