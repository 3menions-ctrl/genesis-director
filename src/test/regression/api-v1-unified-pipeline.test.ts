/**
 * Pipeline unification — api-v1 /videos routes through the UNIFIED pipeline.
 *
 * api-v1 was the last live caller of the deprecated seedance-pipeline (on the
 * old path, missing the reliability fixes). It now routes /videos to
 * hollywood-pipeline (autoApprove, service-role skipCreditDeduction), so every
 * surface funnels through one orchestrator.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(
  resolve(__dirname, "../../..", "supabase/functions/api-v1/index.ts"),
  "utf-8",
);

describe("api-v1 /videos uses the unified hollywood-pipeline", () => {
  it("invokes hollywood-pipeline, not the deprecated seedance-pipeline", () => {
    expect(src).toMatch(/invoke\(\s*'hollywood-pipeline'/);
    expect(src).not.toMatch(/invoke\(\s*'seedance-pipeline'/);
  });
  it("passes autoApprove so the API call doesn't park at the approval gate", () => {
    const start = src.indexOf("invoke('hollywood-pipeline'");
    const region = src.slice(start, start + 400);
    expect(region).toMatch(/autoApprove:\s*true/);
    expect(region).toMatch(/skipCreditDeduction:\s*true/);
  });
});
