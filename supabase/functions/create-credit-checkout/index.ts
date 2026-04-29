import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Credit packages — uses Lovable Stripe lookup_keys (resolved server-side).
// Pricing: $1 = 10 credits.
const CREDIT_PACKAGES: Record<string, { lookupKey: string; credits: number }> = {
  mini:    { lookupKey: "credits_mini_v1",    credits: 90 },
  starter: { lookupKey: "credits_starter_v1", credits: 370 },
  growth:  { lookupKey: "credits_growth_v1",  credits: 1000 },
  agency:  { lookupKey: "credits_agency_v1",  credits: 2500 },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CREDIT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  try {
    logStep("Function started");

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid JSON body");
    }

    const parsedBody = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    const packageId = 'packageId' in parsedBody
      ? String(parsedBody.packageId).toLowerCase().trim()
      : null;
    const isWelcomeOffer = parsedBody.welcomeOffer === true;
    const envInput = typeof parsedBody.environment === "string" ? parsedBody.environment : "sandbox";
    const stripeEnv: StripeEnv = envInput === "live" ? "live" : "sandbox";
    
    if (!packageId || packageId.length > 50 || !CREDIT_PACKAGES[packageId]) {
      logStep("Invalid package ID rejected", { received: packageId });
      throw new Error("Invalid package ID");
    }

    const pkg = CREDIT_PACKAGES[packageId];
    logStep("Package selected", { packageId, credits: pkg.credits });

    // ─── Auth validation ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    logStep("Auth header check", { hasAuth: !!authHeader, prefix: authHeader?.substring(0, 20) });
    
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing or invalid authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Validate token and get user in one call
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      logStep("Auth failed", { error: authError.message, code: authError.status });
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!authUser?.id || !authUser?.email) {
      logStep("Auth missing user data", { hasId: !!authUser?.id, hasEmail: !!authUser?.email });
      throw new Error("User not authenticated or email not available");
    }
    
    const userId = authUser.id;
    const userEmail = authUser.email;
    logStep("User authenticated", { userId, email: userEmail });

    // ─── Stripe checkout (Lovable Stripe via gateway) ─────────────
    const stripe = createStripeClient(stripeEnv);
    logStep("Stripe client ready", { env: stripeEnv });

    // Resolve human-readable lookup_key → real Stripe price ID
    const prices = await stripe.prices.list({ lookup_keys: [pkg.lookupKey], limit: 1 });
    if (!prices.data.length) {
      throw new Error(`Price not found for lookup_key ${pkg.lookupKey}`);
    }
    const stripePrice = prices.data[0];

    const origin = req.headers.get("origin") || "https://genesis-director.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/profile?payment=success&credits=${pkg.credits}`,
      cancel_url: `${origin}/profile?payment=canceled`,
      metadata: {
        user_id: userId,
        credits: pkg.credits.toString(),
        package_id: packageId,
        welcome_offer: isWelcomeOffer ? 'true' : 'false',
      },
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
