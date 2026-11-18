# Architecture

## System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Visitor's browser                                               │
│                                                                  │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │  Public site        │    │  Organizer portal (/staff/*)   │  │
│  │  React SPA          │    │  Lazy-loaded chunk             │  │
│  │  (index-*.js)       │    │  (StaffRouter-*.js)            │  │
│  └──────┬──────────────┘    └──────────────┬─────────────────┘  │
│         │                                  │                     │
└─────────┼──────────────────────────────────┼─────────────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────────────┐
│  Vercel CDN          │         │  Supabase                    │
│                      │         │                              │
│  dist/index.html     │         │  Auth (email+password)       │
│  dist/assets/*.js    │         │  PostgreSQL (RLS)            │
│  dist/assets/*.css   │         │  PostgREST (REST API)        │
│  public/health.json  │         │  Storage (7 buckets)         │
│  public/sitemap.xml  │         │  Edge Functions              │
│  public/content-     │◄────────│    submit-message            │
│    meta.json         │         │    trigger-deploy            │
└──────────────────────┘         └──────────────────────────────┘
          │
          │  Webhook POST (trigger-deploy)
          ▼
┌──────────────────────┐
│  Vercel Build        │
│  npm run build       │
│  → prebuild fetches  │
│    Supabase content  │
│  → snapshot.json     │
│  → dist/             │
└──────────────────────┘
```

---

## Data Flow

### Public site — first paint

1. Browser downloads `dist/index.html` from Vercel CDN (< 3 kB).
2. `index-*.js` loads — includes the **build-time snapshot** (`snapshot.json`, ~9 kB gzipped) as a static import.
3. React renders immediately from snapshot data — no network request needed.
4. In the background, `liveContent.ts` calls `get_public_content()` RPC with a 3-second timeout.
5. If the RPC succeeds, the live data replaces snapshot data in React state; persisted to `localStorage`.
6. If it fails (Supabase paused, network error), the **circuit breaker** trips for 10 minutes — no spinner, no error shown to visitors.

### Content update cycle

```
Organizer edits content in portal
        ↓
Supabase DB updated (RLS: is_staff() required)
        ↓
touch_site_state() trigger stamps site_state.last_change_at
        ↓
Organizer clicks "Publish to website"
        ↓
trigger-deploy Edge Function (auth required, 60s cooldown)
        ↓
POST to VERCEL_DEPLOY_HOOK_URL
        ↓
Vercel rebuilds (npm run prebuild → build-content.mjs fetches Supabase)
        ↓
New snapshot.json committed to dist/ → CDN updated
```

### Live overlay (during the event)

For events starting within 14 days or currently live, the public site polls `get_public_content()` every 2 minutes via `useLiveContent`. This keeps event status (Scheduled / Live / Delayed / Cancelled) current without a full redeploy.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Static snapshot at build time | First paint requires zero network requests; works even when Supabase is paused. |
| `get_public_content()` SECURITY INVOKER | Anon can call it; RLS applies — no draft data can leak. |
| `@supabase/supabase-js` only in portal chunk | Keeps ~65 kB of auth/realtime code out of the public bundle. |
| Single portal for organizer + admin | Simplifies account management; `is_admin()` guards only the most destructive operations. |
| `SECURITY DEFINER` + `search_path=''` | Prevents privilege escalation and schema injection on all security functions. |
| Circuit breaker in `liveContent.ts` | Prevents repeated failed RPC calls from degrading UX when Supabase is paused. |
| `guard_edition_is_current` trigger | Second line of defence against direct API updates to `is_current`; complements RLS. |

---

## Module Map

```
src/
├── main.tsx                   Entry point; mounts <ErrorBoundary><App/>
├── App.tsx                    Router: /staff/* (lazy) + public routes
├── lib/
│   ├── snapshot.ts            Static import of build-time JSON snapshot
│   ├── liveContent.ts         Runtime RPC fetch, circuit breaker, cache
│   ├── contentAdapter.ts      Adapts DB rows → public types (live overlay)
│   ├── supabaseStaff.ts       Supabase client (portal only; tw-staff-auth key)
│   ├── supabase.ts            Re-export alias for backward compat
│   ├── i18n.ts                i18next setup + all translations (en, am, om)
│   ├── icsGenerator.ts        .ics calendar export
│   ├── editionDays.ts         Day number ↔ calendar date helpers
│   ├── ethiopianCalendar.ts   EC ↔ GC date conversion
│   └── sectionRegistry.ts     Maps page section keys to display info
├── components/
│   ├── ErrorBoundary.tsx      Global React error boundary
│   └── layout/                Navbar, Footer, RootLayout
├── pages/                     Public site pages (13 routes)
├── hooks/                     useTourismQueries, useLiveContent, …
├── staff/                     Organizer portal (lazy-loaded)
│   ├── auth/                  AuthProvider (session + profile + inactivity timer)
│   ├── components/            StaffLayout, Toast, ConfirmPasswordModal, …
│   ├── context/               PortalContext
│   ├── hooks/                 TanStack Query hooks for all portal data
│   ├── services/              Service layer (eventsService, adminService, …)
│   └── pages/                 All portal pages (events, news, gallery, …)
└── types/
    ├── index.ts               Public site types (EventItem, NewsItem, …)
    └── database.ts            Hand-crafted Supabase Database<> type
```

---

## Security Layers

```
Request → Vercel CDN headers
       → React Router (client-side, /admin redirects)
       → RequireStaff guard (UX convenience)
       → Supabase Auth JWT verification
       → Row Level Security (is_staff() / is_admin())
       → guard_profile_role_change trigger
       → guard_edition_is_current trigger
       → validate_event_day_range trigger
       → Edge Function auth checks (trigger-deploy verifies JWT + profile)
```
