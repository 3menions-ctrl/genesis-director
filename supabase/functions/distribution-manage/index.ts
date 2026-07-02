import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, successResponse } from "../_shared/script-utils.ts";
import { PROVIDERS, PROVIDER_IDS, getProvider, type ProviderId } from "../_shared/distribution-providers.ts";

/**
 * distribution-manage — the broker for the ad distribution layer.
 *
 * One authenticated POST endpoint, action-routed:
 *   status     — providers (configured?), current connections, recent jobs.
 *   authorize  — start an OAuth handshake → returns an authUrl (or not_configured).
 *   disconnect — drop a channel connection + its secrets.
 *   publish    — create distribution jobs for the chosen channels (schedule or
 *                attempt immediate post via the provider adapter).
 *
 * All table access is service-role here, so the frontend never touches the
 * distribution tables directly. Membership + role are enforced per request.
 */

const ROLE_RANK: Record<string, number> = { owner: 5, admin: 4, producer: 3, reviewer: 2, viewer: 1 };

interface ManageRequest {
  action?: "status" | "authorize" | "disconnect" | "publish";
  organizationId?: string;
  provider?: string;
  // publish
  projectId?: string;
  assetUrl?: string;
  title?: string;
  caption?: string;
  hashtags?: string;
  cta?: string;
  aspectRatio?: string;
  channels?: string[];
  scheduledAt?: string;
}

async function getServiceClient() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

function callbackRedirectUri(): string {
  return `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/distribution-oauth-callback`;
}

// Safe, non-secret connection columns only.
const CONNECTION_COLS = "id, provider, status, account_label, account_external_id, scopes, last_error, connected_at, created_at, updated_at";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) return unauthorizedResponse(corsHeaders, auth.error);

    const body: ManageRequest = await req.json();
    const action = body.action;
    const orgId = body.organizationId;
    if (!orgId) return errorResponse("organizationId is required", 400);

    const sb = await getServiceClient();

    // ── Membership + role gate ──
    const { data: membership, error: membershipErr } = await sb
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (membershipErr) return errorResponse("Couldn't verify workspace membership. Please retry.", 500);
    if (!membership) return errorResponse("You are not a member of this workspace.", 403);
    const role = String(membership.role);
    const rank = ROLE_RANK[role] ?? 0;
    const requireProducer = () => rank >= ROLE_RANK.producer;

    // ═══ STATUS ═══
    if (action === "status") {
      const { data: connections } = await sb
        .from("channel_connections")
        .select(CONNECTION_COLS)
        .eq("organization_id", orgId);
      const byProvider = new Map<string, Record<string, unknown>>();
      (connections ?? []).forEach((c: Record<string, unknown>) => byProvider.set(String(c.provider), c));

      const providers = PROVIDER_IDS.map((id) => {
        const a = PROVIDERS[id];
        const conn = byProvider.get(id) ?? null;
        return {
          id,
          label: a.label,
          scopes: a.scopes,
          configured: a.isConfigured(),
          envKeys: a.envKeys,
          connection: conn,
        };
      });

      const { data: jobs } = await sb
        .from("distribution_jobs")
        .select("id, provider, status, title, caption, asset_url, aspect_ratio, scheduled_at, posted_at, external_url, error, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);

      return successResponse({ providers, jobs: jobs ?? [], role });
    }

    // ═══ AUTHORIZE ═══
    if (action === "authorize") {
      if (!requireProducer()) return errorResponse("Producer access or higher is required to connect channels.", 403);
      const adapter = getProvider(String(body.provider));
      if (!adapter) return errorResponse("Unknown provider", 400);
      if (!adapter.isConfigured()) {
        return successResponse({ status: "not_configured", provider: adapter.id, missing: [adapter.envKeys.id, adapter.envKeys.secret] });
      }
      const state = `${adapter.id}.${crypto.randomUUID()}`;
      const redirectUri = callbackRedirectUri();
      await sb.from("channel_connections").upsert(
        { organization_id: orgId, provider: adapter.id, status: "pending", oauth_state: state, connected_by: auth.userId, last_error: null },
        { onConflict: "organization_id,provider" },
      );
      const authUrl = adapter.buildAuthUrl(redirectUri, state);
      if (!authUrl) return successResponse({ status: "not_configured", provider: adapter.id, missing: [adapter.envKeys.id] });
      return successResponse({ status: "ready", authUrl });
    }

    // ═══ DISCONNECT ═══
    if (action === "disconnect") {
      if (!requireProducer()) return errorResponse("Producer access or higher is required.", 403);
      const provider = String(body.provider);
      const { data: conn } = await sb
        .from("channel_connections")
        .select("id")
        .eq("organization_id", orgId)
        .eq("provider", provider)
        .maybeSingle();
      if (conn?.id) {
        await sb.from("channel_connection_secrets").delete().eq("connection_id", conn.id);
        await sb.from("channel_connections").delete().eq("id", conn.id);
      }
      return successResponse({ ok: true });
    }

    // ═══ PUBLISH ═══
    if (action === "publish") {
      if (!requireProducer()) return errorResponse("Producer access or higher is required to publish.", 403);
      // De-dupe so ["meta","meta"] can't double-post.
      const channels = Array.from(new Set(
        (Array.isArray(body.channels) ? body.channels : []).filter((c): c is ProviderId => (PROVIDER_IDS as string[]).includes(c)),
      ));
      if (channels.length === 0) return errorResponse("Select at least one channel to publish to.", 400);
      if (!body.assetUrl && !body.caption) return errorResponse("Provide an asset URL or at least a caption.", 400);

      // assetUrl is pulled by the provider — require a public https URL and
      // reject loopback/private/link-local hosts.
      if (body.assetUrl) {
        let ok = false;
        try {
          const u = new URL(body.assetUrl);
          const h = u.hostname;
          const internal = h === "localhost"
            || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)
            || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
            || h.endsWith(".internal") || h.endsWith(".local");
          ok = u.protocol === "https:" && !internal;
        } catch { ok = false; }
        if (!ok) return errorResponse("assetUrl must be a public https:// URL.", 400);
      }

      // Scheduling fails CLOSED: a present-but-invalid or past date is an error,
      // never a silent immediate live post.
      let scheduledIso: string | null = null;
      if (body.scheduledAt) {
        const d = new Date(body.scheduledAt);
        if (Number.isNaN(d.getTime())) return errorResponse("scheduledAt is not a valid date.", 400);
        if (d.getTime() <= Date.now()) return errorResponse("scheduledAt must be in the future.", 400);
        scheduledIso = d.toISOString();
      }
      const isFutureSchedule = scheduledIso !== null;

      // A referenced project must belong to THIS org; otherwise drop the link.
      let projectId: string | null = body.projectId ?? null;
      if (projectId) {
        const { data: proj } = await sb.from("movie_projects").select("id").eq("id", projectId).eq("organization_id", orgId).maybeSingle();
        if (!proj) projectId = null;
      }

      const payload = { title: body.title, caption: body.caption, hashtags: body.hashtags, cta: body.cta, assetUrl: body.assetUrl, aspectRatio: body.aspectRatio };

      const createdJobs: Record<string, unknown>[] = [];
      for (const provider of channels) {
        const adapter = PROVIDERS[provider];
        const { data: conn } = await sb
          .from("channel_connections")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("provider", provider)
          .maybeSingle();

        const baseRow = {
          organization_id: orgId,
          project_id: projectId,
          provider,
          connection_id: conn?.id ?? null,
          title: body.title ?? null,
          caption: body.caption ?? null,
          hashtags: body.hashtags ?? null,
          cta: body.cta ?? null,
          asset_url: body.assetUrl ?? null,
          aspect_ratio: body.aspectRatio ?? null,
          scheduled_at: scheduledIso,
          created_by: auth.userId,
        };

        // Scheduled, or not connected → record the job without posting now.
        // Surface insert failures as a synthetic failed entry instead of silently
        // dropping the channel.
        if (isFutureSchedule) {
          const { data, error } = await sb.from("distribution_jobs").insert({ ...baseRow, status: "scheduled" }).select().single();
          if (error) console.error("[distribution-manage] job insert error:", error);
          createdJobs.push(data ?? { provider, status: "failed", error: "Failed to record job" });
          continue;
        }
        if (!conn || conn.status !== "connected") {
          const { data, error } = await sb.from("distribution_jobs").insert({ ...baseRow, status: "pending_credentials", error: `${adapter.label} isn't connected.` }).select().single();
          if (error) console.error("[distribution-manage] job insert error:", error);
          createdJobs.push(data ?? { provider, status: "failed", error: "Failed to record job" });
          continue;
        }

        // Connected → record a 'publishing' row FIRST, then post, then update it,
        // so a successful external post can never be orphaned by an insert failure.
        const { data: jobRow, error: insErr } = await sb.from("distribution_jobs").insert({ ...baseRow, status: "publishing" }).select().single();
        if (!jobRow) { console.error("[distribution-manage] job insert error:", insErr); createdJobs.push({ provider, status: "failed", error: "Failed to record job" }); continue; }

        const { data: secret } = await sb.from("channel_connection_secrets").select("access_token").eq("connection_id", conn.id).maybeSingle();
        const result = await adapter.publish(secret?.access_token ?? null, payload);
        const { data: updated } = await sb.from("distribution_jobs").update({
          status: result.status,
          posted_at: result.ok ? new Date().toISOString() : null,
          external_post_id: result.externalPostId ?? null,
          external_url: result.externalUrl ?? null,
          error: result.ok ? null : (result.message ?? null),
        }).eq("id", jobRow.id).select().single();
        createdJobs.push(updated ?? jobRow);
      }

      return successResponse({ jobs: createdJobs });
    }

    return errorResponse("Unknown action", 400);
  } catch (error) {
    // Log specifics server-side; return a generic message to the client.
    console.error("[distribution-manage] Error:", error);
    return errorResponse("Something went wrong handling the distribution request.", 500);
  }
});
