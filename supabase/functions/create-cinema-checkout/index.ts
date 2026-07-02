import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cinema subscription catalog. Maps lookup-key priceIds → tier metadata.
 * fairUseSeconds mirrors the entitlement RPC mapping (Step 4) so the
 * subscription row created here can be reconciled by the webhook.
 */
const CINEMA_CATALOG: Record<
  string,
  { tier: "cinema_lite" | "cinema_pro" | "cinema_studio"; fairUseSeconds: number; label: string }
> = {
  cinema_lite_monthly:   { tier: "cinema_lite",   fairUseSeconds: 600,  label: "Cinema Lite (monthly)" },
  cinema_lite_yearly:    { tier: "cinema_lite",   fairUseSeconds: 600,  label: "Cinema Lite (yearly)" },
  cinema_pro_monthly:    { tier: "cinema_pro",    fairUseSeconds: 2000, label: "Cinema Pro (monthly)" },
  cinema_pro_yearly:     { tier: "cinema_pro",    fairUseSeconds: 2000, label: "Cinema Pro (yearly)" },
  cinema_studio_monthly: { tier: "cinema_studio", fairUseSeconds: 6000, label: "Cinema Studio (monthly)" },
  cinema_studio_yearly:  { tier: "cinema_studio", fairUseSeconds: 6000, label: "Cinema Studio (yearly)" },
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-CINEMA-CHECKOUT] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

import { STRIPE_BILLING_LOCKED, stripeBillingLockedResponse } from "../_shared/stripe-lock.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (STRIPE_BILLING_LOCKED) return stripeBillingLockedResponse(corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const priceId = String(body?.priceId ?? "").trim();
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : null;
    const rawEnv = body?.environment;
    // AUDIT FIX M-2: only local origins may request sandbox (hosted = always
    // live), to prevent a "sandbox" request falling back to the live key in prod.
    const originHeader = req.headers.get("origin") || req.headers.get("referer") || "";
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(originHeader);
    const env: StripeEnv = (isLocalOrigin && rawEnv === "sandbox") ? "sandbox" : "live";

    if (!priceId || !CINEMA_CATALOG[priceId]) {
      return new Response(JSON.stringify({ error: "Invalid Cinema plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plan = CINEMA_CATALOG[priceId];

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id || !user?.email) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Auth ok", { userId: user.id, priceId, env, tier: plan.tier });

    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
    if (!prices.data.length) throw new Error(`Price not found: ${priceId}`);
    const stripePrice = prices.data[0];
    if (stripePrice.type !== "recurring") {
      throw new Error(`Cinema plan must be recurring: ${priceId}`);
    }

    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_SITE_URL") || "https://genesis-director.lovable.app";
    const { safeReturnUrl } = await import("../_shared/return-url.ts");
    const finalReturnUrl = safeReturnUrl({
      requested: returnUrl,
      fallback: `${origin}/profile?cinema=success&plan=${encodeURIComponent(priceId)}&session_id={CHECKOUT_SESSION_ID}`,
      requestUrl: req.url,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: finalReturnUrl,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        priceId,
        kind: "cinema_subscription",
        tier: plan.tier,
        fairUseSeconds: String(plan.fairUseSeconds),
        source: "cinema_checkout",
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          priceId,
          kind: "cinema_subscription",
          tier: plan.tier,
          fairUseSeconds: String(plan.fairUseSeconds),
          source: "cinema_checkout",
        },
      },
    });

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[CREATE-CINEMA-CHECKOUT] Error", err);
    return new Response(
      JSON.stringify({ error: publicErrorMessage(err, "Unexpected error") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
