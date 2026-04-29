import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

// Sandbox publishable key — safe to embed as a fallback. This guarantees that
// production builds (which currently lack a `.env.production` token) can still
// initialize Stripe.js and route through the sandbox checkout pipeline.
const SANDBOX_PUBLISHABLE_FALLBACK =
  "pk_test_51TRI35PJdOrq91IfErr0PTqdIcnvCYQRkYatphDTFZLQL5fmh48m8bhzOex2xnh5OjYDCNV0DvK0takCaTWJCJvJ00nw7MBUtI";
const clientToken =
  (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) ||
  SANDBOX_PUBLISHABLE_FALLBACK;
// Default to sandbox unless we explicitly have a pk_live_ token. This prevents
// accidentally calling the live Stripe pipeline (which requires STRIPE_LIVE_API_KEY)
// in environments where the live publishable key has not yet been provisioned.
const environment: StripeEnv = clientToken?.startsWith('pk_live_') ? 'live' : 'sandbox';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) {
      throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    }
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return environment;
}