# Release Checklist — v1.0.0

Work through each item before declaring the site live. Check the box once verified.

---

## Build & Code Quality

- [ ] `npm run lint` exits 0 (zero TypeScript errors)
- [ ] `npm run build` exits 0 (zero build errors)
- [ ] `node scripts/content-lint.mjs` exits 0 (no raw i18n keys, lorem, placeholders in dist/)
- [ ] `npm audit --audit-level=high` exits 0 (no high or critical vulnerabilities)
- [ ] `.nvmrc` exists and specifies `20`
- [ ] `package.json` has `"version": "1.0.0"` and `"name": "ambo-university-tourism-week"`
- [ ] `package.json` has `"engines": { "node": ">=20" }`
- [ ] `content/snapshot.last-good.json` exists and is committed
- [ ] `vite.config.ts` uses `import.meta.dirname` (no `__dirname` warning)

---

## Database

- [ ] All 20 migrations applied in order (001–020) on the production Supabase project
- [ ] `NOTIFY pgrst, 'reload schema';` run after last migration
- [ ] `SELECT public.system_check();` returns `{"db_reachable": true, ...}` in SQL Editor
- [ ] `SELECT public.get_public_content()` returns a valid JSON object with all expected keys
- [ ] `supabase/tests/rls_checks.sql` section 0 — RLS enabled on all 18 tables (confirmed in SQL Editor)
- [ ] RLS check: draft events return 0 count via `get_public_content()`
- [ ] RLS check: `has_function_privilege('anon', 'public.is_staff()', 'execute')` = false
- [ ] RLS check: `has_function_privilege('anon', 'public.get_public_content()', 'execute')` = true
- [ ] No editions with `is_current=true` and `state='draft'` simultaneously

---

## Security

- [ ] No `service_role` key in any source file, script, or `.env.example`
- [ ] No `VERCEL_DEPLOY_HOOK_URL` value (the actual URL) in any source file
- [ ] `dist/` scan: no `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, or deploy-hook URLs
- [ ] `.gitignore` includes `.env*` (except `.env.example`) and `dist/`
- [ ] `vercel.json` has `X-Content-Type-Options: nosniff` on all routes
- [ ] `vercel.json` has `X-Frame-Options: DENY` on `/staff/*`
- [ ] `vercel.json` has `Referrer-Policy` and `Permissions-Policy` on `/staff/*`
- [ ] `vercel.json` has `Cache-Control: no-store` on `/staff/*`
- [ ] `vercel.json` has strict CSP on `/staff/*`
- [ ] `vercel.json` has `Content-Security-Policy-Report-Only` on public routes
- [ ] `vercel.json` has `/admin` → `/staff/login` redirect
- [x] `supabase/functions/admin-users/` directory deleted (function removed — was already empty)
- [x] No docs reference a working `admin-users` endpoint (DATABASE.md updated)

---

## Edge Functions

- [ ] `submit-message` deployed: `supabase functions deploy submit-message --no-verify-jwt`
- [ ] `trigger-deploy` deployed: `supabase functions deploy trigger-deploy`
- [ ] Secrets set: `SITE_URL`, `VERCEL_DEPLOY_HOOK_URL`, `IP_SALT`
- [ ] `submit-message` ping: `GET /functions/v1/submit-message?ping=1` returns `{"ok":true}`
- [ ] `trigger-deploy` ping: `GET /functions/v1/trigger-deploy?ping=1` returns `{"ok":true}`
- [ ] `submit-message` with no body returns 400 (not 500)
- [ ] `trigger-deploy` with no auth header returns 401

---

## Environment Variables

- [ ] Vercel Production: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` all set
- [ ] Vercel Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` set
- [ ] GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` set
- [ ] `.env.example` matches all variables documented in `docs/ENVIRONMENT.md`
- [ ] Supabase Auth → URL Configuration: Site URL and redirect URLs match production domain

---

## Public Site

- [ ] Home page renders without error (snapshot + live overlay)
- [ ] Schedule page shows correct day tabs
- [ ] Events page lists published events only
- [ ] Gallery page loads images
- [ ] News page shows published articles
- [ ] About page shows committee members and past editions
- [ ] Contact form submits without error (check portal Messages inbox)
- [ ] Sponsor inquiry form submits without error (check portal Messages inbox)
- [ ] 404 page shows "Page Not Found" for `/nonexistent`
- [ ] Language switcher works (EN / አማ / Orm)
- [ ] Dark mode toggle works; light mode is default on first visit
- [ ] `robots.txt` exists and allows indexing of public pages
- [ ] `sitemap.xml` exists and contains event + news URLs
- [ ] `health.json` exists and contains `version`, `buildTime`, `commitSha`
- [ ] No `/staff/*` pages indexed by robots (X-Robots-Tag: noindex in response headers)
- [ ] ICS export works for at least one event
- [ ] Share link on event detail page produces correct preview

---

## Organizer Portal

- [ ] `/staff/login` renders correctly
- [ ] `/admin` redirects to `/staff/login`
- [ ] Login with valid credentials succeeds; redirects to dashboard
- [ ] Login with invalid credentials shows generic error (not password-specific)
- [ ] Deactivated account: login attempt sets `inactiveRejected` state, shows appropriate message
- [ ] 30-minute inactivity warning appears at 25 minutes
- [ ] Events list, create, edit, publish, unpublish all work
- [ ] Agenda drag-and-drop reorders events
- [ ] Live control: set event status to Delayed with note
- [ ] Gallery upload (image file, correct MIME type, ≤ 5 MB)
- [ ] Sponsors page CRUD
- [ ] Committee members CRUD with photo upload
- [ ] News article create with Markdown and image
- [ ] Announcements with start and expiry time
- [ ] FAQs CRUD
- [ ] Website Text section edit
- [ ] Website Settings (contact info, social links)
- [ ] Messages inbox shows submissions from contact form
- [ ] Backup download produces a valid ZIP
- [ ] History tab shows activity log entries
- [ ] Restore from history works (undo a change)
- [ ] Publish to website triggers a Vercel build (check Vercel Dashboard)
- [ ] "Confirm password" modal appears before delete operations
- [ ] Profile page: full name edit saves; password change succeeds

---

## CI/CD

- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] `.github/workflows/keep-alive.yml` exists (every 3 days)
- [ ] `.github/dependabot.yml` exists (weekly grouped updates)
- [ ] CI passes on `main` branch push (Actions tab)

---

## Handover Docs

- [ ] `README.md` has quick-start instructions
- [ ] `docs/ARCHITECTURE.md` exists
- [ ] `docs/DEPLOYMENT.md` exists (step-by-step from zero)
- [ ] `docs/ENVIRONMENT.md` exists (all variables documented)
- [ ] `docs/OPERATIONS.md` exists (monthly checklist + incident playbook)
- [ ] `docs/TEAM_ACCOUNTS.md` exists
- [ ] `docs/ORGANIZER_GUIDE.md` exists
- [ ] `supabase/migrations/README.md` exists
- [ ] `CHANGELOG.md` exists with v1.0.0 entry

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Developer | | | |
| Lead Organizer | | | |
