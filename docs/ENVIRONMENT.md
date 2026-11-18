# Environment Variables & Secrets

Every variable this project reads, where it must be set, and what breaks without it.

---

## Frontend (Vite — `VITE_*` prefix, baked into the browser bundle at build time)

| Variable | Required? | Where to set | Example | Breaks without it |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | Vercel: Production + Preview; local `.env` | `https://xyz.supabase.co` | Build falls back to last-good snapshot; portal login fails |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Vercel: Production + Preview; local `.env` | `sb_publishable_...` | Same as above |
| `VITE_SITE_URL` | **Yes** | Vercel: Production only | `https://your-app.vercel.app` | Sitemap uses fallback URL; OG tags wrong |
| `VITE_FORCE_LIVE_OVERLAY` | No | Local `.env` only | `true` | Live content polling disabled; uses snapshot only |
| `VITE_TURNSTILE_SITE_KEY` | No | Vercel: Production + Preview | `0x4AAAAAAAxxxx` | Turnstile widget hidden; forms work without challenge |
| `VITE_LIVE_CONTENT` | No | — | `false` | Setting to `false` disables live RPC calls entirely |

> **Never** put `SUPABASE_SERVICE_ROLE_KEY` or `VERCEL_DEPLOY_HOOK_URL` in any `VITE_*` variable.  
> The `VITE_SUPABASE_ANON_KEY` is safe to expose — it is limited by RLS on the database.

---

## Supabase Edge Function Secrets

Set these via the Supabase Dashboard → Edge Functions → Secrets, or:

```bash
supabase secrets set KEY=value
```

| Secret | Required? | Function(s) | Description |
|---|---|---|---|
| `SITE_URL` | **Yes** | `submit-message`, `trigger-deploy` | Canonical public URL for CORS allow-list |
| `VERCEL_DEPLOY_HOOK_URL` | **Yes** | `trigger-deploy` | Vercel deploy hook URL (never in source code) |
| `IP_SALT` | **Yes** | `submit-message` | Random string for hashing visitor IPs (rate-limiting). Generate: `openssl rand -hex 16` |
| `TURNSTILE_SECRET_KEY` | No | `submit-message` | Cloudflare Turnstile secret key; leave unset to disable Turnstile |

The Supabase runtime auto-injects these (do **not** set them manually):

| Auto-injected | Value |
|---|---|
| `SUPABASE_URL` | Project REST URL |
| `SUPABASE_ANON_KEY` | Anon (publishable) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (used only inside the function) |

---

## GitHub Actions Secrets

Set in GitHub → Settings → Secrets → Actions:

| Secret | Used by | Description |
|---|---|---|
| `SUPABASE_URL` | `keep-alive.yml` | Project URL for the keep-alive ping |
| `SUPABASE_ANON_KEY` | `keep-alive.yml` | Anon key for the keep-alive GET request |
| `VITE_SUPABASE_URL` | `ci.yml` | Build-time Supabase URL (optional — CI falls back to last-good snapshot) |
| `VITE_SUPABASE_ANON_KEY` | `ci.yml` | Build-time anon key (optional) |
| `VITE_SITE_URL` | `ci.yml` | Canonical URL for sitemap in CI builds (optional) |

---

## Local Development

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project (Dashboard → Settings → API).  
Everything else is optional for local development.

---

## Vercel Environment Variable Setup

1. Vercel Dashboard → Project → Settings → Environment Variables.
2. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` for **Production** and **Preview**.
3. Set `VITE_SITE_URL` to the final domain once you have one, e.g. `https://tourism-week.vercel.app`.
4. Redeploy after adding variables.
