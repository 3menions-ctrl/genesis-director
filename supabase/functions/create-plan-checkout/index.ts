import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Whitelist of price IDs (lookup keys) that this checkout will create
 * sessions for. Each entry maps to credits granted on success (subscription
 * tiers also grant initial credits via the existing webhook fulfillment
 * pipeline; this is a safety map only).
 */
const PLAN_CATALOG: Record<
  string,
  { kind: "subscription" | "credits"; credits: number; label: string }
> = {
  // Subscriptions
  sub_creator_monthly:  { kind: "subscription", credits: 1000,  label: "Creator" },
  sub_pro_monthly:      { kind: "subscription", credits: 3000,  label: "Pro" },
  sub_studio_monthly:   { kind: "subscription", credits: 10000, label: "Studio" },
  sub_business_monthly: { kind: "subscription", credits: 35000, label: "Business" },
  // Business one-time volume packs
  biz_studio_pack:      { kind: "credits", credits: 5500,  label: "Business Studio" },
  biz_brand_pack:       { kind: "credits", credits: 12000, label: "Business Brand" },
  biz_agency_pack:      { kind: "credits", credits: 32000, label: "Business Agency+" },
  // Personal credit packs (mirror of create-credit-checkout for unified onboarding)
  credits_mini:    { kind: "credits", credits: 90,   label: "Mini" },
  credits_starter: { kind: "credits", credits: 370,  label: "Starter" },
  credits_growth:  { kind: "credits", credits: 1000, label: "Growth" },
  credits_agency:  { kind: "credits", credits: 2500, label: "Agency" },
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-PLAN-CHECKOUT] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const priceId = String(body?.priceId ?? "").trim();
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : null;
    const rawEnv = body?.environment;

    let env: StripeEnv = "live";
    const originHeader = req.headers.get("origin") || req.headers.get("referer") || "";
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(originHeader);
    if (isLocalOrigin && rawEnv === "sandbox") env = "sandbox";

    if (!priceId || !PLAN_CATALOG[priceId]) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plan = PLAN_CATALOG[priceId];

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

    log("Auth ok", { userId: user.id, priceId, env, kind: plan.kind });

    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
    if (!prices.data.length) throw new Error(`Price not found: ${priceId}`);
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const origin = req.headers.get("origin") || "https://genesis-director.lovable.app";
    const finalReturnUrl =
      returnUrl ||
      `${origin}/profile?payment=success&plan=${encodeURIComponent(priceId)}&credits=${plan.credits}&session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: finalReturnUrl,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        priceId,
        kind: plan.kind,
        credits: String(plan.credits),
        source: "onboarding",
      },
      ...(isRecurring && {
        subscription_data: {
          metadata: {
            userId: user.id,
            priceId,
            credits: String(plan.credits),
            source: "onboarding",
          },
        },
      }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CREATE-PLAN-CHECKOUT] Error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});