import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * webhook-dispatch — sign and deliver a workspace webhook event.
 *
 * Modes:
 *   1) Direct dispatch — POST { endpointId, event, payload } from an
 *      authenticated client. Used for "send test event" from the UI.
 *   2) Broadcast dispatch — POST { organizationId, event, payload }
 *      (with the service-role key) from server-side code to fan an event
 *      out to every active endpoint subscribed to that event.
 *
 * Every delivery:
 *   - Signs the body with HMAC-SHA256 using the endpoint's secret
 *   - Sends headers X-Small Bridges-Event, X-Small Bridges-Signature, X-Small Bridges-Timestamp,
 *     X-Small Bridges-Delivery-Id
 *   - Logs result into webhook_deliveries
 *   - Increments failure_count and pauses the endpoint after 10 consecutive
 *     failures (graceful degradation; operator can resume from the UI)
 */

const DELIVERY_TIMEOUT_MS = 10_000;
const PAUSE_AFTER_FAILURES = 10;
const ROLE_RANK: Record<string, number> = { owner: 5, admin: 4, producer: 3, reviewer: 2, viewer: 1 };

interface WebhookEndpoint {
  id: string;
  organization_id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  failure_count: number;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deliverOne(
  supabase: ReturnType<typeof createClient>,
  endpoint: WebhookEndpoint,
  event: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number | null; body: string | null }> {
  const deliveryId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ id: deliveryId, event, payload, sent_at: timestamp });
  const signature = await hmacSha256(endpoint.secret, `${timestamp}.${body}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let status: number | null = null;
  let respBody: string | null = null;
  let ok = false;
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Small Bridges-Webhooks/1.0",
        "X-Small Bridges-Event": event,
        "X-Small Bridges-Signature": `t=${timestamp},v1=${signature}`,
        "X-Small Bridges-Timestamp": timestamp,
        "X-Small Bridges-Delivery-Id": deliveryId,
      },
      body,
    });
    status = res.status;
    ok = res.ok;
    respBody = (await res.text().catch(() => "")).slice(0, 2000);
  } catch (e) {
    respBody = e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timeout);
  }

  // Persist delivery log and update endpoint counters
  await supabase.from("webhook_deliveries").insert({
    endpoint_id: endpoint.id,
    event,
    payload: { id: deliveryId, payload },
    response_status: status,
    response_body: respBody,
    succeeded: ok,
  });

  if (ok) {
    await supabase
      .from("webhook_endpoints")
      .update({ last_delivered_at: new Date().toISOString(), failure_count: 0 })
      .eq("id", endpoint.id);
  } else {
    const nextFailures = (endpoint.failure_count ?? 0) + 1;
    const update: Record<string, unknown> = { failure_count: nextFailures };
    if (nextFailures >= PAUSE_AFTER_FAILURES) update.active = false;
    await supabase.from("webhook_endpoints").update(update).eq("id", endpoint.id);
  }

  return { ok, status, body: respBody };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validateAuth, requireServiceRole, unauthorizedResponse, forbiddenResponse } =
      await import("../_shared/auth-guard.ts");
    const body = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mode 1 — direct dispatch (test fire from UI). Requires an authenticated
    // ADMIN member of the endpoint's organization. Without this gate any
    // anon-key caller could fire validly-signed events at another org's URLs.
    if (body.endpointId) {
      const auth = await validateAuth(req);
      if (!auth.authenticated || !auth.userId) return unauthorizedResponse(corsHeaders, auth.error);

      const { data: endpoint, error } = await supabase
        .from("webhook_endpoints")
        .select("id, organization_id, url, events, secret, active, failure_count")
        .eq("id", body.endpointId)
        .single<WebhookEndpoint>();
      if (error || !endpoint) {
        return new Response(
          JSON.stringify({ success: false, error: "Endpoint not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // The caller must be an admin (or owner) of the endpoint's workspace.
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", endpoint.organization_id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      const rank = membership ? (ROLE_RANK[String(membership.role)] ?? 0) : 0;
      if (rank < ROLE_RANK.admin) {
        return forbiddenResponse(corsHeaders, "Admin access to this workspace is required.");
      }

      const result = await deliverOne(
        supabase,
        endpoint,
        body.event ?? "webhook.test",
        body.payload ?? {},
      );
      return new Response(
        JSON.stringify({
          success: result.ok,
          deliveryStatus: result.status,
          deliveryBody: result.body,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mode 2 — broadcast to all active endpoints subscribed to this event.
    // Server-to-server only: must carry the service-role key. An end-user JWT
    // or the public anon key cannot fan out events into a workspace.
    if (body.organizationId && body.event) {
      if (!requireServiceRole(req)) {
        return forbiddenResponse(corsHeaders, "Broadcast dispatch requires the service role.");
      }
      const { data: endpoints, error } = await supabase
        .from("webhook_endpoints")
        .select("id, organization_id, url, events, secret, active, failure_count")
        .eq("organization_id", body.organizationId)
        .eq("active", true)
        .contains("events", [body.event])
        .returns<WebhookEndpoint[]>();
      if (error) throw error;
      const results = await Promise.all(
        (endpoints ?? []).map((ep) => deliverOne(supabase, ep, body.event, body.payload ?? {})),
      );
      const delivered = results.filter((r) => r.ok).length;
      return new Response(
        JSON.stringify({
          success: true,
          attempted: results.length,
          delivered,
          failed: results.length - delivered,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Provide either endpointId (direct) or organizationId+event (broadcast)",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[webhook-dispatch] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
