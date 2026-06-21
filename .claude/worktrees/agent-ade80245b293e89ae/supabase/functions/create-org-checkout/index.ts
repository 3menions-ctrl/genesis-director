import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Hybrid base + per-seat catalog. Each base plan has an associated per-seat
 * add-on price. Checkout creates a SINGLE subscription with two line items:
 *   1) Flat platform fee   (qty 1)
 *   2) Per-seat fee        (qty = seats)
 */
const ORG_PLAN_CATALOG: Record<
  string,
  { basePriceId: string; seatPriceId: string; plan: string; includedCredits: number }
> = {
  growth_monthly: { basePriceId: "growth_monthly", seatPriceId: "growth_seat_monthly", plan: "growth", includedCredits: 500 },
  growth_yearly:  { basePriceId: "growth_yearly",  seatPriceId: "growth_seat_monthly", plan: "growth", includedCredits: 6000 },
  scale_monthly:  { basePriceId: "scale_monthly",  seatPriceId: "scale_seat_monthly",  plan: "scale",  includedCredits: 2500 },
  scale_yearly:   { basePriceId: "scale_yearly",   seatPriceId: "scale_seat_monthly",  plan: "scale",  includedCredits: 30000 },
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-ORG-CHECKOUT] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

async function lookupPriceId(stripe: ReturnType<typeof createStripeClient>, lookupKey: string): Promise<string> {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (!list.data.length) throw new Error(`Stripe price not found for lookup_key=${lookupKey}`);
  return list.data[0].id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const planKey = String(body?.planKey ?? "").trim();
    const seats = Math.max(1, Math.min(250, Number(body?.seats ?? 1)));
    const orgName = typeof body?.orgName === "string" ? body.orgName.trim() : null;
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : null;
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : null;
    const env: StripeEnv = body?.environment === "sandbox" ? "sandbox" : "live";

    const plan = ORG_PLAN_CATALOG[planKey];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid org plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user?.id || !user?.email) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Auth ok", { userId: user.id, planKey, seats, env, organizationId });

    const stripe = createStripeClient(env);
    const [baseId, seatId] = await Promise.all([
      lookupPriceId(stripe, plan.basePriceId),
      lookupPriceId(stripe, plan.seatPriceId),
    ]);

    const origin = req.headers.get("origin") || "https://apex-studio.ai";
    const finalReturnUrl =
      returnUrl ||
      `${origin}/workspace?payment=success&plan=${encodeURIComponent(plan.plan)}&seats=${seats}&session_id={CHECKOUT_SESSION_ID}`;

    const subMetadata = {
      userId: user.id,
      planKey,
      plan: plan.plan,
      seats: String(seats),
      includedCredits: String(plan.includedCredits),
      orgName: orgName ?? "",
      organizationId: organizationId ?? "",
      source: "org_checkout",
    };

    const session = await stripe.checkout.sessions.create({
      line_items: [
        { price: baseId, quantity: 1 },
        { price: seatId, quantity: seats },
      ],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: finalReturnUrl,
      customer_email: user.email,
      metadata: subMetadata,
      subscription_data: { metadata: subMetadata },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CREATE-ORG-CHECKOUT] Error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});