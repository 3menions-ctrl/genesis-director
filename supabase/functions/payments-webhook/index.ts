// Lovable-managed Stripe webhook endpoint.
// Lovable auto-registers Stripe webhooks (sandbox + live) against this
// function and signs events with PAYMENTS_{SANDBOX|LIVE}_WEBHOOK_SECRET.
// The URL is called with `?env=sandbox|live` so the handler can pick the
// right signing secret. Default `sandbox` if missing.
//
// LOCKED: billing runs through Polar. While STRIPE_BILLING_LOCKED is set we
// acknowledge inbound Stripe events with 200 (so Stripe does not retry-storm)
// but do NOT process them. Release via the stripe-lock module.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleStripeWebhookRequest } from "../_shared/stripe-webhook-handler.ts";
import { STRIPE_BILLING_LOCKED } from "../_shared/stripe-lock.ts";

serve((req) => {
  if (STRIPE_BILLING_LOCKED) {
    console.log("[payments-webhook] stripe billing locked — event acknowledged and ignored");
    return new Response(
      JSON.stringify({ received: true, ignored: true, reason: "stripe_billing_disabled" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return handleStripeWebhookRequest(req, "sandbox");
});
