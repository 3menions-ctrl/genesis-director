/**
 * Regression guard — AuthContext must NOT call `supabase.rpc` detached.
 *
 * fetchProfile reads the owner's row through the get_my_profile() RPC. If the
 * method is pulled off the client into a bare variable
 * (`const f = supabase.rpc; f(...)`), it loses its `this` and throws at runtime
 * ("Cannot read properties of undefined (reading 'rest')"). That throw is
 * swallowed by fetchProfile's catch → a fallback profile with
 * onboarding_completed=false → ProtectedRoute bounces the user to /onboarding,
 * which routes back out, forever (an /onboarding ↔ /studio redirect loop that
 * presents as a stuck/flickering loader).
 *
 * The call must therefore stay bound — either inline `(supabase.rpc as X)(...)`
 * or via `.bind(supabase)`. This grep pins that so the footgun can't return.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = readFileSync(
  resolve(__dirname, "../../contexts/AuthContext.tsx"),
  "utf-8",
);

describe("AuthContext — get_my_profile rpc binding", () => {
  it("does not assign supabase.rpc to a variable (detaches `this`)", () => {
    // A bare `= supabase.rpc as ...` / `= supabase.rpc;` strips the receiver.
    // `.bind(...)` immediately after is the one allowed form.
    const detached = /=\s*supabase\.rpc\s+as(?![^\n]*\.bind)/.test(SRC) ||
      /=\s*supabase\.rpc\s*;/.test(SRC);
    expect(detached).toBe(false);
  });

  it("binds the rpc call to the supabase client", () => {
    expect(SRC).toMatch(/supabase\.rpc\.bind\(supabase\)/);
  });
});
