// ============================================================================
// reconcile-credit-holds — periodic credit-state reconciler.
//
// Runs every few minutes (pg_cron). Calls the DB function
// `reconcile_pipeline_credit_holds()` which:
//
//   * expires TTL-aged holds (returns credits to "available")
//   * consumes holds for completed projects
//   * releases holds for failed/canceled/abandoned projects
//   * releases holds older than 1h for projects still 'generating'
//
// All operations are idempotent — this function is safe to run on any
// schedule, and safe to call manually at any time.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireServiceRole } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!requireServiceRole(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data, error } = await supabase.rpc("reconcile_pipeline_credit_holds");
    if (error) {
      console.error("[reconcile-credit-holds] RPC error:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[reconcile-credit-holds]", JSON.stringify(data));
    return new Response(JSON.stringify(data ?? { success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[reconcile-credit-holds] threw:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
