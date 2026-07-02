/**
 * admin-stuck-jobs-watchdog
 * Cron-triggered. Calls detect_stuck_pipeline_jobs() to surface any project
 * stuck in generation > 30min. Dedupes per project per day at the SQL layer.
 * verify_jwt = false — only invoked by pg_cron via service-role.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/auth-guard.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";

Deno.serve(async (req) => {
  if (!requireCronSecret(req)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(
      supabaseUrl,
      serviceRoleKey,
    );
    const { data, error } = await sb.rpc("detect_stuck_pipeline_jobs");
    if (error) {
      console.error("[stuck-jobs] rpc error", error);
      return new Response(JSON.stringify({ ok: false, error: publicErrorMessage(error) }), { status: 500 });
    }
    console.log("[stuck-jobs] flagged", data);
    const recoveryResponse = await fetch(`${supabaseUrl}/functions/v1/pipeline-watchdog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ triggeredBy: "admin-stuck-jobs-watchdog", flagged: data, triggeredAt: new Date().toISOString() }),
    });
    const recoveryText = await recoveryResponse.text().catch(() => "");
    if (!recoveryResponse.ok) {
      console.error("[stuck-jobs] pipeline-watchdog failed", recoveryResponse.status, recoveryText.slice(0, 500));
    } else {
      console.log("[stuck-jobs] pipeline-watchdog invoked", recoveryText.slice(0, 500));
    }
    return new Response(JSON.stringify({ ok: true, flagged: data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stuck-jobs] exception", e);
    return new Response(JSON.stringify({ ok: false, error: publicErrorMessage(e) }), { status: 500 });
  }
});