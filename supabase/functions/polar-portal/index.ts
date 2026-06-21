/**
 * polar-portal — returns a Polar customer portal URL for the signed-in
 * user (keyed by their Supabase user id as the external customer id),
 * so subscribers can manage / cancel their plan and see invoices.
 *
 * Required secrets: POLAR_ACCESS_TOKEN, POLAR_SERVER.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { polarCustomerPortal } from "../_shared/polar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !user?.id) return json({ error: "Authentication failed" }, 401);

    const url = await polarCustomerPortal(user.id);
    if (!url) return json({ error: "No Polar customer portal available yet" }, 404);
    return json({ url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
