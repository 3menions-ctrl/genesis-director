import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const envClientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const LIVE_CLIENT_TOKEN = "pk_live_51SoLX1Ch3vnsCadWqeD2j7Q79zMMkUlf7Yg3WzixpwnzxIGTP4mOfFLYWBBxEEGJz1HT2vInxfiE1klmvGznjU5b008maWivNL";

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
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false;
  return LIVE_HOSTS.has(hostname) || hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com');
}

// Live whenever:
//   1. We're on a known production hostname, OR
//   2. The injected token is a live publishable key.
// Otherwise treat as sandbox (preview / local dev).
const clientToken = isLiveHost() ? LIVE_CLIENT_TOKEN : envClientToken;
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