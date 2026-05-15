// Legacy custom Stripe webhook endpoint.
// Logic lives in _shared/stripe-webhook-handler.ts so the new
// Lovable-managed `payments-webhook` function can share it.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleStripeWebhookRequest } from "../_shared/stripe-webhook-handler.ts";

serve((req) => handleStripeWebhookRequest(req, "live"));
