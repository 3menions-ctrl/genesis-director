// ─────────────────────────────────────────────────────────────────────────
// Stripe BILLING kill-switch.
//
// Billing is handled exclusively through Polar. Stripe billing surfaces
// (checkout, portal, cinema, org seats) and the inbound Stripe webhook are
// LOCKED until explicitly released. Each locked entrypoint short-circuits at
// the top of its handler.
//
// NOT covered here (intentionally left running): Stripe Connect creator
// payouts (stripe-connect-onboard / stripe-connect-payout).
//
// TO RELEASE: set the env var STRIPE_BILLING_UNLOCK=1 on the affected
// functions, OR change the default below to `false`. (Locked by default so a
// missing/unset env can never silently re-enable Stripe billing.)
// ─────────────────────────────────────────────────────────────────────────

export const STRIPE_BILLING_LOCKED =
  (Deno.env.get("STRIPE_BILLING_UNLOCK") ?? "").trim() !== "1";

/** Standard JSON 503 response for a locked Stripe billing endpoint. */
export function stripeBillingLockedResponse(
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      error: "stripe_billing_disabled",
      message:
        "Stripe billing is currently disabled. All billing is handled through Polar.",
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
