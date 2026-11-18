# Deployment Guide — From Zero to Live

Follow this checklist in order. Each step must succeed before proceeding to the next.

---

## Prerequisites

- GitHub account with this repository.
- [Supabase account](https://supabase.com) (free plan is sufficient).
- [Vercel account](https://vercel.com) linked to your GitHub (free plan is sufficient).
- Node.js ≥ 20 (see `.nvmrc`).
- Supabase CLI ≥ 1.100 (optional — migrations can be applied via the SQL Editor instead).

---

## Step 1 — Create the Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) → **New project**.
2. Choose a region close to Ethiopia (e.g. `eu-central-1` Frankfurt, or `ap-south-1` Mumbai).
3. Note the **Project URL** (`https://xxxx.supabase.co`) and the **anon key** from Dashboard → Settings → API.
4. Note the **service-role key** — keep it secret; you will only need it for the Edge Functions runtime (auto-injected) and optionally for seeding.

---

## Step 2 — Apply database migrations

Open **Dashboard → SQL Editor** and run each file from `supabase/migrations/` in this order, one at a time:

```
001_enums_and_triggers.sql
002_core_tables.sql
003_content_tables.sql
004_messages_settings_audit.sql
005_security_functions.sql
006_rls_policies.sql
007_storage.sql
008_staff_auth.sql
009_event_status_note.sql
011_pipeline.sql
012_admin_tools.sql
013_site_content.sql
014_live_content.sql
015_day6_committees_rls.sql
016_system_check.sql
017_event_setup.sql
018_single_portal.sql
019_fix_event_images.sql
020_publish_draft_committee_members.sql
```

After the last migration, run:

```sql
NOTIFY pgrst, 'reload schema';
```

**Verify:** Dashboard → Table Editor should show `profiles`, `editions`, `events`, etc.  
**Verify:** Dashboard → Authentication → Policies should show RLS enabled on all tables.

---

## Step 3 — Deploy edge functions

Install the Supabase CLI and link your project:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy both functions:

```bash
supabase functions deploy submit-message --no-verify-jwt
supabase functions deploy trigger-deploy
```

> `--no-verify-jwt` on `submit-message` is required: public visitors have no JWT.  
> `trigger-deploy` verifies the JWT internally (organizer session required).

---

## Step 4 — Set function secrets

```bash
supabase secrets set \
  SITE_URL="https://YOUR-APP.vercel.app" \
  VERCEL_DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/HOOK_ID/HOOK_TOKEN" \
  IP_SALT="$(openssl rand -hex 16)"
```

> To create the Vercel deploy hook: Vercel Dashboard → Project → Settings → Git → Deploy Hooks → Add.

Optionally, to enable Cloudflare Turnstile on public forms:

```bash
supabase secrets set TURNSTILE_SECRET_KEY="your-turnstile-secret"
```

---

## Step 5 — Import the project to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**.
2. Import from GitHub — select this repository.
3. Framework preset: **Vite**.
4. Build command: `npm run build` (default).
5. Output directory: `dist` (default).

---

## Step 6 — Set Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add:

| Variable | Environment | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Production + Preview | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Production + Preview | Your Supabase anon key |
| `VITE_SITE_URL` | Production | Your Vercel production URL |

Click **Deploy** (or push to `main`) to trigger the first build.

---

## Step 7 — Set Supabase Auth redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://YOUR-APP.vercel.app`
- **Additional redirect URLs**: add `https://YOUR-APP.vercel.app/staff/reset-password`

This is required for password-reset emails to work.

---

## Step 8 — Create the first organizer account

1. Dashboard → Authentication → Users → **Invite user** (or **Add user**).
2. Enter the organizer's email. Set a temporary password. Tick **Auto Confirm**.
3. The `handle_new_user` trigger creates a `profiles` row with `role = 'organizer'` and `must_change_password = true`.
4. Tell the organizer to sign in at `/staff/login` — they will be prompted to set a new password (minimum 12 characters).

**To create an admin account** (rarely needed):

```sql
UPDATE public.profiles
SET    role = 'admin'
WHERE  id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

See `docs/TEAM_ACCOUNTS.md` for full account management instructions.

---

## Step 9 — Verify the deployment

1. Open `https://YOUR-APP.vercel.app` — the public site should render.
2. Open `https://YOUR-APP.vercel.app/staff/login` — the portal login page should appear.
3. Sign in and check the **Dashboard** — the System Check card should show all green.
4. Check `https://YOUR-APP.vercel.app/health.json` — should return `{"version":"1.0.0",...}`.
5. Check `https://YOUR-APP.vercel.app/sitemap.xml` — should return valid XML.

---

## Step 10 — Set up GitHub Actions secrets

In GitHub → Repository → Settings → Secrets → Actions, add:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

The keep-alive workflow (`.github/workflows/keep-alive.yml`) uses these to prevent the free-plan project from pausing after 7 days of inactivity.

---

## Step 11 — Custom domain (optional)

1. Vercel Dashboard → Project → Settings → Domains → Add.
2. Follow Vercel's DNS instructions for your registrar.
3. After DNS propagates, update `VITE_SITE_URL` in Vercel environment variables to your custom domain.
4. Update `SITE_URL` in Supabase Edge Function secrets: `supabase secrets set SITE_URL="https://yourdomain.com"`.
5. Update Supabase Auth redirect URLs to include your custom domain.
6. Trigger a redeploy.

---

## Seed data (development only)

To populate a fresh database with sample data for development:

```bash
# Option 1: paste supabase/seed.sql into the SQL Editor
# Option 2: run against a local Supabase instance
supabase db reset
```

Do **not** run seed data on the production database.
