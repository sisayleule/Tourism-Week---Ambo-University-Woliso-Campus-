/**
 * submit-message — Supabase Edge Function
 *
 * Accepts contact and sponsor_inquiry form submissions from the public site.
 * verify_jwt = false (visitors have no accounts).
 *
 * Security:
 *   - Honeypot: rejects if the `website` field is filled (bots fill hidden fields)
 *   - Timing: rejects if submitted in under 3 seconds (bots auto-fill instantly)
 *   - Turnstile: if TURNSTILE_SECRET_KEY is set, verifies the token
 *   - Rate limit: max 5 per hour and 20 per day per hashed IP (sha256 of IP + IP_SALT)
 *   - Inserts with the service role (bypasses RLS — anon can no longer INSERT directly)
 *
 * CORS: limited to the site's domain and localhost.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────────────────────

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
    "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Get the visitor's IP from the request, accounting for proxies. */
function getClientIP(req: Request): string {
  const headers = req.headers;
  // Vercel / common proxy headers
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("cf-connecting-ip") ??
    "0.0.0.0"
  );
}

/** Simple JSON response helper. */
function jsonResponse(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// ─── Validation ──────────────────────────────────────────────────────────────

interface ContactPayload {
  kind: "contact";
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  website?: string;      // honeypot
  formRenderedAt?: number; // timestamp
  turnstileToken?: string;
}

interface SponsorPayload {
  kind: "sponsor_inquiry";
  name: string;
  organization: string;
  email: string;
  phone: string;
  tierInterest: string;
  message: string;
  website?: string;      // honeypot
  formRenderedAt?: number; // timestamp
  turnstileToken?: string;
}

type Payload = ContactPayload | SponsorPayload;

function validatePayload(body: Record<string, unknown>): { valid: boolean; payload?: Payload; error?: string } {
  const kind = body.kind;
  if (kind !== "contact" && kind !== "sponsor_inquiry") {
    return { valid: false, error: "Invalid kind" };
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (name.length < 1 || name.length > 200) return { valid: false, error: "Invalid name" };
  if (email.length < 3 || email.length > 320 || !email.includes("@")) return { valid: false, error: "Invalid email" };
  if (message.length < 1 || message.length > 5000) return { valid: false, error: "Invalid message" };

  if (kind === "contact") {
    const subject = String(body.subject ?? "").trim();
    if (subject.length < 3 || subject.length > 500) return { valid: false, error: "Invalid subject" };
    return {
      valid: true,
      payload: {
        kind: "contact",
        name, email, message,
        subject,
        phone: body.phone ? String(body.phone).slice(0, 30) : undefined,
        website: body.website ? String(body.website) : undefined,
        formRenderedAt: body.formRenderedAt ? Number(body.formRenderedAt) : undefined,
        turnstileToken: body.turnstileToken ? String(body.turnstileToken) : undefined,
      },
    };
  }

  // sponsor_inquiry
  const organization = String(body.organization ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (organization.length < 2 || organization.length > 500) return { valid: false, error: "Invalid organization" };
  if (phone.length < 6 || phone.length > 30) return { valid: false, error: "Invalid phone" };

  const tierInterest = String(body.tierInterest ?? "");
  const validTiers = ["platinum", "gold", "silver", "partner", "custom", "title"];
  if (!validTiers.includes(tierInterest)) return { valid: false, error: "Invalid tier" };

  return {
    valid: true,
    payload: {
      kind: "sponsor_inquiry",
      name, email, message,
      organization,
      phone,
      tierInterest,
      website: body.website ? String(body.website) : undefined,
      formRenderedAt: body.formRenderedAt ? Number(body.formRenderedAt) : undefined,
      turnstileToken: body.turnstileToken ? String(body.turnstileToken) : undefined,
    },
  };
}

// ─── Turnstile verification ───────────────────────────────────────────────────

async function verifyTurnstile(token: string, remoteip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // No secret set — skip verification (feature flag off)

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  ipHash: string,
  kind: string
): Promise<{ allowed: boolean; error?: string }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check hourly limit (max 5)
  const { count: hourlyCount } = await supabase
    .from("message_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("kind", kind)
    .gte("created_at", oneHourAgo.toISOString());

  if ((hourlyCount ?? 0) >= 5) {
    return { allowed: false, error: "Rate limit exceeded: too many submissions this hour" };
  }

  // Check daily limit (max 20)
  const { count: dailyCount } = await supabase
    .from("message_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("kind", kind)
    .gte("created_at", oneDayAgo.toISOString());

  if ((dailyCount ?? 0) >= 20) {
    return { allowed: false, error: "Rate limit exceeded: too many submissions today" };
  }

  return { allowed: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
  }

  // Health ping — harmless, no auth required
  if (new URL(req.url).searchParams.get("ping") === "1") {
    const origin = req.headers.get("origin");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405, corsHeaders(req.headers.get("origin")));
  }

  const origin = req.headers.get("origin");

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ success: false, error: "Invalid JSON" }, 400, corsHeaders(origin));
    }

    // ── Validate ──
    const { valid, payload, error } = validatePayload(body as Record<string, unknown>);
    if (!valid || !payload) {
      return jsonResponse({ success: false, error: error ?? "Validation failed" }, 400, corsHeaders(origin));
    }

    // ── Honeypot check ──
    if (payload.website) {
      // Bot filled the hidden field — silently accept but don't insert
      return jsonResponse({ success: true, message: "Thank you." }, 200, corsHeaders(origin));
    }

    // ── Timing check (under 3 seconds) ──
    if (payload.formRenderedAt && Date.now() - payload.formRenderedAt < 3000) {
      return jsonResponse({ success: false, error: "Submission too fast" }, 400, corsHeaders(origin));
    }

    // ── Turnstile verification (if enabled) ──
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (turnstileSecret) {
      if (!payload.turnstileToken) {
        return jsonResponse({ success: false, error: "Verification required" }, 400, corsHeaders(origin));
      }
      const clientIP = getClientIP(req);
      const turnstileOk = await verifyTurnstile(payload.turnstileToken, clientIP);
      if (!turnstileOk) {
        return jsonResponse({ success: false, error: "Verification failed" }, 400, corsHeaders(origin));
      }
    }

    // ── Rate limiting ──
    const clientIP = getClientIP(req);
    const ipSalt = Deno.env.get("IP_SALT") ?? "default-salt-change-me";
    const ipHash = await sha256(clientIP + ipSalt);

    // Create a service-role client (the function runtime provides SUPABASE_SERVICE_ROLE_KEY)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ success: false, error: "Server configuration error" }, 500, corsHeaders(origin));
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rateCheck = await checkRateLimit(supabase, ipHash, payload.kind);
    if (!rateCheck.allowed) {
      return jsonResponse({ success: false, error: rateCheck.error ?? "Rate limit exceeded" }, 429, corsHeaders(origin));
    }

    // ── Insert message ──
    const insertRow: Record<string, unknown> = {
      kind: payload.kind,
      name: payload.name,
      email: payload.email,
      message: payload.message,
    };

    if (payload.kind === "contact") {
      insertRow.phone = payload.phone ?? null;
      // subject is stored in the message prefix for contact form
      insertRow.message = `[${payload.subject}] ${payload.message}`;
    } else {
      insertRow.organisation = payload.organization;
      insertRow.phone = payload.phone;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert(insertRow)
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return jsonResponse({ success: false, error: "Failed to save message" }, 500, corsHeaders(origin));
    }

    // ── Log the rate-limit entry ──
    await supabase.from("message_rate_limits").insert({
      ip_hash: ipHash,
      kind: payload.kind,
    });

    // ── Return generic success ──
    const successMessage =
      payload.kind === "contact"
        ? "Thank you for reaching out to the Department of Tourism. Your inquiry has been logged."
        : "Thank you for your partnership interest. The organizing committee will review your proposal.";

    return jsonResponse(
      { success: true, message: successMessage, id: String(inserted.id) },
      200,
      corsHeaders(origin)
    );
  } catch (err) {
    console.error("submit-message error:", err);
    return jsonResponse({ success: false, error: "An unexpected error occurred" }, 500, corsHeaders(origin));
  }
});
