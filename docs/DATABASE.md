# Database Reference — Ambo University Woliso Campus Tourism Week

> **Phase 1 — Database, Security and Storage (Supabase Free Plan)**  
> This document covers the schema, roles, RLS policies, storage buckets, and operational runbooks for the Tourism Week Supabase backend.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Tables and relationships](#2-tables-and-relationships)
3. [Enums](#3-enums)
4. [Views](#4-views)
5. [Functions and triggers](#5-functions-and-triggers)
6. [Role matrix](#6-role-matrix)
7. [Storage buckets](#7-storage-buckets)
8. [How to apply migrations](#8-how-to-apply-migrations)
9. [How to run the seed](#9-how-to-run-the-seed)
10. [How to create the first admin](#10-how-to-create-the-first-admin)
11. [How to restore content from activity_log](#11-how-to-restore-content-from-activity_log)
12. [How to back up](#12-how-to-back-up)
13. [Seed data items awaiting department verification](#13-seed-data-items-awaiting-department-verification)

---

## 1. Architecture overview

```
Public website (React + Vite)
        │
        │  anon key only (VITE_SUPABASE_ANON_KEY)
        ▼
Supabase PostgREST  ←──  RLS enforced on every table
        │
        ├── public.editions          (1 row, is_current=true)
        ├── public.events            (14 rows, state='published')
        ├── public.announcements
        ├── public.news
        ├── public.gallery_items
        ├── public.sponsors
        ├── public.committee_members
        ├── public.faqs
        ├── public.messages          (INSERT-only for visitors)
        ├── public.site_settings     (1 row)
        ├── public.profiles          (one per staff user)
        └── public.activity_log      (immutable audit trail)

Staff portal (Phase 2–4, not yet built)
        │
        │  JWT from Supabase Auth (email invite flow)
        ▼
Same PostgREST endpoint — staff-level and admin-level policies unlock additional rows
```

**Key design decisions:**
- No stored `status` column on editions. Status is computed by the `edition_public` view using today's date in `Africa/Addis_Ababa` timezone.
- `service_role` key is never in the frontend or repo. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` appear in `.env`.
- The public site continues to run on seed data from `src/data/seedData.ts` until Phase 5 wires up the Supabase services layer.

---

## 2. Tables and relationships

### profiles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References `auth.users(id)` ON DELETE CASCADE |
| full_name | text | Set from invite metadata or email prefix |
| role | app_role | `organizer` (default) or `admin` |
| is_active | boolean | Soft-disable without deleting |
| must_change_password | boolean NOT NULL DEFAULT true | Added in migration 008. When `true`, the staff member is forced to set a new password on next login. Set to `false` by the frontend after the forced-password-change flow completes. |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-stamped by trigger |

> **No direct INSERT.** The `handle_new_user` trigger creates the row when `auth.users` gains a row. Role is always `organizer` on creation — never read from user metadata.
>
> **Self-service UPDATE** (added in migration 008): a staff member may update their own row but only the `full_name` and `must_change_password` columns. The `guard_profile_role_change` trigger enforces this and rejects any attempt to change `role`, `is_active`, `id`, or `created_at` by a non-admin.

### editions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| number | integer | e.g. `5` |
| slug | text UNIQUE | e.g. `5th-annual-2017-ec` |
| title_i18n | jsonb | `{"en":…, "am":…, "om":…}` |
| theme_i18n | jsonb | Required non-empty `en` key |
| sub_theme_i18n | jsonb | Nullable |
| edition_name_i18n | jsonb | |
| venue_i18n | jsonb | |
| date_range_display_i18n | jsonb | Display string only |
| start_date | date | Gregorian |
| end_date | date | Gregorian |
| start_date_ec / end_date_ec | text | Ethiopian Calendar display |
| stats | jsonb | `{daysCount, activitiesCount, expectedParticipants, exhibitorsCount}` |
| is_current | boolean | At most one `true` (partial unique index) |

### events → editions (edition_id FK)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| edition_id | uuid FK | ON DELETE CASCADE |
| slug | text UNIQUE | |
| day | smallint | 1–7 |
| session | session_type | `morning` / `afternoon` |
| start_time / end_time | time | Nullable |
| sort_order | integer | Within day+session |
| title_i18n | jsonb NOT NULL | `en` key required |
| description_i18n | jsonb | |
| venue_name_i18n | jsonb | |
| category | event_category | |
| venue_type | venue_type | |
| image_url | text | Repo path or Storage URL |
| featured | boolean | |
| status | event_status | `scheduled` / `live` / `delayed` / `cancelled` |
| status_note_i18n | jsonb | Added in migration 009. Short optional localised note attached to a non-scheduled status (e.g. "Starts 30 minutes late"). Cleared when status returns to `scheduled` or `live`. |
| state | content_state | `draft` / `published` |

### announcements

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| message_i18n | jsonb NOT NULL | |
| type | announcement_type | `normal` / `urgent` |
| link | text | Optional target URL |
| starts_at | timestamptz | Visibility window start |
| expires_at | timestamptz | NULL = never expires |
| state | content_state | Defaults to `published` (goes live immediately) |

### news → editions (edition_id nullable FK)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| edition_id | uuid FK | Nullable; SET NULL on edition delete |
| slug | text UNIQUE | |
| title_i18n | jsonb NOT NULL | |
| summary_i18n | jsonb | |
| body_i18n | jsonb | |
| category | news_category | |
| cover_image_url | text | |
| pinned | boolean | Pins to top of list |
| published_at | timestamptz | Set when state → published |
| state | content_state | |

### gallery_items → editions + events (nullable)

| Column | Type | Notes |
|--------|------|-------|
| edition_id | uuid FK | ON DELETE CASCADE |
| event_id | uuid FK | Nullable; SET NULL on event delete |
| media_type | text | `photo` or `video` |
| image_url | text NOT NULL | Primary asset |
| video_url | text | Only for video items |
| caption_i18n | jsonb | |
| year | integer | Archive year |
| category | text | Matches event_category or `highlights` |

### sponsors, committee_members, faqs

Simple content tables — `state`, `sort_order`, i18n fields. No foreign keys to editions (sponsors and FAQs are edition-independent).

### messages

| Column | Type | Notes |
|--------|------|-------|
| id | bigint IDENTITY PK | |
| kind | text | `contact` or `sponsor_inquiry` |
| name | text | ≤ 200 chars |
| organisation | text | ≤ 500 chars, nullable |
| email | text | ≤ 320 chars |
| phone | text | ≤ 30 chars, nullable |
| message | text | ≤ 5000 chars |
| handled | boolean | Staff workflow |
| handled_by | uuid FK | References profiles |
| handled_at | timestamptz | |

### site_settings

Single-row table (`id boolean PK DEFAULT true`). Phone is `NULL` until a verified number is provided.

### activity_log

| Column | Type | Notes |
|--------|------|-------|
| id | bigint IDENTITY PK | Monotonically increasing |
| actor_id | uuid FK | NULL for system / migration actions |
| action | text | `INSERT` / `UPDATE` / `DELETE` |
| table_name | text | Which content table |
| row_id | text | String form of the affected row's PK |
| old_data | jsonb | Full before-snapshot |
| new_data | jsonb | Full after-snapshot |
| created_at | timestamptz | |

> **Immutable.** No role may UPDATE or DELETE log rows. Only `log_activity()` (SECURITY DEFINER) may INSERT.

---

## 3. Enums

| Enum | Values |
|------|--------|
| `app_role` | `organizer`, `admin` |
| `content_state` | `draft`, `published` |
| `event_status` | `scheduled`, `live`, `delayed`, `cancelled` |
| `event_category` | `culture`, `sports`, `academic`, `competition`, `community` |
| `venue_type` | `campus`, `town`, `both` |
| `session_type` | `morning`, `afternoon` |
| `announcement_type` | `normal`, `urgent` |
| `news_category` | `department`, `sports_community`, `academic`, `general` |
| `sponsor_tier` | `title`, `gold`, `silver`, `partner` |

> `sponsor_tier` top value is `title` (the spec); `src/data/seedData.ts` uses `platinum` — use `title` in all SQL.

---

## 4. Views

### edition_public

```sql
SELECT *, CASE
  WHEN today < start_date   THEN 'upcoming'
  WHEN today BETWEEN …      THEN 'live'
  ELSE 'past'
END AS status
FROM public.editions
```

- `security_invoker = true` — RLS on `editions` still applies.
- `status` is never stored; always computed from the current date in `Africa/Addis_Ababa`.

---

## 5. Functions and triggers

| Name | Type | Purpose |
|------|------|---------|
| `set_updated_at()` | Trigger fn | Stamps `updated_at = now()` on every UPDATE |
| `handle_new_user()` | Trigger fn | Creates `profiles` row (role=`organizer`) on `auth.users` INSERT |
| `log_activity()` | Trigger fn | Writes to `activity_log` on INSERT/UPDATE/DELETE of content tables |
| `guard_profile_role_change()` | Trigger fn | Blocks non-admins from changing `profiles.role`, `profiles.is_active`, `id`, or `created_at`. Updated in migration 008 to also block any other column except `full_name` and `must_change_password`. |
| `is_staff()` | STABLE fn | Returns `true` if current user has an active profile |
| `is_admin()` | STABLE fn | Returns `true` if current user has an active `admin` profile |

All functions use `SECURITY DEFINER` + `SET search_path = ''`.  
`is_staff()` and `is_admin()` are executable only by the `authenticated` role.

---

## 6. Role matrix

| Operation | anon | organizer | admin |
|-----------|:----:|:---------:|:-----:|
| SELECT published events/news/gallery/sponsors/committee/faqs | ✓ | ✓ | ✓ |
| SELECT draft content | ✗ | ✓ | ✓ |
| SELECT editions & site_settings | ✓ | ✓ | ✓ |
| INSERT content (events, news, gallery, etc.) | ✗ | ✓ | ✓ |
| UPDATE content | ✗ | ✓ | ✓ |
| DELETE content (events, news, gallery, sponsors, committee, faqs) | ✗ | ✗ | ✓ |
| DELETE announcements | ✗ | ✓ | ✓ |
| INSERT messages | ✓ | ✓ | ✓ |
| SELECT messages | ✗ | ✓ | ✓ |
| UPDATE messages (mark handled) | ✗ | ✓ | ✓ |
| DELETE messages | ✗ | ✗ | ✓ |
| INSERT/UPDATE/DELETE editions | ✗ | ✗ | ✓ |
| INSERT/UPDATE/DELETE site_settings | ✗ | ✗ | ✓ |
| SELECT activity_log | ✗ | ✗ | ✓ |
| UPDATE/DELETE activity_log | ✗ | ✗ | ✗ |
| Change profiles.role / is_active | ✗ | ✗ | ✓ |
| Upload to Storage buckets | ✗ | ✓ | ✓ |
| Delete from Storage buckets | ✗ | ✗ | ✓ |

---

## 7. Storage buckets

| Bucket | Public | Max size | Allowed types |
|--------|:------:|:--------:|---------------|
| `event-images` | ✓ | 5 MB | jpeg, png, webp, avif |
| `gallery` | ✓ | 5 MB | jpeg, png, webp, avif |
| `news-covers` | ✓ | 5 MB | jpeg, png, webp, avif |
| `sponsor-logos` | ✓ | 5 MB | jpeg, png, webp, avif |
| `committee` | ✓ | 5 MB | jpeg, png, webp, avif |

SVG is explicitly excluded (can carry executable content).  
Public read requires no JWT — the website uses `supabase.storage.from('event-images').getPublicUrl(path)`.

---

## 8. How to apply migrations

### Local development (Supabase CLI)

```bash
# Install CLI
npm install -g supabase

# Link to your project (run once)
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply all migrations in order
supabase db push

# Or reset completely (drops all data and re-applies everything)
supabase db reset
```

### Remote (no local Docker)

```bash
# Get the database URL from Supabase dashboard → Settings → Database → Connection string
psql "$DATABASE_URL" -f supabase/migrations/001_enums_and_triggers.sql
psql "$DATABASE_URL" -f supabase/migrations/002_core_tables.sql
psql "$DATABASE_URL" -f supabase/migrations/003_content_tables.sql
psql "$DATABASE_URL" -f supabase/migrations/004_messages_settings_audit.sql
psql "$DATABASE_URL" -f supabase/migrations/005_security_functions.sql
psql "$DATABASE_URL" -f supabase/migrations/006_rls_policies.sql
psql "$DATABASE_URL" -f supabase/migrations/007_storage.sql
```

Apply in numbered order. All migrations are idempotent where possible (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$ … EXCEPTION WHEN duplicate_object`).

---

## 9. How to run the seed

```bash
# After migrations are applied:
psql "$DATABASE_URL" -f supabase/seed.sql
```

The seed inserts:
- 1 edition (5th Annual, 2017 E.C., start `2025-04-07`)
- 14 events (all `state='published'`, `status='scheduled'`)
- 1 announcement (urgent, expires end of Day 5)
- 1 site_settings row (phone NULL)

All inserts use `ON CONFLICT (id) DO NOTHING` — safe to re-run.

See [Section 13](#13-seed-data-items-awaiting-department-verification) for items not yet seeded.

---

## 10. How to create the first admin

Staff accounts are created via **invite only** — there is no public sign-up.

### Step 1 — Invite yourself

1. Open Supabase Dashboard → **Authentication** → **Users** → **Invite user**
2. Enter your email address and send the invite.
3. The `handle_new_user` trigger automatically creates a `profiles` row with `role = 'organizer'`.

### Step 2 — Promote to admin

Connect to the database as the Supabase postgres superuser (Dashboard → **SQL Editor**) and run:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'YOUR-EMAIL@EXAMPLE.COM'
);
```

> Replace `YOUR-EMAIL@EXAMPLE.COM` with your actual email. This is a one-time bootstrap operation. After this, use the admin portal (Phase 2) to invite and manage other staff.

### Step 3 — Verify

```sql
SELECT id, full_name, role, is_active
FROM public.profiles
WHERE role = 'admin';
-- Should return 1 row with your account
```

### Step 4 — Invite organizers

From the Supabase dashboard (or via the admin portal in Phase 2), invite each organizer by email. They receive `role = 'organizer'` automatically. Admins can promote them if needed.

---

## 11. How to restore content from activity_log

The `activity_log` table stores full JSON snapshots of every row before and after each change. Use `old_data` to reconstruct a previous state.

### Find the last known good version of a row

```sql
-- Find all changes to a specific event (replace the slug):
SELECT
  al.id         AS log_id,
  al.action,
  al.actor_id,
  p.full_name   AS changed_by,
  al.created_at AS changed_at,
  al.old_data,
  al.new_data
FROM public.activity_log al
LEFT JOIN public.profiles p ON p.id = al.actor_id
WHERE al.table_name = 'events'
  AND al.old_data->>'slug' = 'great-ambo-university-woliso-campus-running'
   OR al.new_data->>'slug' = 'great-ambo-university-woliso-campus-running'
ORDER BY al.created_at DESC;
```

### Restore an accidentally updated row

```sql
-- Example: restore the title_i18n of an event to the version before the last update.
-- 1. Find the log entry:
SELECT id, old_data FROM public.activity_log
WHERE table_name = 'events'
  AND action = 'UPDATE'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Apply the restore (replace LOG_ID and the columns you need):
UPDATE public.events
SET
  title_i18n       = (SELECT old_data->'title_i18n'       FROM public.activity_log WHERE id = LOG_ID),
  description_i18n = (SELECT old_data->'description_i18n' FROM public.activity_log WHERE id = LOG_ID)
WHERE id = (SELECT (old_data->>'id')::uuid FROM public.activity_log WHERE id = LOG_ID);
```

### Restore a deleted row

```sql
-- Find the DELETE log entry:
SELECT id, old_data FROM public.activity_log
WHERE table_name = 'events' AND action = 'DELETE'
ORDER BY created_at DESC LIMIT 1;

-- Re-insert from the snapshot (adjust columns to match the table):
INSERT INTO public.events
SELECT * FROM jsonb_populate_record(null::public.events,
  (SELECT old_data FROM public.activity_log WHERE id = LOG_ID)
);
```

---

## 12. How to back up

### Automatic backups (Supabase Free Plan)

The Supabase Free plan provides **daily point-in-time backups** retained for 7 days. Access them at:  
Dashboard → **Database** → **Backups**

### Manual SQL dump (recommended before any bulk change)

```bash
# Requires the Supabase connection string (from Dashboard → Settings → Database)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  --format=plain \
  --file="backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Export just the content tables (lightweight)

```bash
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl \
  --table=public.editions \
  --table=public.events \
  --table=public.announcements \
  --table=public.news \
  --table=public.gallery_items \
  --table=public.sponsors \
  --table=public.committee_members \
  --table=public.faqs \
  --table=public.site_settings \
  --data-only \
  --format=plain \
  --file="content_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Restore from a dump

```bash
psql "$DATABASE_URL" -f backup_YYYYMMDD_HHMMSS.sql
```

---

## 13. Seed data items awaiting department verification

The following items exist in `src/data/seedData.ts` but were **not seeded** into the database because they were AI-generated rather than explicitly supplied by the department. Please review each and confirm before seeding.

### News articles (3)

| Slug | Issue |
|------|-------|
| `preparations-finalized-for-5th-annual-tourism-week` | Appears accurate; cover image `/news-prep.jpg` exists in repo. **Confirm content is correct.** |
| `great-run-route-announced` | Cover image `/images/news-run.jpg` **does not exist** in repo. Supply the file or update the path. |
| `academic-symposium-call-for-posters` | Cover image `/images/news-symposium.jpg` **does not exist** in repo. Supply the file or update the path. |

### Gallery items (17)

All 17 items reference `year=2024` photos stored at `/assets/aistudio/image_*.png` (files exist in repo). Captions are in all three languages. **Confirm these are real photos from a previous edition** and that the captions are accurate before seeding.

### Sponsors (8)

| Name | Tier | Issue |
|------|------|-------|
| Ethiopian Tourism Board | title | No logo, no website URL |
| Oromia Tourism Commission | title | No logo, no website URL |
| Woliso Eco-Lodge & Hot Springs Resort | gold | No logo, no website URL |
| Negash Resort & Botanical Garden | gold | No logo, no website URL |
| Woliso Town Municipality | silver | No logo, no website URL |
| Commercial Bank of Ethiopia (Woliso Branch) | silver | No logo, no website URL |
| SW Shewa Cultural Artisans Association | partner | No logo, no website URL |
| Ambo University Alumni Hospitality Network | partner | No logo, no website URL |

**Confirm these sponsors are current/active and supply logo images and website URLs.**

### Committee members (4)

All 4 entries have placeholder names (`[NAME: Department Head]`, etc.) and no photos. Roles are real. **Supply real names and headshots.**

### FAQs (4)

Well-written answers in English, Amharic and Afaan Oromo. Content appears accurate but was generated. **Department should review before publishing.**

### Edition stats

`expectedParticipants = "2,000+"` and `exhibitorsCount = "30+"` appear in `seedData.ts` but are unverified estimates. Once confirmed, update with:

```sql
UPDATE public.editions
SET stats = stats || '{"expectedParticipants": "2,000+", "exhibitorsCount": "30+"}'::jsonb
WHERE number = 5;
```


---

## Migration 011 — Publishing pipeline tables

> Added in Phase 5. See `docs/PUBLISHING.md` for the full pipeline.

### message_rate_limits

| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| ip_hash | text | sha256(visitor IP + IP_SALT) |
| kind | text | `contact` or `sponsor_inquiry` |
| created_at | timestamptz | |

RLS enabled, **no policies** — only the service role (via the `submit-message` Edge Function) can read/write. Used for rate limiting: max 5 per hour and 20 per day per hashed IP.

### site_state

Single-row table (`id boolean PK DEFAULT true`).

| Column | Type | Notes |
|--------|------|-------|
| id | boolean PK | Always `true` |
| last_change_at | timestamptz | Updated by `touch_site_state()` trigger on content changes |
| last_deploy_requested_at | timestamptz | Updated by the `trigger-deploy` Edge Function |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: staff can SELECT (via `is_staff()`); nobody can INSERT/UPDATE/DELETE directly — only SECURITY DEFINER triggers and the service role (via the Edge Function) can write.

### touch_site_state() trigger

`SECURITY DEFINER` trigger function attached to: events, news, gallery_items, sponsors, committee_members, faqs, editions, site_settings (AFTER INSERT/UPDATE/DELETE).

For **events UPDATE only**: skips the trigger if the only changed columns are `status`, `status_note_i18n`, or `updated_at` (those are served live and don't need a rebuild). All other changes (title, description, venue, day, session, image, state, etc.) DO set `last_change_at`.

**Announcements are NOT wired** to this trigger — announcement creates/updates/deletes are served live and must not cause a rebuild.

### Messages INSERT policy change

Migration 011 drops the `messages: anon insert` and `messages: authenticated insert` policies. Visitors can no longer INSERT directly — only the `submit-message` Edge Function (using the service role) inserts messages.


---

## Migration 012 — Admin tools

> Added in Phase 6. See `docs/ADMIN_PORTAL.md` for the full admin portal guide.

### site_state.last_backup_at

New nullable `timestamptz` column on `site_state`. Set by the `set_last_backup_at()` function when an admin downloads a backup. Used to show a stale-backup banner on the admin dashboard.

### New SECURITY DEFINER functions

All five functions:
- Run as the function owner (bypass RLS).
- Begin with `IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION …` (or `is_staff()` for `set_last_backup_at`).
- Use `SET search_path = ''` to prevent schema injection.
- Grant `EXECUTE` to `authenticated` only; revoke from `PUBLIC`.

| Function | Args | Returns | Purpose |
|----------|------|---------|---------|
| `set_current_edition(p_edition_id uuid)` | Edition UUID | `void` | Atomically sets `is_current = false` on all editions, then `true` on the chosen one. |
| `create_edition_from_template(p_source, p_number, p_slug, p_title_i18n, p_theme_i18n, p_venue_i18n, p_start, p_end)` | See migration | `jsonb` | Creates a new edition (is_current = false) and copies source events as drafts. Events whose day exceeds the new edition's day count are skipped. Returns `{ new_edition_id, copied, skipped }`. |
| `restore_log_entry(p_log_id bigint)` | Log row ID | `jsonb` | Restores a row from an activity_log entry. UPDATE → re-applies old_data; DELETE → re-inserts old_data; INSERT → sets state='draft'. Whitelist of 9 tables; profiles are never restorable. Returns `{ success, message }`. |
| `purge_activity_log(p_older_than_days int)` | Days (min 180) | `jsonb` | Deletes log rows older than N days. Refuses values below 180. Returns `{ deleted }`. Only way to delete log rows. |
| `set_last_backup_at()` | — | `void` | Sets `site_state.last_backup_at = now()`. Callable by any active staff member (not admin-only). |

### Updated role matrix

| Operation | anon | organizer | admin |
|-----------|:----:|:---------:|:-----:|
| Call `set_current_edition` | ✗ | ✗ | ✓ |
| Call `create_edition_from_template` | ✗ | ✗ | ✓ |
| Call `restore_log_entry` | ✗ | ✗ | ✓ |
| Call `purge_activity_log` | ✗ | ✗ | ✓ |
| Call `set_last_backup_at` | ✗ | ✓ | ✓ |
| Read `site_state.last_backup_at` | ✗ | ✓ | ✓ |

### admin-users Edge Function (removed)

This function was removed. User management is now done through the Supabase
dashboard. See `docs/TEAM_ACCOUNTS.md`. The `supabase/functions/admin-users/`
directory has been deleted; no deployment is required or expected.

## 14. Phase 6B additions — Migration 013

Migration `013_site_content.sql` adds the following to the schema.

### editions — new columns

| Column | Type | Notes |
|--------|------|-------|
| subtitle_i18n | jsonb | Short hero subtitle. Falls back to `sub_theme_i18n` when null. |
| theme_highlight_i18n | jsonb | Word/phrase within `theme_i18n` to render gold-italic per language. No highlight when value is not found in theme text. |
| hero_poster_url | text | Override hero poster. `NULL` = use application default. |
| hero_video_url | text | Override hero video. `NULL` = use application default. |
| summary_i18n | jsonb | One-paragraph summary for the Past Editions Timeline. |
| cover_image_url | text | Cover image for the Past Editions Timeline card. No empty box when `NULL`. |
| state | content_state NOT NULL DEFAULT 'draft' | All existing rows back-filled to `'published'`. Anon reads only published editions. |

**New guard trigger:** `guard_edition_is_current` — blocks non-admins from changing `is_current`. Runs as `BEFORE UPDATE`.

**Updated `set_current_edition`:** now requires `state = 'published'` before allowing the edition to become current.

**Updated `create_edition_from_template`:** now callable by both organizers and admins (`is_staff()` check instead of `is_admin()`). New editions are created with `state = 'draft'`.

### page_sections

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| key | text UNIQUE | Registry key, e.g. `home.hero`, `about.intro`. Must match `src/lib/sectionRegistry.ts`. |
| title_i18n | jsonb | Nullable. |
| subtitle_i18n | jsonb | Nullable. |
| body_i18n | jsonb | Nullable. Markdown-safe plain text. |
| image_url | text | Optional section-level image. |
| cta_label_i18n | jsonb | Optional button label. |
| cta_url | text | Internal path (`/…`) or `https://` only. |
| state | content_state NOT NULL DEFAULT 'draft' | |
| needs_review | boolean NOT NULL DEFAULT false | Set to `true` by the seed. Cleared when saved via the portal. |

**RLS:** anon reads published only; staff insert/update; admin delete.

### page_section_items

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| section_id | uuid FK | ON DELETE CASCADE → `page_sections`. |
| title_i18n | jsonb | |
| body_i18n | jsonb | |
| icon | text | Lucide component name (PascalCase). |
| image_url | text | |
| link_url | text | Internal or `https://` only. |
| badge_i18n | jsonb | Small label (e.g. distance, category). |
| sort_order | integer NOT NULL DEFAULT 0 | |
| state | content_state NOT NULL DEFAULT 'published' | |

**RLS:** anon reads published items in published parent sections only; staff insert/update/delete; admin delete inherited.

### site-content storage bucket

| Property | Value |
|----------|-------|
| Bucket name | `site-content` |
| Accepted MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| Max file size | 5 MB |
| Public read | Yes |
| Staff upload | Yes (`INSERT`) |
| Admin delete | Yes (`DELETE`); staff cannot delete |

Files are stored under `sections/<filename>` within the bucket.

### New triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_touch_site_state_page_sections` | `page_sections` | Updates `site_state.last_change_at` on any change |
| `trg_touch_site_state_page_section_items` | `page_section_items` | Same |
| `trg_log_page_sections` | `page_sections` | Writes to `activity_log` |
| `trg_log_page_section_items` | `page_section_items` | Writes to `activity_log` |
| `trg_log_editions` | `editions` | Writes to `activity_log` (idempotent) |
| `guard_edition_is_current` | `editions` | Blocks non-admin `is_current` changes |

---

## 15. Section registry (`src/lib/sectionRegistry.ts`)

The section registry is a **front-end module with no Supabase import** that defines every editable public-site section. Each entry specifies:

- `key` — machine key matching `page_sections.key`
- `label` — human-readable name in portal
- `page` — which public page it appears on
- `publicUrl` — full URL with anchor for the "View on website" link
- `fields` — which form controls appear in the editor
- `maxLengths` — character limits per field
- `hasCards` / `maxCards` / `allowedIcons` — card editor configuration
- `fallbackBehaviour` — `'default'` (show built-in text when no published DB row) or `'hide'` (hide the section)
- `defaultContent` — the original hard-coded text, used as fallback and for the "Reset to default" function

Registered keys: `home.hero`, `home.highlights`, `home.itinerary`, `home.explore`, `home.philosophy`, `home.gallery`, `home.news`, `home.cta`, `about.intro`, `about.heritage`, `about.timeline`, `sponsors.intro`, `contact.intro`.

---

## Migration 017 — Event Setup (edition_days, contacts, publish_edition)

Applied after migration 016. Run `supabase/migrations/017_event_setup.sql` in the Supabase SQL editor.

### New columns on existing tables

#### editions
| Column | Type | Notes |
|--------|------|-------|
| logo_url | text | Edition logo in the `site-content` bucket under `edition-logos/<id>/`. NULL = use the application default. |
| about_i18n | jsonb | Markdown prose for the "About this edition" section. Sanitised on render. |

New constraint: `CHECK (end_date - start_date <= 30)` — editions may span at most 31 days.

#### events
- `day` CHECK widened from `1–7` to `1–31`.
- `session_type` enum gains `'evening'` value.
- New BEFORE INSERT/UPDATE trigger `validate_event_day_range` rejects an event whose `day` exceeds `(end_date - start_date + 1)` for the parent edition.

#### committee_members
| Column | Type | Notes |
|--------|------|-------|
| bio_i18n | jsonb | Short biography (Markdown, 3 languages). |
| department | text | Academic department or unit. |

### New tables

#### edition_days → editions (edition_id FK, CASCADE)

Per-day programme metadata. Rows are gated by the parent edition's `state = 'published'` for anonymous reads.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| edition_id | uuid FK | ON DELETE CASCADE |
| day | smallint | 1–31 (1-based within the edition) |
| title_i18n | jsonb | Optional display title for the day tab. |
| description_i18n | jsonb | Optional description. |
| — | UNIQUE | `(edition_id, day)` |

**RLS:** Anon SELECT when parent edition is published. Staff full CRUD. Activity-log and touch_site_state triggers applied.

#### committee_member_contacts → committee_members (member_id PK/FK, CASCADE)

One optional row per member. `show_public = false` (default) means the row is completely invisible to anonymous users.

| Column | Type | Notes |
|--------|------|-------|
| member_id | uuid PK = FK | ON DELETE CASCADE |
| email | text | |
| phone | text | |
| telegram | text | |
| show_public | boolean DEFAULT false | When false: row hidden from anon via RLS. When true: contact block embedded in public committee response. |

**RLS (critical):** Anon SELECT is allowed ONLY when `show_public = true` AND the member's edition is published AND the member is published. Contact details must NEVER appear in any public query unless `show_public = true`.

### New / updated functions

#### `publish_edition(p_edition_id uuid, p_make_current boolean) → jsonb`
- Security: SECURITY DEFINER; callable by any authenticated staff member (organizer or admin).
- Validates: English title, theme, dates present, ≤ 31 days.
- If `p_make_current = true`, requires `end_date >= today (Africa/Addis_Ababa)`.
- In one transaction: sets edition `state = 'published'`; publishes all draft events, edition_days (gated by edition state), and committee members for the edition; optionally flips `is_current` using a transaction-local bypass setting.
- Returns `{ edition_id, is_current, published_events, published_days, published_members, days_in_edition, warnings[] }`.

#### `create_edition_from_template(…, p_copy_committees boolean DEFAULT false) → jsonb`
Gains a 9th parameter `p_copy_committees`. When `true`, copies committee members from the source edition as drafts (without contact rows). Returns `{ new_edition_id, copied_events, skipped_events, copied_days, copied_members }`.

#### `guard_edition_is_current()` (updated)
Now allows `publish_edition()` to flip `is_current` by checking the transaction-local setting `app.publish_edition_bypass = 'true'`. Direct non-admin edits are still blocked.

#### `get_public_content()` (updated)
Now returns:
- `edition` includes `logo_url` and `about_i18n`.
- `committee` members include `bio_i18n`, `department`, and an inline `contact` object (non-null only when `show_public = true`).
- New key `edition_days`: array of `{id, edition_id, day, title_i18n, description_i18n}` for the current edition. Returns `[]` gracefully when migration 017 is not yet applied.

#### `validate_event_day_range()` trigger
BEFORE INSERT/UPDATE OF day, edition_id on events. Raises `check_violation` when `NEW.day > (end_date - start_date + 1)`.

#### `system_check()` (updated)
Extended with 8 new rows for migration 017 items: `editions.logo_url`, `editions.about_i18n`, `edition_days` table, `events.day_check_1_31`, `committee_members.bio_i18n`, `committee_members.department`, `committee_member_contacts` table, `publish_edition` function, `validate_event_day_range` function.

### Storage

Edition logos upload to the **`site-content`** bucket using the path `edition-logos/<edition_id>/logo.{png|webp}`. PNG or WebP, max 2 MB, recommended transparent background. The bucket is public-read; upload requires staff authentication.

### Role matrix additions (migration 017)

| Table | anon | organizer | admin |
|-------|------|-----------|-------|
| edition_days | SELECT (when edition published) | SELECT + INSERT + UPDATE + DELETE | all |
| committee_member_contacts | SELECT (when show_public=true + member+edition published) | SELECT + INSERT + UPDATE | SELECT + INSERT + UPDATE + DELETE |
| publish_edition() | — | EXECUTE | EXECUTE |

### How to apply migration 017

1. Open **Supabase Dashboard → SQL Editor**.
2. Paste the full contents of `supabase/migrations/017_event_setup.sql`.
3. Run. The migration is idempotent (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL`).
4. Verify by running `SELECT * FROM public.system_check() WHERE migration = '017';` — all rows should show `present = true`.
5. Run `supabase/rls_checks.sql` section 11 to verify privacy and permission rules.

> **Note on `ALTER TYPE … ADD VALUE`:** PostgreSQL cannot run `ALTER TYPE … ADD VALUE` inside a transaction block. The migration uses a `DO $$ BEGIN … EXCEPTION WHEN others THEN … END $$` guard to handle re-runs safely. Supabase migrations run non-transactionally, so this is safe.
