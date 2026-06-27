// List recent Stripe invoices for the authenticated user's Cinema subscription.
// Returns hosted invoice URLs and PDFs so users can view/download from Credits.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
const THREE_DECIMAL = new Set(["bhd","jod","kwd","omr","tnd"]);

function toMajor(amount: number | null | undefined, currency: string): number {
  const v = amount ?? 0;
  const c = (currency ?? "").toLowerCase();
  if (ZERO_DECIMAL.has(c)) return v;
  if (THREE_DECIMAL.has(c)) return v / 1000;
  return v / 100;
}

function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

import { STRIPE_BILLING_LOCKED, stripeBillingLockedResponse } from "../_shared/stripe-lock.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (STRIPE_BILLING_LOCKED) return stripeBillingLockedResponse(cors);
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
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 12));

    // Collect every Stripe customer id this user has used in this environment.
    const { data: subs } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env);

    const customerIds = Array.from(
      new Set((subs ?? []).map((s: { stripe_customer_id: string | null }) => s.stripe_customer_id).filter(Boolean) as string[]),
    );

    if (customerIds.length === 0) {
      return new Response(JSON.stringify({ invoices: [] }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(env);
    const all: Array<{
      id: string;
      number: string | null;
      status: string | null;
      amount_paid: number;
      amount_due: number;
      currency: string;
      created: string | null;
      period_end: string | null;
      hosted_invoice_url: string | null;
      pdf_url: string | null;
      description: string | null;
    }> = [];

    for (const customerId of customerIds) {
      const list = await stripe.invoices.list({ customer: customerId, limit });
      for (const inv of list.data) {
        const line = inv.lines?.data?.[0];
        all.push({
          id: inv.id ?? "",
          number: inv.number ?? null,
          status: inv.status ?? null,
          amount_paid: toMajor(inv.amount_paid, inv.currency),
          amount_due: toMajor(inv.amount_due, inv.currency),
          currency: inv.currency,
          created: isoFromUnix(inv.created),
          period_end: isoFromUnix((line as any)?.period?.end),
          hosted_invoice_url: inv.hosted_invoice_url ?? null,
          pdf_url: inv.invoice_pdf ?? null,
          description: (line as any)?.description ?? inv.description ?? null,
        });
      }
    }

    all.sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));

    return new Response(JSON.stringify({ invoices: all.slice(0, limit) }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[list-cinema-invoices] error", err);
    return new Response(JSON.stringify({ error: "internal_error", message: "We couldn't load invoices. Please try again." }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
