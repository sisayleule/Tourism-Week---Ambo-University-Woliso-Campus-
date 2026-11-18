import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, Compass, Home, Image, MoreHorizontal, X, FileText, Info, Award, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGallery, useNews, useSponsors } from '../../hooks/useTourismQueries';

/**
 * MobileBottomNav
 * ───────────────
 * Fixed bar at the bottom of every public page on screens narrower than xl.
 * Height: 64 px content + env(safe-area-inset-bottom) for notched phones.
 * RootLayout adds the matching pb-[calc(64px+env(safe-area-inset-bottom,0px))]
 * to <main> so content is never hidden.
 *
 * Tap targets: each item is min-w-[56px] min-h-[56px] (exceeds 44 × 44 px).
 * "More" sheet: bottom-sheet with safe-area padding, closed on route change.
 */
export const MobileBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: galleryData }  = useGallery();
  const { data: newsData }     = useNews();
  const { data: sponsorsData } = useSponsors();

  // Close sheet on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  // Body-scroll lock while sheet is open
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [moreOpen]);

  // Escape to close
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [moreOpen]);

  const mainItems = [
    { to: '/',         label: t('nav.home'),     icon: Home     },
    { to: '/schedule', label: t('nav.schedule'), icon: Calendar },
    { to: '/events',   label: t('nav.events'),   icon: Compass  },
    { to: '/gallery',  label: t('nav.gallery'),  icon: Image,
      hide: !galleryData || galleryData.length === 0 },
  ].filter((item) => !item.hide);

  const moreItems = [
    { to: '/news',     label: t('nav.news'),     icon: FileText, desc: 'Announcements & press',
      hide: !newsData || newsData.length === 0 },
    { to: '/about',    label: t('nav.about'),    icon: Info,     desc: 'Department & history' },
    { to: '/sponsors', label: t('nav.sponsors'), icon: Award,    desc: 'Partners & tiers',
      hide: !sponsorsData || sponsorsData.length === 0 },
    { to: '/contact',  label: t('nav.contact'),  icon: Phone,    desc: 'FAQs & inquiries' },
  ].filter((item) => !item.hide);

  /* Nav bar height is 64px content + safe-area; RootLayout's pb must match */
  const BAR_HEIGHT = 64;

  return (
    <>
      {/* ── "More" bottom sheet ── */}
      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Additional Navigation Links"
          className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setMoreOpen(false)}
        >
          {/* Scrim */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

          {/* Sheet */}
          <div
            className="relative bg-[#FAF7F0] dark:bg-[#12221C] rounded-t-3xl border-t border-stone-200 dark:border-stone-800 p-6 shadow-2xl"
            style={{ paddingBottom: `max(env(safe-area-inset-bottom, 0px), 1.5rem)` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-stone-300 dark:bg-stone-700 mx-auto mb-5" aria-hidden="true" />

            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 mb-4">
              <h3 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
                {t('nav.more')}
              </h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {moreItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col p-4 min-h-[72px] rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 hover:border-[#0F3D2E] transition-all focus-visible:outline-2 focus-visible:outline-[#D9A441]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="p-1.5 rounded-lg bg-[#0F3D2E]/10 dark:bg-[#D9A441]/10 text-[#0F3D2E] dark:text-[#D9A441]">
                        <IconComponent className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug">
                      {item.desc}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed bottom bar ── */}
      {/*
        Height:  64px fixed content
        Padding: safe-area-inset-bottom so the bar itself grows on notched phones.
        The <main> in RootLayout adds matching bottom padding so content is not
        hidden below the bar.
      */}
      <nav
        aria-label="Mobile bottom navigation"
        className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F0]/95 dark:bg-[#0B1612]/95 backdrop-blur-md border-t border-stone-200/80 dark:border-stone-800/80 px-2"
        style={{
          height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-stretch justify-around max-w-lg mx-auto h-16">
          {mainItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center min-w-[56px] flex-1 py-1 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#D9A441] ${
                    isActive
                      ? 'text-[#0F3D2E] dark:text-[#D9A441] font-semibold'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`}
                      aria-hidden="true"
                    />
                    <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="flex flex-col items-center justify-center min-w-[56px] flex-1 py-1 rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors focus-visible:outline-2 focus-visible:outline-[#D9A441]"
          >
            <MoreHorizontal className="h-5 w-5 stroke-[1.8px]" aria-hidden="true" />
            <span className="text-[10px] mt-0.5 tracking-tight">
              {t('nav.more')}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
