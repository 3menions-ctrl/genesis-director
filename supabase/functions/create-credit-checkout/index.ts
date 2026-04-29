import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Lovable Stripe price IDs (lookup keys), credits per package
const CREDIT_PACKAGES: Record<string, { priceId: string; credits: number }> = {
  mini:    { priceId: "credits_mini",    credits: 90 },
  starter: { priceId: "credits_starter", credits: 370 },
  growth:  { priceId: "credits_growth",  credits: 1000 },
  agency:  { priceId: "credits_agency",  credits: 2500 },
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-CREDIT-CHECKOUT] ${s}${d ? ' - ' + JSON.stringify(d) : ''}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const packageId = String(body?.packageId ?? '').toLowerCase().trim();
    const rawEnv = body?.environment;
    const env: StripeEnv = rawEnv === 'live' ? 'live' : 'sandbox';
    const returnUrl = typeof body?.returnUrl === 'string' ? body.returnUrl : null;

    if (!packageId || !CREDIT_PACKAGES[packageId]) {
      return new Response(JSON.stringify({ error: "Invalid package ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pkg = CREDIT_PACKAGES[packageId];

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id || !user?.email) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log("User authed", { userId: user.id, packageId, env });

    // Stripe via Lovable gateway
    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [pkg.priceId], limit: 1 });
    if (!prices.data.length) throw new Error(`Price not found for lookup_key: ${pkg.priceId}`);
    const stripePrice = prices.data[0];

    const origin = req.headers.get("origin") || "https://genesis-director.lovable.app";
    const finalReturnUrl = returnUrl || `${origin}/profile?payment=success&credits=${pkg.credits}&session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: finalReturnUrl,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        user_id: user.id,
        credits: String(pkg.credits),
        package_id: packageId,
      },
    });

    log("Session created", { sessionId: session.id });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
