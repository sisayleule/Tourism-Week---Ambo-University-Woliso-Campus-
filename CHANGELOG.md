# Changelog

All notable changes to this project are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] — 2026-11-17

### Added
- **Public site**: Home, Schedule, Events, Event Detail, Gallery, News, News Article, About, Sponsors, Contact, Legal, 404 pages.
- **Organizer portal** at `/staff/*` — single portal for all accounts (`role='organizer'` and `role='admin'`).
- **Event Setup Wizard** — step-by-step edition creation, day scheduling, committee management, `publish_edition()` RPC.
- **Live-first content layer** — `get_public_content()` RPC with 3-second timeout, circuit breaker, localStorage cache, and build-time snapshot fallback (`content/snapshot.last-good.json`).
- **Edge functions**: `submit-message` (contact/sponsor forms, rate-limiting, Turnstile), `trigger-deploy` (Vercel webhook, 60-second cooldown, staff-auth required).
- **Publishing pipeline**: `site_state` table, deploy trigger, `content-meta.json`, sitemap.xml, SEO static HTML.
- **Migrations 001–020**: full schema with RLS, storage buckets, security functions, audit log.
- **i18n**: English, Amharic (am), Afaan Oromo (om) across all public pages.
- **Responsive** at 360 px, 768 px, 1280 px and above.
- **Dark mode toggle** (light default, persisted in `localStorage`).
- **PWA manifest** and service worker stub.
- **ICS export** for individual events.
- **Backup download** (ZIP of all published content as JSON).
- **History / restore** from activity log.
- **Confirm-password modal** before destructive portal actions.
- **30-minute inactivity sign-out** with 5-minute warning.
- **Global error boundary** wrapping the full React tree.
- `.nvmrc` pinning Node 20; `engines` field in `package.json`.
- `public/health.json` generated at build time (version, buildTime, commitSha).
- `.github/workflows/ci.yml` — install, typecheck, build, content lint, npm audit, bundle budget, Playwright.
- `.github/dependabot.yml` — weekly grouped npm + GitHub Actions updates.
- `supabase/migrations/README.md` — migration runbook with per-file description.
- `supabase/tests/rls_checks.sql` — full permission-matrix verification suite.
- `docs/ENVIRONMENT.md` — every variable and secret.
- `docs/ARCHITECTURE.md` — system diagram and data flow.
- `docs/DEPLOYMENT.md` — step-by-step from zero to live.
- `docs/OPERATIONS.md` — monthly checklist, incident playbook.
- `docs/RELEASE_CHECKLIST.md` — pre-release gate checklist.
- `scripts/content-lint.mjs` — build-output linter (no raw i18n keys, lorem, placeholders).
- `scripts/build-health.mjs` — generates `public/health.json`.

### Changed
- `vercel.json`: added `Referrer-Policy`, `Permissions-Policy`, strict CSP on `/staff/*`, `Content-Security-Policy-Report-Only` on public site, `Accept-Ranges` on assets, `/admin` redirect.
- `vite.config.ts`: replaced `__dirname` with `import.meta.dirname` (removes Vite native-config warning).
- `package.json`: name → `ambo-university-tourism-week`, version → `1.0.0`, added `engines.node ≥ 20`, added `content:lint` and `build:health` scripts.
- `@supabase/supabase-js` pinned to `2.49.10` (2.119 introduced breaking generic type changes incompatible with the hand-crafted `Database` type; tracked in `dependabot.yml` for future upgrade).
- `src/types/database.ts`: restored original `Update` types after supabase-js downgrade.

### Fixed
- 11 TypeScript errors introduced by `@supabase/supabase-js@2.119` (resolved by pinning 2.49.10).
- `vite.config.ts` Vite native-config `__dirname` warning.

### Security
- No secrets in `dist/` (confirmed by scan).
- `VERCEL_DEPLOY_HOOK_URL` referenced only by name in JS string literals — the actual URL is never in source code.
- `renderMarkdown` escapes `&<>"'` before any regex substitution — no raw HTML can pass through `dangerouslySetInnerHTML`.
- Login `returnTo` uses React Router `location.state.from.pathname` — no open-redirect via URL parameter.
- 2 low-severity `@supabase/auth-js` CVEs accepted: GHSA-8r88-6cj9-9fh5 affects OAuth path routing only; this project uses `signInWithPassword` exclusively.

### Known Limitations (Free Plan)
- Supabase pauses after 7 days inactivity → keep-alive workflow pings every 3 days.
- Vercel free plan has 100 GB bandwidth/month.
- Supabase free plan allows 2 projects, 500 MB database, 1 GB storage.
- No custom domain on free Vercel plan without upgrading.
- Edge Function cold start ~1 s on Supabase free tier.
