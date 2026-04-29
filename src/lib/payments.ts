/**
 * Lovable Stripe payments helpers.
 * The client token (VITE_PAYMENTS_CLIENT_TOKEN) starts with `pk_test_` in dev
 * and `pk_live_` in production. We derive the environment from that prefix
 * and pass it to the checkout edge function.
 */
export type PaymentsEnv = "sandbox" | "live";

export function getPaymentsEnvironment(): PaymentsEnv {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
  return token?.startsWith("pk_live_") ? "live" : "sandbox";
}