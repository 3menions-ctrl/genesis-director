/**
 * Credit packages — the single front-end source of truth for the
 * pay-as-you-go credit packs. The `id` MUST match a key in the
 * `CREDIT_PACKAGES` map inside
 * supabase/functions/create-credit-checkout/index.ts (the server looks
 * up the real Stripe price by that package's lookup key, so the price
 * here is display-only and must be kept in sync with Stripe).
 */
import { getPaymentsProvider } from "./index";
import { IS_SPEND_ONLY } from "@/lib/native/purchases";

export interface CreditPackage {
  id: "mini" | "starter" | "growth" | "agency" | "studio" | "brand" | "agency+";
  name: string;
  /** USD, display only — the authoritative charge is the provider price. */
  price: number;
  credits: number;
  blurb: string;
  popular?: boolean;
  /** "business" packs are the larger one-time tiers shown on the business
   *  pricing surface; "personal" are the default buy-credits packs. */
  tier?: "personal" | "business";
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  { id: "mini",    name: "Mini",    price: 9,    credits: 90,    blurb: "Quick top-up — one short story.", tier: "personal" },
  { id: "starter", name: "Starter", price: 37,   credits: 370,   blurb: "A weekend of experiments.", tier: "personal" },
  { id: "growth",  name: "Growth",  price: 99,   credits: 1000,  blurb: "Ship something every week.", popular: true, tier: "personal" },
  { id: "agency",  name: "Agency",  price: 249,  credits: 2500,  blurb: "For studios and teams.", tier: "personal" },
  { id: "studio",  name: "Studio",  price: 499,  credits: 5500,  blurb: "Studio-scale production.", tier: "business" },
  { id: "brand",   name: "Brand",   price: 999,  credits: 12000, blurb: "Always-on brand content.", tier: "business" },
  { id: "agency+", name: "Agency+", price: 2499, credits: 32000, blurb: "Highest-volume teams.", tier: "business" },
];

export function approxClips(credits: number): number {
  // Rough guide used across the credit UI (~10 credits ≈ one clip).
  return Math.round(credits / 10);
}

/**
 * Begin a hosted Stripe checkout for a credit package and redirect the
 * browser to it. Throws on failure so callers can surface a toast. On
 * success the function does not return (navigation occurs).
 */
export async function startCreditCheckout(packageId: CreditPackage["id"]): Promise<void> {
  // Hard backstop for the iOS native shell: Apple guideline 3.1.1 forbids
  // selling digital credits through anything but In-App Purchase, so no
  // web checkout may ever start from inside the native app. The UI is also
  // hidden (see PURCHASING_ENABLED), but this guarantees it at the source.
  if (IS_SPEND_ONLY) {
    throw new Error("Purchasing isn't available in the app. Manage credits on the web.");
  }
  const provider = await getPaymentsProvider();
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/credits?payment=success`
      : undefined;
  const { url } = await provider.createCreditCheckout({ packageId, returnUrl });
  if (!url) throw new Error("Checkout did not return a redirect URL");
  window.location.href = url;
}
