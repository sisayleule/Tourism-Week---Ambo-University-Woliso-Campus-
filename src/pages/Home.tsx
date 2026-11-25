import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Compass,
  Heart,
  MapPin,
  Mountain,
  Pause,
  Play,
  Sparkles,
  TreePine,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { HeroCountdown } from '../components/hero/HeroCountdown';
import { HeroVideo, type HeroVideoHandle } from '../components/hero/HeroVideo';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '../components/common/StateViews';
import { StatusBadge } from '../components/common/StatusBadge';
import { TiletDivider } from '../components/common/TiletDivider';
import {
  useAnnouncements,
  useEdition,
  useEditionDays,
  useEvents,
  useGallery,
  useNews,
  useSection,
  useSponsors,
} from '../hooks/useTourismQueries';
import { buildEditionDays } from '../lib/editionDays';
import { formatDualDate } from '../lib/ethiopianCalendar';
import { resolveImage, resolveImageSrc } from '../lib/resolveImage';
import { getSectionEntry } from '../lib/sectionRegistry';
import type { CardDefault } from '../lib/sectionRegistry';
import { downloadICSFile, generateICS } from '../lib/icsGenerator';
import { EventItem, GalleryItem, Language } from '../types';
import type { SectionItemSnapshot, SectionSnapshot } from '../lib/snapshot';

// ── Static asset imports — Vite hashes these for cache-busting ──────────────
import wonchiImg       from '../assets/images/wonchi_crater_lake_1793712664730.jpg';
import coffeeImg       from '../assets/images/ethiopian_coffee_ceremony_1793712665543.jpg';
import { DEFAULT_HERO_POSTER } from '../lib/heroMedia';

/* ─────────────────────────────────────────────────────────────────────
   Helper: resolve an i18n field from a section snapshot row,
   falling back to the registry default then to an empty string.
──────────────────────────────────────────────────────────────────────── */
function secText(
  section: SectionSnapshot | undefined,
  field: 'titleI18n' | 'subtitleI18n' | 'bodyI18n',
  lang: Language,
  registryKey: string,
  registryField: 'title' | 'subtitle' | 'body',
): string {
  const dbVal = section?.[field];
  const regEntry = getSectionEntry(registryKey);
  const regDefault = regEntry?.defaultContent?.[registryField];
  return dbVal?.[lang] ?? dbVal?.en ?? regDefault?.[lang] ?? regDefault?.en ?? '';
}

/* ─────────────────────────────────────────────────────────────────────
   Helper: split theme text so the key word can be rendered gold-italic.
   The highlight word now comes from the edition's theme_highlight_i18n
   field (Phase 6B). Falls back to the hard-coded GOLD_WORDS dict when
   the DB field is empty (so existing installs work without re-seeding).
──────────────────────────────────────────────────────────────────────── */
const GOLD_WORDS_FALLBACK: Record<Language, string> = {
  en: 'Peace',
  am: 'ሰላምና',
  om: 'Nageenyaa',
};

function splitTheme(text: string, highlightWord: string): [string, string, string] {
  if (!highlightWord) return [text, '', ''];
  const idx = text.indexOf(highlightWord);
  if (idx === -1) return [text, '', ''];
  return [text.slice(0, idx), highlightWord, text.slice(idx + highlightWord.length)];
}

/* ─────────────────────────────────────────────────────────────────────
   CardNorm — common shape used to render both snapshot items and
   registry defaults without cast chains.
──────────────────────────────────────────────────────────────────────── */
interface CardNorm {
  id?:     string
  title:   string
  body:    string
  badge:   string
  icon:    string | null | undefined
  imageUrl:string | null | undefined
  linkUrl: string | null | undefined
}

function normaliseCard(
  raw: unknown,
  lang: Language,
): CardNorm {
  // snapshot item shape
  if (raw && typeof raw === 'object' && 'titleI18n' in (raw as object)) {
    const snap = raw as SectionItemSnapshot
    return {
      id:       snap.id,
      title:    snap.titleI18n?.[lang] ?? snap.titleI18n?.en ?? '',
      body:     snap.bodyI18n?.[lang]  ?? snap.bodyI18n?.en  ?? '',
      badge:    snap.badgeI18n?.[lang] ?? snap.badgeI18n?.en ?? '',
      icon:     snap.icon,
      imageUrl: snap.imageUrl,
      linkUrl:  snap.linkUrl,
    }
  }
  // registry CardDefault shape
  const def = raw as { title?: { en?: string; am?: string; om?: string }; body?: { en?: string; am?: string; om?: string }; badge?: { en?: string; am?: string; om?: string }; icon?: string; link?: string }
  return {
    id:       undefined,
    title:    def?.title?.[lang] ?? def?.title?.en ?? '',
    body:     def?.body?.[lang]  ?? def?.body?.en  ?? '',
    badge:    def?.badge?.[lang] ?? def?.badge?.en ?? '',
    icon:     def?.icon ?? null,
    imageUrl: null,
    linkUrl:  def?.link ?? null,
  }
}

type AnyCard = SectionItemSnapshot | CardDefault | Record<string, unknown>
const ICON_MAP: Record<string, React.ReactNode> = {
  Mountain:  <Mountain  className="h-6 w-6" aria-hidden="true" />,
  Coffee:    <Coffee    className="h-6 w-6" aria-hidden="true" />,
  Heart:     <Heart     className="h-6 w-6" aria-hidden="true" />,
  TreePine:  <TreePine  className="h-6 w-6" aria-hidden="true" />,
  BookOpen:  <BookOpen  className="h-6 w-6" aria-hidden="true" />,
  Sparkles:  <Sparkles  className="h-6 w-6" aria-hidden="true" />,
  Award:     <Award     className="h-6 w-6" aria-hidden="true" />,
  Users:     <Users     className="h-6 w-6" aria-hidden="true" />,
  Compass:   <Compass   className="h-6 w-6" aria-hidden="true" />,
  Trophy:    <Trophy    className="h-6 w-6" aria-hidden="true" />,
};
function resolveIcon(icon: string | null | undefined): React.ReactNode {
  if (!icon) return null;
  return ICON_MAP[icon] ?? null;
}

/* ─────────────────────────────────────────────────────────────────────
   Day metadata helper — derived from edition dates at runtime.
   The hardcoded DAY_DATES map is gone; use buildEditionDays() inside
   the component (needs edition data) instead.
──────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────
   Image / video paths
   - wonchiImg, coffeeImg are Vite-imported above (content-hashed).
   - DEFAULT_HERO_POSTER is imported from heroMedia.ts (also Vite-hashed).
   - Hero video src selection (480p vs 720p) is handled inside HeroVideo.
──────────────────────────────────────────────────────────────────────── */
const WONCHI_URL          = wonchiImg;
const COFFEE_URL          = coffeeImg;

export const Home: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';

  const { data: edition, isLoading: editionLoading } = useEdition();
  const { data: events,  isLoading: eventsLoading  } = useEvents();
  const { data: gallery                             } = useGallery();
  const { data: newsItems                           } = useNews();
  const { data: sponsors                            } = useSponsors();
  const { data: editionDaysDb                       } = useEditionDays();

  // ── Phase 6B: section content from DB (fall back to registry defaults) ──
  const { data: heroSection      } = useSection('home.hero');
  const { data: highlightsSection} = useSection('home.highlights');
  const { data: itinerarySection } = useSection('home.itinerary');
  const { data: exploreSection   } = useSection('home.explore');
  const { data: philosophySection} = useSection('home.philosophy');
  const { data: gallerySection   } = useSection('home.gallery');
  const { data: newsSection      } = useSection('home.news');
  const { data: ctaSection       } = useSection('home.cta');

  /* ── video ── */
  const heroVideoRef  = useRef<HeroVideoHandle>(null);
  const [isPlaying,       setIsPlaying      ] = useState(true);
  const [useStaticPoster, setUseStaticPoster] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  /* Stable callbacks for HeroVideo — won't cause it to re-render */
  const handleStallFallback  = useCallback(() => { setUseStaticPoster(true); setIsPlaying(false); }, []);
  const handlePlayingChange  = useCallback((playing: boolean) => setIsPlaying(playing), []);
  const handleAutoplayBlocked = useCallback(() => { setAutoplayBlocked(true); setIsPlaying(false); }, []);

  /* ── gallery lightbox ── */
  const [activeGalleryModal, setActiveGalleryModal] = useState<GalleryItem | null>(null);

  /* ── schedule day selector ── */
  const [activeDay, setActiveDay] = useState(1);

  // Derive day tabs from edition dates — never hardcoded
  const allDays = useMemo(
    () => buildEditionDays(edition?.startDateGC, edition?.endDateGC),
    [edition?.startDateGC, edition?.endDateGC],
  );
  // Hide trailing days that have zero published events
  const visibleDays = useMemo(() => {
    if (!events || events.length === 0) return allDays;
    const maxDayWithEvents = Math.max(...events.map((e) => e.day));
    return allDays.filter((d) => d.day <= Math.max(maxDayWithEvents, 1));
  }, [allDays, events]);

  /* ── carousels ── */
  const highlightsRef = useRef<HTMLDivElement>(null);
  const galleryRef    = useRef<HTMLDivElement>(null);
  const [highlightsPaused, setHighlightsPaused] = useState(false);
  const [galleryPaused,    setGalleryPaused   ] = useState(false);

  /* ── hero typewriter ── */
  const fullTheme = edition?.themeI18n[currentLang] ?? edition?.themeI18n.en ?? '';
  const [typedTheme,      setTypedTheme     ] = useState('');
  const [typingDone,      setTypingDone     ] = useState(false);

  /* ── highlight word: from DB (themeHighlightI18n) → fallback dict ── */
  const highlightWord = React.useMemo(() => {
    // Cast to extended type — adaptEditionFull adds themeHighlightI18n
    const ext = edition as (typeof edition & { themeHighlightI18n?: Record<string, string> | null }) | undefined;
    return (
      ext?.themeHighlightI18n?.[currentLang] ??
      ext?.themeHighlightI18n?.en ??
      GOLD_WORDS_FALLBACK[currentLang] ??
      GOLD_WORDS_FALLBACK.en
    );
  }, [edition, currentLang]);

  /* ─── network / motion detection (Save-Data / reduced-motion → static poster) ── */
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } };
    const slowNet = nav.connection?.saveData || ['2g', 'slow-2g'].includes(nav.connection?.effectiveType ?? '');
    if (reducedMotion || slowNet) { setUseStaticPoster(true); setIsPlaying(false); }
  }, []);
  /* Note: autoplay-block detection, canplay handling, stall guard, and the
     countdown interval are all handled inside HeroVideo / HeroCountdown.
     The 1-second countdown tick never touches this component's state. */

  /* ─── typewriter ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!fullTheme) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedTheme(fullTheme); setTypingDone(true); return;
    }
    setTypedTheme(''); setTypingDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTypedTheme(fullTheme.slice(0, i));
      if (i >= fullTheme.length) { clearInterval(id); setTypingDone(true); }
    }, 42);
    return () => clearInterval(id);
  }, [fullTheme]);

  /* ─── highlights auto-scroll ─────────────────────────────────────── */
  useEffect(() => {
    const el = highlightsRef.current;
    if (!el || !featuredEvents.length) return;
    let id: number;
    let last = performance.now();
    const speed = 32; // px/sec
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (!highlightsPaused && el) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightsPaused]);

  /* ─── gallery auto-scroll ────────────────────────────────────────── */
  useEffect(() => {
    const el = galleryRef.current;
    if (!el || !galleryItems.length || galleryItems.length <= 10) return;
    let id: number;
    let last = performance.now();
    const speed = 26;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (!galleryPaused && el) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryPaused]);

  /* ─── helpers ────────────────────────────────────────────────────── */
  const toggleVideo = () => {
    if (isPlaying) {
      heroVideoRef.current?.pause();
    } else {
      heroVideoRef.current?.play();
      setAutoplayBlocked(false);
    }
  };

  const handleICS = (evt: EventItem) => {
    downloadICSFile(generateICS([evt], evt.titleI18n.en), `${evt.slug}.ics`);
  };

  const scrollHighlights = (dir: 'left' | 'right') => {
    const el = highlightsRef.current; if (!el) return;
    const half = el.scrollWidth / 2;
    if (dir === 'left' && el.scrollLeft <= 10 && half > 0) el.scrollLeft += half;
    el.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
  };
  const scrollGallery = (dir: 'left' | 'right') => {
    const el = galleryRef.current; if (!el) return;
    const half = el.scrollWidth / 2;
    if (dir === 'left' && el.scrollLeft <= 10 && half > 0) el.scrollLeft += half;
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  /* ─── derived data ───────────────────────────────────────────────── */
  // Build a map of day → title from edition_days DB data (migration 017)
  const dayTitleMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    for (const d of editionDaysDb ?? []) {
      const title = (d.titleI18n as any)?.[currentLang] ?? (d.titleI18n as any)?.en ?? '';
      if (title) map[d.day] = title;
    }
    return map;
  }, [editionDaysDb, currentLang]);

  /* ─── derive edition status from real dates, never from stored string ──     past    = now is after endDateGC
     live    = now is between startDateGC and endDateGC (inclusive)
     upcoming = now is before startDateGC
     Falls back to 'upcoming' while edition is loading.
  ──────────────────────────────────────────────────────────────────── */
  const editionStatus = React.useMemo(() => {
    if (!edition) return 'upcoming' as const;
    const now   = Date.now();
    const start = new Date(edition.startDateGC + 'T00:00:00Z').getTime();
    const end   = new Date(edition.endDateGC   + 'T23:59:59Z').getTime();
    if (now > end)   return 'past'     as const;
    if (now >= start) return 'live'   as const;
    return 'upcoming' as const;
  }, [edition]);
  const featuredEvents  = events?.filter((e) => e.featured) ?? [];

  // todayHighlight: the first event whose day matches today (Africa/Addis_Ababa).
  // Falls back to the first featured event, then the first event overall.
  const todayHighlight = React.useMemo(() => {
    if (!events || events.length === 0) return undefined;
    if (edition?.startDateGC && edition?.endDateGC) {
      const addisToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (addisToday >= edition.startDateGC && addisToday <= edition.endDateGC) {
        const startMs  = new Date(edition.startDateGC + 'T00:00:00Z').getTime();
        const todayMs  = new Date(addisToday + 'T00:00:00Z').getTime();
        const dayNum   = Math.round((todayMs - startMs) / 86_400_000) + 1;
        const todayEvt = events.find((e) => e.day === dayNum);
        if (todayEvt) return todayEvt;
      }
    }
    return events.find((e) => e.featured) ?? events[0];
  }, [events, edition]);
  const dayEvents       = events?.filter((e) => e.day === activeDay) ?? [];
  const galleryItems    = gallery ?? [];
  const marqueeEvents   = [...featuredEvents, ...featuredEvents];
  const marqueeGallery  = [...galleryItems, ...galleryItems];
  const editionStats    = edition?.stats;

  /**
   * Pick a curated event-card image when the event has no uploaded image.
   *
   * Priority order:
   *   1. The event's own image_url from the DB (evt.image)
   *   2. Title-keyword match  — most specific, picks the right scene
   *   3. Category fallback     — picks by event category, cycling by card index
   *   4. Last-resort generic   — the original placeholder
   */
  const CULTURAL_IMAGES = [
    '/assets/aistudio/image_c9b19ed8.png',  // multi-ethnic cultural attire assembly
    '/assets/aistudio/image_e2e72d06.png',  // exhibition pavilion & cultural hostesses
    '/assets/aistudio/image_6eb824fd.png',  // heritage costume poses
    '/assets/aistudio/image_dd2f8daf.png',  // shamma & tibeb white robe delegation
    '/assets/aistudio/image_c7963080.png',  // national unity cultural representatives
    '/assets/aistudio/image_d5bf61c0.png',  // traditional stick dance & peace procession
  ];
  const CARNIVAL_IMAGES = [
    '/assets/aistudio/image_e6296589.png',  // celebration street carnival & youth dance
    '/assets/aistudio/image_c9b19ed8.png',  // multi-ethnic procession
    '/assets/aistudio/image_c7963080.png',  // group cultural scene
  ];
  const SPORTS_IMAGES = [
    '/assets/aistudio/image_3856f7f5.png',  // morning carnival march & athletic peloton
    '/assets/aistudio/image_db590259.png',
    '/assets/aistudio/image_fe8a90e0.png',
  ];

  function getEventCardImage(evt: EventItem, idx: number): string {
    if (evt.image) return evt.image;
    const title = (evt.titleI18n?.en ?? '').toLowerCase();
    // Title keyword matching — most specific
    if (title.includes('carnival') || title.includes('cultural show') || title.includes('culture & art') || title.includes('cultural & art'))
      return CARNIVAL_IMAGES[idx % CARNIVAL_IMAGES.length];
    if (title.includes('handcraft') || title.includes('exhibition') || title.includes('craft'))
      return '/assets/aistudio/image_e2e72d06.png'; // exhibition pavilion scene
    if (title.includes('music') || title.includes('dance') || title.includes('festival'))
      return CULTURAL_IMAGES[idx % CULTURAL_IMAGES.length];
    // Category fallback
    if (evt.category === 'culture')
      return CULTURAL_IMAGES[idx % CULTURAL_IMAGES.length];
    if (evt.category === 'sports')
      return SPORTS_IMAGES[idx % SPORTS_IMAGES.length];
    // Generic last resort
    return CULTURAL_IMAGES[idx % CULTURAL_IMAGES.length];
  }

  const [themeBefore, themeGold, themeAfter] = typingDone
    ? splitTheme(typedTheme, highlightWord)
    : [typedTheme, '', ''];


  if (editionLoading || eventsLoading) {
    return <div className="max-w-7xl mx-auto px-4 py-20"><LoadingSkeleton rows={5} /></div>;
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="overflow-x-hidden">

      {/* ═══════════════════════════════════════════════════════════════
          A  CINEMATIC HERO
          - Exactly 100svh (100vh fallback); navbar sits inside it.
          - clamp() fluid type so headline + status block + buttons all
            fit without scrolling at 1366×768, 1440×900, 390×844, 360×640.
          - Short-screen (max-height) adjustments reduce gaps further.
          - editionStatus is derived from dates (see above), not stored string.
      ═══════════════════════════════════════════════════════════════ */}
      {/*
        ═══════════════════════════════════════════════════════════════
        A  CINEMATIC HERO  (mobile + desktop identical structure)
        ───────────────────────────────────────────────────────────────
        Layer 0 (z-0)  : video / poster — position:absolute inset-0,
                          object-fit:cover.  NEVER in normal flow.
        Layer 1 (z-1)  : gradient scrim — absolute, stronger on mobile.
        Layer 2 (z-10) : content column  — relative, fills full section
                          height via flex-1.  paddingTop = navbar height
                          so text clears the transparent header.
        Layer 3 (z-10) : bottom bar      — position:absolute bottom-0
                          so it does NOT consume flex height.

        Section height : 100svh (100vh fallback).  No maxHeight on mobile
                         so long-language content can grow; maxHeight only
                         on wide screens where content can never overflow.
        ═══════════════════════════════════════════════════════════════
      */}
      <section
        aria-label="Festival hero"
        className="relative w-full flex flex-col bg-[#071510] text-white h-screen-small"
        style={{
          minHeight: 560,
          /* NO maxHeight in inline style — a CSS media query in index.css
             applies it only at ≥1024 px so phones are never clipped. */
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        {/* ── Layer 0: media wrapper — absolute, covers full section ────────────
            HeroVideo handles: source selection (480/720), deferred src
            assignment, stall guard, IntersectionObserver pause, tab-hidden
            pause, and fade-in. The poster img is always present behind the
            video so there is never a black flash.

            The video/img use INLINE styles for width/height/objectFit because
            the global CSS rule `img, video { height: auto }` in index.css has
            higher specificity than Tailwind utility classes and would otherwise
            limit the media to its intrinsic aspect-ratio height.
        ── */}
        <div
          data-media-wrap
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            overflow: 'hidden',
            background: '#071510',
          }}
        >
          {/* Poster always rendered — visible until video fades in or when skipVideo */}
          <img
            src={resolveImageSrc((edition as any)?.heroPosterUrl ?? DEFAULT_HERO_POSTER)}
            alt="Ethiopian destinations: Lalibela Rock Church"
            fetchPriority="high"
            style={{
              position:    'absolute',
              top:         0,
              left:        0,
              width:       '100%',
              height:      '100%',
              minWidth:    '100%',
              minHeight:   '100%',
              maxWidth:    'none',
              maxHeight:   'none',
              aspectRatio: 'auto',
              objectFit:   'cover',
              objectPosition: 'center',
              display:     'block',
              transform:   'none',
            }}
          />
          {/* HeroVideo renders null when skipVideo=true; otherwise the video
              element sits on top of the poster and fades in when playing */}
          <HeroVideo
            ref={heroVideoRef}
            posterSrc={resolveImageSrc((edition as any)?.heroPosterUrl ?? DEFAULT_HERO_POSTER)}
            skipVideo={useStaticPoster}
            externalIsPlaying={isPlaying}
            onStallFallback={handleStallFallback}
            onPlayingChange={handlePlayingChange}
            onAutoplayBlocked={handleAutoplayBlocked}
          />
        </div>

        {/* ── Layer 1: gradient scrim ─────────────────────────────────────
            Light overlay so text stays legible over any video frame.
            Uses two gradients stacked:
              • bottom-to-top deep fade  (keeps headline/buttons readable)
              • flat mid-tone wash       (takes the raw brightness edge off)
            Kept intentionally light so the video remains visible and cinematic.
        ── */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}
        >
          {/* Bottom-to-top fade — anchors the text block */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(7,21,16,0.72) 0%, rgba(7,21,16,0.28) 45%, transparent 100%)',
            }}
          />
          {/* Flat mid-tone wash — reduces overall brightness slightly */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(7,21,16,0.18)',
            }}
          />
        </div>

        {/* ── Layer 2: content column ──
            • Takes up ALL remaining flex height via flex-1.
            • paddingTop clears the fixed transparent Navbar:
                60 px on phones  / 68 px on sm  / 76 px on lg+
              plus a little breathing room above the first text line.
            • paddingBottom reserves space above where the absolute
              bottom bar sits (≈ 48 px) + safe-area.
            • overflowY:auto lets very-short screens (320×568, landscape
              667×375) scroll the content rather than clip it, while the
              media still fills the full section behind.
        ── */}
        <div
          className="relative flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 min-h-0 w-full"
          style={{
            zIndex: 10,
            /* Clear navbar + comfortable gap */
            paddingTop: 'calc(60px + clamp(16px, 3vh, 32px))',
            /* Reserve space for absolute bottom bar + safe-area */
            paddingBottom: 'calc(48px + env(safe-area-inset-bottom, 0px) + clamp(8px, 1.5vh, 16px))',
            overflowY: 'auto',
          }}
        >
          <div
            className="max-w-3xl w-full mx-auto text-center flex flex-col items-center"
            style={{ gap: 'clamp(8px, 1.4vh, 16px)' }}
          >

            {/* Overline — "Tourism Week Round 7th" */}
            <div className="fade-rise delay-100 inline-flex items-center justify-center">
              <span
                className="font-extrabold uppercase font-editorial"
                style={{
                  fontSize: 'clamp(1.2rem, 2.25vw + 0.3rem, 1.65rem)',
                  color: '#F5C842',
                  textShadow: '0 0 20px rgba(217,164,65,0.6), 0 2px 8px rgba(0,0,0,0.9)',
                  letterSpacing: '0.2em',
                }}
              >
                {edition?.editionNameI18n[currentLang] ?? edition?.editionNameI18n.en}
              </span>
            </div>

            {/* Headline — fluid size: ~30px on 360, ~46px on 768, ~62px on 1440 */}
            <h1
              className="font-editorial font-extrabold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] min-h-[1.2em] fade-rise delay-200 leading-[1.1] tracking-tight text-balance"
              style={{ fontSize: 'clamp(0.925rem, 2.25vw + 0.2rem, 1.875rem)' }}
            >
              {typingDone ? (
                <>
                  {themeBefore}
                  <em className="gold-italic not-italic font-editorial">{themeGold}</em>
                  {themeAfter}
                </>
              ) : (
                <>
                  <span>{typedTheme}</span>
                  <span
                    className="inline-block w-[3px] h-[0.75em] ml-1.5 bg-[#D9A441] align-middle rounded-full shadow-[0_0_8px_#D9A441] animate-pulse"
                    aria-hidden="true"
                  />
                </>
              )}
            </h1>

            {/* Sub-theme — fluid */}
            <p
              className="text-stone-200/90 leading-relaxed max-w-xl mx-auto font-normal fade-rise delay-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] text-pretty"
              style={{ fontSize: 'clamp(0.78rem, 1.2vw + 0.2rem, 1rem)' }}
            >
              {edition?.subThemeI18n?.[currentLang] ?? edition?.subThemeI18n?.en ?? t('hero.tagline')}
            </p>

            {/* Venue chip — solid bg on mobile (≤lg), backdrop-blur on desktop */}
            <div
              className="inline-flex items-center gap-2 text-stone-200 px-4 py-1.5 rounded-full border border-white/15 fade-rise delay-400 lg:backdrop-blur-md"
              style={{
                fontSize: 'clamp(0.75rem, 1.2vw, 0.9rem)',
                /* Solid bg on mobile avoids compositing cost; desktop keeps blur */
                background: 'rgba(0,0,0,0.50)',
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-[#D9A441] shrink-0" aria-hidden="true" />
              <span>{edition?.venueI18n[currentLang] ?? edition?.venueI18n.en}</span>
            </div>

            {/* ── Status block ── */}

            {/* UPCOMING: countdown — isolated in its own memoized component;
                the 1-second tick never re-renders the hero or video wrapper */}
            {editionStatus === 'upcoming' && edition?.startDateGC && (
              <HeroCountdown
                targetDateGC={edition.startDateGC}
                labels={{
                  startsIn: t('hero.startsIn'),
                  days:     t('hero.days'),
                  hours:    t('hero.hours'),
                  minutes:  t('hero.minutes'),
                  seconds:  t('hero.seconds'),
                }}
              />
            )}

            {/* LIVE: happening-now — no card, just text + pulse dot */}
            {editionStatus === 'live' && (
              <div className="flex flex-col items-center gap-2 fade-rise delay-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    {t('hero.happeningNow')}
                  </span>
                </div>
                {todayHighlight ? (
                  <>
                    <p className="font-display font-bold text-base text-white text-center">
                      Day {todayHighlight.day}: {todayHighlight.titleI18n[currentLang] ?? todayHighlight.titleI18n.en}
                    </p>
                    <p className="text-xs text-stone-300 text-center capitalize">
                      {todayHighlight.session} Session · {todayHighlight.venueNameI18n[currentLang] ?? todayHighlight.venueNameI18n.en} · Free public entry
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-stone-300 text-center">{t('hero.viewSchedule')}</p>
                )}
              </div>
            )}

            {/* PAST: highlights — no card, just icon + text + buttons */}
            {editionStatus === 'past' && (
              <div className="flex flex-col items-center gap-3 fade-rise delay-500">
                <Trophy className="h-7 w-7 text-[#D9A441]" aria-hidden="true" />
                <h2 className="font-editorial font-bold text-lg text-white text-center">
                  {t('hero.highlightsTitle')}
                </h2>
                <p className="text-xs text-stone-300 text-center">{t('hero.nextEditionAnnouncement')}</p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <NavLink
                    to="/schedule"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#D9A441] text-[#071510] font-bold text-sm hover:bg-[#C59132] transition-all"
                  >
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    {t('hero.viewSchedule')}
                  </NavLink>
                  <NavLink
                    to="/gallery"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm border border-white/20 hover:bg-white/20 transition-all"
                  >
                    {t('hero.viewGallery')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </NavLink>
                </div>
              </div>
            )}

            {/* CTAs for upcoming + live */}
            {editionStatus !== 'past' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center fade-rise delay-500 w-full sm:w-auto"
                style={{ gap: 'clamp(8px,1.5vw,12px)' }}>
                <NavLink
                  to="/schedule"
                  className="lift inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D9A441] text-[#071510] font-bold hover:bg-[#C59132] transition-colors shadow-lg w-full sm:w-auto"
                  style={{ padding: 'clamp(12px,1.6vh,14px) clamp(20px,4vw,28px)', fontSize: 'clamp(0.82rem,1.2vw,0.9rem)' }}
                >
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('hero.viewSchedule')}
                </NavLink>
                <NavLink
                  to="/events"
                  className="lift inline-flex items-center justify-center gap-2 rounded-2xl text-white font-semibold border border-white/25 hover:bg-white/18 transition-colors w-full sm:w-auto lg:backdrop-blur-md"
                  style={{
                    padding: 'clamp(12px,1.6vh,14px) clamp(20px,4vw,28px)',
                    fontSize: 'clamp(0.82rem,1.2vw,0.9rem)',
                    background: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Compass className="h-4 w-4 text-[#D9A441] shrink-0" aria-hidden="true" />
                  {t('hero.exploreEvents')}
                </NavLink>
              </div>
            )}
          </div>{/* end content inner */}
        </div>{/* end content column (Layer 2) */}

        {/* ── Layer 2b: iOS autoplay-blocked Play button ──────────────────────
            Shown when the browser loaded the video but blocked autoplay
            (iOS Low Power Mode, some Android policies).
            Absolutely positioned so it never affects layout.
            Poster is already covering the hero (the <video> element shows
            its poster frame). This button lets the user start the video.
        ── */}
        {autoplayBlocked && !useStaticPoster && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 10 }}
            aria-hidden="true"
          >
            <button
              type="button"
              onClick={toggleVideo}
              aria-label={t('hero.playVideo')}
              aria-hidden="false"
              className="pointer-events-auto flex items-center justify-center w-16 h-16 rounded-full border-2 border-white/40 text-white hover:scale-105 transition-all focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
              style={{ background: 'rgba(0,0,0,0.55)' }}
            >
              <Play className="h-7 w-7 ml-1 text-[#D9A441]" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Layer 3: bottom bar — absolute so it NEVER consumes flex height ──
            Pinned to the bottom of the section, above the safe area.
            The content column already pads-bottom to clear this bar.
        ── */}
        <div
          className="absolute left-0 right-0 bottom-0 z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-stone-400"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
            paddingTop: '6px',
            fontSize: 'clamp(0.6rem,1vw,0.7rem)',
          }}
        >
          {/* Video pause/play — shown when video is active */}
          {!useStaticPoster && (
            <button
              type="button"
              onClick={toggleVideo}
              aria-label={isPlaying ? t('hero.pauseVideo') : t('hero.playVideo')}
              className="flex items-center gap-1 text-stone-300 hover:text-white bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 transition-colors"
            >
              {isPlaying
                ? <Pause className="h-3 w-3 text-[#D9A441]" aria-hidden="true" />
                : <Play  className="h-3 w-3 text-[#D9A441]" aria-hidden="true" />}
              <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          )}
          {/* Play button when poster is showing (Save-Data / reduced-motion) */}
          {useStaticPoster && (
            <button
              type="button"
              onClick={() => {
                setUseStaticPoster(false);
                setIsPlaying(true);
              }}
              aria-label={t('hero.playVideo')}
              className="flex items-center gap-1 text-stone-300 hover:text-white bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 transition-colors"
            >
              <Play className="h-3 w-3 text-[#D9A441]" aria-hidden="true" />
              <span className="hidden sm:inline">Play</span>
            </button>
          )}

          {/* Featured wonders — hidden on very small screens; solid bg on mobile */}
          <div
            className="hidden sm:flex items-center gap-1.5 text-stone-300 px-3 py-1 rounded-full border border-[#D9A441]/20 lg:backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.50)' }}
          >
            <span className="text-[#D9A441] font-bold uppercase" style={{ fontSize: 'clamp(0.55rem,0.9vw,0.65rem)', letterSpacing:'0.1em' }}>
              Wonders:
            </span>
            {/* Use DB items when available, fall back to registry defaults */}
            {(heroSection?.items?.length
              ? heroSection.items as AnyCard[]
              : (getSectionEntry('home.hero')?.defaultContent?.cards ?? []) as AnyCard[]
            ).map((w, i, a) => {
              const n = normaliseCard(w, currentLang)
              return (
                <React.Fragment key={i}>
                  <span className="text-white font-medium">{n.title}</span>
                  {i < a.length - 1 && <span className="text-[#D9A441]/40" aria-hidden="true">·</span>}
                </React.Fragment>
              )
            })}
          </div>

          {/* Scroll hint */}
          <a
            href="#below-hero"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <span className="hidden sm:inline">{t('hero.scrollDown')}</span>
            <ArrowDown className="h-3.5 w-3.5 animate-bounce text-[#D9A441]" aria-hidden="true" />
          </a>
        </div>
      </section>
      {/* ═══════════════════════════════════════════════════════════════
          B  TODAY / NEXT-UP DISPATCH CARD
          Only shown when the festival is LIVE (between start and end dates).
          Hidden for upcoming (no highlight yet) and past (event is over).
      ═══════════════════════════════════════════════════════════════ */}
      {editionStatus === 'live' && todayHighlight && (
        <section
          id="below-hero"
          aria-label="Today's highlight"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20 fade-rise"
        >
          <div className="rounded-3xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 shadow-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-[#0F3D2E] text-[#D9A441] flex items-center justify-center shrink-0 shadow-lg border border-[#D9A441]/25">
                <Calendar className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">
                  <span>Today's Official Highlight</span>
                  <span aria-hidden="true">·</span>
                  <StatusBadge status={todayHighlight.status} />
                </div>
                <h2 className="heading-md text-stone-900 dark:text-stone-100 truncate">
                  {todayHighlight.titleI18n[currentLang] ?? todayHighlight.titleI18n.en}
                </h2>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Clock   className="h-3.5 w-3.5 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                    <span className="capitalize">{todayHighlight.session} Session</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin  className="h-3.5 w-3.5 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                    <span>{todayHighlight.venueNameI18n[currentLang] ?? todayHighlight.venueNameI18n.en}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <NavLink
                to={`/events/${todayHighlight.slug}`}
                className="lift inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0F3D2E] text-white hover:bg-[#0A2A20] font-semibold text-sm transition-colors shadow-md"
              >
                Explore Activity
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </NavLink>
              <button
                type="button"
                onClick={() => handleICS(todayHighlight)}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-xs transition-colors"
                title="Add to calendar (.ics)"
              >
                <CalendarPlus className="h-4 w-4 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                <span className="hidden sm:inline">Add to Cal</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          C  FLAGSHIP HIGHLIGHTS CAROUSEL
      ═══════════════════════════════════════════════════════════════ */}
      {featuredEvents.length > 0 && (
      <section
        id="below-hero"
        aria-label="Featured festival highlights"
        className="section-gap bg-canvas"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 fade-rise">
            <div>
              <p className="overline mb-2">
                {secText(highlightsSection, 'subtitleI18n', currentLang, 'home.highlights', 'subtitle') || 'Flagship Attractions'}
              </p>
              <h2 className="heading-lg text-stone-900 dark:text-stone-100">
                {secText(highlightsSection, 'titleI18n', currentLang, 'home.highlights', 'title') || 'Top Festival Highlights'}
              </h2>
              <p className="mt-2 text-base text-stone-500 dark:text-stone-400 max-w-xl">
                {secText(highlightsSection, 'bodyI18n', currentLang, 'home.highlights', 'body') || `Cultural pageantry, athletic determination, and living heritage — ${allDays.length} days of celebration.`}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Prev / Next */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollHighlights('left')}
                  aria-label="Previous highlights"
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollHighlights('right')}
                  aria-label="Next highlights"
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {/* Accessible pause — no descriptive text label visible */}
              <button
                type="button"
                onClick={() => setHighlightsPaused((v) => !v)}
                aria-label={highlightsPaused ? 'Resume carousel' : 'Pause carousel'}
                title={highlightsPaused ? 'Resume' : 'Pause'}
                className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                {highlightsPaused
                  ? <Play  className="h-4 w-4 text-[#D9A441]" aria-hidden="true" />
                  : <Pause className="h-4 w-4 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                }
              </button>
              <NavLink
                to="/events"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
              >
                View All {events?.length ?? 0} Activities
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </NavLink>
            </div>
          </div>
        </div>

        {/* Scrollable track — full bleed with edge fade */}
        <div className="relative">
          <div
            ref={highlightsRef}
            onMouseEnter={() => setHighlightsPaused(true)}
            onMouseLeave={() => setHighlightsPaused(false)}
            onTouchStart={() => setHighlightsPaused(true)}
            onTouchEnd={() => setHighlightsPaused(false)}
            className="flex gap-5 overflow-x-auto no-scrollbar edge-fade pb-4 pt-2 pl-4 sm:pl-6 lg:pl-8 pr-4 sm:pr-6 lg:pr-8 cursor-grab active:cursor-grabbing select-none"
          >
            {marqueeEvents.map((evt, idx) => (
              <article
                key={`${evt.id}-${idx}`}
                className="lift w-[82vw] sm:w-[380px] lg:w-[420px] shrink-0 flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-[#12221C] border border-stone-100 dark:border-stone-800 group"
              >
                {/* Image frame — same fit as Festival Highlights cards */}
                <div className="relative w-full overflow-hidden bg-stone-100 dark:bg-stone-900" style={{ aspectRatio: '4/3' }}>
                  {(() => { const ri = resolveImage(getEventCardImage(evt, idx % (featuredEvents.length || 1))); return (
                  <img
                    src={ri.src}
                    srcSet={ri.srcSet || undefined}
                    sizes={ri.srcSet ? '(min-width: 1024px) 420px, (min-width: 640px) 380px, 82vw' : undefined}
                    alt={evt.titleI18n.en}
                    loading="lazy"
                    decoding="async"
                    width={420} height={315}
                    className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-700"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fb = '/assets/optimized/image_b3b470e9-960.webp';
                      if (img.src !== window.location.origin + fb) { img.srcset = ''; img.src = fb; }
                    }}
                  />); })()}
                </div>

                {/* Card body */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#D9A441] text-[#071510] text-[10px] font-bold">
                        Day {evt.day}
                      </span>
                      <StatusBadge status={evt.status} />
                    </div>
                    <h3 className="font-display font-bold text-base text-stone-900 dark:text-stone-100 leading-snug line-clamp-2">
                      {evt.titleI18n[currentLang] ?? evt.titleI18n.en}
                    </h3>
                  </div>
                  <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                    {evt.descriptionI18n[currentLang] ?? evt.descriptionI18n.en}
                  </p>
                  <div className="flex items-center justify-between text-xs border-t border-stone-100 dark:border-stone-800 pt-3">
                    <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 truncate max-w-[55%]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                      <span className="truncate">{evt.venueNameI18n[currentLang] ?? evt.venueNameI18n.en}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleICS(evt)}
                        title="Add to calendar"
                        className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                      </button>
                      <NavLink
                        to={`/events/${evt.slug}`}
                        className="font-bold text-[#0F3D2E] dark:text-[#D9A441] hover:underline whitespace-nowrap"
                      >
                        Details →
                      </NavLink>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          D  INTERACTIVE DAY SELECTOR
      ═══════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Daily schedule explorer"
        className="section-gap bg-section-alt"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 fade-rise">
            <div>
              <p className="overline mb-2">
                {secText(itinerarySection, 'subtitleI18n', currentLang, 'home.itinerary', 'subtitle') || 'Daily Itinerary'}
              </p>
              <h2 className="heading-lg text-stone-900 dark:text-stone-100">
                {secText(itinerarySection, 'titleI18n', currentLang, 'home.itinerary', 'title') || 'Select a Day to Preview Sessions'}
              </h2>
            </div>
            <NavLink
              to="/schedule"
              className="text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline shrink-0"
            >
              Full Schedule →
            </NavLink>
          </div>

          {/* Day tabs — large numerals, gold underline on active */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 fade-rise delay-100">
            {visibleDays.map((dayMeta) => {
              const isActive = activeDay === dayMeta.day;
              return (
                <button
                  key={dayMeta.day}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveDay(dayMeta.day)}
                  className={`tab-gold-underline ${isActive ? 'active' : ''} relative p-4 rounded-2xl text-left transition-all border focus-visible:outline-2 focus-visible:outline-[#D9A441] ${
                    isActive
                      ? 'bg-[#0F3D2E] text-white border-[#0F3D2E] shadow-lg dark:bg-[#D9A441]/15 dark:border-[#D9A441]'
                      : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600'
                  }`}
                >
                  <span className={`block font-editorial text-4xl font-extrabold leading-none mb-1 ${isActive ? 'text-[#D9A441]' : 'text-stone-300 dark:text-stone-600'}`}>
                    {dayMeta.day}
                  </span>
                  <span className={`block text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-white/80 dark:text-[#D9A441]' : 'text-stone-500 dark:text-stone-500'}`}>
                    {dayMeta.dayOfWeek}
                  </span>
                  <span className={`block text-[10px] mt-0.5 ${isActive ? 'text-white/60' : 'text-stone-400 dark:text-stone-600'}`}>
                    {dayMeta.ecShort} E.C.
                  </span>
                  {dayTitleMap[dayMeta.day] && (
                    <span className={`block text-[9px] mt-1 leading-tight truncate max-w-full font-medium ${isActive ? 'text-[#D9A441]' : 'text-stone-400 dark:text-stone-500'}`}>
                      {dayTitleMap[dayMeta.day]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Day activities panel */}
          <div className="rounded-3xl bg-white dark:bg-[#12221C] border border-stone-100 dark:border-stone-800 p-6 sm:p-8 space-y-6 fade-rise delay-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-stone-100 dark:border-stone-800">
              {(() => {
                const dayMeta = visibleDays.find((d) => d.day === activeDay) ?? visibleDays[0];
                return (
                  <div>
                    <h3 className="heading-md text-stone-900 dark:text-stone-100">
                      Day {activeDay} — {dayMeta?.dayOfWeek ?? ''}
                    </h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                      {dayMeta ? formatDualDate(dayMeta.ec, dayMeta.gc, currentLang) : ''}
                    </p>
                  </div>
                );
              })()}
              <NavLink
                to={`/schedule?day=${activeDay}`}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F3D2E] dark:text-[#D9A441] hover:underline shrink-0"
              >
                Open in Schedule
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </NavLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayEvents.length === 0 ? (
                <p className="col-span-2 text-sm text-stone-500 dark:text-stone-400 py-4 text-center italic">
                  Programme for this day hasn't been published yet — check back soon.
                </p>
              ) : dayEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="lift p-5 rounded-2xl bg-stone-50 dark:bg-[#0F1E19] border border-stone-100 dark:border-stone-800 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">
                      {({ morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as Record<string,string>)[evt.session] ?? evt.session} Session
                    </span>
                    <StatusBadge status={evt.status} />
                  </div>
                  <h4 className="font-display font-bold text-base text-stone-900 dark:text-stone-100 leading-snug">
                    {evt.titleI18n[currentLang] ?? evt.titleI18n.en}
                  </h4>
                  <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                    {evt.descriptionI18n[currentLang] ?? evt.descriptionI18n.en}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
                    <span className="flex items-center gap-1.5 text-stone-400">
                      <MapPin className="h-3.5 w-3.5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0" aria-hidden="true" />
                      <span className="truncate max-w-[60%]">{evt.venueNameI18n[currentLang] ?? evt.venueNameI18n.en}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleICS(evt)}
                      className="font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
                    >
                      + Add to Cal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          E  EXPLORE WOLISO — equal-height overlay cards
      ═══════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Explore Woliso destinations"
        className="section-gap bg-canvas"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3 fade-rise">
            <p className="overline">Beyond the Campus</p>
            <h2 className="heading-lg text-stone-900 dark:text-stone-100">
              {secText(exploreSection, 'titleI18n', currentLang, 'home.explore', 'title') || 'Explore Woliso & the South West Shewa Eco-Corridor'}
            </h2>
            <p className="text-base text-stone-500 dark:text-stone-400 max-w-2xl mx-auto">
              {secText(exploreSection, 'subtitleI18n', currentLang, 'home.explore', 'subtitle') || 'Woliso is a gateway to volcanic caldera lakes, geothermal hot springs, and ancient forests — a living classroom for our Tourism students.'}
            </p>
          </div>

          {/* Equal-height cards with overlay titles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-rise delay-200">
            {/* Use DB items when available; fall back to built-in defaults */}
            {(exploreSection?.items?.length
              ? exploreSection.items as AnyCard[]
              : (getSectionEntry('home.explore')?.defaultContent?.cards ?? []) as AnyCard[]
            ).map((raw, idx) => {
              const c = normaliseCard(raw, currentLang)
              const imgSrc = c.imageUrl ?? (idx === 0 ? WONCHI_URL : COFFEE_URL)
              return (
                <div
                  key={c.id ?? String(idx)}
                  className="lift group relative rounded-3xl overflow-hidden"
                  style={{ minHeight: '420px' }}
                >
                  <img
                    src={imgSrc}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071510]/90 via-[#071510]/30 to-transparent" />

                  {c.badge && (
                    <div className="absolute top-5 left-5">
                      <span className="px-3 py-1 rounded-full bg-black/70 text-[#D9A441] text-xs font-bold backdrop-blur-md">
                        {c.badge}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    {c.icon && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#D9A441] uppercase tracking-wider mb-2">
                        {resolveIcon(c.icon)}
                        <span>{c.icon}</span>
                      </div>
                    )}
                    <h3 className="font-editorial font-bold text-xl text-white mb-2">{c.title}</h3>
                    <p className="text-sm text-stone-300 leading-relaxed line-clamp-3">{c.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          F  STATS BAND
          daysCount / activitiesCount = computed from events array.
          Community Attendees / Artisan Exhibitors = hardcoded permanently.
      ═══════════════════════════════════════════════════════════════ */}
      {(() => {
        const computedDays       = events ? new Set(events.map((e) => e.day)).size : null;
        const computedActivities = events ? events.length : null;

        type StatTile = { num: string; label: string; sub: string };
        const allTiles: Array<StatTile | null> = [
          computedDays != null
            ? { num: String(computedDays), label: 'Celebration Days', sub: edition?.dateRangeDisplayI18n[currentLang] ?? '' }
            : null,
          computedActivities != null
            ? { num: String(computedActivities), label: 'Public Activities', sub: 'Culture, sports, debates & tours' }
            : null,
          // Hardcoded permanently — never hidden, never depends on snapshot/DB
          { num: '2,000+', label: 'Community Attendees', sub: 'Students, townspeople & visitors' },
          { num: '30+',    label: 'Artisan Exhibitors',  sub: 'Indigenous crafts & textile booths' },
        ];
        const statTiles: StatTile[] = allTiles.filter((t): t is StatTile => t !== null);

        if (statTiles.length === 0) return null;

        const cols = statTiles.length <= 2 ? 'grid-cols-2' : statTiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';

        // Icon mapping per stat label
        const statIcons: Record<string, React.ReactNode> = {
          'Celebration Days': (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          ),
          'Public Activities': (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ),
          'Community Attendees': (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          ),
          'Artisan Exhibitors': (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9.813 15.904 1.075-3.754a1.125 1.125 0 0 1 1.082-.815h.022a1.125 1.125 0 0 1 1.082.816l1.075 3.753M9.813 15.904 7.01 7.497A1.125 1.125 0 0 0 5.926 6.75H4.5M9.813 15.904l-1.31 4.578A1.125 1.125 0 0 0 9.584 21.75h4.832a1.125 1.125 0 0 0 1.08-1.268l-1.309-4.578M9.813 15.904h4.374M4.5 6.75h15M4.5 9.75h15" />
            </svg>
          ),
        };

        return (
          <section
            aria-label="Festival statistics"
            className="bg-[#0F3D2E] dark:bg-[#071510] py-20 sm:py-24"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className={`grid ${cols} divide-y lg:divide-y-0 lg:divide-x divide-[#D9A441]/20 fade-rise`}>
                {statTiles.map((s, i) => (
                  <div key={i} className="group relative px-6 sm:px-10 py-8 text-center">
                    {/* icon */}
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#D9A441]/10 text-[#D9A441] mb-3 ring-1 ring-[#D9A441]/20">
                      {statIcons[s.label]}
                    </span>
                    {/* number */}
                    <span className="block font-editorial text-5xl sm:text-6xl font-extrabold text-[#D9A441] tabular-nums leading-none">
                      {s.num}
                    </span>
                    {/* label */}
                    <span className="block text-sm text-white font-bold mt-3 uppercase tracking-wider">
                      {s.label}
                    </span>
                    {/* sub */}
                    <span className="block text-xs text-stone-400 mt-1 line-clamp-2">
                      {s.sub}
                    </span>
                    {/* hover underline */}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#D9A441]/50 rounded-full transition-all duration-300 group-hover:w-12" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          G  THEME / ABOUT PHILOSOPHY
      ═══════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Festival theme and philosophy"
        className="section-gap bg-section-alt"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

            {/* Text side */}
            <div className="lg:col-span-7 space-y-5 fade-rise">
              <p className="overline">
                {secText(philosophySection, 'titleI18n', currentLang, 'home.philosophy', 'title') || 'The Guiding Philosophy'}
              </p>
              <h2 className="heading-lg text-stone-900 dark:text-stone-100">
                {secText(philosophySection, 'bodyI18n', currentLang, 'home.philosophy', 'body') || t('about.themeHeading')}
              </h2>
              <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed">
                {secText(philosophySection, 'subtitleI18n', currentLang, 'home.philosophy', 'subtitle') || t('about.themeParagraph')}
              </p>
              <NavLink
                to="/about"
                className="lift inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors shadow-sm"
              >
                About Department &amp; Faculty
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </NavLink>
            </div>

            {/* 2×2 virtue grid — DB-driven with registry fallback */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4 fade-rise delay-200">
              {(philosophySection?.items?.length
                ? philosophySection.items as AnyCard[]
                : (getSectionEntry('home.philosophy')?.defaultContent?.cards ?? []) as AnyCard[]
              ).map((raw, idx) => {
                const c = normaliseCard(raw, currentLang)
                return (
                  <div
                    key={c.id ?? String(idx)}
                    className="lift p-5 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-100 dark:border-stone-800 text-center space-y-2"
                  >
                    <span className="text-[#0F3D2E] dark:text-[#D9A441] flex justify-center">
                      {resolveIcon(c.icon)}
                    </span>
                    <h4 className="font-display font-bold text-sm text-stone-900 dark:text-stone-100">{c.title}</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{c.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          H  MEDIA GALLERY — masonry layout, hover captions, lightbox
      ═══════════════════════════════════════════════════════════════ */}
      {galleryItems.length > 0 && (
      <section
        aria-label="Celebration media gallery"
        className="section-gap bg-canvas"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 fade-rise">
            <div>
              <p className="overline mb-2">
                {secText(gallerySection, 'subtitleI18n', currentLang, 'home.gallery', 'subtitle') || 'Visual Chronicles'}
              </p>
              <h2 className="heading-lg text-stone-900 dark:text-stone-100">
                {secText(gallerySection, 'titleI18n', currentLang, 'home.gallery', 'title') || 'Celebration Media Gallery'}
              </h2>
              <p className="mt-2 text-base text-stone-500 dark:text-stone-400 max-w-xl">
                {secText(gallerySection, 'bodyI18n', currentLang, 'home.gallery', 'body') || 'Authentic event photography capturing student pageantry, athletic runs, and cultural pride.'}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollGallery('left')}
                  aria-label="Scroll gallery left"
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollGallery('right')}
                  aria-label="Scroll gallery right"
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setGalleryPaused((v) => !v)}
                aria-label={galleryPaused ? 'Resume gallery scroll' : 'Pause gallery scroll'}
                className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                {galleryPaused
                  ? <Play  className="h-4 w-4 text-[#D9A441]" aria-hidden="true" />
                  : <Pause className="h-4 w-4 text-[#0F3D2E] dark:text-[#D9A441]" aria-hidden="true" />
                }
              </button>
              <NavLink
                to="/gallery"
                className="hidden sm:inline text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
              >
                Full Archive →
              </NavLink>
            </div>
          </div>

          {/* ── First 10 images: masonry grid ───────────────────────────── */}
          {galleryItems.length > 0 && (() => {
            const gridItems  = galleryItems.slice(0, 10);
            const extraItems = galleryItems.slice(10);
            const extraMarquee = [...extraItems, ...extraItems];

            return (
              <>
                <div className="masonry fade-rise delay-100">
                  {gridItems.map((item) => (
                    <div
                      key={item.id}
                      className="masonry-item lift group relative rounded-2xl overflow-hidden cursor-pointer bg-stone-100 dark:bg-stone-900"
                      onClick={() => setActiveGalleryModal(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setActiveGalleryModal(item)}
                      aria-label={`View photo: ${item.titleI18n[currentLang] ?? item.titleI18n.en}`}
                    >
                      {(() => {
                        const ri = resolveImage((item as GalleryItem & { thumbUrl?: string }).thumbUrl ?? item.thumbnail ?? item.url);
                        return (
                          <img
                            src={ri.src}
                            srcSet={ri.srcSet || undefined}
                            sizes={ri.srcSet ? '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw' : undefined}
                            alt={item.titleI18n[currentLang] ?? item.titleI18n.en}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        );
                      })()}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#071510]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <span className="small-caps-date text-stone-300">{item.category} · {item.year}</span>
                        <p className="text-xs font-semibold text-white mt-1 line-clamp-2">
                          {item.titleI18n[currentLang] ?? item.titleI18n.en}
                        </p>
                      </div>
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-white border border-white/10">
                        {item.year}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Images 11+: fixed-height horizontal carousel ─────────── */}
                {extraItems.length > 0 && (
                  <div className="relative fade-rise delay-200">
                    <div
                      ref={galleryRef}
                      onMouseEnter={() => setGalleryPaused(true)}
                      onMouseLeave={() => setGalleryPaused(false)}
                      onTouchStart={() => setGalleryPaused(true)}
                      onTouchEnd={() => setGalleryPaused(false)}
                      className="flex gap-4 overflow-x-auto no-scrollbar edge-fade pb-4 pt-2 pl-4 sm:pl-6 lg:pl-8 pr-4 sm:pr-6 lg:pr-8 cursor-grab active:cursor-grabbing select-none"
                    >
                      {extraMarquee.map((item, idx) => (
                        <div
                          key={`${item.id}-extra-${idx}`}
                          className="lift shrink-0 w-[82vw] sm:w-[340px] lg:w-[380px] rounded-2xl overflow-hidden relative group cursor-pointer bg-stone-100 dark:bg-stone-900 flex items-center justify-center"
                          style={{ height: '340px' }}
                          onClick={() => setActiveGalleryModal(item)}
                          role="button"
                          tabIndex={idx < extraItems.length ? 0 : -1}
                          onKeyDown={(e) => e.key === 'Enter' && idx < extraItems.length && setActiveGalleryModal(item)}
                          aria-label={idx < extraItems.length ? `View photo: ${item.titleI18n[currentLang] ?? item.titleI18n.en}` : undefined}
                          aria-hidden={idx >= extraItems.length}
                        >
                          {(() => {
                            const ri = resolveImage((item as GalleryItem & { thumbUrl?: string }).thumbUrl ?? item.thumbnail ?? item.url);
                            return (
                              <img
                                src={ri.src}
                                srcSet={ri.srcSet || undefined}
                                sizes={ri.srcSet ? '(min-width: 1024px) 380px, (min-width: 640px) 340px, 82vw' : undefined}
                                alt={item.titleI18n[currentLang] ?? item.titleI18n.en}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                              />
                            );
                          })()}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#071510]/80 via-[#071510]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <span className="small-caps-date text-stone-300 text-[10px]">{item.category} · {item.year}</span>
                            <p className="text-xs font-semibold text-white mt-0.5 line-clamp-2">
                              {item.titleI18n[currentLang] ?? item.titleI18n.en}
                            </p>
                          </div>
                          <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-white border border-white/10">
                            {item.year}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          I  NEWS — 1 large featured card + 2 smaller
      ═══════════════════════════════════════════════════════════════ */}
      {newsItems && newsItems.length > 0 && (
      <section
        aria-label="Latest news and announcements"
        className="section-gap bg-section-alt"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 fade-rise">
            <div>
              <p className="overline mb-2">
                {secText(newsSection, 'subtitleI18n', currentLang, 'home.news', 'subtitle') || 'Campus Bulletins'}
              </p>
              <h2 className="heading-lg text-stone-900 dark:text-stone-100">
                {secText(newsSection, 'titleI18n', currentLang, 'home.news', 'title') || 'Latest News & Notices'}
              </h2>
            </div>
            <NavLink to="/news" className="text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline shrink-0">
              All Announcements →
            </NavLink>
          </div>

          {newsItems && newsItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-rise delay-100">

              {/* Large featured card */}
              <article className="lift lg:col-span-2 relative rounded-3xl overflow-hidden bg-white dark:bg-[#12221C] border border-stone-100 dark:border-stone-800 flex flex-col">
                {newsItems[0].image ? (
                  <div className="relative h-52 sm:h-64 overflow-hidden bg-stone-100 dark:bg-stone-900">
                    {(() => { const ri = resolveImage(newsItems[0].image); return (
                    <img
                      src={ri.src}
                      srcSet={ri.srcSet || undefined}
                      sizes={ri.srcSet ? '(min-width: 1024px) 66vw, 100vw' : undefined}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={800} height={256}
                      className="w-full h-full object-cover"
                    />); })()}
                  </div>
                ) : (
                  /* No image: CSS gradient block — no empty grey box */
                  <div className="h-36 sm:h-44 bg-gradient-to-br from-[#0F3D2E] via-[#0A2A20] to-[#071510] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D9A441_1px,transparent_1px)] [background-size:20px_20px]" aria-hidden="true" />
                    <Award className="h-12 w-12 text-[#D9A441]/50" aria-hidden="true" />
                  </div>
                )}
                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {newsItems[0].pinned && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#D9A441]/15 text-[#0F3D2E] dark:text-[#D9A441] text-[10px] font-bold uppercase tracking-wider border border-[#D9A441]/30">
                          {t('news.pinned')}
                        </span>
                      )}
                      <span className="small-caps-date">
                        {newsItems[0].publishedAtEC} E.C.
                      </span>
                    </div>
                    <h3 className="heading-md text-stone-900 dark:text-stone-100">
                      {newsItems[0].titleI18n[currentLang] ?? newsItems[0].titleI18n.en}
                    </h3>
                    <p className="text-base text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                      {newsItems[0].excerptI18n[currentLang] ?? newsItems[0].excerptI18n.en}
                    </p>
                  </div>
                  <NavLink to={`/news/${newsItems[0].slug}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F3D2E] dark:text-[#D9A441] hover:underline">
                    {t('news.readMore')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </NavLink>
                </div>
              </article>

              {/* Two smaller cards */}
              <div className="flex flex-col gap-6">
                {newsItems.slice(1, 3).map((news) => (
                  <article
                    key={news.id}
                    className="lift flex-1 p-6 rounded-3xl bg-white dark:bg-[#12221C] border border-stone-100 dark:border-stone-800 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#0F3D2E] dark:text-[#D9A441] uppercase tracking-wider">
                          {news.categoryI18n[currentLang] ?? news.categoryI18n.en}
                        </span>
                        <span className="small-caps-date">{news.publishedAtEC} E.C.</span>
                      </div>
                      <h3 className="font-display font-bold text-base text-stone-900 dark:text-stone-100 leading-snug">
                        {news.titleI18n[currentLang] ?? news.titleI18n.en}
                      </h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-3 leading-relaxed">
                        {news.excerptI18n[currentLang] ?? news.excerptI18n.en}
                      </p>
                    </div>
                    <NavLink to={`/news/${news.slug}`} className="text-sm font-bold text-[#0F3D2E] dark:text-[#D9A441] hover:underline">
                      {t('news.readMore')} →
                    </NavLink>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          J  SPONSORS STRIP
          Renders only when real sponsor data exists (list non-empty).
          Add sponsors to SEED_SPONSORS in seedData.ts to populate this.
      ═══════════════════════════════════════════════════════════════ */}
      {sponsors && sponsors.length > 0 && (
        <section
          aria-label="Sponsors and institutional partners"
          className="section-gap-sm bg-canvas border-t border-stone-100 dark:border-stone-800"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 fade-rise">
              <p className="overline">{t('sponsors.title')}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 fade-rise delay-100">
              {sponsors.map((sp) => (
                <div
                  key={sp.id}
                  className="lift px-5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#12221C] flex items-center gap-3"
                >
                  {(sp as typeof sp & { logo_url?: string | null }).logo_url && (
                    <img
                      src={(sp as typeof sp & { logo_url?: string | null }).logo_url!}
                      alt={sp.name}
                      className="h-8 w-8 object-contain"
                    />
                  )}
                  <span className="text-stone-700 dark:text-stone-300 text-sm font-semibold">{sp.name}</span>
                </div>
              ))}
            </div>
            <div className="text-center mt-8 fade-rise delay-200">
              <NavLink
                to="/sponsors"
                className="text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
              >
                {t('sponsors.becomeSponsorTitle')} →
              </NavLink>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          K  CALL TO ACTION — follow the programme
      ═══════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Follow the programme"
        className="relative bg-[#0F3D2E] dark:bg-[#071510] py-20 sm:py-28 overflow-hidden"
      >
        {/* Dot grid decoration */}
        <div
          className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#D9A441_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none"
          aria-hidden="true"
        />
        <TiletDivider variant="gold" className="absolute top-0 left-0 right-0" />
        <TiletDivider variant="gold" className="absolute bottom-0 left-0 right-0" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center fade-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(16px, 2.5vh, 28px)' }}>

          {/* 1. Chip */}
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#071510]/70 border border-[#D9A441]/30 text-[#D9A441] text-[11px] font-bold uppercase tracking-[0.18em]">
            {ctaSection?.titleI18n?.[currentLang] ?? ctaSection?.titleI18n?.en ?? t('cta.chip')}
          </span>

          {/* 2. Headline */}
          <h2
            className="font-serif font-bold text-white leading-tight text-balance"
            style={{ fontSize: 'clamp(1.75rem, 4vw + 0.5rem, 3rem)' }}
          >
            {ctaSection?.subtitleI18n?.[currentLang] ?? ctaSection?.subtitleI18n?.en ?? t('cta.headline')}
          </h2>

          {/* 3. Subheading — edition theme in italic gold */}
          <p
            className="font-serif italic text-[#D9A441] leading-snug"
            style={{ fontSize: 'clamp(1rem, 1.8vw + 0.2rem, 1.35rem)' }}
          >
            {t('cta.subheading')}
          </p>

          {/* 4. Body paragraph */}
          <p
            className="text-[#FAF7F0]/85 leading-relaxed mx-auto"
            style={{ fontSize: 'clamp(0.95rem, 1.2vw + 0.25rem, 1.0625rem)', maxWidth: '62ch' }}
          >
            {ctaSection?.bodyI18n?.[currentLang] ?? ctaSection?.bodyI18n?.en ?? t('cta.body')}
          </p>

          {/* 5. Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 w-full sm:w-auto pt-1">
            {/* Primary — solid gold */}
            <NavLink
              to={ctaSection?.ctaUrl ?? '/schedule'}
              className="
                cta-btn-primary
                inline-flex items-center justify-center gap-2
                px-8 rounded-2xl bg-[#D9A441] text-[#0A2A20]
                font-bold text-sm
                border-2 border-transparent
                shadow-lg
                transition-all duration-200
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441]
                w-full sm:w-auto
              "
              style={{ minHeight: '52px' }}
            >
              {ctaSection?.ctaLabelI18n?.[currentLang] ?? ctaSection?.ctaLabelI18n?.en ?? t('cta.primaryBtn')}
            </NavLink>

            {/* Secondary — outline */}
            <NavLink
              to="/events"
              className="
                cta-btn-secondary
                inline-flex items-center justify-center gap-2
                px-8 rounded-2xl bg-transparent text-[#FAF7F0]
                font-semibold text-sm
                border-2 border-[#D9A441]/70
                transition-all duration-200
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441]
                w-full sm:w-auto
              "
              style={{ minHeight: '52px' }}
            >
              {t('cta.secondaryBtn')}
            </NavLink>
          </div>

          {/* 6. Footer line */}
          <p
            className="text-[#D9A441] font-bold uppercase tracking-[0.14em] pt-1"
            style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.72rem)' }}
          >
            {t('cta.footerLine')}
          </p>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          GALLERY LIGHTBOX (unchanged functionality)
      ═══════════════════════════════════════════════════════════════ */}
      {activeGalleryModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeGalleryModal.titleI18n[currentLang] ?? activeGalleryModal.titleI18n.en}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center"
          onClick={() => setActiveGalleryModal(null)}
        >
          <div
            className="bg-[#FAF7F0] dark:bg-[#12221C] rounded-t-3xl sm:rounded-3xl max-w-4xl w-full overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800"
            style={{ maxHeight: 'calc(92dvh - env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <span className="overline">{activeGalleryModal.category} · {activeGalleryModal.year} Archive</span>
              <button
                type="button"
                onClick={() => setActiveGalleryModal(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 transition-colors"
                aria-label="Close gallery"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center" style={{ maxHeight: '55dvh' }}>
              <img
                src={activeGalleryModal.url}
                alt={activeGalleryModal.titleI18n[currentLang] ?? activeGalleryModal.titleI18n.en}
                className="w-full object-contain"
                style={{ maxHeight: '55dvh' }}
              />
            </div>
            <div className="space-y-1.5 pb-safe">
              <h4 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
                {activeGalleryModal.titleI18n[currentLang] ?? activeGalleryModal.titleI18n.en}
              </h4>
              {activeGalleryModal.captionI18n && (
                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {activeGalleryModal.captionI18n[currentLang] ?? activeGalleryModal.captionI18n.en}
                </p>
              )}
              <p className="text-xs text-stone-400 dark:text-stone-500 pt-1">
                Ambo University · Woliso Campus · Department of Tourism and Hotel Management
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
