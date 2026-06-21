// Lovable-managed Stripe webhook endpoint.
// Lovable auto-registers Stripe webhooks (sandbox + live) against this
// function and signs events with PAYMENTS_{SANDBOX|LIVE}_WEBHOOK_SECRET.
// The URL is called with `?env=sandbox|live` so the handler can pick the
// right signing secret. Default `sandbox` if missing.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleStripeWebhookRequest } from "../_shared/stripe-webhook-handler.ts";

serve((req) => handleStripeWebhookRequest(req, "sandbox"));
