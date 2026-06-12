/**
 * BTCPay Server payments provider — fully OSS, self-hostable, accepts
 * Bitcoin, Lightning, Monero. Doesn't replace Stripe for fiat payouts
 * but offers a no-fee crypto rail for users in regions where fiat
 * payment cards are friction.
 *
 * VITE_PAYMENTS_PROVIDER=btcpay enables it. The backend needs:
 *   - A BTCPay Server instance
 *   - A store id + webhook secret in supabase secrets (BTCPAY_HOST,
 *     BTCPAY_WEBHOOK_SECRET)
 *   - The `btcpay-create-invoice` and `btcpay-webhook` edge functions
 *     (to be added when this rail is turned on; both are stubs today).
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

export const btcpayProvider: PaymentsProvider = {
  name: "btcpay",

  async createCreditCheckout({ packageId, returnUrl }): Promise<CheckoutSession> {
    const data = await call<{ checkoutLink?: string; invoiceId?: string }>(
      "btcpay-create-invoice",
      { packageId, returnUrl },
    );
    if (!data?.checkoutLink || !data?.invoiceId) {
      throw new Error("BTCPay rail not configured");
    }
    return { url: data.checkoutLink, sessionId: data.invoiceId };
  },

  async createSubscriptionCheckout(): Promise<CheckoutSession> {
    // BTCPay has limited subscription support; for now, recurring
    // payment via crypto is recommended through Stripe + auto-buy
    // credit packs. Throw a friendly error to fail fast.
    throw new Error(
      "Crypto subscriptions not supported. Use the Stripe rail for "
      + "recurring plans, or purchase credit packs in crypto.",
    );
  },

  async createPortalSession(): Promise<PortalSession> {
    throw new Error("BTCPay has no portal session — view invoices in your BTCPay account.");
  },
};
