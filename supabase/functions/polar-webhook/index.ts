/**
 * polar-webhook — receives Polar.sh webhooks (Standard Webhooks signed),
 * verifies them, and:
 *   - order.paid            → grants credits via add_credits (idempotent on
 *                             the Polar order id), which posts to the ledger.
 *   - subscription.created/active/updated → upserts public.subscriptions.
 *   - subscription.canceled → marks cancel_at_period_end.
 *   - subscription.revoked  → marks status canceled.
 *
 * Required secrets: POLAR_WEBHOOK_SECRET (dashboard signing secret),
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * The Polar product UUID for a credit pack carries no credit amount, so the
 * authoritative credit count is read from the checkout metadata we attached
 * in polar-checkout (credits + userId + package_id).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyPolarWebhook } from "../_shared/polar.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[POLAR-WEBHOOK] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

const sb = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const ENV_TAG = (Deno.env.get("POLAR_SERVER") || "sandbox").toLowerCase();

/**
 * Insert a bell notification for the user, idempotently. `dedupeKey` prevents a
 * webhook retry (or duplicate event) from posting the same notification twice.
 */
async function notifyUser(opts: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  dedupeKey: string;
  severity?: string;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(opts.userId)) return;
  const { error } = await sb().from("notifications").upsert(
    {
      user_id: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      data: opts.data ?? {},
      dedupe_key: opts.dedupeKey,
      severity: opts.severity ?? "info",
      read: false,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (error) log("notification insert failed", { error: error.message, type: opts.type });
  else log("notification sent", { userId: opts.userId, type: opts.type });
}

async function grantCredits(order: any) {
  const md = order?.metadata ?? {};
  const userId = String(md.user_id || md.userId || "");
  const credits = parseInt(String(md.credits ?? "0"), 10);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) { log("order.paid: no/invalid user_id", { userId }); return; }
  if (!Number.isFinite(credits) || credits <= 0 || credits > 1000000) { log("order.paid: no creditable amount", { credits: md.credits }); return; }
  const packageId = String(md.package_id ?? "pack");
  const ref = `polar_${order.id}`; // idempotency key for add_credits

  const { error } = await sb().rpc("add_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_description: `Purchased ${credits} credits (${packageId} via Polar)`,
    p_stripe_payment_id: ref,
  });
  // A transient failure here means the customer paid but got no credits. THROW so
  // the handler returns 500 and Polar retries (matching the Stripe handler), rather
  // than swallowing it and returning 200 (which Polar reads as success → no retry).
  if (error) { log("add_credits error", { error: error.message }); throw new Error(`add_credits failed: ${error.message}`); }
  log("credits granted", { userId, credits, packageId, ref });

  // Bell notification — a renewal (subscription order) reads as "added", a
  // one-time pack as "purchased".
  const isRenewal = String(md.kind ?? "") !== "credits" && !!md.price_id;
  await notifyUser({
    userId,
    type: isRenewal ? "subscription_renewed" : "credits_purchased",
    title: isRenewal ? "Monthly credits added" : "Credits added to your balance",
    body: `${credits.toLocaleString()} credits are now ready to spend.`,
    data: { credits, package_id: packageId, order_id: String(order.id), link: "/account?tab=credits" },
    dedupeKey: `notif_order_${order.id}`,
    severity: "success",
  });
}

/**
 * Reverse credits on a refunded order. The refund event carries the same
 * metadata we attached at checkout, so the credit count and user are known.
 * Idempotent on the order id (reverse_credit_purchase dedupes on the reference),
 * so a duplicate refund event is a no-op.
 */
async function reverseCredits(order: any) {
  const md = order?.metadata ?? {};
  const userId = String(md.user_id || md.userId || "");
  const credits = parseInt(String(md.credits ?? "0"), 10);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) { log("order.refunded: no/invalid user_id", { userId }); return; }
  if (!Number.isFinite(credits) || credits <= 0) { log("order.refunded: nothing to reverse", { credits: md.credits }); return; }
  const ref = `polar_${order.id}`;

  const { error } = await sb().rpc("reverse_credit_purchase", {
    p_user_id: userId,
    p_amount: credits,
    p_description: `Refund/chargeback reversal (Polar order ${order.id})`,
    p_reference: ref,
  });
  if (error) { log("reverse_credit_purchase error", { error: error.message }); throw new Error(`reverse_credit_purchase failed: ${error.message}`); }
  log("credits reversed", { userId, credits, ref });

  await notifyUser({
    userId,
    type: "credits_purchased",
    title: "Refund processed",
    body: `${credits.toLocaleString()} credits were reversed for your refunded purchase.`,
    data: { credits: -credits, order_id: String(order.id), link: "/account?tab=credits" },
    dedupeKey: `notif_refund_${order.id}`,
    severity: "info",
  });
}

async function upsertSubscription(sub: any, statusOverride?: string) {
  const md = sub?.metadata ?? {};
  const userId = String(md.user_id || md.userId || sub?.customer?.external_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) { log("sub upsert: no user_id", { subId: sub?.id }); return; }
  const customerId = String(sub?.customer_id || sub?.customer?.id || "");
  const productId = String(sub?.product_id || sub?.product?.id || "");
  const priceId = String(md.price_id || sub?.price_id || sub?.prices?.[0]?.id || productId || "unknown");

  const { error } = await sb().from("subscriptions").upsert({
    user_id: userId,
    organization_id: md.org_id || null,
    stripe_subscription_id: `polar_${sub.id}`,
    stripe_customer_id: customerId || `polar_${userId}`,
    product_id: productId || null,
    price_id: priceId,
    seats: Number(sub?.seats ?? 1) || 1,
    status: statusOverride || String(sub?.status || "active"),
    current_period_start: sub?.current_period_start ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: !!sub?.cancel_at_period_end,
    environment: ENV_TAG,
    metadata: md,
  }, { onConflict: "stripe_subscription_id,environment" });
  if (error) log("sub upsert error", { error: error.message, subId: sub?.id });
  else log("sub upserted", { subId: sub?.id, status: statusOverride || sub?.status });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let event: any;
  try {
    const raw = await req.text();
    event = await verifyPolarWebhook(raw, req.headers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("verification failed", { msg });
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  try {
    const type = String(event?.type ?? "");
    const data = event?.data ?? {};
    log("event", { type, id: data?.id });

    switch (type) {
      case "order.paid":
        await grantCredits(data);
        break;
      case "order.refunded":
        await reverseCredits(data);
        break;
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.uncanceled":
        await upsertSubscription(data);
        break;
      case "subscription.canceled":
        await upsertSubscription(data, undefined); // keeps status, flips cancel_at_period_end via payload
        break;
      case "subscription.revoked":
        await upsertSubscription(data, "canceled");
        break;
      default:
        log("ignored event", { type });
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("handler error", { msg });
    // 500 so Polar retries (per its finite backoff schedule). A transient DB
    // error during fulfillment must NOT be reported as success — that would
    // strand a paid customer with no credits and no retry. Polar surfaces
    // persistently-failing events in the dashboard rather than retrying forever.
    // Body uses a sanitized code (no internal detail leak); full msg is logged.
    return new Response(JSON.stringify({ received: false, error: "handler_error" }), { status: 500 });
  }
});
