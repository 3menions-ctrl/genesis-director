/**
 * Stripe implementation of the PaymentsProvider interface.
 *
 * Wraps the existing `create-credit-checkout` / `create-plan-checkout`
 * / `create-cinema-checkout` / `create-org-checkout` /
 * `create-portal-session` edge functions so the app code calls a single
 * `payments.createCreditCheckout(...)` instead of `supabase.functions.invoke`.
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

export const stripeProvider: PaymentsProvider = {
  name: "stripe",

  async createCreditCheckout({ packageId, returnUrl }): Promise<CheckoutSession> {
    const data = await call<{ url?: string; sessionId?: string }>(
      "create-credit-checkout",
      { packageId, returnUrl },
    );
    if (!data?.url || !data?.sessionId) throw new Error("Bad checkout response");
    return { url: data.url, sessionId: data.sessionId };
  },

  async createSubscriptionCheckout({ priceId, kind, returnUrl, orgId }): Promise<CheckoutSession> {
    const fnName =
      kind === "cinema" ? "create-cinema-checkout"
      : kind === "org" ? "create-org-checkout"
      : "create-plan-checkout";
    const data = await call<{ url?: string; sessionId?: string }>(
      fnName,
      { priceId, returnUrl, orgId },
    );
    if (!data?.url || !data?.sessionId) throw new Error("Bad checkout response");
    return { url: data.url, sessionId: data.sessionId };
  },

  async createPortalSession({ returnUrl }): Promise<PortalSession> {
    const data = await call<{ url?: string }>(
      "create-portal-session",
      { returnUrl },
    );
    if (!data?.url) throw new Error("Bad portal response");
    return { url: data.url };
  },
};
