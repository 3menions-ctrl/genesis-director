import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

/**
 * Resolve the Stripe secret key for the requested environment. We talk
 * to Stripe's API directly (no proxy gateway) — the sk_test_ / sk_live_
 * prefix on the key itself selects test vs live mode. Sandbox callers
 * (local dev only) may set STRIPE_SANDBOX_SECRET_KEY; otherwise the
 * single STRIPE_SECRET_KEY is used.
 */
function getStripeSecretKey(env: StripeEnv): string {
  if (env === 'sandbox') {
    return Deno.env.get('STRIPE_SANDBOX_SECRET_KEY') || getEnv('STRIPE_SECRET_KEY');
  }
  return getEnv('STRIPE_SECRET_KEY');
}

export function createStripeClient(env: StripeEnv): Stripe {
  // Deno has no Node http stack, so the SDK needs the fetch-based client.
  return new Stripe(getStripeSecretKey(env), {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Verify a Stripe webhook signature without depending on the SDK's
 * `constructEventAsync` (which would route through the gateway).
 * Matches Stripe's HMAC-SHA256 scheme: signed payload = `${timestamp}.${body}`.
 */
export async function verifyStripeWebhook(
  body: string,
  signature: string | null,
  secret: string,
): Promise<{ type: string; data: { object: any }; id: string }> {
  if (!signature) throw new Error("Missing stripe-signature header");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}