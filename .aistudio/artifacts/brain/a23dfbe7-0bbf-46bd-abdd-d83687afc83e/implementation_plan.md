# Ambo University Woliso Campus — Tourism Week Website (Phase 1)

A public, production-grade promotional and event communication web application for Ambo University, Woliso Campus, and its Department of Tourism and Hotel Management. Built to celebrate the 5th Annual Tourism Celebration ("Tourism for Peace and Stability"), spotlight the department's academic and community achievements, and keep the public seamlessly informed before, during, and after the event with zero login or registration friction.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during initial interactive discovery and directly govern Phase 1 implementation:

- **Confirmed Decision 1 (Event State Simulation)**: A discreet, accessible testing toggle will be included in the preview/development environment to allow immediate verification of all three core hero and schedule states: **Upcoming** (with live countdown), **Live** (highlighting current day/session activities), and **Past** (highlighting event gallery and recap).
- **Confirmed Decision 2 (Default Language & Trilingual Switcher)**: English is configured as the default initial language for wide accessibility, with a persistent, instantaneous one-tap language switcher across all three regional languages: **English**, **Amharic (አማርኛ)**, and **Afaan Oromo**. Selections persist in `localStorage` and dynamically adapt font typography (`Noto Sans Ethiopic` for Amharic, `Plus Jakarta Sans` for English and Afaan Oromo).
- **Confirmed Decision 3 (Scaffolding Scope)**: Phase 1 implements the complete **Foundation + Interactive Shell & Navigation**, establishing the design tokens, layout hierarchy (sticky topbar, mobile bottom navigation bar, announcement banner, footer), trilingual dictionary seeds, typed service layer, and responsive page routing skeletons with unified loading, error, and empty states.

---

## 1. Overview & Core Concept

- **What It Does**: Serves as the authoritative, public-facing digital hub for Ambo University Woliso Campus Tourism Week. Enables local residents, university staff, students, domestic and international tourists, and institutional partners to explore the event programme, view day-by-day schedules (Campus vs. Town venues), read departmental announcements, browse media galleries, and access contact and sponsorship information without any account creation or barrier.
- **Target Audience / Persona**:
  - *Woliso Community & Visitors*: Seeking quick access on mobile devices (often under 2G/3G conditions) to know what events are taking place today, where in town or campus to join, and when.
  - *Academic Community & Students*: Faculty, guest lecturers, and participants joining seminars, debates, athletic competitions, and exhibitions.
  - *Prospective Sponsors & Partners*: Regional tourism boards, eco-lodges, hotels, and local businesses wanting to support the festival and submit sponsorship inquiries.
- **Key Value**: Low-bandwidth, mobile-first, high-legibility access to accurate event schedules and cultural programming, celebrated with authentic Ethiopian visual distinction and full trilingual fluency.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Public Discovery Flow**: Visitor opens the site on mobile or desktop $\rightarrow$ views the rich hero announcing the 5th Annual Edition with live countdown or live status $\rightarrow$ reads urgent banner notice $\rightarrow$ navigates effortlessly via sticky top bar or mobile bottom nav.
2. **Trilingual Switching Flow**: Visitor taps language button in header or footer (`EN` / `አማ` / `OM`) $\rightarrow$ UI text, event titles, descriptions, and date conventions instantly re-render in the chosen language without page reload $\rightarrow$ font family and line-height adjust automatically for Ethiopian script (`Noto Sans Ethiopic`).
3. **Dual Calendar Display**: All dates are presented with dual Ethiopian Calendar (E.C.) and Gregorian Calendar (G.C.) references (e.g., *Megabit 29, 2017 E.C. / April 7, 2025 G.C.*), respecting local cultural norms.

### Visual Identity & Theme
- **Aesthetic Direction**: Academic, editorial, welcoming, and proudly Ethiopian. Uses subtle geometric Ethiopian textile motifs (*tilet*) as delicate hairline section dividers and accent borders, steering clear of generic corporate templates.
- **Color Tokens**:
  - `Primary Forest Green`: `#0F3D2E` (Dark variant `#0A2A20`) — evokes Ethiopian highlands, university prestige, and nature-based tourism.
  - `Warm Gold Accent`: `#D9A441` — celebrations, prestige, and cultural jewelry.
  - `Terracotta Highlight`: `#C65D3B` — earthen architecture, traditional pottery, and active badges.
  - `Off-White Canvas`: `#FAF7F0` (light) with `Ink Text` `#14201A` ensuring $>7:1$ WCAG AAA contrast.
  - `Dark Mode Canvas`: `#0B1612` (deep green-black) with soft limestone text `#E8EFEA` and slate borders `#1A2D24`.
- **Typography Pairing**:
  - *Headings & Titles*: **Bricolage Grotesque** (expressive, rhythmic, editorial sans with personality).
  - *Body Prose & Controls*: **Plus Jakarta Sans** (clean, crisp, comfortable reading cadence).
  - *Ethiopic Script*: **Noto Sans Ethiopic** (balanced vertical proportions and native line-height compensation).
  - *Numerals & Timestamps*: `tabular-nums` for aligned scheduling and countdowns.
- **Component Styling & Layout**:
  - Rounded-2xl structural surfaces, subtle hairline borders (`1px solid var(--border)`).
  - Single-elevation depth with soft ambient diffusion.
  - Zero-pill metadata discipline: metadata renders with typographic dot separators (`·`), reserving bordered controls strictly for interactive filter tabs.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Zero-Friction Public Access (Strict Non-Negotiable)**
  - *Chosen Approach*: Completely anonymous, read-only public experience. No authentication, no user profiles, no ticket generation, no notification subscriptions, and no dashboards.
  - *Why*: The brief demands universal access for citizens and festival attendees on mobile browsers without barriers.
- **Decision 2: Decoupled Services Layer Architecture**
  - *Chosen Approach*: All UI components consume data exclusively through async service functions (`src/services/*.ts`) backed by TanStack Query hooks. Components never import raw seed data directly.
  - *Why*: Allows future automated backend integration (Postgres, Firebase, or headless CMS) to replace seed data seamlessly with zero refactoring in page or component templates.
- **Decision 3: Standalone Ethiopian Calendar Converter**
  - *Chosen Approach*: A lightweight, pure TypeScript calculation module (`src/lib/ethiopianCalendar.ts`) handling conversion between Gregorian and Ethiopian dates (year, month name, day of week) in English, Amharic, and Afaan Oromo.
  - *Why*: Zero external heavyweight runtime dependencies, works 100% offline, and accurately converts the 2017 E.C. festival schedule.
- **Decision 4: Mobile Sticky Cap Governance & Bandwidth Adaptability**
  - *Chosen Approach*: Sticky header + mobile bottom bar capped at $\le 12\%$ of viewport height. Poster-first media loading detecting `navigator.connection.saveData` or slow connections.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Root (src/App.tsx)                          │
│          Trilingual Provider (i18n) + QueryClientProvider              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────┐
│           Shell Layout                │   │         Router Viewports          │
│  - AnnouncementBanner (dismissible)   │   │  /              -> Home Page      │
│  - StickyNavbar (Logo, Links, Lang,   │   │  /schedule      -> Schedule Page  │
│    Theme, Status Toggle)              │   │  /events        -> Events Grid    │
│  - MobileBottomNav (Home, Schedule,   │   │  /events/:slug  -> Event Detail   │
│    Events, Gallery, More)             │   │  /gallery       -> Gallery Page   │
│  - Footer (University info, Links,    │   │  /news          -> News & Notice  │
│    Tilet divider, Sponsors bar)       │   │  /about         -> Dept & History │
│                                       │   │  /sponsors      -> Sponsors Tier  │
│                                       │   │  /contact       -> Contact & FAQ  │
│                                       │   │  /legal         -> Terms & Policy │
└───────────────────────────────────────┘   └─────────────────┬─────────────────┘
                                                              │
                                    ┌─────────────────────────┴─────────────────┐
                                    ▼                                           ▼
┌────────────────────────────────────────────────────────┐   ┌───────────────────────────────────┐
│                   Services Layer                       │   │          Lib & Utilities          │
│  - getEdition() -> Edition                             │   │  - ethiopianCalendar.ts           │
│  - getEvents()  -> EventItem[]                         │   │  - i18n/ config & JSON dictionaries│
│  - getNews()    -> NewsItem[]                          │   │  - icsGenerator.ts (calendar export│
│  - getGallery() -> GalleryItem[]                       │   │  - cn() & style helpers           │
│  - getSponsors()-> Sponsor[]                           │   │  - tiletPatterns (SVG dividers)   │
└───────────────────────────┬────────────────────────────┘   └───────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│              Typed Seed Data (src/data/)               │
│  Real 5th Annual Tourism Celebration (2017 E.C.)       │
│  Trilingual fields: { en: "...", am: "...", om: "..." }│
└────────────────────────────────────────────────────────┘
```

### TypeScript Core Entities
- `Edition`: `{ id, number, titleI18n, themeI18n, startDateEC, endDateEC, startDateGC, endDateGC, status: 'upcoming' | 'live' | 'past', venueI18n }`
- `EventItem`: `{ id, slug, editionId, day: 1..5, session: 'morning' | 'afternoon', startTime?, endTime?, titleI18n, descriptionI18n, category: 'culture' | 'sports' | 'academic' | 'competition' | 'community', venueType: 'campus' | 'town' | 'both', venueNameI18n, status: 'scheduled' | 'live' | 'delayed' | 'cancelled', image?, featured? }`
- `NewsItem`, `Announcement`, `GalleryItem`, `Sponsor`, `CommitteeMember`, `FAQ`.

---

## 5. Phase 1 Implementation Steps

1. **Package Installation**: Install `react-router-dom`, `@tanstack/react-query`, `i18next`, `react-i18next`, `zod`, `react-hook-form`, `date-fns`.
2. **Typography & Styling Foundation**:
   - Update `index.html` with Google Fonts preloads (`Plus Jakarta Sans`, `Bricolage Grotesque`, `Noto Sans Ethiopic`).
   - Configure Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` and custom CSS theme tokens in `src/index.css`.
   - Implement SVG Ethiopian *tilet* pattern generator for authentic dividers.
3. **Internationalisation (i18n)**:
   - Configure `i18next` with local JSON resources for English, Amharic, and Afaan Oromo (`en`, `am`, `om`).
   - Create language switcher with local storage persistence and `document.documentElement.lang` synchronisation.
4. **Seed Data & Services Layer**:
   - Implement complete real programme for the 5th Annual Tourism Celebration (2017 E.C., Megabit 29 – Miyazya 04).
   - Author trilingual title and description seeds for all 5 days of events, committee members, FAQs, and announcements.
   - Build `src/services/` with simulated async network latency and TanStack Query query hooks (`useEdition`, `useEvents`, `useNews`, etc.).
5. **Global Layout & Navigation Shell**:
   - `AnnouncementBanner`: High-priority dismissible banner for official campus notices.
   - `Navbar`: Responsive top bar conforming to the 3-Zone contract with brand wordmark, nav links, language selector, dark mode toggle, and discreet status simulator toggle.
   - `MobileBottomNav`: Ergonomic 5-item bottom bar for mobile thumb navigation with active indicators.
   - `Footer`: Department credentials, quick navigation, social links, sponsor preview ribbon, and copyright.
6. **Page Scaffolding**:
   - Wire up React Router routes: `/`, `/schedule`, `/events`, `/events/:slug`, `/gallery`, `/news`, `/news/:slug`, `/about`, `/sponsors`, `/contact`, `/legal`, and `*` (404 Not Found).
   - Implement polished Phase 1 viewports with loading skeleton states, empty states, and Ethiopian tilet accents.
7. **Build & Quality Pass**: Verify compilation, TypeScript typing, contrast ratios, and responsive layout across mobile, tablet, and desktop breakpoints.
