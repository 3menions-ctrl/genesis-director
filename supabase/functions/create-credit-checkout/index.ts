import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit packages with Stripe price IDs (must match database stripe_price_id)
const CREDIT_PACKAGES: Record<string, { priceId: string; credits: number }> = {
  starter: {
    priceId: "price_1SpKEvCZh4qZNjWWqIG0CC17",
    credits: 370,
  },
  growth: {
    priceId: "price_1SpKNZCZh4qZNjWWN8QwPqPc",
    credits: 1000,
  },
  agency: {
    priceId: "price_1SpKPsCZh4qZNjWWcafLgUhd",
    credits: 3000,
  },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CREDIT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid JSON body");
    }

    // Validate packageId is a string and exists in allowed packages
    const packageId = typeof body === 'object' && body !== null && 'packageId' in body 
      ? String((body as Record<string, unknown>).packageId).toLowerCase().trim()
      : null;
    
    if (!packageId || packageId.length > 50 || !CREDIT_PACKAGES[packageId]) {
      logStep("Invalid package ID rejected", { received: packageId });
      throw new Error("Invalid package ID");
    }

    const pkg = CREDIT_PACKAGES[packageId];
    logStep("Package selected", { packageId, credits: pkg.credits });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://genesis-director.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: pkg.priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/profile?payment=success&credits=${pkg.credits}`,
      cancel_url: `${origin}/profile?payment=canceled`,
      metadata: {
        user_id: user.id,
        credits: pkg.credits.toString(),
        package_id: packageId,
      },
      customer_creation: customerId ? undefined : 'always',
      payment_intent_data: {
        description: 'Apex Studio Credit Pack',
        receipt_email: user.email,
      },
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
