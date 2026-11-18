# Setup Guide — Ambo University Woliso Campus Tourism Week

Follow these steps in order to bring a fresh Supabase project to a fully-working state.

---

## Prerequisites

- Node ≥ 18, Bun (or npm/pnpm)
- [Supabase CLI](https://supabase.com/docs/guides/cli) `supabase >= 1.100`
- A Supabase project (free or Pro) — create one at [app.supabase.com](https://app.supabase.com)
- A Vercel project (or any static host) linked to this repository for the public site

---

## 1. Environment variables

Copy `.env.example` to `.env` and fill in:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Dashboard → Settings → API>
VITE_SITE_URL=https://<your-vercel-domain>.vercel.app
```

> **Never** put the service-role key in `.env` or any frontend file.

---

## 2. Apply migrations in order

Open the **Supabase SQL Editor** and run each file from `supabase/migrations/` in numerical order.  Run them one at a time so you can see any error clearly.

| File | What it adds |
|---|---|
| `001_enums_and_triggers.sql` | Enums, `set_updated_at()` trigger |
| `002_core_tables.sql` | `profiles`, `editions`, `edition_public` view |
| `003_content_tables.sql` | `events`, `announcements`, `news`, `gallery_items`, `sponsors`, `committee_members`, `faqs` |
| `004_messages_settings_audit.sql` | `messages`, `site_settings`, `activity_log` |
| `005_security_functions.sql` | `is_staff()`, `is_admin()`, `guard_profile_role_change()` |
| `006_rls_policies.sql` | Row-Level Security on all tables |
| `007_storage.sql` | Storage buckets: `gallery`, `news-covers`, `sponsor-logos`, `committee`, `event-images` |
| `008_staff_auth.sql` | `profiles.must_change_password` |
| `009_event_status_note.sql` | `events.status_note_i18n` |
| `011_pipeline.sql` | `site_state`, `message_rate_limits`, `touch_site_state()` |
| `012_admin_tools.sql` | Edition-management RPCs, `site_state.last_backup_at` |
| `013_site_content.sql` | Extended edition columns, `page_sections`, `page_section_items` |
| `014_live_content.sql` | `get_public_content()` RPC |
| `015_day6_committees_rls.sql` | Day 6 end date, `committee_key_enum`, `gallery_items.thumb_url`, RLS tighten |
| `016_system_check.sql` | `system_check()` RPC |
| `017_event_setup.sql` | Event setup wizard tables/functions |
| `018_single_portal.sql` | Single portal: staff-level DELETE on content, activity log, settings; set_current_edition and restore_log_entry use is_staff() |

After running all migrations, **reload the PostgREST schema cache**:

```sql
NOTIFY pgrst, 'reload schema';
```

(Each migration file already ends with this statement.  Running it manually is a safety net when re-applying.)

---

## 3. Load seed data (optional — development only)

```bash
# If you have the Supabase CLI linked:
supabase db reset --linked   # drops and re-applies all migrations + seed

# Or paste supabase/seed.sql into the SQL Editor manually
```

---

## 4. Deploy Edge Functions

```bash
supabase functions deploy trigger-deploy
supabase functions deploy submit-message
```

> The `admin-users` edge function has been removed. User management is done through
> the Supabase dashboard (see `docs/TEAM_ACCOUNTS.md`).

---

## 5. Set function secrets

In the Supabase Dashboard → Edge Functions → Secrets (or via the CLI):

```bash
supabase secrets set \
  SITE_URL="https://<your-vercel-domain>.vercel.app" \
  VERCEL_DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/..." \
  IP_SALT="$(openssl rand -hex 16)"
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Supabase runtime.

---

## 6. Create the first organizer account

1. Sign in to the **Supabase Dashboard → Authentication → Users** and create a user manually with an email and a temporary password. Tick **Auto Confirm**.
2. The `handle_new_user` trigger creates a `profiles` row with `role = 'organizer'` and `must_change_password = true`.
3. Sign in at `/staff/login`. On first login you are prompted to set a new password (minimum 12 characters).

**To create an admin-role account** (rarely needed — both roles now use the same portal):

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR-ADMIN@EXAMPLE.COM');
```

For more detail see `docs/TEAM_ACCOUNTS.md`.

---

## 7. Verify the setup

1. Open `/staff` and sign in.
2. Click **Website Settings → History** to confirm the activity log is reachable.
3. Click the **System check** card on the dashboard to verify all checks pass.

You can also run `supabase/tests/rls_checks.sql` in the SQL Editor to verify RLS policies behave correctly.

---

## 8. Configure Vercel (production)

Add these environment variables to your Vercel project (Settings → Environment Variables):

```
VITE_SUPABASE_URL          = https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY     = <anon key>
VITE_SITE_URL              = https://<your-vercel-domain>.vercel.app
```

The `prebuild` script (`scripts/build-content.mjs`) fetches published content from Supabase at build time.  Every time you publish a change in the portal and trigger a deploy (via the **Publish to website** button), Vercel rebuilds with fresh content.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Your database is missing an update (column…)" in the portal | Apply the migration listed in the error message |
| Public site still shows old content after a portal save | Click "Update website now" in the portal, or manually trigger `POST /functions/v1/trigger-deploy` |
| `get_public_content()` returns 404 | Apply migration 014; also run `NOTIFY pgrst, 'reload schema'` |
| Editions save shows a Postgres error | The error message includes the real Postgres message — act on that |
| System Check shows CORS blocked for a function | Set `SITE_URL` secret to your production URL and redeploy: `supabase functions deploy <name>` |
