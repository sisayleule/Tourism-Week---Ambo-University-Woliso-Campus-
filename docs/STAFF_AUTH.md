# Staff Authentication — Operations Runbook

> **Single portal** — all accounts (organizer and admin role) sign in at `/staff/login`.  
> There is no separate admin portal. The `/admin` URL redirects to `/staff/login`.

---

## Table of Contents

1. [The portal URL](#1-the-portal-url)
2. [Creating accounts](#2-creating-accounts)
3. [Password rules](#3-password-rules)
4. [Session behaviour](#4-session-behaviour)
5. [Deactivating and reactivating accounts](#5-deactivating-and-reactivating-accounts)
6. [Resetting a password](#6-resetting-a-password)
7. [Manual test script](#7-manual-test-script)

---

## 1. The portal URL

| Portal | URL | Who signs in |
|--------|-----|--------------|
| **Organizer portal** | `/staff/login` | Any account with `is_active = true` (role organizer **or** admin) |

Both roles see the same interface. The role badge always shows "Organizer".

The `/admin` and `/admin/*` paths redirect to `/staff/login`.

---

## 2. Creating accounts

Accounts are created through the **Supabase dashboard** — there is no user-management screen in the portal and no service key in the web app.

For step-by-step instructions see `docs/TEAM_ACCOUNTS.md`.

---

## 3. Password rules

| Requirement | Value |
|-------------|-------|
| Minimum length | **12 characters** |
| Enforced at | First-login set-password screen and profile → Change password |
| First-login forced change | Yes (`must_change_password = true` on account creation) |

---

## 4. Session behaviour

| Property | Value |
|----------|-------|
| Storage key | `tw-staff-auth` (localStorage) |
| Inactivity warning | At 25 minutes |
| Auto sign-out | At 30 minutes |
| Activity events that reset the timer | mousemove, click, keydown, touchstart, scroll |

---

## 5. Deactivating and reactivating accounts

See `docs/TEAM_ACCOUNTS.md` for the SQL snippets.

A deactivated account (`is_active = false`) is rejected on every portal page load — the AuthProvider checks `is_active` and signs out immediately if it is false.

---

## 6. Resetting a password

See `docs/TEAM_ACCOUNTS.md` for the tested SQL snippet. No email configuration is needed.

---

## 7. Manual test script

### TC-01 — Organizer signs in

1. Go to `/staff/login`, enter organizer credentials.
2. **Expected:** signs in, sees the Organizer Portal dashboard. Role badge shows "Organizer".

### TC-02 — Admin-role account signs in at the same portal

1. Go to `/staff/login`, enter admin-role credentials.
2. **Expected:** signs in. Sees the same interface as organizer. Role badge shows "Organizer".

### TC-03 — /admin redirects to /staff/login

1. Navigate to `/admin` (not signed in).
2. **Expected:** redirected to `/staff/login`.
3. Navigate to `/admin/users` (not signed in).
4. **Expected:** redirected to `/staff/login`.

### TC-04 — First-login password change (12-char min)

1. Sign in with a `must_change_password = true` account.
2. **Expected:** redirected to `/staff/set-password`.
3. Try an 11-character password — submit stays disabled.
4. Enter 12+ characters, confirm, click Set password.
5. **Expected:** success, redirect to `/staff`.

### TC-05 — Inactive account is rejected

1. Set `is_active = false` for a test account (SQL).
2. Attempt to sign in.
3. **Expected:** "Your account is not active. Contact the department administrator." Error shown. Not signed in.

### TC-06 — Inactivity timeout

1. Sign in. Wait (or reduce `INACTIVITY_WARN_MS` in `AuthProvider.tsx` for local testing).
2. **Expected:** inactivity warning modal appears at 25 minutes.
3. Click "Stay signed in" — session continues.
4. Wait until 30 minutes total inactivity.
5. **Expected:** auto sign-out, redirected to `/staff/login`.

### TC-07 — Confirm-password modal blocks wrong password

1. Click Delete on any item.
2. Enter a wrong password in the Confirm modal.
3. **Expected:** "Incorrect password" error, item not deleted.
4. Enter the correct password.
5. **Expected:** item deleted.

### TC-08 — Confirm-password valid for 5 minutes

1. Trigger any protected action, enter correct password.
2. Immediately trigger another protected action.
3. **Expected:** no password prompt (confirmed within 5 min window).

### TC-09 — Organizer can delete content

1. Sign in as organizer. Go to `/staff/news`.
2. **Expected:** Delete button visible on news items.
3. Click Delete, confirm dialog, confirm password.
4. **Expected:** item deleted.

### TC-10 — Organizer can read messages

1. Sign in as organizer. Go to `/staff/messages`.
2. **Expected:** messages load. Can mark as handled. Can delete.

### TC-11 — Organizer can read History

1. Sign in as organizer. Go to `/staff/settings` → History tab.
2. **Expected:** activity log loads. Can restore a previous version.

### TC-12 — Organizer can edit Website Settings

1. Go to `/staff/settings` → Contact & Links tab.
2. Change contact email. Click Save settings. Confirm password.
3. **Expected:** "Settings saved." toast.

### TC-13 — Organizer cannot change roles or is_active

1. As organizer, run via browser console or REST:  
   `UPDATE profiles SET role = 'admin' WHERE id = auth.uid()`
2. **Expected:** `guard_profile_role_change` trigger raises "Permission denied".

### TC-14 — No service key in repo or bundle

```bash
# In the repo
grep -r "service_role" src/ scripts/ docs/ .env.example
# Expected: 0 matches

# In the built bundle
grep -rl "service_role" dist/assets/
# Expected: no files
```

### TC-15 — /admin/* redirects work

```bash
curl -I https://YOUR_DOMAIN/admin
# Expected: 302 → /staff/login

curl -I https://YOUR_DOMAIN/admin/users
# Expected: 302 → /staff/login
```

### TC-16 — Response headers

```bash
curl -I https://YOUR_DOMAIN/staff/login
# Expected header: X-Robots-Tag: noindex, nofollow
# Expected header: X-Frame-Options: DENY
# Expected header: Cache-Control: no-store, no-cache, ...

curl https://YOUR_DOMAIN/robots.txt
# Expected: Disallow: /staff
# Should NOT contain: Disallow: /admin
```
