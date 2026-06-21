/**
 * Shared Polar.sh helpers for edge functions.
 *
 *  - polarBase()          → API base URL, switched by POLAR_SERVER.
 *  - createPolarCheckout  → POST /v1/checkouts/, returns { id, url }.
 *  - polarCustomerPortal  → customer portal link for an external customer id.
 *  - verifyPolarWebhook   → Standard Webhooks (Svix-compatible) signature check.
 *
 * Webhook verification note: Polar's own SDK does
 *   Buffer.from(secret,'utf-8').toString('base64')
 * and hands that to the standard-webhooks lib, which base64-decodes it back.
 * Net effect: the HMAC-SHA256 key is the RAW UTF-8 bytes of the dashboard
 * secret. We replicate that here with WebCrypto (no npm deps in Deno).
 */

export function polarBase(): string {
  const server = (Deno.env.get("POLAR_SERVER") || "sandbox").toLowerCase();
  return server === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";
}

function polarToken(): string {
  const t = Deno.env.get("POLAR_ACCESS_TOKEN");
  if (!t) throw new Error("POLAR_ACCESS_TOKEN is not configured");
  return t;
}

export interface PolarCheckoutResult {
  id: string;
  url: string;
}

export async function createPolarCheckout(opts: {
  productId: string;
  successUrl: string;
  customerEmail?: string;
  externalCustomerId?: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<PolarCheckoutResult> {
  const res = await fetch(`${polarBase()}/v1/checkouts/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${polarToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products: [opts.productId],
      success_url: opts.successUrl,
      customer_email: opts.customerEmail,
      external_customer_id: opts.externalCustomerId,
      metadata: opts.metadata ?? {},
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Polar checkout failed (${res.status}): ${txt.slice(0, 400)}`);
  }
  const data = await res.json();
  if (!data?.id || !data?.url) throw new Error("Polar checkout response missing id/url");
  return { id: data.id, url: data.url };
}

export async function polarCustomerPortal(externalCustomerId: string): Promise<string | null> {
  // Create a customer session and return its portal URL.
  const res = await fetch(`${polarBase()}/v1/customer-sessions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${polarToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ external_customer_id: externalCustomerId }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.customer_portal_url ?? null;
}

// ---- Standard Webhooks verification (constant-time) -----------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Verify a Polar webhook. Returns the parsed event on success, throws on
 * failure. `rawBody` MUST be the exact bytes received (do not re-serialize).
 */
export async function verifyPolarWebhook(
  rawBody: string,
  headers: Headers,
): Promise<any> {
  const secret = Deno.env.get("POLAR_WEBHOOK_SECRET");
  if (!secret) throw new Error("POLAR_WEBHOOK_SECRET is not configured");

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) throw new Error("missing webhook signature headers");

  // Reject stale timestamps (>5 min) to blunt replay attacks.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new Error("webhook timestamp outside tolerance");
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Header is space-delimited "v1,<sig> v1,<sig2>"; match any.
  const ok = sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    return sig && timingSafeEqual(sig, expected);
  });
  if (!ok) throw new Error("webhook signature mismatch");

  return JSON.parse(rawBody);
}
