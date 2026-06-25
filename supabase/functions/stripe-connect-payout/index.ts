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

    // AUDIT FIX H-4 (High): the previous flow read pending rows, created the
    // Stripe transfer, THEN stamped payout_id — with no row lock and no Stripe
    // idempotency key. Two concurrent invocations (double-click / retry / tabs)
    // both read the same unpaid rows and both created separate transfers ⇒
    // double payout (real money). Fixed by:
    //   (a) creating the payout row first, then ATOMICALLY claiming the unpaid
    //       rows via UPDATE ... WHERE payout_id IS NULL (only one caller wins);
    //       the amount is computed solely from rows THIS request claimed;
    //   (b) a deterministic Stripe idempotencyKey;
    //   (c) fail-closed on transfer error: rows stay stamped to the failed
    //       payout (never auto-unclaimed/retried), so a transfer whose outcome
    //       is unknown can never be re-sent. Stranded earnings are recovered by
    //       an operator after reconciling with Stripe.

    // 2. Create the payout row up-front (stripe_payout_id filled in after the
    //    transfer; nullable per migration 20260704000300).
    const { data: payoutRow, error: insErr } = await supabase
      .from("creator_payouts")
      .insert({
        user_id: auth.userId,
        stripe_payout_id: null,
        amount_cents: 0,
        currency: "usd",
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !payoutRow) throw insErr ?? new Error("payout insert failed");

    // 3. Atomically claim this user's unpaid earnings. The WHERE payout_id IS
    //    NULL makes this the single point of mutual exclusion: a concurrent
    //    invocation claims zero rows.
    const { data: claimed, error: claimErr } = await supabase
      .from("creator_earnings_ledger")
      .update({ payout_id: payoutRow.id })
      .eq("user_id", auth.userId)
      .is("payout_id", null)
      .select("id, usd_cents");
    if (claimErr) throw claimErr;

    if (!claimed || claimed.length === 0) {
      // Nothing to pay (or another payout claimed it first) — drop the empty row.
      await supabase.from("creator_payouts").delete().eq("id", payoutRow.id);
      return new Response(
        JSON.stringify({ error: "Nothing to cash out yet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amountCents = claimed.reduce((sum, r) => sum + (r.usd_cents ?? 0), 0);

    // 4. Minimum-threshold check (now on the claimed amount).
    const { data: minRow } = await supabase
      .from("creator_payout_config")
      .select("value")
      .eq("key", "minimum_payout_cents")
      .maybeSingle();
    const minCents = parseInt(String(minRow?.value ?? "2000"), 10) || 2000;

    if (amountCents < minCents) {
      // Below threshold — release the claim and drop the row so the earnings
      // remain available for a future payout.
      await supabase
        .from("creator_earnings_ledger")
        .update({ payout_id: null })
        .eq("payout_id", payoutRow.id);
      await supabase.from("creator_payouts").delete().eq("id", payoutRow.id);
      return new Response(
        JSON.stringify({ error: `Minimum payout is $${(minCents / 100).toFixed(2)}.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("creator_payouts")
      .update({ amount_cents: amountCents })
      .eq("id", payoutRow.id);

    // 5. Create the Stripe Transfer with an idempotency key tied to this payout
    //    row, so a transport-level retry of THIS request cannot create a second
    //    transfer.
    const stripe = createStripeClient("live");
    let transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency: "usd",
          destination: acct.stripe_account_id,
          metadata: { user_id: auth.userId, source: "small-bridges-payout", payout_id: payoutRow.id },
        },
        { idempotencyKey: `sbpayout_${payoutRow.id}` },
      );
    } catch (transferErr) {
      // Fail closed: keep the rows claimed to this failed payout so they are
      // never auto-retried. Operator reconciles with Stripe before releasing.
      await supabase
        .from("creator_payouts")
        .update({ status: "failed", failure_message: String(transferErr).slice(0, 500) })
        .eq("id", payoutRow.id);
      console.error("stripe-connect-payout transfer failed", String(transferErr));
      return new Response(
        JSON.stringify({ error: "Couldn't initiate the payout — please contact support." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Record the transfer id on the (already-claimed) payout row.
    await supabase
      .from("creator_payouts")
      .update({ stripe_payout_id: transfer.id })
      .eq("id", payoutRow.id);

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
