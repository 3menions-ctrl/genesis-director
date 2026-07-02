import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getProvider } from "../_shared/distribution-providers.ts";
import { logAndSanitize } from "../_shared/safe-error.ts";

// @public-endpoint
// Distribution-provider OAuth redirect target. Called by the provider
// without a JWT; integrity is enforced via the unguessable,
// provider-matched `state` parameter.

/**
 * distribution-oauth-callback — the OAuth redirect target.
 *
 * Each platform redirects the browser here with ?code & ?state after the user
 * approves. We look up the pending connection by state, exchange the code for
 * tokens, store them in channel_connection_secrets (service role), flip the
 * connection to "connected", and bounce the browser back to the app.
 *
 * This is a browser redirect (not a Bearer-authenticated API call), so it is
 * keyed entirely off the unguessable `state` value minted by authorize.
 */

async function getServiceClient() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

function appUrl(path: string): string {
  const base = (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

function redirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: appUrl(path) } });
}

function callbackRedirectUri(): string {
  return `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/distribution-oauth-callback`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error") || url.searchParams.get("error_description");

  if (!state) return redirect("/business/distribution?dist_error=missing_state");

  const providerId = state.split(".")[0];
  const adapter = getProvider(providerId);
  if (!adapter) return redirect("/business/distribution?dist_error=unknown_provider");

  const sb = await getServiceClient();

  // Resolve the pending connection by its CSRF state.
  const { data: conn } = await sb
    .from("channel_connections")
    .select("id, organization_id, provider")
    .eq("oauth_state", state)
    .maybeSingle();

  if (!conn) return redirect("/business/distribution?dist_error=state_not_found");

  // Defense-in-depth: the row resolved by state must belong to the provider the
  // state claims, so a state minted for one provider can't be redeemed against another.
  if (conn.provider !== providerId) return redirect("/business/distribution?dist_error=provider_mismatch");

  if (oauthError || !code) {
    await sb.from("channel_connections")
      .update({ status: "error", last_error: oauthError ?? "Authorization was cancelled.", oauth_state: null })
      .eq("id", conn.id);
    return redirect(`/business/distribution?dist_error=${encodeURIComponent(adapter.id)}`);
  }

  try {
    const tokens = await adapter.exchangeCode(code, callbackRedirectUri());
    if (!tokens.accessToken) throw new Error("No access token returned by provider.");

    const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString() : null;
    await sb.from("channel_connection_secrets").upsert({
      connection_id: conn.id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? null,
      token_expires_at: expiresAt,
      raw: tokens.raw ?? {},
    }, { onConflict: "connection_id" });

    await sb.from("channel_connections").update({
      status: "connected",
      scopes: adapter.scopes,
      connected_at: new Date().toISOString(),
      oauth_state: null,
      last_error: null,
    }).eq("id", conn.id);

    return redirect(`/business/distribution?dist_connected=${encodeURIComponent(adapter.id)}`);
  } catch (e) {
    await sb.from("channel_connections")
      .update({ status: "error", last_error: logAndSanitize("distribution-oauth-callback", e, "Token exchange failed"), oauth_state: null })
      .eq("id", conn.id);
    return redirect(`/business/distribution?dist_error=${encodeURIComponent(adapter.id)}`);
  }
});
