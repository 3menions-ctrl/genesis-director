/**
 * Payments abstraction.
 *
 * Stripe is the default provider because it's the only one with mature
 * USD payouts at the scale Small Bridges needs. But we lock the public
 * surface behind a tiny interface so the app code never imports a
 * Stripe-specific type. Swapping in Lemon Squeezy, Paddle, BTCPay, or a
 * crypto rail is a one-file change — the call sites stay the same.
 *
 * Active provider is chosen by VITE_PAYMENTS_PROVIDER at build time.
 */

export type PaymentsProviderName =
  | "stripe"
  | "polar"
  | "lemonsqueezy"
  | "paddle"
  | "btcpay";

export interface CheckoutSession {
  /** A URL the browser should be redirected to. */
  url: string;
  /** The session id (provider-specific). Useful for client polling. */
  sessionId: string;
}

export interface PortalSession {
  url: string;
}

export interface PaymentsProvider {
  name: PaymentsProviderName;

  /** Begin a one-shot credit purchase. Returns a redirect URL. */
  createCreditCheckout(opts: {
    packageId: string;
    returnUrl?: string;
  }): Promise<CheckoutSession>;

  /** Begin a recurring subscription checkout. */
  createSubscriptionCheckout(opts: {
    priceId: string;
    kind: "personal" | "org" | "cinema";
    returnUrl?: string;
    orgId?: string;
  }): Promise<CheckoutSession>;

  /** Open the customer billing portal (where supported). */
  createPortalSession(opts: {
    returnUrl?: string;
  }): Promise<PortalSession>;
}

/**
 * Stripe BILLING kill-switch (audit remediation).
 *
 * The Stripe create-*-checkout path does NOT fund the org credit pool — its
 * webhook (`payments-webhook` → stripe-webhook-handler, currently "sandbox"
 * mode) never tops up `organizations.credits_balance`, so org subscriptions
 * purchased via Stripe land UNFUNDED. Billing is handled by Polar (merchant of
 * record, which funds the pool via `polar-webhook`). This locks the Stripe
 * BILLING provider off and routes any request for it to Polar.
 *
 * Reversible: set to `false` to re-enable Stripe billing once its webhook funds
 * the org pool. Stripe Connect *payouts* (creator earnings) are a separate path
 * and are unaffected by this switch.
 */
const STRIPE_BILLING_LOCKED = true;

const REQUESTED: PaymentsProviderName =
  (import.meta.env.VITE_PAYMENTS_PROVIDER as PaymentsProviderName | undefined)
  || "polar";

const ACTIVE: PaymentsProviderName =
  STRIPE_BILLING_LOCKED && REQUESTED === "stripe" ? "polar" : REQUESTED;

/**
 * Lazy provider resolver — only the active provider's module is loaded.
 */
let cached: PaymentsProvider | null = null;
export async function getPaymentsProvider(): Promise<PaymentsProvider> {
  if (cached) return cached;
  switch (ACTIVE) {
    case "stripe": {
      const { stripeProvider } = await import("./stripe");
      cached = stripeProvider;
      return cached;
    }
    case "polar": {
      const { polarProvider } = await import("./polar");
      cached = polarProvider;
      return cached;
    }
    case "lemonsqueezy": {
      const { lemonsqueezyProvider } = await import("./lemonsqueezy");
      cached = lemonsqueezyProvider;
      return cached;
    }
    case "btcpay": {
      const { btcpayProvider } = await import("./btcpay");
      cached = btcpayProvider;
      return cached;
    }
    case "paddle":
      throw new Error("Paddle provider not implemented yet");
    default:
      throw new Error(`Unknown payments provider: ${ACTIVE}`);
  }
}
