/**
 * Regression: final-film 24h URL death (QA audit P0-1).
 *
 * THE BUG: seamless-stitcher uploads the stitched master to the PRIVATE
 * `published-renders` bucket and returns a 24h *signed* URL. The durability
 * guard (`isTemporaryReplicateUrl`) only matched `replicate.delivery`, so the
 * expiring signed URL was treated as permanent and stored verbatim as
 * `movie_projects.video_url` by both hollywood-pipeline and final-assembly.
 * Every finished film 404'd ~24h after render.
 *
 * THE FIX:
 *   - The guard is broadened (pure module `_shared/url-durability.ts`) to also
 *     flag Supabase *signed* URLs as expiring, while leaving *public* URLs
 *     durable. With the guard fixed, hollywood/final-assembly re-persist the
 *     master to durable public storage and store the permanent URL.
 *   - final-assembly gained the persist step (it previously wrote the signed URL
 *     with no persistence at all).
 *   - hollywood-pipeline gained the missing import of the persist helpers (they
 *     were used but never imported — a latent ReferenceError).
 *
 * The guard test is a real behavioral unit test (pure module, importable). The
 * call-site assertions are static source contracts (the edge functions import
 * Deno `https://` modules and can't run under vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  isExpiringUrl,
  isTemporaryReplicateUrl,
} from "../../../supabase/functions/_shared/url-durability";

const REPO_ROOT = resolve(__dirname, "../../..");

describe("url-durability.isExpiringUrl — expiring vs durable", () => {
  it("flags Supabase SIGNED storage URLs as expiring (the P0-1 fix)", () => {
    const signed =
      "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/sign/published-renders/abc/def.mp4?token=eyJhbGciOi.payload.sig";
    expect(isExpiringUrl(signed)).toBe(true);
  });

  it("flags Replicate delivery URLs as expiring (original behavior preserved)", () => {
    expect(isExpiringUrl("https://replicate.delivery/pbxt/abc/out.mp4")).toBe(true);
  });

  it("treats Supabase PUBLIC URLs as durable (must NOT over-match)", () => {
    const pub =
      "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/video-clips/abc/final.mp4";
    expect(isExpiringUrl(pub)).toBe(false);
  });

  it("treats arbitrary durable https URLs as durable", () => {
    expect(isExpiringUrl("https://cdn.example.com/v/final.mp4")).toBe(false);
  });

  it("handles null/undefined/empty", () => {
    expect(isExpiringUrl(null)).toBe(false);
    expect(isExpiringUrl(undefined)).toBe(false);
    expect(isExpiringUrl("")).toBe(false);
  });

  it("isTemporaryReplicateUrl is the same (back-compat alias)", () => {
    expect(isTemporaryReplicateUrl).toBe(isExpiringUrl);
  });
});

describe("call sites persist the final film to durable storage", () => {
  it("hollywood-pipeline imports persistVideoToStorage + the guard (no latent ReferenceError)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "supabase/functions/hollywood-pipeline/index.ts"),
      "utf-8",
    );
    expect(src).toMatch(
      /import\s*\{[^}]*persistVideoToStorage[^}]*\}\s*from\s*"\.\.\/_shared\/video-persistence\.ts"/,
    );
    expect(src).toMatch(/isTemporaryReplicateUrl/);
  });

  it("final-assembly persists the final URL before storing it as video_url", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "supabase/functions/final-assembly/index.ts"),
      "utf-8",
    );
    // It must compute a durable URL via the persistence helper…
    expect(src).toMatch(/persistVideoToStorage/);
    expect(src).toMatch(/durableFinalVideoUrl/);
    // …and the canonical video_url write must use the durable value, not the
    // raw signed finalVideoUrl.
    expect(src).toMatch(/video_url:\s*durableFinalVideoUrl/);
    expect(src).not.toMatch(/video_url:\s*finalVideoUrl\b/);
  });
});

describe("video-persistence re-exports the broadened guard", () => {
  it("isTemporaryReplicateUrl is sourced from url-durability", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "supabase/functions/_shared/video-persistence.ts"),
      "utf-8",
    );
    expect(src).toMatch(/from\s*"\.\/url-durability\.ts"/);
  });
});
