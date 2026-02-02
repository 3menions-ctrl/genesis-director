/**
 * Stripe Webhook Edge Function Tests
 * 
 * Integration tests for payment processing webhooks.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("stripe-webhook - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  await response.text(); // Consume body
  
  assertEquals(response.status, 200);
});

Deno.test("stripe-webhook - requires stripe signature", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      // Missing stripe-signature header
    },
    body: JSON.stringify({
      type: "checkout.session.completed",
    }),
  });

  await response.json();
  
  // Should fail without valid signature
  assertEquals(response.status >= 400, true);
});

Deno.test("stripe-webhook - rejects invalid signature", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "stripe-signature": "invalid_signature",
    },
    body: JSON.stringify({
      type: "checkout.session.completed",
    }),
  });

  await response.json();
  
  // Should reject invalid signature
  assertEquals(response.status >= 400, true);
});
