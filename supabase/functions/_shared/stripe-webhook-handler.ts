// Shared Stripe webhook handler for the Lovable-managed `payments-webhook`
// endpoint. Verifies signatures against the configured webhook secret and
// dispatches credit purchases + subscription lifecycle events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { verifyStripeWebhook, type StripeEnv } from "./stripe.ts";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function pickWebhookSecret(env: StripeEnv): string | null {
  const secret = env === "sandbox"
    ? Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET");
  return secret && secret.length > 0 ? secret : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CINEMA_TIER_BY_PRICE: Record<string, "cinema_lite" | "cinema_pro" | "cinema_studio"> = {
  cinema_lite_monthly:   "cinema_lite",
  cinema_lite_yearly:    "cinema_lite",
  cinema_pro_monthly:    "cinema_pro",
  cinema_pro_yearly:     "cinema_pro",
  cinema_studio_monthly: "cinema_studio",
  cinema_studio_yearly:  "cinema_studio",
};

function resolveCinemaTier(priceId?: string | null) {
  if (!priceId) return null;
  return CINEMA_TIER_BY_PRICE[priceId] ?? null;
}

async function handleCreditPurchase(session: any) {
  const md = session.metadata || {};
  const userId = md.user_id;
  if (!userId || !UUID_RE.test(userId)) {
    log("skip credit purchase: bad user_id", { userId });
    return;
  }
  const credits = parseInt(md.credits || "0", 10);
  if (!Number.isFinite(credits) || credits <= 0 || credits > 100000) {
    log("skip credit purchase: bad credits", { credits: md.credits });
    return;
  }
  const packageId = md.package_id;
  if (!packageId || !/^[a-z0-9_-]{1,50}$/i.test(packageId)) {
    log("skip credit purchase: bad package_id", { packageId });
    return;
  }
  const stripePaymentId = (session.payment_intent as string) || session.id;

  const sb = getSupabase();
  const { error } = await sb.rpc("add_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_description: `Purchased ${credits} credits (${packageId} package)`,
    p_stripe_payment_id: stripePaymentId,
  });
  if (error) {
    log("add_credits error", { error: error.message });
    throw new Error(error.message);
  }
  log("credits added", { userId, credits, packageId });
}

async function handleSubscriptionUpsert(sub: any, env: StripeEnv) {
  const md = sub.metadata || {};
  const userId = md.user_id || md.userId;
  if (!userId || !UUID_RE.test(userId)) {
    log("skip subscription upsert: bad user_id", { userId, subId: sub.id });
    return;
  }

  const items = sub.items?.data || [];
  let basePriceId: string | null = null;
  let seatPriceId: string | null = null;
  let seats = 1;
  let productId: string | null = null;

  for (const it of items) {
    const ext = it?.price?.metadata?.lovable_external_id || it?.price?.id;
    const isSeat = (it?.price?.metadata?.role === "seat") ||
                   /seat/i.test(ext || "") ||
                   (items.length > 1 && (it?.quantity || 1) > 1);
    if (isSeat) {
      seatPriceId = ext;
      seats = it.quantity || seats;
    } else {
      basePriceId = ext;
      productId = it?.price?.product || productId;
    }
  }
  if (!basePriceId && items[0]) {
    basePriceId = items[0].price?.metadata?.lovable_external_id || items[0].price?.id;
    productId = items[0].price?.product || productId;
    seats = items[0].quantity || 1;
  }

  if (!basePriceId) {
    log("skip subscription upsert: no priceId resolvable", { subId: sub.id });
    return;
  }

  const cinemaTier = resolveCinemaTier(basePriceId);

  const item = items[0];
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  const orgId = md.organization_id || md.org_id || null;

  const sb = getSupabase();
  const { error } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      organization_id: orgId && UUID_RE.test(orgId) ? orgId : null,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: productId,
      price_id: basePriceId,
      seat_price_id: seatPriceId,
      seats,
      status: sub.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      environment: env,
      metadata: cinemaTier ? { ...md, cinema_tier: cinemaTier } : md,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id,environment" },
  );
  if (error) {
    log("subscription upsert error", { error: error.message, subId: sub.id });
    throw new Error(error.message);
  }
  log("subscription upserted", {
    subId: sub.id, userId, seats, status: sub.status, env,
    ...(cinemaTier && { cinema_tier: cinemaTier, cinema_period_end: periodEnd }),
  });
}

async function handleSubscriptionDeleted(sub: any, env: StripeEnv) {
  const sb = getSupabase();
  await sb.from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  log("subscription canceled", { subId: sub.id });
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  const subscriptionId: string | null = invoice?.subscription || invoice?.parent?.subscription_details?.subscription || null;
  if (!subscriptionId) {
    log("skip invoice.paid: no subscription id", { invoiceId: invoice?.id });
    return;
  }
  const line = invoice?.lines?.data?.[0];
  const periodStart = line?.period?.start ?? null;
  const periodEnd = line?.period?.end ?? null;
  if (!periodStart || !periodEnd) {
    log("invoice.paid missing period — relying on subscription.updated", { subscriptionId });
    return;
  }
  const sb = getSupabase();
  const { error } = await sb.from("subscriptions")
    .update({
      status: "active",
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env);
  if (error) {
    log("invoice.paid update error", { error: error.message, subscriptionId });
    throw new Error(error.message);
  }
  log("invoice.paid period rolled", { subscriptionId, periodStart, periodEnd, env });
}

async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  const subscriptionId: string | null = invoice?.subscription || invoice?.parent?.subscription_details?.subscription || null;
  if (!subscriptionId) return;
  const sb = getSupabase();
  await sb.from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env);
  log("invoice.payment_failed → past_due", { subscriptionId, env });
}

/**
 * Default env when the webhook URL omits `?env=`. Lovable's managed
 * registration always appends ?env=sandbox|live; legacy custom Stripe
 * endpoints may not, so we fall back to "live" for the production endpoint.
 */
export async function handleStripeWebhookRequest(
  req: Request,
  defaultEnv: StripeEnv = "live",
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const rawEnv = url.searchParams.get("env");
    const env: StripeEnv = rawEnv === "sandbox" || rawEnv === "live" ? rawEnv : defaultEnv;

    const secret = pickWebhookSecret(env);
    if (!secret) {
      log("ERROR: no webhook secret configured", { env });
      return new Response(JSON.stringify({ error: "webhook not configured" }), { status: 500 });
    }

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    let event: { type: string; data: { object: any }; id: string };
    try {
      event = await verifyStripeWebhook(body, sig, secret);
    } catch (err) {
      log("ERROR: signature verification failed", { error: String(err), env });
      return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
    }

    log("event", { type: event.type, env, id: event.id });

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "payment") {
            await handleCreditPurchase(session);
          }
          if (session.mode === "subscription") {
            const md = session.metadata || {};
            if (md.kind === "cinema_subscription") {
              log("cinema checkout completed", {
                userId: md.userId, priceId: md.priceId, tier: md.tier, sessionId: session.id,
              });
            }
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpsert(event.data.object, env);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object, env);
          break;
        case "invoice.paid":
        case "invoice.payment_succeeded":
          await handleInvoicePaid(event.data.object, env);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object, env);
          break;
        default:
          log("unhandled event", { type: event.type });
      }
    } catch (handlerErr) {
      log("handler error", { error: String(handlerErr) });
      return new Response(JSON.stringify({ error: String(handlerErr) }), { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log("FATAL", { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}