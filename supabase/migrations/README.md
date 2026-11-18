# Supabase Migrations

Apply these files in numerical order using the **Supabase SQL Editor** or `supabase db push`.  
Every file is idempotent (safe to re-run) unless noted.

| # | File | What it adds / changes |
|---|------|------------------------|
| 001 | `001_enums_and_triggers.sql` | All enum types (`app_role`, `content_state`, `event_status`, `event_category`, `venue_type`, `session_type`, `announcement_type`, `news_category`, `sponsor_tier`); `set_updated_at()` trigger function. |
| 002 | `002_core_tables.sql` | `profiles` table; `handle_new_user()` trigger (auto-creates profile on auth signup); `editions` table with partial unique index for `is_current`; `edition_public` view (computes upcoming/live/past status). |
| 003 | `003_content_tables.sql` | `events`, `announcements`, `news`, `gallery_items`, `sponsors`, `committee_members`, `faqs` — all content tables with `updated_at` triggers. |
| 004 | `004_messages_settings_audit.sql` | `messages`, `site_settings`, `activity_log`; `log_activity()` SECURITY DEFINER trigger attached to all content tables. |
| 005 | `005_security_functions.sql` | `is_staff()`, `is_admin()`, `guard_profile_role_change()` — all SECURITY DEFINER, `search_path=''`, EXECUTE revoked from PUBLIC. |
| 006 | `006_rls_policies.sql` | Enables RLS on all tables; creates all policies: anon sees published only, staff sees all, is_admin() gates destructive operations. |
| 007 | `007_storage.sql` | Five public-read storage buckets (`event-images`, `gallery`, `news-covers`, `sponsor-logos`, `committee`); staff upload / admin delete policies. |
| 008 | `008_staff_auth.sql` | `profiles.must_change_password`; `profiles: staff updates own row` RLS policy; extends `guard_profile_role_change` to block non-admins from changing any other column. |
| 009 | `009_event_status_note.sql` | `events.status_note_i18n` — short note for Delayed/Cancelled status. |
| 011 | `011_pipeline.sql` | `site_state` (single-row deploy-state table), `message_rate_limits`; `touch_site_state()` trigger attached to all content tables. |
| 012 | `012_admin_tools.sql` | `set_current_edition()`, `create_edition_from_template()`, `restore_log_entry()`, `purge_activity_log()`, `set_last_backup_at()` RPCs; `site_state.last_backup_at`. |
| 013 | `013_site_content.sql` | Extended edition columns (`subtitle_i18n`, `theme_highlight_i18n`, `hero_poster_url`, `hero_video_url`, `summary_i18n`, `cover_image_url`, `state`); `page_sections` and `page_section_items` tables; `edition_public` view updated; `site-content` storage bucket. |
| 014 | `014_live_content.sql` | `get_public_content()` SECURITY INVOKER RPC — returns full public snapshot as JSONB; granted to anon + authenticated. |
| 015 | `015_day6_committees_rls.sql` | Adds `'evening'` to `session_type`; `committee_key_enum`; `committee_members.committee_key`, `is_leader`, `edition_id`; **`gallery_items.thumb_url`** (small thumbnail URL for grid display, distinct from the full-size `url`); tightens messages RLS (staff read only). |
| 016 | `016_system_check.sql` | `system_check()` RPC for portal health checks. |
| 017 | `017_event_setup.sql` | `editions.logo_url`, `about_i18n`, 31-day CHECK; `edition_days` table; widens event `day` to 1–31 and adds `evening` session; `committee_members.bio_i18n`, `department`; `committee_member_contacts` table; `publish_edition()` and `create_edition_from_template()` updated RPCs; `edition-logos` storage bucket; `get_public_content()` updated. |
| 018 | `018_single_portal.sql` | Removes the admin/organizer split on content CRUD — all DELETE, `activity_log` SELECT, `site_settings` write, `editions` write now use `is_staff()`. Keeps `is_admin()` only for `profiles.role` changes, `purge_activity_log`, and `editions` DELETE. Updates `set_current_edition`, `restore_log_entry`, `system_check` to use `is_staff()`. |
| 019 | `019_fix_event_images.sql` | Data migration: backfills `events.image_url` for all events missing one, using static aistudio assets. Safe to re-run. |
| 020 | `020_publish_draft_committee_members.sql` | Data migration: publishes all committee members belonging to published editions. Safe to re-run. |

## Migration 010

There is no `010_*.sql`. Migration 010 was deliberately skipped during development (a cancelled schema branch that added a `page_revisions` table, later superseded by the `page_sections` approach in migration 013). Numbers jump from 009 to 011.

## gallery_items.thumb_url

The `gallery_items.thumb_url` column is created by **`015_day6_committees_rls.sql`**. It stores an optional small-thumbnail URL (used by the gallery grid) separate from the full-size `url` column added in `003_content_tables.sql`. When `thumb_url` is NULL the gallery falls back to `url`.

## Applying on a fresh project

```sql
-- Run each file in order in the Supabase SQL Editor.
-- After the last migration, reload the PostgREST schema cache:
NOTIFY pgrst, 'reload schema';
```

Or via CLI if the project is linked:

```bash
supabase db push
```

## Re-running migrations

Every migration uses `IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$`, or `CREATE OR REPLACE` so they can be re-run safely.  Data migrations (019, 020) use `WHERE` conditions that make them no-ops when already applied.

## Security properties

- All SECURITY DEFINER functions set `search_path = ''`.
- `is_staff()` and `is_admin()` have `EXECUTE` revoked from `PUBLIC` and granted only to `authenticated`.
- `get_public_content()` is SECURITY INVOKER — anon can call it and RLS still applies.
- `handle_new_user()`, `log_activity()`, `set_updated_at()`, and `guard_*` triggers are SECURITY DEFINER with `search_path = ''`.
