import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the raw body for signature verification
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // SECURITY: Always require signature verification
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("SECURITY ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured - signature verification required" }), 
        { status: 500 }
      );
    }

    if (!sig) {
      logStep("SECURITY ERROR: Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }), 
        { status: 401 }
      );
    }
    
    let event: Stripe.Event;
    
    try {
      // Use constructEventAsync for Deno/edge runtime (SubtleCrypto requires async)
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      logStep("Signature verified successfully");
    } catch (err) {
      logStep("SECURITY ERROR: Signature verification failed", { 
        error: err instanceof Error ? err.message : String(err) 
      });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }), 
        { status: 401 }
      );
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id, customerEmail: session.customer_email });

      // Validate session has required metadata
      if (!session.metadata) {
        logStep("Missing session metadata");
        return new Response(JSON.stringify({ error: "Missing session metadata" }), { status: 400 });
      }

      // Get and validate user_id (must be valid UUID format)
      const userId = session.metadata.user_id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || !uuidRegex.test(userId)) {
        logStep("Invalid user_id in metadata", { userId });
        return new Response(JSON.stringify({ error: "Invalid user_id" }), { status: 400 });
      }

      // Validate credits is a positive integer within reasonable bounds
      const credits = parseInt(session.metadata.credits || "0", 10);
      if (isNaN(credits) || credits <= 0 || credits > 100000) {
        logStep("Invalid credits value", { credits: session.metadata.credits });
        return new Response(JSON.stringify({ error: "Invalid credits value" }), { status: 400 });
      }

      // Validate package_id is a simple alphanumeric string
      const packageId = session.metadata.package_id;
      if (!packageId || !/^[a-z0-9_-]{1,50}$/i.test(packageId)) {
        logStep("Invalid package_id", { packageId });
        return new Response(JSON.stringify({ error: "Invalid package_id" }), { status: 400 });
      }

      // Validate payment_intent or session.id for stripe_payment_id
      const stripePaymentId = (session.payment_intent as string) || session.id;
      if (!stripePaymentId || stripePaymentId.length > 255) {
        logStep("Invalid payment reference");
        return new Response(JSON.stringify({ error: "Invalid payment reference" }), { status: 400 });
      }

      logStep("Adding credits", { userId, credits, packageId });

      // Create Supabase admin client
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Add credits to user using the existing RPC function
      const { data, error } = await supabaseAdmin.rpc("add_credits", {
        p_user_id: userId,
        p_amount: credits,
        p_description: `Purchased ${credits} credits (${packageId} package)`,
        p_stripe_payment_id: stripePaymentId,
      });

      if (error) {
        logStep("Error adding credits", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      logStep("Credits added successfully", { userId, credits, result: data });
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});
