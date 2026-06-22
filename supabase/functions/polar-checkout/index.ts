/**
 * polar-checkout — creates a Polar.sh hosted checkout for either a
 * one-time credit pack (mode: "credits") or a subscription
 * (mode: "subscription"), returning { url, sessionId } to match the
 * PaymentsProvider contract.
 *
 * Credits are granted server-side by polar-webhook on `order.paid` using
 * the metadata we attach here (userId + credits + package_id). The
 * resulting add_credits call posts straight to the double-entry ledger
 * via the mirror trigger.
 *
 * Required secrets: POLAR_ACCESS_TOKEN, POLAR_SERVER (production|sandbox),
 * and a product UUID per pack: POLAR_PRODUCT_MINI / _STARTER / _GROWTH /
 * _AGENCY. Subscriptions resolve POLAR_PRODUCT_<PRICEID> (or accept a raw
 * product UUID as the priceId).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createPolarCheckout } from "../_shared/polar.ts";
import { safeReturnUrl } from "../_shared/return-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_PACKAGES: Record<string, { credits: number; envKey: string }> = {
  // Consumer one-time packs.
  mini:    { credits: 90,   envKey: "POLAR_PRODUCT_MINI" },
  starter: { credits: 370,  envKey: "POLAR_PRODUCT_STARTER" },
  growth:  { credits: 1000, envKey: "POLAR_PRODUCT_GROWTH" },
  agency:  { credits: 2500, envKey: "POLAR_PRODUCT_AGENCY" },
  // Business one-time packs (packageId = lowercased pack name from Pricing).
  studio:    { credits: 5500,  envKey: "POLAR_PRODUCT_STUDIO" },
  brand:     { credits: 12000, envKey: "POLAR_PRODUCT_BRAND" },
  "agency+": { credits: 32000, envKey: "POLAR_PRODUCT_AGENCYPLUS" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const log = (s: string, d?: unknown) =>
  console.log(`[POLAR-CHECKOUT] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? "credits");
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : null;

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id || !user?.email) return json({ error: "Authentication failed" }, 401);

    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_SITE_URL") || "https://genesis-director.lovable.app";

    let productId: string;
    let metadata: Record<string, string>;
    let fallbackReturn: string;

    if (mode === "credits") {
      const packageId = String(body?.packageId ?? "").toLowerCase().trim();
      const pkg = CREDIT_PACKAGES[packageId];
      if (!pkg) return json({ error: "Invalid package ID" }, 400);
      productId = Deno.env.get(pkg.envKey) ?? "";
      if (!productId) return json({ error: `Polar product not configured for ${packageId}` }, 503);
      metadata = {
        userId: user.id,
        user_id: user.id,
        credits: String(pkg.credits),
        package_id: packageId,
        kind: "credits",
      };
      fallbackReturn = `${origin}/credits?payment=success&credits=${pkg.credits}&checkout_id={CHECKOUT_ID}`;
    } else if (mode === "subscription") {
      const priceId = String(body?.priceId ?? "").trim();
      const kind = String(body?.kind ?? "personal");
      const orgId = typeof body?.orgId === "string" ? body.orgId : "";
      if (!priceId) return json({ error: "Missing priceId" }, 400);
      // Accept a raw Polar product UUID, else resolve POLAR_PRODUCT_<PRICEID>.
      productId = UUID_RE.test(priceId)
        ? priceId
        : (Deno.env.get(`POLAR_PRODUCT_${priceId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`) ?? "");
      if (!productId) return json({ error: `Polar product not configured for plan ${priceId}` }, 503);
      metadata = {
        userId: user.id,
        user_id: user.id,
        kind,
        price_id: priceId,
        ...(orgId ? { org_id: orgId } : {}),
      };
      fallbackReturn = `${origin}/account?subscription=success&checkout_id={CHECKOUT_ID}`;
    } else {
      return json({ error: "Invalid mode" }, 400);
    }

    const successUrl = safeReturnUrl({ requested: returnUrl, fallback: fallbackReturn, requestUrl: req.url });
    const successWithId = successUrl.includes("{CHECKOUT_ID}")
      ? successUrl
      : successUrl + (successUrl.includes("?") ? "&" : "?") + "checkout_id={CHECKOUT_ID}";

    const checkout = await createPolarCheckout({
      productId,
      successUrl: successWithId,
      customerEmail: user.email,
      externalCustomerId: user.id,
      metadata,
    });

    log("checkout created", { id: checkout.id, mode });
    return json({ url: checkout.url, sessionId: checkout.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return json({ error: msg }, 500);
  }
});
