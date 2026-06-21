/**
 * deriveSurfaceFromPath — pathname → Sentry surface tag.
 *
 * The tag drives the issues-list filter in Sentry. A regression in
 * the editor surface should NOT get lost in a hundred unrelated
 * tickets — the test pins the mapping so a future route rename
 * can't silently re-bucket every error.
 */

import { describe, it, expect } from "vitest";
import { deriveSurfaceFromPath } from "@/components/ui/error-boundary";

describe("deriveSurfaceFromPath", () => {
  it("strips leading slash + collapses sub-routes to the top segment", () => {
    expect(deriveSurfaceFromPath("/editor/abc-123/timeline")).toBe("editor");
    expect(deriveSurfaceFromPath("/profile/foo/settings")).toBe("profile");
    expect(deriveSurfaceFromPath("/admin/observability")).toBe("admin");
  });

  it("maps every auth subroute to a single `auth` surface", () => {
    expect(deriveSurfaceFromPath("/auth")).toBe("auth");
    expect(deriveSurfaceFromPath("/login")).toBe("auth");
    expect(deriveSurfaceFromPath("/signup")).toBe("auth");
    expect(deriveSurfaceFromPath("/reset-password")).toBe("auth");
    expect(deriveSurfaceFromPath("/forgot-password")).toBe("auth");
  });

  it("root path → `root`", () => {
    expect(deriveSurfaceFromPath("/")).toBe("root");
    expect(deriveSurfaceFromPath("")).toBe("root");
  });

  it("unknown segment passes through as the segment itself", () => {
    expect(deriveSurfaceFromPath("/hello-world")).toBe("hello-world");
  });

  it("handles paths without a leading slash", () => {
    expect(deriveSurfaceFromPath("editor/x")).toBe("editor");
  });
});
