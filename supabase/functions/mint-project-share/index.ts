import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * mint-project-share — mint (or fetch) a public share slug for a project.
 *
 * The caller must be the project owner. Idempotent — returning the same slug
 * if a share already exists for the project.
 *
 * Body: { projectId: string }
 * Returns: { slug: string, url: string }
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

    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error } = await supabaseUser.rpc(
      "mint_project_share_slug",
      { p_project_id: projectId },
    );
    if (error) throw error;

    const slug = data as string;
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.com";

    return new Response(
      JSON.stringify({ slug, url: `${siteUrl}/p/${slug}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
