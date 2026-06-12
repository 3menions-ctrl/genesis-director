import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * oauth-authorize — Start an OAuth flow for a workspace integration.
 *
 * POST { provider: "google_drive" | "notion", organizationId, returnUrl }
 * Returns { authorizeUrl } — the caller (frontend) navigates there.
 *
 * The state param is an HMAC-signed JSON blob carrying:
 *   { provider, organizationId, userId, returnUrl, nonce, exp }
 * The callback verifies and decodes it; tampered state is rejected.
 *
 * Required edge secrets (set per provider you support):
 *   OAUTH_STATE_SECRET                     — required, used to HMAC the state
 *   GOOGLE_OAUTH_CLIENT_ID                 — Google Drive
 *   NOTION_OAUTH_CLIENT_ID                 — Notion
 *   PUBLIC_SITE_URL                        — e.g. https://smallbridges.co (callback redirect base)
 */

const PROVIDERS = {
  google_drive: {
    authorizeBase: "https://accounts.google.com/o/oauth2/v2/auth",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    scope: "https://www.googleapis.com/auth/drive.file",
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  notion: {
    authorizeBase: "https://api.notion.com/v1/oauth/authorize",
    clientIdEnv: "NOTION_OAUTH_CLIENT_ID",
    scope: "",
    extraParams: { owner: "user" },
  },
} as const;

type Provider = keyof typeof PROVIDERS;

async function signState(payload: object, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/=+$/, "");
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
    new TextEncoder().encode(b64),
  );
  const sigHex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${b64}.${sigHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { validateAuth, unauthorizedResponse } = await import(
      "../_shared/auth-guard.ts"
    );
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body = await req.json().catch(() => ({}));
    const provider = body.provider as Provider | undefined;
    const organizationId = body.organizationId as string | undefined;
    const returnUrl = (body.returnUrl as string | undefined) ?? "";

    if (!provider || !(provider in PROVIDERS)) {
      throw new Error("Unsupported provider");
    }
    if (!organizationId) throw new Error("organizationId required");

    // Verify user is a member of the org before issuing an authorize URL.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this workspace");

    const cfg = PROVIDERS[provider];
    const clientId = Deno.env.get(cfg.clientIdEnv);
    if (!clientId) {
      throw new Error(
        `${cfg.clientIdEnv} is not configured. Add it via \`supabase secrets set ${cfg.clientIdEnv}=...\``,
      );
    }
    const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
    if (!stateSecret) {
      throw new Error(
        "OAUTH_STATE_SECRET is not configured. Generate one with `openssl rand -hex 32` and add it as a Supabase secret.",
      );
    }

    const siteUrl =
      Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.co";
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

    const state = await signState(
      {
        p: provider,
        o: organizationId,
        u: auth.userId,
        r: returnUrl || `${siteUrl}/workspace/integrations`,
        n: crypto.randomUUID(),
        exp: Math.floor(Date.now() / 1000) + 600, // 10 min
      },
      stateSecret,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      ...(cfg.scope ? { scope: cfg.scope } : {}),
      ...cfg.extraParams,
    });

    const authorizeUrl = `${cfg.authorizeBase}?${params.toString()}`;
    return new Response(JSON.stringify({ authorizeUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[oauth-authorize] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
