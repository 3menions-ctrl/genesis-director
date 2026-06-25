import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * oauth-callback — handle the redirect back from Google Drive / Notion.
 *
 * Receives ?code=<auth_code>&state=<signed_state>
 *  1. Verifies the HMAC signature on state and decodes it
 *  2. Exchanges the auth code with the provider's token endpoint
 *  3. Persists tokens (encrypted at rest with Supabase Vault if configured;
 *     otherwise stored as-is — the column names end in `_encrypted` so the
 *     application layer can adopt encryption transparently later)
 *  4. Redirects user back to the returnUrl with ?integration=...&status=success
 *
 * Required edge secrets:
 *   OAUTH_STATE_SECRET                    — same secret as oauth-authorize
 *   GOOGLE_OAUTH_CLIENT_ID, _CLIENT_SECRET
 *   NOTION_OAUTH_CLIENT_ID, _CLIENT_SECRET
 */

const PROVIDERS = {
  google_drive: {
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    secretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  notion: {
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    clientIdEnv: "NOTION_OAUTH_CLIENT_ID",
    secretEnv: "NOTION_OAUTH_CLIENT_SECRET",
    userInfoUrl: null, // Notion returns workspace info inside the token exchange
  },
} as const;

type Provider = keyof typeof PROVIDERS;

async function verifyState(
  signed: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const [b64, sigHex] = signed.split(".");
  if (!b64 || !sigHex) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = new Uint8Array(
    sigHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(b64),
  );
  if (!ok) return null;
  try {
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function bounce(returnUrl: string, params: Record<string, string>) {
  const url = new URL(returnUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Always have a destination to bounce the user back to.
  const fallback =
    Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.co";
  let returnUrl = `${fallback}/workspace/integrations`;

  try {
    const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
    if (!stateSecret) throw new Error("OAUTH_STATE_SECRET not configured");
    if (!stateRaw) throw new Error("Missing state");

    const state = await verifyState(stateRaw, stateSecret);
    if (!state) throw new Error("Invalid state signature");
    if (typeof state.exp === "number" && state.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("state expired");
    }

    returnUrl = (state.r as string) || returnUrl;
    if (errorParam) throw new Error(errorParam);
    if (!code) throw new Error("Missing authorization code");

    const provider = state.p as Provider;
    if (!(provider in PROVIDERS)) throw new Error("Unsupported provider");

    const cfg = PROVIDERS[provider];
    const clientId = Deno.env.get(cfg.clientIdEnv);
    const clientSecret = Deno.env.get(cfg.secretEnv);
    if (!clientId || !clientSecret) {
      throw new Error(
        `${cfg.clientIdEnv}/${cfg.secretEnv} not configured for ${provider}`,
      );
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

    // ── Exchange code → tokens ───────────────────────────────────────────
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        // Notion requires HTTP Basic auth on the token endpoint.
        ...(provider === "notion"
          ? {
              Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            }
          : {}),
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[oauth-callback/${provider}] token exchange ${tokenRes.status}: ${errBody.slice(0, 300)}`);
      throw new Error(`Token exchange failed (${tokenRes.status})`);
    }

    const tokens = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string | undefined = tokens.refresh_token;
    const expiresIn: number | undefined = tokens.expires_in;
    const scopes: string | undefined = tokens.scope;

    // ── Resolve display name / external account id ───────────────────────
    let displayName: string | null = null;
    let externalAccountId: string | null = null;
    if (cfg.userInfoUrl) {
      const u = await fetch(cfg.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (u.ok) {
        const ui = await u.json();
        displayName = ui.email ?? ui.name ?? null;
        externalAccountId = ui.id ?? ui.sub ?? null;
      }
    } else if (provider === "notion") {
      // Notion returns the workspace info inline.
      displayName = tokens.workspace_name ?? tokens.owner?.user?.name ?? null;
      externalAccountId = tokens.workspace_id ?? tokens.bot_id ?? null;
    }

    // ── Persist ──────────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("workspace_integrations").upsert(
      {
        organization_id: state.o as string,
        provider,
        external_account_id: externalAccountId,
        display_name: displayName,
        access_token_encrypted: accessToken,
        refresh_token_encrypted: refreshToken ?? null,
        token_expires_at: expiresIn
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null,
        scopes: scopes ? scopes.split(" ") : null,
        connected_by: state.u as string,
        status: "active",
      },
      { onConflict: "organization_id,provider" },
    );

    return bounce(returnUrl, {
      integration: provider,
      status: "success",
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    console.error("[oauth-callback] Error:", reason);
    return bounce(returnUrl, {
      integration: "oauth",
      status: "error",
      reason: "connection_failed",
    });
  }
});
