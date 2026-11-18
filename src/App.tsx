import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { RootLayout } from './components/layout/RootLayout';
import i18n from './lib/i18n';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { EventDetail } from './pages/EventDetail';
import { Events } from './pages/Events';
import { Gallery } from './pages/Gallery';
import { Home } from './pages/Home';
import { Legal } from './pages/Legal';
import { News } from './pages/News';
import { NewsArticle } from './pages/NewsArticle';
import { NotFound } from './pages/NotFound';
import { Schedule } from './pages/Schedule';
import { Sponsors } from './pages/Sponsors';

/**
 * Single staff/organizer portal — lazy loaded so @supabase/supabase-js stays
 * out of the public bundle. Both organizer and admin-role accounts use this
 * portal at /staff/*. The /admin/* prefix redirects here.
 */
const StaffRouter = React.lazy(() => import('./staff/StaffRouter'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] dark:bg-[#0B1612]">
      <div
        className="h-10 w-10 rounded-full border-4 border-[#0F3D2E] border-t-transparent animate-spin"
        role="status"
        aria-label="Loading portal"
      />
    </div>
  );
}

// refetchOnWindowFocus is disabled globally: the live-first layer
// (useLiveContent) handles window-focus refetches manually with its own
// circuit-breaker logic.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <Routes>
            {/* ── Organizer portal (/staff/*) ───────────────────────────── */}
            <Route
              path="staff/*"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <StaffRouter />
                </Suspense>
              }
            />

            {/* ── Legacy /admin/* redirect → organizer portal ─────────── */}
            {/* All accounts including role='admin' sign in at /staff/login */}
            <Route path="admin" element={<Navigate to="/staff/login" replace />} />
            <Route path="admin/*" element={<Navigate to="/staff/login" replace />} />

            {/* ── Public site ──────────────────────────────────────────── */}
            <Route path="/" element={<RootLayout />}>
              <Route index element={<Home />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="events" element={<Events />} />
              <Route path="events/:slug" element={<EventDetail />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="news" element={<News />} />
              <Route path="news/:slug" element={<NewsArticle />} />
              <Route path="about" element={<About />} />
              <Route path="sponsors" element={<Sponsors />} />
              <Route path="contact" element={<Contact />} />
              <Route path="legal" element={<Legal />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
