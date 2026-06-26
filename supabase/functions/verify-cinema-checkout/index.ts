import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Verifies a Cinema checkout session after Stripe redirects back to the app.
 *
 * Returns a normalized status the client uses to decide what to render:
 *   - "paid"          → subscription is active, kick off entitlement refresh
 *   - "processing"    → payment in flight, ask the client to keep polling
 *   - "failed"        → payment declined / authentication failed
 *   - "expired"       → session timed out before completion
 *   - "open"          → user closed the page mid-flow (treat as cancelled)
 *   - "unknown"       → defensive default
 */
const log = (s: string, d?: unknown) =>
  console.log(`[VERIFY-CINEMA-CHECKOUT] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

function classify(session: any): { state: string; reason: string | null } {
  // Session-level lifecycle first
  if (session.status === "expired") return { state: "expired", reason: "Checkout session expired before payment completed." };
  if (session.status === "open")    return { state: "open",    reason: "Checkout was not completed." };

  // status === "complete" — inspect payment outcome
  const paymentStatus: string | undefined = session.payment_status;
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") {
    return { state: "paid", reason: null };
  }

  const piStatus: string | undefined = session.payment_intent?.status;
  const lastErr = session.payment_intent?.last_payment_error;
  if (piStatus === "succeeded") return { state: "paid", reason: null };
  if (piStatus === "processing") return { state: "processing", reason: "Bank is still processing your payment." };
  if (piStatus === "requires_payment_method" || piStatus === "requires_action" || piStatus === "canceled") {
    return {
      state: "failed",
      reason: lastErr?.message || "Your bank declined the payment. Please try a different card.",
    };
  }
  if (paymentStatus === "unpaid") {
    return {
      state: "failed",
      reason: lastErr?.message || "Payment was not collected. Please try again.",
    };
  }
  return { state: "unknown", reason: null };
}

import { STRIPE_BILLING_LOCKED, stripeBillingLockedResponse } from "../_shared/stripe-lock.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (STRIPE_BILLING_LOCKED) return stripeBillingLockedResponse(corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "").trim();
    const rawEnv = body?.environment;
    const env: StripeEnv = rawEnv === "sandbox" ? "sandbox" : "live";

    if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(env);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "subscription"],
    });

    // Defense-in-depth: prevent users from inspecting other people's sessions.
    const sessionUser = (session.metadata as Record<string, string> | null)?.userId;
    if (sessionUser && sessionUser !== user.id) {
      log("session/user mismatch", { sessionUser, userId: user.id, sessionId });
      return new Response(JSON.stringify({ error: "Session does not belong to user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { state, reason } = classify(session);
    const priceId = (session.metadata as Record<string, string> | null)?.priceId ?? null;
    const tier    = (session.metadata as Record<string, string> | null)?.tier ?? null;

    log("classified", { sessionId, state, status: session.status, paymentStatus: session.payment_status });

    return new Response(
      JSON.stringify({
        state,
        reason,
        priceId,
        tier,
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[VERIFY-CINEMA-CHECKOUT] Error", err);
    return new Response(
      JSON.stringify({ error: "verify_failed", message: "We couldn't verify your purchase. Please refresh and try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
