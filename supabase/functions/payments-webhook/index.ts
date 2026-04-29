import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@22.0.2";
import { type StripeEnv, createStripeClient, getWebhookSecret } from "../_shared/stripe.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAYMENTS-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const url = new URL(req.url);
    const envParam = url.searchParams.get("env") === "live" ? "live" : "sandbox";
    const stripeEnv: StripeEnv = envParam;

    const stripe = createStripeClient(stripeEnv);
    const webhookSecret = getWebhookSecret(stripeEnv);

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      logStep("Signature verified", { env: stripeEnv });
    } catch (err) {
      logStep("Signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed" || event.type === "transaction.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout completed", { sessionId: session.id });

      if (!session.metadata) {
        return new Response(JSON.stringify({ received: true, skipped: "no_metadata" }), { status: 200 });
      }

      const userId = session.metadata.user_id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || !uuidRegex.test(userId)) {
        return new Response(JSON.stringify({ received: true, skipped: "invalid_user_id" }), { status: 200 });
      }

      const credits = parseInt(session.metadata.credits || "0", 10);
      if (isNaN(credits) || credits <= 0 || credits > 100000) {
        return new Response(JSON.stringify({ received: true, skipped: "invalid_credits" }), { status: 200 });
      }

      const packageId = session.metadata.package_id;
      if (!packageId || !/^[a-z0-9_-]{1,50}$/i.test(packageId)) {
        return new Response(JSON.stringify({ received: true, skipped: "invalid_package_id" }), { status: 200 });
      }

      const stripePaymentId = (session.payment_intent as string) || session.id;

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data, error } = await supabaseAdmin.rpc("add_credits", {
        p_user_id: userId,
        p_amount: credits,
        p_description: `Purchased ${credits} credits (${packageId} package)`,
        p_stripe_payment_id: stripePaymentId,
      });

      if (error) {
        logStep("add_credits error", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      logStep("Credits added", { userId, credits, result: data });
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