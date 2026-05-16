/**
 * admin-stuck-jobs-watchdog
 * Cron-triggered. Calls detect_stuck_pipeline_jobs() to surface any project
 * stuck in generation > 30min. Dedupes per project per day at the SQL layer.
 * verify_jwt = false — only invoked by pg_cron via service-role.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb.rpc("detect_stuck_pipeline_jobs");
    if (error) {
      console.error("[stuck-jobs] rpc error", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }
    console.log("[stuck-jobs] flagged", data);
    return new Response(JSON.stringify({ ok: true, flagged: data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stuck-jobs] exception", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});