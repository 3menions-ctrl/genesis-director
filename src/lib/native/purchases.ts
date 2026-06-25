/**
 * Spend-only mode for the iOS native shell.
 *
 * Apple App Store Review Guideline 3.1.1: digital content/credits consumed in
 * an iOS app must be sold through Apple In-App Purchase. We are NOT wiring
 * StoreKit/IAP for now, so the native app ships SPEND-ONLY:
 *   • Credit BALANCE is shown and credits can be SPENT.
 *   • All purchase UI (Buy Credits, Pricing CTAs, checkout flows) is HIDDEN.
 *
 * 3.1.1 also forbids buttons/links that send users to an external purchase
 * mechanism, so we deliberately do NOT render a "buy on the web" link in the
 * native app. Purchasing happens on smallbridges.co in a normal browser.
 *
 * On the web, PURCHASING_ENABLED is always true — nothing changes.
 */
import { IS_NATIVE } from './index';

/** True when the app may show credit-purchase UI (web only; never on iOS). */
export const PURCHASING_ENABLED: boolean = !IS_NATIVE;

/** Convenience inverse for readability at call sites. */
export const IS_SPEND_ONLY: boolean = IS_NATIVE;
