# Team Accounts — Ambo University Woliso Campus Tourism Week

How to create, reset, deactivate, and reactivate organizer accounts.  
There is no user-management screen in the portal. All account operations go through the **Supabase dashboard** or a SQL snippet.

> **Who should own the Supabase project?**  
> The project must be owned by a **department email address**, not a personal one. If the person leaves, ownership can be transferred without losing access. The department IT contact or head of department should hold the credentials.

---

## Table of Contents

1. [How to create an organizer account](#1-how-to-create-an-organizer-account)
2. [How to reset a forgotten password](#2-how-to-reset-a-forgotten-password)
3. [How to deactivate an account](#3-how-to-deactivate-an-account)
4. [How to reactivate an account](#4-how-to-reactivate-an-account)
5. [About the admin role](#5-about-the-admin-role)
6. [Sending temporary passwords safely](#6-sending-temporary-passwords-safely)

---

## 1. How to create an organizer account

No service key is used in the web app. All accounts are created through the Supabase dashboard.

**Steps:**

1. Open the Supabase dashboard for the project → **Authentication → Users → Add user → Create new user**.
2. Enter the new person's **email address** and a **temporary password** (at least 12 characters, something they can type easily).
3. Tick **Auto Confirm** (this skips the email verification step).
4. Click **Create user**.

The `handle_new_user` database trigger automatically creates a `profiles` row for the new user with:
- `role = 'organizer'`
- `is_active = true`
- `must_change_password = true`

5. Send the person their temporary password **privately** (see [section 6](#6-sending-temporary-passwords-safely)).
6. They sign in at `/staff/login` and are immediately asked to set a new password (minimum 12 characters).

---

## 2. How to reset a forgotten password

If a person cannot log in and the department does not have SMTP configured, use this SQL snippet in the **Supabase SQL Editor** (Dashboard → SQL Editor → New query):

```sql
-- Step 1: Set a new temporary password for the user.
-- Replace 'user@example.com' and 'NewTempPassword123!' with real values.

SELECT auth.admin_update_user(
  id,
  '{"password": "NewTempPassword123!", "app_metadata": {}}'::jsonb
)
FROM auth.users
WHERE email = 'user@example.com';

-- Step 2: Force them to change it on next login.
UPDATE public.profiles
SET must_change_password = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

> **Tested:** this snippet works on Supabase free and Pro plans as of November 2026.  
> Run it in the SQL Editor (not the API). It requires the SQL Editor's service-role context.

Send the temporary password to the person privately. They will be asked to change it immediately on next sign-in.

---

## 3. How to deactivate an account

Deactivating locks the person out immediately. Use this when someone leaves the department or should no longer have access.

```sql
-- Replace 'user@example.com' with the person's email.
UPDATE public.profiles
SET is_active = false
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

The portal checks `is_active` on every page load. The person's current session is invalidated within seconds.

> **Note:** this does not delete the auth user or their history in the activity log. That history is preserved for auditing purposes.

---

## 4. How to reactivate an account

```sql
-- Replace 'user@example.com' with the person's email.
UPDATE public.profiles
SET is_active = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

After reactivation, the person can sign in at `/staff/login` immediately.

---

## 5. About the admin role

The `role` field in `profiles` can be `'organizer'` or `'admin'`. After migration 018 (single portal), **both roles use the same `/staff/*` portal and have the same interface**. The role badge always shows "Organizer" regardless of the DB role.

The only remaining difference is:
- `role = 'admin'` can still call `purge_activity_log()` via direct SQL — there is no UI for this.
- `role = 'admin'` can change another user's `role` or `is_active` via SQL — the `guard_profile_role_change` trigger allows this.

For day-to-day use, all accounts are functionally identical. You do not need to create admin accounts for the portal.

**To promote a user to admin (SQL only, rarely needed):**

```sql
-- Only an existing admin or service_role can run this.
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

---

## 6. Sending temporary passwords safely

A temporary password gives immediate access to the portal and all content on it. Send it carefully.

**Do:**
- Send via **Telegram direct message** or **WhatsApp direct message** to the person personally.
- Send the login URL (`https://your-domain.com/staff/login`) in the same message.
- Tell them to change their password immediately on first login.

**Do not:**
- Post in a group chat (even a private group).
- Send by email unless you are certain the email is private and secure.
- Write it in a shared document.

**Example message to send:**

```
Hi [Name],

Your Tourism Week portal account is ready.

Login: https://your-domain.com/staff/login
Email: your@email.address
Temporary password: [password here]

You will be asked to set a new password when you first log in.
Please do this straight away and do not share this message.
```
