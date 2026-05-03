// Cron-driven: tops up each active org subscription's monthly credit allowance.
// Idempotent — RPC dedupes by (org, month).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (_req) => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await sb.rpc("monthly_org_credit_refill");
  if (error) {
    console.error("[monthly-credit-refill] error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  console.log("[monthly-credit-refill] result", data);
  return new Response(JSON.stringify(data), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
