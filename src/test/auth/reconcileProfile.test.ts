/**
 * AuthContext profile reconciliation — security regression tests.
 *
 * Pins the invariant that fixes the "account_type silently flips to personal on
 * navigation" bug: a NON-AUTHORITATIVE fallback profile (returned by
 * fetchProfile on timeout / network error / RLS-denied refetch during a
 * TOKEN_REFRESHED) must NEVER downgrade an already-established business/
 * enterprise profile. Only a genuine authoritative DB read may change
 * account_type.
 */
import { describe, it, expect } from "vitest";
import {
  reconcileProfile,
  buildFallbackProfile,
  type UserProfile,
} from "@/contexts/authProfile";

function profile(id: string, account_type: UserProfile["account_type"], extra: Partial<UserProfile> = {}): UserProfile {
  return {
    ...buildFallbackProfile(id, `${id}@example.com`),
    account_type,
    account_tier: account_type === "business" ? "scale" : "free",
    onboarding_completed: true,
    credits_balance: account_type === "business" ? 5000 : 0,
    ...extra,
  };
}

describe("reconcileProfile — never downgrade an established account_type", () => {
  it("a fallback does NOT overwrite an established business profile (the bug)", () => {
    const established = profile("u1", "business");
    const fallback = buildFallbackProfile("u1", "u1@example.com"); // account_type 'personal'

    const next = reconcileProfile(established, fallback, /* authoritative */ false);

    // The business profile must survive a transient/fallback refetch verbatim.
    expect(next).toBe(established);
    expect(next?.account_type).toBe("business");
    expect(next?.credits_balance).toBe(5000);
  });

  it("a fallback does NOT downgrade an enterprise profile either", () => {
    const established = profile("u1", "enterprise");
    const fallback = buildFallbackProfile("u1", "u1@example.com");
    expect(reconcileProfile(established, fallback, false)?.account_type).toBe("enterprise");
  });

  it("an authoritative read DOES apply, even when it changes account_type (real server change)", () => {
    const established = profile("u1", "business");
    const downgradedByServer = profile("u1", "personal");

    const next = reconcileProfile(established, downgradedByServer, /* authoritative */ true);

    expect(next).toBe(downgradedByServer);
    expect(next?.account_type).toBe("personal");
  });

  it("an authoritative read applies an UPGRADE (personal → business)", () => {
    const established = profile("u1", "personal");
    const upgraded = profile("u1", "business");
    expect(reconcileProfile(established, upgraded, true)?.account_type).toBe("business");
  });

  it("with no prior profile, a fallback IS accepted (genuine first load / new user)", () => {
    const fallback = buildFallbackProfile("u1", "u1@example.com");
    const next = reconcileProfile(null, fallback, false);
    expect(next).toBe(fallback);
    expect(next?.account_type).toBe("personal");
  });

  it("a non-authoritative null keeps the prior profile rather than blanking it", () => {
    const established = profile("u1", "business");
    expect(reconcileProfile(established, null, false)).toBe(established);
  });

  it("a fallback for a DIFFERENT user does not get pinned to the prior user's profile", () => {
    const prior = profile("u1", "business");
    const otherUserFallback = buildFallbackProfile("u2", "u2@example.com");
    const next = reconcileProfile(prior, otherUserFallback, false);
    // Different identity → we do not preserve u1's profile for u2.
    expect(next).toBe(otherUserFallback);
    expect(next?.id).toBe("u2");
  });

  it("buildFallbackProfile always claims least privilege", () => {
    const f = buildFallbackProfile("u9", "u9@example.com");
    expect(f.account_type).toBe("personal");
    expect(f.account_tier).toBe("free");
    expect(f.credits_balance).toBe(0);
    expect(f.onboarding_completed).toBe(false);
  });
});
