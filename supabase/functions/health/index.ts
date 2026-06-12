// ──────────────────────────────────────────────────────────────────────
// /health — liveness probe for uptime monitors.
//
// Returns 200 + a JSON body with build metadata. Cheap, no DB calls, no
// secrets. Uptime monitors (Cachet, UptimeRobot, BetterStack, or your
// own self-hosted Uptime Kuma) should hit this every minute.
// ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const body = JSON.stringify({
    ok: true,
    service: "small-bridges-edge",
    time: new Date().toISOString(),
    region: Deno.env.get("DENO_REGION") || "unknown",
    commit: Deno.env.get("DEPLOY_COMMIT_SHA") || null,
  });
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
