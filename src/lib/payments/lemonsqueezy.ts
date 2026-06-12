/**
 * Lemon Squeezy provider — a closer-to-OSS alternative to Stripe for
 * EU-based creators who want a merchant of record (LS handles VAT/MoSS).
 *
 * Pure stub today — call sites should not select `lemonsqueezy` until
 * the matching edge functions land. The interface exists so the swap
 * is a one-file change once those edge functions are in place.
 */
import type {
  PaymentsProvider,
  CheckoutSession,
  PortalSession,
} from "./index";

export const lemonsqueezyProvider: PaymentsProvider = {
  name: "lemonsqueezy",

  async createCreditCheckout(): Promise<CheckoutSession> {
    throw new Error("Lemon Squeezy provider not implemented yet");
  },

  async createSubscriptionCheckout(): Promise<CheckoutSession> {
    throw new Error("Lemon Squeezy provider not implemented yet");
  },

  async createPortalSession(): Promise<PortalSession> {
    throw new Error("Lemon Squeezy provider not implemented yet");
  },
};
