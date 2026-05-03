import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the raw body for signature verification
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // SECURITY: Always require signature verification
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("SECURITY ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured - signature verification required" }), 
        { status: 500 }
      );
    }

    if (!sig) {
      logStep("SECURITY ERROR: Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }), 
        { status: 401 }
      );
    }
    
    let event: Stripe.Event;
    
    try {
      // Use constructEventAsync for Deno/edge runtime (SubtleCrypto requires async)
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      logStep("Signature verified successfully");
    } catch (err) {
      logStep("SECURITY ERROR: Signature verification failed", { 
        error: err instanceof Error ? err.message : String(err) 
      });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }), 
        { status: 401 }
      );
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id, customerEmail: session.customer_email });

      // Validate session has required metadata
      // CRITICAL: Return 200 for non-retryable validation errors to prevent Stripe webhook storms
      // Stripe retries 400/500 errors for up to 3 days, creating thousands of duplicate calls
      if (!session.metadata) {
        logStep("Missing session metadata — acknowledging to prevent retry storm");
        return new Response(JSON.stringify({ received: true, skipped: true, reason: "missing_metadata" }), { status: 200 });
      }

      // Get and validate user_id (must be valid UUID format)
      const userId = session.metadata.user_id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || !uuidRegex.test(userId)) {
        logStep("Invalid user_id in metadata — acknowledging to prevent retry storm", { userId });
        return new Response(JSON.stringify({ received: true, skipped: true, reason: "invalid_user_id" }), { status: 200 });
      }

      // Validate credits is a positive integer within reasonable bounds
      const credits = parseInt(session.metadata.credits || "0", 10);
      if (isNaN(credits) || credits <= 0 || credits > 100000) {
        logStep("Invalid credits value — acknowledging to prevent retry storm", { credits: session.metadata.credits });
        return new Response(JSON.stringify({ received: true, skipped: true, reason: "invalid_credits" }), { status: 200 });
      }

      // Validate package_id is a simple alphanumeric string
      const packageId = session.metadata.package_id;
      if (!packageId || !/^[a-z0-9_-]{1,50}$/i.test(packageId)) {
        logStep("Invalid package_id — acknowledging to prevent retry storm", { packageId });
        return new Response(JSON.stringify({ received: true, skipped: true, reason: "invalid_package_id" }), { status: 200 });
      }

      // Validate payment_intent or session.id for stripe_payment_id
      const stripePaymentId = (session.payment_intent as string) || session.id;
      if (!stripePaymentId || stripePaymentId.length > 255) {
        logStep("Invalid payment reference — acknowledging to prevent retry storm");
        return new Response(JSON.stringify({ received: true, skipped: true, reason: "invalid_payment_ref" }), { status: 200 });
      }

      logStep("Adding credits", { userId, credits, packageId });

      // Create Supabase admin client
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Add credits to user using the existing RPC function
      const { data, error } = await supabaseAdmin.rpc("add_credits", {
        p_user_id: userId,
        p_amount: credits,
        p_description: `Purchased ${credits} credits (${packageId} package)`,
        p_stripe_payment_id: stripePaymentId,
      });

      if (error) {
        logStep("Error adding credits", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      logStep("Credits added successfully", { userId, credits, result: data });
    }

    // ── Subscription lifecycle: sync account tier/type on the profile ──────
    // Triggered by checkout.session.completed for `mode: subscription`,
    // and customer.subscription.{created,updated,deleted}.
    const isSubscriptionLifecycle =
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      (event.type === "checkout.session.completed" &&
        (event.data.object as Stripe.Checkout.Session).mode === "subscription");

    if (isSubscriptionLifecycle) {
      try {
        let userId: string | null = null;
        let plan: string | null = null;
        let active = false;

        if (event.type === "checkout.session.completed") {
          const s = event.data.object as Stripe.Checkout.Session;
          userId = s.metadata?.user_id ?? null;
          plan = (s.metadata?.plan_id ?? s.metadata?.plan ?? null)?.toLowerCase() ?? null;
          active = true;
        } else {
          const sub = event.data.object as Stripe.Subscription;
          userId = (sub.metadata?.user_id as string | undefined) ?? null;
          plan = ((sub.metadata?.plan_id as string | undefined) ??
                  (sub.metadata?.plan as string | undefined) ??
                  null)?.toLowerCase() ?? null;
          active = ["active", "trialing", "past_due"].includes(sub.status);
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (userId && uuidRegex.test(userId) && plan) {
          // Map plan_id → account_type + account_tier per the Bible
          const TIER_MAP: Record<string, { type: string; tier: string }> = {
            starter:    { type: "personal",   tier: "free"     },
            pro:        { type: "personal",   tier: "pro"      },
            growth:     { type: "business",   tier: "growth"   },
            scale:      { type: "business",   tier: "scale"    },
            enterprise: { type: "enterprise", tier: "enterprise" },
          };
          const mapping = TIER_MAP[plan];

          if (mapping) {
            const supabaseAdmin = createClient(
              Deno.env.get("SUPABASE_URL") ?? "",
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
              { auth: { persistSession: false } }
            );

            // On cancellation, downgrade to personal/free at period end.
            const update = active
              ? { account_type: mapping.type, account_tier: mapping.tier, updated_at: new Date().toISOString() }
              : { account_tier: "free", updated_at: new Date().toISOString() };

            const { error: profErr } = await supabaseAdmin
              .from("profiles")
              .update(update)
              .eq("id", userId);

            if (profErr) {
              logStep("Subscription tier sync failed", { userId, plan, error: profErr.message });
            } else {
              logStep("Subscription tier synced", { userId, plan, active });
            }
          } else {
            logStep("Unknown plan in subscription metadata — skipping tier sync", { plan });
          }
        }
      } catch (subErr) {
        // Non-fatal; never block the webhook
        logStep("Subscription lifecycle handler error", {
          error: subErr instanceof Error ? subErr.message : String(subErr),
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});
