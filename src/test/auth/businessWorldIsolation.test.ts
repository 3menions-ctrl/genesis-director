/**
 * Hard world isolation — which paths count as consumer-account surfaces that a
 * business/enterprise account must be redirected away from.
 */
import { describe, it, expect } from "vitest";
import { isConsumerAccountPath } from "@/components/auth/BusinessWorldIsolation";

describe("isConsumerAccountPath", () => {
  it("flags the consumer-account page surfaces", () => {
    for (const p of [
      "/lobby",
      "/me",
      "/me/year",
      "/account",
      "/account/notifications",
      "/settings",
      "/inbox",
    ]) {
      expect(isConsumerAccountPath(p)).toBe(true);
    }
  });

  it("does NOT flag neutral / shared-infra routes a business user legitimately needs", () => {
    for (const p of [
      // /profile is a signed-in user's personal identity page, reachable by any
      // account type (App.tsx) — and /c/:id renders the same page unguarded, so
      // it is intentionally NOT a consumer-account-isolated surface.
      "/profile",
      "/business",
      "/business/editor",
      "/business/projects",
      "/production",
      "/production/abc-123",
      "/invite/tok_123",
      "/auth",
      "/auth/callback",
      "/onboarding",
      "/start",
      "/welcome/checkout",
      "/enterprise/coming-soon",
      "/help",
      "/search",
      "/r/xyz",
      "/terms",
      "/",
    ]) {
      expect(isConsumerAccountPath(p)).toBe(false);
    }
  });

  it("respects path boundaries (no false prefix matches)", () => {
    // "/me" must not swallow "/media" or "/messages".
    expect(isConsumerAccountPath("/media")).toBe(false);
    expect(isConsumerAccountPath("/messages")).toBe(false);
    // "/account" boundary
    expect(isConsumerAccountPath("/accounts-payable")).toBe(false);
  });

  it("does not flag the shared CREATION routes (handled by RedirectBusinessToModule)", () => {
    for (const p of ["/studio", "/editor", "/editor/abc", "/avatars", "/environments", "/templates", "/library"]) {
      expect(isConsumerAccountPath(p)).toBe(false);
    }
  });
});
