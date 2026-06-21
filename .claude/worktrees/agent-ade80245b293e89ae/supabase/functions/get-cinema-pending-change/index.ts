// Returns the user's scheduled Cinema subscription change (upgrade / downgrade
// queued via the customer portal or Stripe schedules) and its effective date.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mirror of CINEMA_TIER_BY_PRICE in stripe-webhook / create-cinema-checkout.
const CINEMA_TIER_BY_PRICE: Record<string, "cinema_lite" | "cinema_pro" | "cinema_studio"> = {
  cinema_lite_monthly:   "cinema_lite",
  cinema_lite_yearly:    "cinema_lite",
  cinema_pro_monthly:    "cinema_pro",
  cinema_pro_yearly:     "cinema_pro",
  cinema_studio_monthly: "cinema_studio",
  cinema_studio_yearly:  "cinema_studio",
};

const TIER_RANK: Record<string, number> = {
  cinema_lite: 1,
  cinema_pro: 2,
  cinema_studio: 3,
};

const TIER_DISPLAY: Record<string, string> = {
  cinema_lite: "Cinema Lite",
  cinema_pro: "Cinema Pro",
  cinema_studio: "Cinema Studio",
};

function resolvePriceLookup(price: any): string | null {
  return price?.lookup_key ?? price?.metadata?.lovable_external_id ?? null;
}

function resolveTier(price: any): "cinema_lite" | "cinema_pro" | "cinema_studio" | null {
  const key = resolvePriceLookup(price);
  return key ? (CINEMA_TIER_BY_PRICE[key] ?? null) : null;
}

function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";

    // Pick the most recent active-ish subscription for this user/env.
    const { data: sub } = await sb
      .from("subscriptions")
      .select("stripe_subscription_id, price_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      return new Response(JSON.stringify({ pending: null }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(env);
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
      expand: ["schedule", "schedule.phases.items.price", "items.data.price"],
    });

    const currentItem: any = subscription.items?.data?.[0];
    const currentPrice: any = currentItem?.price;
    const currentTier = resolveTier(currentPrice) ?? null;
    const currentTierRank = currentTier ? TIER_RANK[currentTier] ?? 0 : 0;
    const currentPeriodEnd = isoFromUnix(
      currentItem?.current_period_end ?? (subscription as any).current_period_end,
    );

    // 1) Scheduled phase change (most common via Customer Portal upgrade/downgrade).
    const schedule: any = (subscription as any).schedule;
    if (schedule && Array.isArray(schedule.phases)) {
      const nowSec = Math.floor(Date.now() / 1000);
      const nextPhase = schedule.phases.find((p: any) => (p.start_date ?? 0) > nowSec);
      if (nextPhase) {
        const nextItem = nextPhase.items?.[0];
        const nextPriceObj = nextItem?.price && typeof nextItem.price === "object"
          ? nextItem.price
          : null;
        const nextPriceId = typeof nextItem?.price === "string"
          ? nextItem.price
          : nextPriceObj?.id ?? null;
        const nextLookup = nextPriceObj ? resolvePriceLookup(nextPriceObj) : null;
        const nextTier = nextPriceObj ? resolveTier(nextPriceObj) : null;
        const nextRank = nextTier ? TIER_RANK[nextTier] ?? 0 : 0;
        const kind: "upgrade" | "downgrade" | "change" =
          nextRank && currentTierRank
            ? nextRank > currentTierRank ? "upgrade" : nextRank < currentTierRank ? "downgrade" : "change"
            : "change";

        return new Response(JSON.stringify({
          pending: {
            kind,
            source: "schedule",
            currentTier,
            currentPlanName: currentTier ? TIER_DISPLAY[currentTier] : null,
            nextTier,
            nextPlanName: nextTier ? TIER_DISPLAY[nextTier] : (nextLookup ?? null),
            nextPriceId: nextLookup ?? nextPriceId,
            cadence: nextLookup?.endsWith("_yearly") ? "yearly" : nextLookup?.endsWith("_monthly") ? "monthly" : null,
            effectiveAt: isoFromUnix(nextPhase.start_date) ?? currentPeriodEnd,
          },
        }), {
          status: 200, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // 2) `pending_update` — proration confirmation pending. Less common for
    // Cinema flows but we surface it for completeness.
    const pendingUpdate: any = (subscription as any).pending_update;
    if (pendingUpdate && Array.isArray(pendingUpdate.subscription_items) && pendingUpdate.subscription_items.length) {
      const nextItem = pendingUpdate.subscription_items[0];
      // pending_update only carries price id, not a full Price object.
      const nextPriceId: string | null = nextItem?.price ?? null;
      let nextTier: "cinema_lite" | "cinema_pro" | "cinema_studio" | null = null;
      let nextLookup: string | null = null;
      if (nextPriceId) {
        try {
          const price = await stripe.prices.retrieve(nextPriceId);
          nextLookup = resolvePriceLookup(price);
          nextTier = resolveTier(price);
        } catch { /* ignore */ }
      }
      const nextRank = nextTier ? TIER_RANK[nextTier] ?? 0 : 0;
      const kind: "upgrade" | "downgrade" | "change" =
        nextRank && currentTierRank
          ? nextRank > currentTierRank ? "upgrade" : nextRank < currentTierRank ? "downgrade" : "change"
          : "change";

      return new Response(JSON.stringify({
        pending: {
          kind,
          source: "pending_update",
          currentTier,
          currentPlanName: currentTier ? TIER_DISPLAY[currentTier] : null,
          nextTier,
          nextPlanName: nextTier ? TIER_DISPLAY[nextTier] : (nextLookup ?? null),
          nextPriceId: nextLookup ?? nextPriceId,
          cadence: nextLookup?.endsWith("_yearly") ? "yearly" : nextLookup?.endsWith("_monthly") ? "monthly" : null,
          effectiveAt: isoFromUnix(pendingUpdate.expires_at) ?? currentPeriodEnd,
        },
      }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ pending: null }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-cinema-pending-change] error", err);
    return new Response(JSON.stringify({ error: String(err), pending: null }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});