# Operations Manual

---

## Monthly Checklist

Run these checks at the start of each month.

| # | Task | How |
|---|---|---|
| 1 | Confirm Supabase project is active | Visit [app.supabase.com](https://app.supabase.com); check the project is not paused |
| 2 | Check the keep-alive workflow ran | GitHub → Actions → "Keep Supabase Alive" → confirm last run succeeded |
| 3 | Sign in to the portal and run System Check | Portal → Dashboard → System Check card → "Run check" |
| 4 | Download a content backup | Portal → Website Settings → Backup tab → "Download backup" |
| 5 | Store the backup ZIP offline | Copy the downloaded ZIP to a safe location outside the project |
| 6 | Review the activity log | Portal → Website Settings → History tab → scan for unexpected changes |
| 7 | Check npm audit | Run `npm audit` locally; fix any high/critical findings |
| 8 | Verify the public site loads from snapshot when offline | Disconnect from the internet; open the site — content should still render |

---

## Yearly Runbook

| Task | When | How |
|---|---|---|
| Renew custom domain | Before expiry | Registrar dashboard |
| Review and rotate `IP_SALT` secret | Annually | `supabase secrets set IP_SALT="$(openssl rand -hex 16)"` then redeploy functions |
| Archive the old edition | After Tourism Week ends | Portal → Editions → set current edition to the new year's edition |
| Review all staff accounts | Annually | Portal → no user management UI; use Supabase Dashboard → Auth → Users |
| Check for Supabase free-plan limit changes | Annually | [supabase.com/pricing](https://supabase.com/pricing) |
| Rotate Vercel deploy hook URL | Optional | Vercel Dashboard → Project → Settings → Git → Deploy Hooks |

---

## Backup and Restore Drill

### Backup

1. Sign in to the portal at `/staff/login`.
2. Go to **Website Settings → Backup**.
3. Click **"Download backup"** — a `.zip` file is saved containing all published content as JSON.
4. The download also updates `site_state.last_backup_at` in the database.

The backup ZIP contains:
- `edition.json`
- `events.json`
- `news.json`
- `gallery.json`
- `sponsors.json`
- `committee.json`
- `faqs.json`
- `site_settings.json`
- `announcements.json`
- `sections.json`

### Restore a single item from history

1. Portal → **Website Settings → History**.
2. Find the accidental delete or change in the activity log.
3. Click **Restore** on that row.
4. The item is restored to its previous state (UPDATE → previous values; DELETE → re-inserted as draft; INSERT → unpublished/set to draft).

### Full restore from backup

There is no one-click full restore; use the backup JSON files as a reference to manually re-enter data, or contact a developer to write a seed script from the JSON.

---

## Incident Playbook

### Site is down (blank page or error)

1. Check Vercel Dashboard → Deployments — did the last deploy succeed?
2. Check the browser console for errors.
3. If there is a blank white page, the error boundary (`ErrorBoundary.tsx`) should catch it — check for the "Something went wrong" screen.
4. If Supabase is unreachable, the site should still render from the snapshot. Verify by checking `localStorage.getItem('tw_live_snapshot')` in browser DevTools.
5. If the deployment itself is broken: Vercel Dashboard → Deployments → find the last good deploy → "Redeploy".

### Supabase project is paused

**Symptom:** Portal shows "Failed to fetch" or public site falls back to cached/snapshot data.

1. Go to [app.supabase.com](https://app.supabase.com).
2. Click the paused project → **Restore project** (may take 1–2 minutes).
3. After restoration, the portal will reconnect automatically.
4. Trigger a manual deploy in Vercel to rebuild the public site with fresh content.
5. Check the keep-alive workflow ran and re-enable it if disabled (GitHub → Actions tab).

### Deploy not updating the public site

**Symptom:** Organizer saved content and clicked "Publish to website" but the public site still shows old content.

1. Check Vercel Dashboard → Deployments — was a build triggered?
2. If no build was triggered, the `trigger-deploy` edge function may have failed:
   - Portal → Dashboard shows a "Deploy error" message.
   - Check the Supabase Edge Function logs: Dashboard → Edge Functions → `trigger-deploy` → Logs.
   - Common causes: `VERCEL_DEPLOY_HOOK_URL` secret not set, or the 60-second cooldown has not passed.
3. Trigger a manual deploy in Vercel Dashboard → Project → Deployments → Redeploy.
4. After the build completes (~60 seconds), refresh the public site.

### Forgotten password

1. Go to `/staff/login` → click **"Forgot password"**.
2. Enter the account email → click **"Send reset link"**.
3. Check email (including spam) for a reset link from Supabase.
4. Click the link → set a new password (minimum 12 characters).

If the email link does not work: a Supabase admin can go to Dashboard → Authentication → Users → find the user → **Reset password** to send a new link.

### Accidental content deletion

1. Portal → **Website Settings → History**.
2. Find the DELETE entry for the item.
3. Click **Restore** — the item is re-inserted as a draft.
4. Review and re-publish the item from the relevant portal page.

### Expired or transferred domain

1. Update your registrar DNS to point to the new host/IP.
2. Update `VITE_SITE_URL` in Vercel environment variables.
3. Update `SITE_URL` in Supabase Edge Function secrets: `supabase secrets set SITE_URL="https://newdomain.com"`.
4. Update Supabase Auth → URL Configuration → Site URL and redirect URLs.
5. Trigger a redeploy.
6. Verify `sitemap.xml` and OG tags use the new domain.

### Failed build

**Symptom:** Vercel shows a failed deployment.

1. Vercel Dashboard → Deployments → click the failed build → View build logs.
2. Common causes:
   - `tsc --noEmit` fails: TypeScript errors in source code. Fix the errors, push, redeploy.
   - `prebuild` fails: Supabase unreachable at build time. The script falls back to `snapshot.last-good.json` — if that file is missing or corrupt, the build still succeeds with an empty snapshot.
   - Out-of-memory: unlikely on Vercel's free plan for this project size.
3. If the build fails and there was a good previous deployment, that deployment remains live — visitors are not affected.

---

## Free Plan Known Limitations

| Service | Limit | Workaround |
|---|---|---|
| Supabase | Pauses after 7 days of inactivity | Keep-alive GitHub workflow (every 3 days) |
| Supabase | 500 MB database | Purge old activity log entries: Portal → History → Purge |
| Supabase | 1 GB storage | Delete unused images from storage buckets |
| Supabase | 2 active projects | Only one project is used |
| Supabase | Edge Function cold start ~1 s | Acceptable for form submit and deploy trigger |
| Vercel | 100 GB bandwidth/month | Unlikely to exceed for a university event site |
| Vercel | No custom domain on Hobby plan | Upgrade to Pro, or use Vercel subdomain |
| GitHub | Scheduled workflows disabled after 60 days with no pushes | Re-enable from Actions tab, or push a small change |
