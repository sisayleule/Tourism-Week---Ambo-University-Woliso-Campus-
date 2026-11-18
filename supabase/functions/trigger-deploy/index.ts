/**
 * trigger-deploy — Supabase Edge Function
 *
 * Triggers a Vercel deploy hook to rebuild the public site after content changes.
 * verify_jwt = true — only authenticated staff can call this.
 *
 * Security:
 *   - Confirms the caller is an active staff member (organizer or admin).
 *   - Refuses if site_state.last_deploy_requested_at < 60 seconds ago.
 *   - POSTs to the secret VERCEL_DEPLOY_HOOK_URL.
 *   - Updates last_deploy_requested_at and returns 202.
 *
 * CORS: any localhost/127.0.0.1 port + SITE_URL secret.
 *
 * Deploy:
 *   supabase functions deploy trigger-deploy
 *   supabase secrets set SITE_URL=https://your-app.vercel.app VERCEL_DEPLOY_HOOK_URL=https://...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ─────────────────────────────────────────────────────────────────────

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  const siteUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("APP_URL") ?? "";
  if (siteUrl && origin === siteUrl.replace(/\/$/, "")) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin)
    ? (origin as string)
    : (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "") || "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null = null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Health ping — harmless, no auth required
  if (new URL(req.url).searchParams.get("ping") === "1") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405, origin);
  }

  try {
    // ── Extract the caller's JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401, origin);
    }
    const token = authHeader.slice(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl) {
      return jsonResponse({ success: false, error: "Server configuration error" }, 500, origin);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // ── Verify the caller is an active staff member ──
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ success: false, error: "Invalid token" }, 401, origin);
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      return jsonResponse({ success: false, error: "Access denied: not an active staff member" }, 403, origin);
    }

    if (profile.role !== "organizer" && profile.role !== "admin") {
      return jsonResponse({ success: false, error: "Access denied: invalid role" }, 403, origin);
    }

    // ── Rate limit: refuse if last_deploy_requested_at < 60 seconds ago ──
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: state } = await adminClient
      .from("site_state")
      .select("last_deploy_requested_at")
      .eq("id", true)
      .single();

    if (state?.last_deploy_requested_at) {
      const elapsed = Date.now() - new Date(state.last_deploy_requested_at).getTime();
      if (elapsed < 60_000) {
        return jsonResponse(
          { success: false, error: "A deploy was recently requested. Please wait at least 60 seconds." },
          429,
          origin,
        );
      }
    }

    // ── POST to the Vercel deploy hook ──
    const deployHookUrl = Deno.env.get("VERCEL_DEPLOY_HOOK_URL");
    if (!deployHookUrl) {
      return jsonResponse({ success: false, error: "Deploy hook URL not configured" }, 500, origin);
    }

    const deployRes = await fetch(deployHookUrl, { method: "POST" });
    if (!deployRes.ok) {
      console.error("Deploy hook failed:", deployRes.status, await deployRes.text().catch(() => ""));
      return jsonResponse({ success: false, error: "Deploy hook request failed" }, 502, origin);
    }

    await adminClient
      .from("site_state")
      .update({ last_deploy_requested_at: new Date().toISOString() })
      .eq("id", true);

    return jsonResponse(
      { success: true, message: "Deploy triggered. The site will update in 1–2 minutes." },
      202,
      origin,
    );
  } catch (err) {
    console.error("trigger-deploy error:", err);
    return jsonResponse({ success: false, error: "An unexpected error occurred" }, 500, origin);
  }
});
