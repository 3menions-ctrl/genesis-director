// Lovable-managed Stripe webhook endpoint.
// Lovable automatically registers this function with Stripe and signs events
// using PAYMENTS_SANDBOX_WEBHOOK_SECRET / PAYMENTS_LIVE_WEBHOOK_SECRET.
// This file simply delegates to the same handler used by the legacy
// `stripe-webhook` function so credit purchases and subscriptions both work.
export { default } from "../stripe-webhook/index.ts";