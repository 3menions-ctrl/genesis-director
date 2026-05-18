// ============================================================================
// reserve-credits — server-side credit reservation API
//
// Used by Studio v2 (and any other multi-step generation flow) to atomically
// hold N credits BEFORE kicking off renders. The hold reduces the user's
// effective balance for all subsequent reserve calls until the hold is
// consumed (on render success) or released (on render failure / abandon).
//
// Three operations, switched by `action`:
//   - reserve:  { action: 'reserve',  amount, projectId?, idempotencyKey?, ttlSeconds?, description? }
//   - consume:  { action: 'consume',  holdId, description?, clipDuration? }
//   - release:  { action: 'release',  holdId, reason? }
//
// All operations validate the caller's JWT and ensure the targeted hold
// belongs to that user (or is being created for them). Mutations run with
// the service role so RLS on credit_holds stays locked down.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1) Validate JWT — reject anonymous callers.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "missing_authorization" });
  }
  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  let jwtPayload: { sub?: string; role?: string; aud?: string | string[]; exp?: number } | null = null;
  try {
    const payloadPart = token.split(".")[1];
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    jwtPayload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
  } catch {
    return json(401, { error: "invalid_token" });
  }
  if (!jwtPayload?.sub || jwtPayload.role !== "authenticated" || (jwtPayload.exp && jwtPayload.exp * 1000 < Date.now())) {
    return json(401, { error: "invalid_token" });
  }
  const userId = jwtPayload.sub;

  // 2) Parse + dispatch.
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const action = String(body?.action || "");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (action === "state") {
      const { data, error } = await admin.rpc("get_credit_state", { p_user_id: userId });
      if (error) return json(500, { success: false, error: "state_lookup_failed", detail: error.message });
      const payload = (data || {}) as Record<string, unknown>;
      return json(payload.success === true ? 200 : 404, payload);
    }

    if (action === "reserve") {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        return json(400, { error: "amount_must_be_positive_integer" });
      }
      const { data, error } = await admin.rpc("reserve_credits", {
        p_user_id:         userId,
        p_amount:          amount,
        p_project_id:      body.projectId ?? null,
        p_description:     body.description ?? null,
        p_idempotency_key: body.idempotencyKey ?? null,
        p_ttl_seconds:     Number.isInteger(body.ttlSeconds) ? body.ttlSeconds : 900,
      });
      if (error) {
        console.error("[reserve-credits] reserve_credits RPC error:", error);
        return json(500, { error: "rpc_failed", detail: error.message });
      }
      const ok = (data as any)?.success === true;
      return json(ok ? 200 : 402, data as Record<string, unknown>);
    }

    if (action === "consume" || action === "release") {
      const holdId = String(body.holdId || "");
      if (!holdId) return json(400, { error: "holdId_required" });

      // Defensive ownership check — user can only operate on their own holds.
      const { data: hold, error: holdErr } = await admin
        .from("credit_holds")
        .select("id, user_id, status")
        .eq("id", holdId)
        .maybeSingle();
      if (holdErr) return json(500, { error: "lookup_failed", detail: holdErr.message });
      if (!hold)   return json(404, { error: "hold_not_found" });
      if (hold.user_id !== userId) return json(403, { error: "forbidden" });

      if (action === "consume") {
        const { data, error } = await admin.rpc("consume_credit_hold", {
          p_hold_id:       holdId,
          p_description:   body.description ?? null,
          p_clip_duration: Number.isInteger(body.clipDuration) ? body.clipDuration : null,
        });
        if (error) return json(500, { error: "rpc_failed", detail: error.message });
        const ok = (data as any)?.success === true;
        return json(ok ? 200 : 409, data as Record<string, unknown>);
      }

      const { data, error } = await admin.rpc("release_credit_hold", {
        p_hold_id: holdId,
        p_reason:  body.reason ?? null,
      });
      if (error) return json(500, { error: "rpc_failed", detail: error.message });
      return json(200, data as Record<string, unknown>);
    }

    return json(400, { error: "unknown_action", action });
  } catch (e: any) {
    console.error("[reserve-credits] unhandled error:", e);
    return json(500, { error: "internal_error", detail: e?.message });
  }
});
