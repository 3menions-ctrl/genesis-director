// ──────────────────────────────────────────────────────────────────────
// stripe-connect-onboard
//
// Creates or fetches a Stripe Express account for the caller and
// returns a short-lived account-link URL the user is redirected to
// in order to complete onboarding (KYC, bank account, terms).
//
// Body: { returnUrl?: string }
// Response: { url: string }
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

    const body = await req.json().catch(() => ({}));
    const { safeReturnUrl } = await import("../_shared/return-url.ts");
    const origin = req.headers.get("origin")
      || Deno.env.get("PUBLIC_SITE_URL")
      || "https://smallbridges.com";
    const refreshUrl = safeReturnUrl({
      requested: typeof body.returnUrl === "string" ? body.returnUrl : null,
      fallback: `${origin}/workspace/credits?connect=refresh`,
      requestUrl: req.url,
    });
    const returnUrl = safeReturnUrl({
      requested: typeof body.returnUrl === "string" ? body.returnUrl : null,
      fallback: `${origin}/workspace/credits?connect=done`,
      requestUrl: req.url,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find or create the Stripe Express account.
    const { data: existing } = await supabase
      .from("creator_payout_accounts")
      .select("stripe_account_id, onboarding_complete")
      .eq("user_id", auth.userId)
      .maybeSingle();

    const stripe = createStripeClient("live");   // payouts are live-only
    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const { data: { user } } = await supabase.auth.admin.getUserById(auth.userId);
      const acct = await stripe.accounts.create({
        type: "express",
        email: user?.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        business_profile: {
          name: "Small Bridges creator",
          product_description: "Cinematic AI video & atom sales on Small Bridges",
        },
        metadata: { user_id: auth.userId },
      });
      accountId = acct.id;
      await supabase.from("creator_payout_accounts").insert({
        user_id: auth.userId,
        stripe_account_id: accountId,
        onboarding_complete: false,
        payouts_enabled: false,
        charges_enabled: false,
        country: acct.country ?? null,
      });
    }

    // 2. Short-lived account link the user is redirected to.
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-connect-onboard failed", String(e));
    return new Response(JSON.stringify({ error: "Couldn't start onboarding — try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
