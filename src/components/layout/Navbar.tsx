import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, Menu, Moon, Radio, SlidersHorizontal, Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEventStatusSwitcher, useEdition, useEvents, useGallery, useNews, useSponsors } from '../../hooks/useTourismQueries';
import { setAppLanguage } from '../../lib/i18n';
import { Language } from '../../types';

/* ─── Logo paths ────────────────────────────────────────────────────── */
export const LOGO_FULL  = '/assets/tourism-week-logo.png';
export const CREST_AMBOU = '/assets/aistudio/image_230557a2.png';

/* ─── Nav definitions ───────────────────────────────────────────────── */
const PRIMARY_NAV = [
  { to: '/',         key: 'nav.home'                                 },
  { to: '/schedule', key: 'nav.schedule', hideWhenEmpty: 'schedule' },
  { to: '/events',   key: 'nav.events',   hideWhenEmpty: 'events'   },
  { to: '/gallery',  key: 'nav.gallery',  hideWhenEmpty: 'gallery'  },
  { to: '/news',     key: 'nav.news',     hideWhenEmpty: 'news'     },
  { to: '/about',    key: 'nav.about'                                },
] as const;

const ALL_NAV = [
  ...PRIMARY_NAV,
  { to: '/sponsors', key: 'nav.sponsors', hideWhenEmpty: 'sponsors' },
  { to: '/contact',  key: 'nav.contact'  },
] as const;

type NavItem = { to: string; key: string; hideWhenEmpty?: string };
function shouldHideNav(item: { hideWhenEmpty?: string }, emptySections: Set<string>): boolean {
  if (!item.hideWhenEmpty) return false;
  return emptySections.has(item.hideWhenEmpty);
}

/* ─── Focus-trap helper ─────────────────────────────────────────────── */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(containerEl: HTMLElement, e: KeyboardEvent) {
  const els = Array.from(containerEl.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[aria-hidden="true"]'),
  );
  if (!els.length) return;
  const first = els[0];
  const last  = els[els.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }
}

/* ─── Component ─────────────────────────────────────────────────────── */
export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location    = useLocation();

  const [isScrolled,  setIsScrolled ] = useState(false);
  const [mobileOpen,  setMobileOpen ] = useState(false);
  const [isDark,      setIsDark     ] = useState(false);
  const [statusOpen,  setStatusOpen ] = useState(false);

  const statusRef   = useRef<HTMLDivElement>(null);
  const drawerRef   = useRef<HTMLDivElement>(null);
  const menuBtnRef  = useRef<HTMLButtonElement>(null);

  const { currentOverride, changeStatus } = useEventStatusSwitcher();
  const { data: galleryData }  = useGallery();
  const { data: newsData }     = useNews();
  const { data: sponsorsData } = useSponsors();
  const { data: eventsData }   = useEvents();
  const { data: editionData }  = useEdition();
  const activeLogo = (editionData as any)?.logoUrl ?? LOGO_FULL;
  const currentLang = (i18n.language as Language) || 'en';

  const hasEvents  = !!(eventsData && eventsData.length > 0);
  const hasLiveNow = hasEvents && eventsData!.some((e) => e.status === 'live');

  const scheduleDayParam = React.useMemo(() => {
    if (!editionData?.startDateGC || !editionData?.endDateGC) return '';
    const addisToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (addisToday < editionData.startDateGC || addisToday > editionData.endDateGC) return '';
    const startMs = new Date(editionData.startDateGC + 'T00:00:00Z').getTime();
    const todayMs = new Date(addisToday + 'T00:00:00Z').getTime();
    const dayNum  = Math.round((todayMs - startMs) / 86_400_000) + 1;
    if (hasEvents) {
      const daysWithContent = new Set(eventsData!.map((e) => e.day));
      if (daysWithContent.has(dayNum)) return `?day=${dayNum}`;
      const next = [...daysWithContent].sort((a, b) => a - b).find((d) => d >= dayNum);
      if (next) return `?day=${next}`;
    }
    return `?day=${dayNum}`;
  }, [editionData, eventsData, hasEvents]);

  const scheduleHref = `/schedule${scheduleDayParam}`;

  const emptySections = new Set<string>();
  if (!galleryData  || galleryData.length  === 0) emptySections.add('gallery');
  if (!newsData     || newsData.length     === 0) emptySections.add('news');
  if (!sponsorsData || sponsorsData.length === 0) emptySections.add('sponsors');
  if (!hasEvents) { emptySections.add('schedule'); emptySections.add('events'); }

  const visiblePrimaryNav = (PRIMARY_NAV as readonly NavItem[]).filter((item) => !shouldHideNav(item, emptySections));
  const visibleAllNav     = (ALL_NAV    as readonly NavItem[]).filter((item) => !shouldHideNav(item, emptySections));

  const isHome        = location.pathname === '/';
  const isTransparent = isHome && !isScrolled;

  /* ── scroll ── */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── dark-mode init ── */
  useEffect(() => {
    const saved = localStorage.getItem('tourism_theme');
    const dark  = saved === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    setIsDark(dark);
  }, []);

  /* ── close on navigation ── */
  useEffect(() => {
    setMobileOpen(false);
    setStatusOpen(false);
  }, [location.pathname]);

  /* ── DRAWER: body-scroll lock + focus trap + Escape + outside click ── */
  useEffect(() => {
    if (!mobileOpen) return;

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first focusable element in drawer
    const id = window.setTimeout(() => {
      const first = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 50);

    // Trap focus inside drawer
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        menuBtnRef.current?.focus();
        return;
      }
      if (drawerRef.current) trapFocus(drawerRef.current, e);
    };

    // Close on outside click
    const onMouseDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);

    return () => {
      document.body.style.overflow = prev;
      clearTimeout(id);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [mobileOpen]);

  /* ── status dropdown outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('tourism_theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  const headerCls = isTransparent
    ? 'bg-transparent border-transparent shadow-none'
    : 'bg-white/96 dark:bg-[#071510]/96 backdrop-blur-xl border-b border-stone-200/80 dark:border-white/8 shadow-md';

  const linkColor = isTransparent
    ? 'text-white/85 hover:text-white'
    : 'text-stone-700 dark:text-stone-200 hover:text-[#0F3D2E] dark:hover:text-white';

  const activeColor = isTransparent
    ? 'text-[#D9A441]'
    : 'text-[#0F3D2E] dark:text-[#D9A441]';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerCls}`}>

      {/* ── Main bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-[60px] sm:h-[68px] lg:h-[76px]">

          {/* ── Logo ── */}
          <NavLink
            to="/"
            aria-label="Tourism Week, Ambo University Woliso Campus — Home"
            className="flex items-center shrink-0 group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9A441]"
          >
            {isTransparent ? (
              <div className="rounded-xl px-2 py-1 bg-white/90 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
                <img
                  src={activeLogo}
                  alt="Tourism Week — Ambo University Woliso Campus"
                  style={{ height: 38, width: 'auto', display: 'block' }}
                />
              </div>
            ) : (
              <img
                src={activeLogo}
                alt="Tourism Week — Ambo University Woliso Campus"
                className="transition-transform duration-300 group-hover:scale-105"
                style={{ height: 44, width: 'auto', display: 'block', mixBlendMode: 'multiply' }}
              />
            )}
          </NavLink>

          {/* ── Primary nav — desktop only ── */}
          <nav aria-label="Primary navigation" className="hidden xl:flex items-center gap-0.5">
            {visiblePrimaryNav.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to === '/schedule' ? scheduleHref : to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative px-3.5 py-2 text-[13px] font-semibold rounded-lg transition-colors whitespace-nowrap tab-gold-underline
                   ${isActive ? `${activeColor} active` : linkColor}`
                }
              >
                {t(key)}
                {to === '/schedule' && hasLiveNow && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#071510]" aria-label="Live now" />
                )}
              </NavLink>
            ))}
          </nav>

          {/* ── Right controls ── */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

            {/* Language switcher — min 44 px height */}
            <div
              className={`flex items-center p-0.5 rounded-xl border backdrop-blur-md
                ${isTransparent
                  ? 'border-white/15 bg-black/30'
                  : 'border-stone-200 dark:border-white/15 bg-stone-100 dark:bg-black/30'
                }`}
              role="group"
              aria-label="Select language"
            >
              {(['en', 'am', 'om'] as Language[]).map((lang) => {
                const labels: Record<Language, string> = { en: 'EN', am: 'አማ', om: 'OM' };
                const active = currentLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setAppLanguage(lang)}
                    aria-pressed={active}
                    className={`min-w-[36px] min-h-[36px] px-2 py-1 text-[11px] font-bold rounded-lg transition-all
                      ${lang === 'am' ? 'font-ethiopic' : ''}
                      ${active
                        ? 'bg-[#D9A441] text-[#0A2A20] shadow-sm'
                        : isTransparent
                          ? 'text-stone-200 hover:text-white'
                          : 'text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                      }`}
                  >
                    {labels[lang]}
                  </button>
                );
              })}
            </div>

            {/* Dark mode toggle — min 44 px */}
            <button
              type="button"
              onClick={toggleDark}
              aria-label={t('common.themeToggle')}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl border transition-colors
                ${isTransparent
                  ? 'border-white/15 bg-black/30 text-white hover:bg-white/10'
                  : 'border-stone-200 dark:border-white/15 bg-stone-100 dark:bg-black/30 text-stone-700 dark:text-white hover:bg-stone-200 dark:hover:bg-white/10'
                }`}
            >
              {isDark
                ? <Sun  className="h-4 w-4 text-[#D9A441]" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>

            {/* Dev status switcher */}
            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => setStatusOpen((v) => !v)}
                aria-label={t('common.simSwitchLabel')}
                title="Preview edition status"
                className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl border transition-all backdrop-blur-md
                  ${currentOverride
                    ? 'border-[#D9A441]/60 bg-[#D9A441]/20 text-[#D9A441]'
                    : isTransparent
                      ? 'border-white/15 bg-black/30 text-stone-300 hover:text-white'
                      : 'border-stone-200 dark:border-white/15 bg-stone-100 dark:bg-black/30 text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>

              {statusOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-[#071510] border border-stone-200 dark:border-stone-700/80 shadow-2xl py-2 z-50 text-xs text-stone-800 dark:text-white">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {t('common.simSwitchLabel')}
                  </p>
                  {([
                    { val: null,       label: t('common.simAuto')     },
                    { val: 'upcoming', label: t('common.simUpcoming') },
                    { val: 'live',     label: t('common.simLive')     },
                    { val: 'past',     label: t('common.simPast')     },
                  ] as const).map(({ val, label }) => (
                    <button
                      key={String(val)}
                      onClick={() => { changeStatus(val); setStatusOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-between transition-colors
                        ${currentOverride === val ? 'text-[#D9A441] font-bold' : 'text-stone-700 dark:text-stone-300'}`}
                    >
                      <span>{label}</span>
                      {currentOverride === val && <span className="text-[#D9A441]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Gold CTA — desktop only */}
            {hasEvents && (
              <NavLink
                to={scheduleHref}
                className="hidden xl:inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-xl bg-[#D9A441] text-[#0A2A20] hover:bg-[#C59132] transition-all shadow-md hover:-translate-y-0.5 whitespace-nowrap"
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('nav.schedule')}</span>
                {hasLiveNow && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-[#0A2A20]" aria-label="Live now" />
                )}
              </NavLink>
            )}

            {/* Hamburger — min 44 px, xl:hidden */}
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className={`xl:hidden min-w-[44px] min-h-[44px] p-2.5 rounded-xl border transition-colors
                ${isTransparent
                  ? 'border-white/15 bg-black/30 text-white hover:bg-white/10'
                  : 'border-stone-200 dark:border-white/15 bg-stone-100 dark:bg-black/30 text-stone-700 dark:text-white hover:bg-stone-200 dark:hover:bg-white/10'
                }`}
            >
              {mobileOpen
                ? <X    className="h-5 w-5" aria-hidden="true" />
                : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Gold-forest tilet micro-border */}
      {!isTransparent && (
        <div aria-hidden="true" className="w-full h-[2px] bg-gradient-to-r from-[#0F3D2E] via-[#D9A441] to-[#C65D3B] opacity-70" />
      )}

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="xl:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`xl:hidden fixed top-0 right-0 bottom-0 z-50 w-[min(320px,90vw)] bg-white/99 dark:bg-[#071510]/99 backdrop-blur-2xl border-l border-stone-200 dark:border-stone-800 flex flex-col transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen ? true : undefined}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <img
            src={activeLogo}
            alt="Tourism Week — Ambo University Woliso Campus"
            style={{ height: 36, width: 'auto', display: 'block', mixBlendMode: 'multiply' }}
          />
          <button
            type="button"
            onClick={() => { setMobileOpen(false); menuBtnRef.current?.focus(); }}
            aria-label="Close navigation menu"
            className="min-w-[44px] min-h-[44px] p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable nav links */}
        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {visibleAllNav.map(({ to, key }) => (
              <li key={to}>
                <NavLink
                  to={to === '/schedule' ? scheduleHref : to}
                  end={to === '/'}
                  onClick={() => { setMobileOpen(false); }}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3.5 min-h-[52px] rounded-xl text-[15px] font-semibold transition-colors
                     ${isActive
                       ? 'bg-[#D9A441]/12 text-[#0F3D2E] dark:bg-[#D9A441]/15 dark:text-[#D9A441]'
                       : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/6'
                     }`
                  }
                >
                  {t(key)}
                  {to === '/schedule' && hasLiveNow && (
                    <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-label="Live now" />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA at bottom of drawer */}
        <div className="px-4 py-4 border-t border-stone-100 dark:border-stone-800 shrink-0 safe-area-bottom">
          {hasEvents && (
            <NavLink
              to={scheduleHref}
              onClick={() => setMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#D9A441] text-[#071510] font-bold text-sm shadow-md"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>{t('hero.viewSchedule')}</span>
              {hasLiveNow && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-[#071510]" aria-label="Live now" />
              )}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
};
