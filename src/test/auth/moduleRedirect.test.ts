/**
 * Business→module redirect path mapping — keeps business/enterprise accounts
 * inside /business/* when they hit a shared consumer creation route, preserving
 * project ids and query strings.
 */
import { describe, it, expect } from "vitest";
import { computeModuleRedirect } from "@/components/auth/RedirectBusinessToModule";

describe("computeModuleRedirect", () => {
  it("maps a bare consumer route to its module equivalent", () => {
    expect(computeModuleRedirect("/studio", "/business/create", "/studio", "")).toBe("/business/create");
    expect(computeModuleRedirect("/library", "/business/projects", "/library", "")).toBe("/business/projects");
    expect(computeModuleRedirect("/avatars", "/business/avatars", "/avatars", "")).toBe("/business/avatars");
    expect(computeModuleRedirect("/training-video", "/business/learning", "/training-video", "")).toBe("/business/learning");
  });

  it("preserves a trailing /:id segment (deep-linked editor project)", () => {
    expect(computeModuleRedirect("/editor", "/business/editor", "/editor/abc-123", "")).toBe(
      "/business/editor/abc-123",
    );
  });

  it("preserves the query string", () => {
    expect(computeModuleRedirect("/editor", "/business/editor", "/editor", "?project=xyz")).toBe(
      "/business/editor?project=xyz",
    );
    expect(computeModuleRedirect("/editor", "/business/editor", "/editor/abc", "?tab=mix")).toBe(
      "/business/editor/abc?tab=mix",
    );
  });

  it("does not duplicate the base when the pathname does not start with it", () => {
    // Defensive: if the guard is ever mounted on an unexpected path.
    expect(computeModuleRedirect("/editor", "/business/editor", "/something-else", "")).toBe(
      "/business/editor",
    );
  });
});
