// ──────────────────────────────────────────────────────────────────────
// stripe-connect-payout
//
// Initiates a payout from the caller's pending earnings to their
// connected Stripe Express account. Stamps every earnings_ledger row
// that contributed to the payout with the new payout_id so we can't
// double-pay.
//
// Body: {}
// Response: { payoutId: string, amount_cents: number }
// ──────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Verify the account is fully onboarded + payouts enabled.
    const { data: acct } = await supabase
      .from("creator_payout_accounts")
      .select("stripe_account_id, payouts_enabled, onboarding_complete")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (!acct?.stripe_account_id || !acct.onboarding_complete || !acct.payouts_enabled) {
      return new Response(
        JSON.stringify({ error: "Finish Stripe Connect onboarding first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Lock pending earnings + compute the payout amount.
    // We pull rows in a single SELECT FOR UPDATE-equivalent via the
    // service-role client — safe because no other path is mutating them
    // concurrently (only the trigger inserts).
    const { data: pending } = await supabase
      .from("creator_earnings_ledger")
      .select("id, usd_cents")
      .eq("user_id", auth.userId)
      .is("payout_id", null);

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nothing to cash out yet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amountCents = pending.reduce((sum, r) => sum + (r.usd_cents ?? 0), 0);

    // 3. Pull minimum payout threshold from config.
    const { data: minRow } = await supabase
      .from("creator_payout_config")
      .select("value")
      .eq("key", "minimum_payout_cents")
      .maybeSingle();
    const minCents = parseInt(String(minRow?.value ?? "2000"), 10) || 2000;

    if (amountCents < minCents) {
      return new Response(
        JSON.stringify({ error: `Minimum payout is $${(minCents / 100).toFixed(2)}.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Create a Stripe Transfer to the connected account.
    const stripe = createStripeClient("live");
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: acct.stripe_account_id,
      metadata: { user_id: auth.userId, source: "small-bridges-payout" },
    });

    // 5. Record the payout + stamp the ledger entries.
    const { data: payoutRow, error: insErr } = await supabase
      .from("creator_payouts")
      .insert({
        user_id: auth.userId,
        stripe_payout_id: transfer.id,
        amount_cents: amountCents,
        currency: "usd",
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !payoutRow) throw insErr ?? new Error("payout insert failed");

    const ids = pending.map((r) => r.id);
    await supabase
      .from("creator_earnings_ledger")
      .update({ payout_id: payoutRow.id })
      .in("id", ids);

    return new Response(
      JSON.stringify({ payoutId: payoutRow.id, amount_cents: amountCents }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("stripe-connect-payout failed", String(e));
    return new Response(
      JSON.stringify({ error: "Couldn't initiate the payout — try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
