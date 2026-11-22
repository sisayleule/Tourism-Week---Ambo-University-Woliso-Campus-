/**
 * contentVersion.ts — Lightweight version-check client.
 *
 * Calls content_version() via the Supabase PostgREST RPC endpoint (plain
 * fetch, no @supabase/supabase-js).  Returns the `v` string (the
 * any_change_at timestamp) or null on any error.
 *
 * Rules:
 *  · 8-second AbortController timeout — same as the full content fetch.
 *  · cache: 'no-store' — never serve a cached response.
 *  · Returns null when env vars are absent, the function is not found
 *    (migration 021 not yet applied), or any network/HTTP error occurs.
 *  · Never throws to callers.
 *  · No @supabase/supabase-js import.
 *
 * The public site polls this every 30–120 s and only calls
 * fetchLiveContent() when v changes.  At ~200 bytes per response this
 * costs essentially nothing.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const ANON_KEY     = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

const VERSION_RPC_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/content_version`
  : '';

const TIMEOUT_MS = 8_000;

/**
 * Fetch the current content version token from content_version().
 *
 * Returns the `v` string on success, or null when:
 *   · env vars are missing
 *   · migration 021 is not yet applied (404/400)
 *   · network error or timeout
 */
export async function fetchContentVersion(): Promise<string | null> {
  if (!VERSION_RPC_URL || !ANON_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(VERSION_RPC_URL, {
      method: 'POST',
      headers: {
        apikey:         ANON_KEY,
        Authorization:  `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body:   '{}',
      signal: controller.signal,
      cache:  'no-store',
    });

    // 404 / 400 → migration 021 not applied; fall back gracefully (caller
    // will use the full-fetch path instead).
    if (!res.ok) return null;

    const data = await res.json() as { v?: string | null };
    return data?.v ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the current version and measure the round-trip time.
 * Used by the debug panel "Run live test" button.
 */
export async function fetchContentVersionWithTiming(): Promise<{
  v:          string | null;
  durationMs: number;
  httpStatus: number | null;
  error:      string | null;
}> {
  if (!VERSION_RPC_URL || !ANON_KEY) {
    return { v: null, durationMs: 0, httpStatus: null, error: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch(VERSION_RPC_URL, {
      method: 'POST',
      headers: {
        apikey:         ANON_KEY,
        Authorization:  `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body:   '{}',
      signal: controller.signal,
      cache:  'no-store',
    });

    const durationMs = Date.now() - t0;

    if (!res.ok) {
      let errorText = `HTTP ${res.status}`;
      try {
        const j = await res.json() as { message?: string; error?: string };
        errorText = j.message ?? j.error ?? errorText;
      } catch { /* ignore */ }
      return { v: null, durationMs, httpStatus: res.status, error: errorText };
    }

    const data = await res.json() as { v?: string | null };
    return { v: data?.v ?? null, durationMs, httpStatus: res.status, error: null };
  } catch (err) {
    const durationMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    return { v: null, durationMs, httpStatus: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
