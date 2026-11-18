import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';
import { Navbar } from './Navbar';
import { useLiveContent } from '../../hooks/useLiveContent';
import { ContentDebugView } from '../common/ContentDebugView';

/*
 * RootLayout
 * ----------
 * - Home page gets zero top-padding so the hero is full-bleed behind the navbar.
 * - All other pages get enough top-padding to clear the fixed navbar
 *   (60 px mobile / 68 px tablet / 76 px desktop — matching Navbar heights).
 * - Bottom padding on <main> equals the MobileBottomNav height (64 px) + safe-area
 *   so content is never hidden behind the fixed bar on small screens.
 *   On xl+ the bottom nav is hidden so we drop that padding.
 */
export const RootLayout: React.FC = () => {
  const location   = useLocation();
  const isHomePage = location.pathname === '/';

  useLiveContent();

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7F0] text-[#14201A] dark:bg-[#0B1612] dark:text-[#E8EFEA] transition-colors selection:bg-[#D9A441]/30 selection:text-[#0F3D2E]">

      <Navbar />

      <main
        id="main-content"
        tabIndex={-1}
        className={[
          'flex-1 focus:outline-none',
          /* Top clearance for fixed navbar */
          isHomePage ? 'pt-0' : 'pt-[60px] sm:pt-[68px] lg:pt-[76px]',
          /*
           * Bottom clearance for the fixed MobileBottomNav (xl+ has none).
           *
           * Home page: NO bottom padding on <main>.
           *   The hero `<section>` manages its own height (100svh) and must
           *   fill the full viewport. The bottom nav floats above it via
           *   z-index.  Sections below the hero get their own bottom padding
           *   via the hero's safe-area-aware bottom bar placement.
           *
           * All other pages: add the nav height + safe area so the last
           *   piece of content is never hidden behind the bottom nav.
           */
          isHomePage
            ? 'pb-0'
            : 'pb-[calc(64px+env(safe-area-inset-bottom,0px))] xl:pb-0',
        ].join(' ')}
      >
        <Outlet />
      </main>

      <Footer />
      <MobileBottomNav />
      <ContentDebugView />
    </div>
  );
};
