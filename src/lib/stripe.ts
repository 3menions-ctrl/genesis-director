import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
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