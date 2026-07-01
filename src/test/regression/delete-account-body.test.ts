/**
 * Regression: account deletion failed for EVERYONE (QA audit P1-18).
 *
 * THE BUG: both delete surfaces invoked `delete-user-account` with NO body, but
 * the edge fn requires `password` (password accounts) or `confirm:'DELETE MY
 * ACCOUNT'` (passwordless) → always HTTP 400. The typed "DELETE" never left the
 * client (and wouldn't match the server phrase anyway).
 *
 * THE FIX: both surfaces detect whether the account has a password identity and
 * send the correct body — { password } for password accounts (with a password
 * field), or { confirm: 'DELETE MY ACCOUNT' } for passwordless.
 *
 * Source contract — both are heavy client components; assert the call contract.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const security = readFileSync(
  resolve(REPO_ROOT, "src/components/settings/SecuritySettings.tsx"),
  "utf-8",
);
const dashboard = readFileSync(
  resolve(REPO_ROOT, "src/pages/account/SettingsDashboard.tsx"),
  "utf-8",
);

for (const [name, src] of [
  ["SecuritySettings", security],
  ["SettingsDashboard", dashboard],
] as const) {
  describe(`${name} — delete-user-account sends a valid body`, () => {
    it("does NOT invoke delete-user-account with no arguments", () => {
      // The exact pre-fix bug: invoke('delete-user-account') with nothing after.
      expect(src).not.toMatch(/invoke\(\s*["']delete-user-account["']\s*\)/);
    });

    it("detects a password identity (provider === 'email')", () => {
      expect(src).toMatch(/provider\s*===\s*["']email["']/);
    });

    it("sends { password } for password accounts and the confirm phrase otherwise", () => {
      expect(src).toMatch(/confirm:\s*["']DELETE MY ACCOUNT["']/);
      // The invoke must carry a body object.
      expect(src).toMatch(/invoke\(\s*["']delete-user-account["']\s*,\s*\{[\s\S]*body/);
    });
  });
}
