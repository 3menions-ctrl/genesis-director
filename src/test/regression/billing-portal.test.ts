/**
 * Regression: no in-app way to manage/cancel a subscription (QA audit P2-7) +
 * payout onboarding ignored the return URL (P3).
 *
 * - P2-7: copy promised a billing portal but polar-portal /
 *   createPortalSession had ZERO callers — subscribers couldn't open the portal.
 *   Now PersonalSubscriptionCard has a "Manage billing" button that opens it.
 * - P3:  stripe-connect-onboard reads body.returnUrl, but the client sent
 *   return_path (ignored) → user bounced to the default page. Now sends returnUrl.
 *
 * Source contracts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const card = readFileSync(
  resolve(REPO_ROOT, "src/components/settings/PersonalSubscriptionCard.tsx"),
  "utf-8",
);
const dashboard = readFileSync(
  resolve(REPO_ROOT, "src/pages/account/SettingsDashboard.tsx"),
  "utf-8",
);

describe("P2-7 billing portal is wired to a button", () => {
  it("PersonalSubscriptionCard calls createPortalSession via the provider", () => {
    expect(card).toMatch(/getPaymentsProvider\(/);
    expect(card).toMatch(/createPortalSession\(/);
  });
  it("redirects to the returned portal url", () => {
    expect(card).toMatch(/window\.location\.href\s*=\s*url/);
  });
});

describe("P3 connect onboarding sends the field the fn reads", () => {
  it("sends returnUrl (not the ignored return_path)", () => {
    const region = dashboard.slice(
      dashboard.indexOf("stripe-connect-onboard"),
      dashboard.indexOf("stripe-connect-onboard") + 400,
    );
    expect(region).toMatch(/returnUrl:/);
    expect(region).not.toMatch(/return_path:/);
  });
});
