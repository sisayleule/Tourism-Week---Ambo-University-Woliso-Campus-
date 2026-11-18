# Ambo University Woliso Campus — Tourism Week

Official public website and organizer portal for the annual Tourism Week celebration.  
Built with **React 19 + Vite 8 + Supabase + Vercel**.

---

## Quick Start (local development)

**Prerequisites:** Node.js ≥ 20 (see `.nvmrc`), npm ≥ 10.

```bash
git clone <this-repo>
cd ambo-university-woliso-campus---tourism-week
cp .env.example .env          # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                   # starts on http://localhost:3000
```

The prebuild script fetches published content from Supabase.  
If Supabase is unreachable it falls back to `content/snapshot.last-good.json` automatically.

---

## Organizer Portal

Both `role = 'organizer'` and `role = 'admin'` accounts sign in at the same URL.

| Portal | URL | Min password |
|--------|-----|-------------|
| **Organizer portal** | `/staff/login` | 12 characters |

The portal is excluded from search engines (`X-Robots-Tag: noindex, nofollow` on all `/staff/*` responses).  
Legacy `/admin` URLs redirect to `/staff/login` automatically.

---

## Project Structure

```
src/
  App.tsx                   — SPA router; /admin/* → /staff/login
  components/
    ErrorBoundary.tsx        — Global React error boundary
  staff/                    — Organizer portal (lazy-loaded chunk)
  pages/                    — Public site pages (13 routes)
  lib/
    snapshot.ts              — Build-time content (static import)
    liveContent.ts           — Runtime RPC fetch with circuit breaker
    supabaseStaff.ts         — Supabase client (portal only)
    i18n.ts                  — Translations: en, am, om
  types/
    database.ts              — Hand-crafted Supabase type definitions
supabase/
  migrations/                — 001–020 (see migrations/README.md)
  functions/
    submit-message/          — Public contact/sponsor form handler
    trigger-deploy/          — Vercel deploy-hook trigger (auth required)
  tests/
    rls_checks.sql           — Full RLS permission-matrix verification
scripts/
  build-content.mjs          — Build-time snapshot generator
  content-lint.mjs           — Post-build content linter
  build-health.mjs           — Generates public/health.json
  seo-html.mjs               — Generates static OG/SEO HTML files
docs/
  ARCHITECTURE.md            — System diagram and data flow
  DEPLOYMENT.md              — Step-by-step from zero to live
  ENVIRONMENT.md             — Every variable and secret
  OPERATIONS.md              — Monthly checklist + incident playbook
  TEAM_ACCOUNTS.md           — Account management (no service key in browser)
  ORGANIZER_GUIDE.md         — Guide for all common organizer tasks
  RELEASE_CHECKLIST.md       — Pre-release gate checklist
```

---

## Build Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 (runs prebuild first) |
| `npm run build` | Production build → `dist/` |
| `npm run lint` | TypeScript type-check (no emit) |
| `npm run snapshot:save` | Fetch from Supabase and save as `content/snapshot.last-good.json` |
| `npm run test` | Playwright acceptance tests |
| `npm run content:lint` | Scan `dist/` for broken placeholders and raw i18n keys |
| `npm run audit:responsive` | Responsive overflow audit at 360 px |

---

## Deploy

```bash
# 1. Apply all migrations in Supabase SQL Editor (see supabase/migrations/README.md)
# 2. Deploy edge functions
supabase functions deploy submit-message --no-verify-jwt
supabase functions deploy trigger-deploy
# 3. Set secrets (SITE_URL, VERCEL_DEPLOY_HOOK_URL, IP_SALT)
# 4. Import to Vercel, set env vars, deploy
```

Full instructions: **`docs/DEPLOYMENT.md`**

---

## Documentation

| File | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | System diagram, data flow, key decisions |
| `docs/DEPLOYMENT.md` | Step-by-step from zero to live (10 steps) |
| `docs/ENVIRONMENT.md` | Every variable and secret |
| `docs/OPERATIONS.md` | Monthly checklist, yearly runbook, incident playbook |
| `docs/TEAM_ACCOUNTS.md` | Create, reset, deactivate accounts |
| `docs/ORGANIZER_GUIDE.md` | Guide for every common task in the portal |
| `docs/RELEASE_CHECKLIST.md` | Pre-release gate checklist |
| `supabase/migrations/README.md` | Migration runbook |
| `CHANGELOG.md` | Full change history |

---

## Health Check

The public site exposes `GET /health.json` for uptime monitors:

```json
{ "version": "1.0.0", "buildTime": "2026-11-17T...", "commitSha": "abc1234" }
```
