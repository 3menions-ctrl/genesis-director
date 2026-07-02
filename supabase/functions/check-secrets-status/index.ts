import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logAndSanitize } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * check-secrets-status — reports whether each requested edge secret name is set.
 * NEVER returns the actual values — only "present" | "missing".
 *
 * Caller must be an admin (validated via auth-guard).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { validateAuth, unauthorizedResponse } = await import(
      "../_shared/auth-guard.ts"
    );
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    // Admin gate: only an admin (or an internal service-role caller) may probe
    // which secrets are configured. A plain authenticated user must NOT be able
    // to enumerate present/missing secret names.
    if (!auth.isServiceRole) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: roles } = await admin
        .from("user_roles").select("role").eq("user_id", auth.userId!);
      if (!roles?.some((r) => r.role === "admin")) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { keys } = await req.json();
    if (!Array.isArray(keys)) throw new Error("keys must be an array");

    const status: Record<string, "present" | "missing"> = {};
    for (const k of keys) {
      if (typeof k !== "string") continue;
      // Only allow env keys that match a safe name pattern. This blocks any
      // attempt to probe arbitrary env vars.
      if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(k)) {
        status[k] = "missing";
        continue;
      }
      const v = Deno.env.get(k);
      status[k] = v && v.length > 0 ? "present" : "missing";
    }

    return new Response(JSON.stringify({ status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: logAndSanitize("check-secrets-status", error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
