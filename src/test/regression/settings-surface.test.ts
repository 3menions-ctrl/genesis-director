/**
 * Regression: the /settings surface carried four broken flows (QA audit):
 *  - P2-3 change-email always failed (sent no password; edge fn requires it)
 *  - P2-4 "opt out of tracking" was a no-op (wrote user_gamification, but
 *         track_event reads profiles.tracking_opted_out)
 *  - P2-5 "Deactivate" navigated to a route that redirects straight back (dead end)
 *  - P2-6 "Active Sessions" was hardcoded fake markup, never the real sessions
 *
 * Source contracts (heavy settings components).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const account = readFileSync(
  resolve(REPO_ROOT, "src/components/settings/AccountSettings.tsx"),
  "utf-8",
);
const security = readFileSync(
  resolve(REPO_ROOT, "src/components/settings/SecuritySettings.tsx"),
  "utf-8",
);

describe("P2-3 change-email sends the required password", () => {
  it("invokes update-user-email with newEmail AND password", () => {
    expect(account).toMatch(/invoke\('update-user-email'/);
    expect(account).toMatch(/body:\s*\{\s*newEmail:[^}]*password:/);
  });
});

describe("P2-4 opt-out tracking writes the canonical profiles column", () => {
  it("handlePrivacyToggle updates profiles, not user_gamification", () => {
    const region = account.slice(
      account.indexOf("handlePrivacyToggle"),
      account.indexOf("handlePrivacyToggle") + 700,
    );
    expect(region).toMatch(/\.from\('profiles'\)[\s\S]*?\.update\(/);
    expect(region).not.toMatch(/\.from\('user_gamification'\)[\s\S]*?\.update\(/);
  });
});

describe("P2-5 deactivate actually deactivates (not a dead-end nav)", () => {
  it("no longer navigates to the redirect-only /settings/deactivate", () => {
    expect(account).not.toMatch(/navigate\(['"]\/settings\/deactivate['"]\)/);
  });
  it("writes deactivated_at and signs out", () => {
    expect(account).toMatch(/deactivated_at/);
    expect(account).toMatch(/auth\.signOut\(\)/);
  });
});

describe("P2-6 active sessions uses the real SessionsCard", () => {
  it("renders SessionsCard instead of the fake 'Current Device' markup", () => {
    expect(security).toMatch(/<SessionsCard\b/);
    expect(security).not.toMatch(/Current Device/);
  });
});
