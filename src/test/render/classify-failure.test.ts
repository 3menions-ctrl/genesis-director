/**
 * classifyFailure — pure mapping from raw stitcher error messages to
 * the render_failures.classification enum.
 *
 * Every classifier branch has a representative input. The "unknown"
 * fallback is the safety net — if a future error message doesn't
 * match anything we know, it lands there. The admin observability
 * histogram surfaces the bucket; that's the signal to extend the
 * enum (and update this test).
 */

import { describe, it, expect } from "vitest";
import { classifyFailure } from "../../../supabase/functions/_shared/failure-classify.ts";

describe("classifyFailure", () => {
  it("input_invalid — missing required fields", () => {
    expect(classifyFailure("either projectId or clips[] is required")).toBe(
      "input_invalid",
    );
    expect(classifyFailure("sessionId is required in clips mode")).toBe(
      "input_invalid",
    );
    expect(classifyFailure("project_not_found: abc")).toBe("input_invalid");
    expect(classifyFailure("transitionDuration must be in (0, 2]")).toBe(
      "input_invalid",
    );
  });

  it("replicate_submit — POST /predictions failed", () => {
    expect(classifyFailure("replicate_submit_429: rate limit exceeded")).toBe(
      "replicate_submit",
    );
    expect(classifyFailure("replicate_submit_500: server error")).toBe(
      "replicate_submit",
    );
  });

  it("replicate_failed — prediction status failed or canceled", () => {
    expect(classifyFailure("replicate_failed: ffmpeg exited 1")).toBe(
      "replicate_failed",
    );
    expect(classifyFailure("replicate_canceled: timeout from caller")).toBe(
      "replicate_failed",
    );
  });

  it("replicate_timeout — 4-minute poll deadline hit", () => {
    expect(classifyFailure("replicate_timeout_after_4m (last=processing)")).toBe(
      "replicate_timeout",
    );
  });

  it("byte_check_fail — output too small or not MP4", () => {
    expect(classifyFailure("replicate_output_too_small: 0 bytes")).toBe(
      "byte_check_fail",
    );
    expect(
      classifyFailure(`replicate_output_not_mp4: header reads "HTML"`),
    ).toBe("byte_check_fail");
  });

  it("persistence_fail — storage upload failed", () => {
    expect(classifyFailure("upload_failed: bucket not found")).toBe(
      "persistence_fail",
    );
  });

  it("sign_url_fail — createSignedUrl rejected", () => {
    expect(classifyFailure("sign_failed: row missing")).toBe("sign_url_fail");
  });

  it("auth_revalidate — token expired mid-flight", () => {
    expect(classifyFailure("auth token expired between request and run")).toBe(
      "auth_revalidate",
    );
  });

  it("unknown — falls through gracefully so the dashboard surfaces gap", () => {
    expect(classifyFailure("something we have never seen")).toBe("unknown");
    expect(classifyFailure("")).toBe("unknown");
  });

  it("is case-insensitive (matches mixed-case messages)", () => {
    expect(classifyFailure("REPLICATE_TIMEOUT_AFTER_4m")).toBe(
      "replicate_timeout",
    );
    expect(classifyFailure("Replicate_Failed: x")).toBe("replicate_failed");
  });
});
