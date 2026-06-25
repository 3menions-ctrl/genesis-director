// Sync seat quantity from org_seats → Stripe subscription line item.
// Called after assign_org_seat / revoke_org_seat to keep billing accurate.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json();
    const orgId: string = body.organizationId;
    if (!orgId) return new Response(JSON.stringify({ error: "missing organizationId" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    // Verify caller has admin permission on the org
    const { data: perm } = await sb.rpc("has_org_permission", {
      p_org_id: orgId, p_user_id: user.id, p_min_role: "admin",
    });
    if (!perm) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    // Active seat count
    const { data: countData } = await sb.rpc("get_org_seat_count", { p_org_id: orgId });
    const activeSeats: number = countData || 1;

    // Find the org's active subscription across BOTH environments. PREVIOUSLY
    // this filtered by an env that defaulted to 'sandbox' when the client didn't
    // pass `environment: "live"` — but webhooks store hosted checkouts as
    // 'live', so the lookup always missed and returned no_active_subscription.
    // Derive the Stripe env from the stored row instead of trusting the body.
    const { data: sub } = await sb
      .from("subscriptions")
      .select("stripe_subscription_id, seat_price_id, environment")
      .eq("organization_id", orgId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_active_subscription", seats: activeSeats }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const env: StripeEnv = sub.environment === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(env);
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const seatItem = stripeSub.items.data.find((it: any) =>
      it.price?.metadata?.role === "seat" ||
      /seat/i.test(it.price?.metadata?.lovable_external_id || "") ||
      it.id === sub.seat_price_id
    );

    if (!seatItem) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_seat_line_item", seats: activeSeats }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: seatItem.id, quantity: activeSeats }],
      proration_behavior: "create_prorations",
    });

    // Update local row immediately (webhook will re-sync too)
    await sb.from("subscriptions")
      .update({ seats: activeSeats, updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", sub.stripe_subscription_id)
      .eq("environment", env);

    return new Response(JSON.stringify({ ok: true, seats: activeSeats }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-org-seats] error", err);
    return new Response(JSON.stringify({ error: "internal_error", message: "We couldn't sync seats. Please try again." }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
