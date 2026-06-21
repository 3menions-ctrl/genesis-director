/**
 * Polar.sh implementation of the PaymentsProvider interface.
 *
 * Polar is a merchant-of-record billing platform (open source, polar.sh)
 * that handles global sales tax / VAT for us — a lighter, creator-friendly
 * alternative to Stripe. We wrap the `polar-checkout` and `polar-portal`
 * edge functions so app code keeps calling `payments.createCreditCheckout(...)`.
 *
 * Backend requirements (Supabase secrets):
 *   - POLAR_ACCESS_TOKEN        organization access token (polar_oat_…)
 *   - POLAR_WEBHOOK_SECRET      webhook signing secret from the dashboard
 *   - POLAR_SERVER              "production" | "sandbox" (default sandbox)
 *   - POLAR_PRODUCT_<PKG>       product UUID per credit package (MINI/STARTER/GROWTH/AGENCY)
 *   - POLAR_PRODUCT_<PRICEID>   product UUID per subscription plan (mapped server-side)
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  PaymentsProvider,
  CheckoutSession,
  PortalSession,
} from "./index";

async function call<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message || `${name} failed`);
  return data as T;
}

export const polarProvider: PaymentsProvider = {
  name: "polar",

  async createCreditCheckout({ packageId, returnUrl }): Promise<CheckoutSession> {
    const data = await call<{ url?: string; sessionId?: string }>(
      "polar-checkout",
      { mode: "credits", packageId, returnUrl },
    );
    if (!data?.url || !data?.sessionId) throw new Error("Bad Polar checkout response");
    return { url: data.url, sessionId: data.sessionId };
  },

  async createSubscriptionCheckout({ priceId, kind, returnUrl, orgId }): Promise<CheckoutSession> {
    const data = await call<{ url?: string; sessionId?: string }>(
      "polar-checkout",
      { mode: "subscription", priceId, kind, returnUrl, orgId },
    );
    if (!data?.url || !data?.sessionId) throw new Error("Bad Polar checkout response");
    return { url: data.url, sessionId: data.sessionId };
  },

  async createPortalSession({ returnUrl }): Promise<PortalSession> {
    const data = await call<{ url?: string }>(
      "polar-portal",
      { returnUrl },
    );
    if (!data?.url) throw new Error("Bad Polar portal response");
    return { url: data.url };
  },
};
