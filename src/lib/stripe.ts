import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

// Hostnames that MUST always run live payments, regardless of which token
// was injected at build time. This protects against a build accidentally
// shipping the sandbox publishable key to a production domain.
const LIVE_HOSTS = new Set<string>([
  'apex-studio.ai',
  'www.apex-studio.ai',
  'genesis-director.lovable.app',
]);

function isLiveHost(): boolean {
  if (typeof window === 'undefined') return false;
  return LIVE_HOSTS.has(window.location.hostname);
}

// Live whenever:
//   1. We're on a known production hostname, OR
//   2. The injected token is a live publishable key.
// Otherwise treat as sandbox (preview / local dev).
const environment: StripeEnv =
  isLiveHost() || clientToken?.startsWith('pk_live_') ? 'live' : 'sandbox';

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