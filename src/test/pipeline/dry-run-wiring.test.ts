/**
 * dry-run-wiring — guards the end-to-end dry-run thread.
 *
 * A dry run swaps the two billable Replicate calls (video generation + the
 * stitch cog) for a bundled placeholder, so the whole pipeline can be validated
 * for ~$0. The DANGER is a BROKEN thread: if `dryRun` is dropped at any hop, a
 * "dry run" silently becomes a REAL, billed render. These source-level
 * assertions fail CI the moment any link in the chain is removed — catching a
 * money-spending regression without spending money.
 *
 * Chain: mode-router → hollywood-pipeline → generate-single-clip (mock) →
 *        poll-replicate-prediction (completes mock) → seamless-stitcher (skip cog)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fn = (p: string) =>
  readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

describe("dry-run: shared module", () => {
  const src = fn("_shared/dry-run.ts");
  it("exports the helpers the pipeline relies on", () => {
    expect(src).toMatch(/export function isDryRun/);
    expect(src).toMatch(/export function mockPredictionId/);
    expect(src).toMatch(/export function isMockPredictionId/);
    expect(src).toMatch(/export function dryRunPlaceholderUrl/);
    expect(src).toMatch(/export function assertNotDryRunAtSpend/);
  });
  it("mock prediction ids are recognisable (mock_dryrun_ prefix)", () => {
    expect(src).toMatch(/mock_dryrun_/);
  });
  it("the global env switch is honored", () => {
    expect(src).toMatch(/MOCK_REPLICATE/);
  });
});

describe("dry-run: the thread is intact end-to-end", () => {
  it("mode-router accepts dryRun and forwards it to hollywood", () => {
    const src = fn("mode-router/index.ts");
    expect(src).toMatch(/dryRun\?: boolean/);       // on the request interface
    expect(src).toMatch(/enableMusic,[^}]*dryRun\s*\}\s*=\s*request/s); // destructured
    expect(src).toMatch(/dryRun,\s*\/\/.*forward/i); // forwarded in the hollywood payload
  });
  it("hollywood forwards dryRun to the generate-single-clip dispatch", () => {
    const src = fn("hollywood-pipeline/index.ts");
    expect(src).toMatch(/dryRun\?: boolean/);
    expect(src).toMatch(/dryRun:\s*request\.dryRun === true/);
  });
  it("generate-single-clip mocks the Replicate call and stamps the project", () => {
    const src = fn("generate-single-clip/index.ts");
    expect(src).toMatch(/const isDry = isDryRun\(/);
    expect(src).toMatch(/if \(isDry\)\s*\{[\s\S]{0,120}mockPredictionId\(shotIndex\)/);
    // the real engine dispatch must be an ELSE branch (never runs when dry)
    expect(src).toMatch(/\}\s*else if \(videoEngine === 'wan'\)/);
    // stamps dryRun into pending_video_tasks so the stitcher also skips its cog
    expect(src).toMatch(/isDry \? \{ dryRun: true \}/);
  });
  it("poll-replicate-prediction completes a mock prediction with the placeholder", () => {
    const src = fn("poll-replicate-prediction/index.ts");
    expect(src).toMatch(/isMockPredictionId\(predictionId\)/);
    expect(src).toMatch(/dryRunPlaceholderUrl/);
  });
  it("seamless-stitcher skips the billable ffmpeg cog on a dry run", () => {
    const src = fn("seamless-stitcher/index.ts");
    expect(src).toMatch(/const stitchDry = isDryRun\(/);
    // the short-circuit must return BEFORE the cog fetch to api.replicate.com
    const cutAt = src.indexOf("if (stitchDry)");
    const cogAt = src.indexOf('fetch("https://api.replicate.com/v1/predictions"');
    expect(cutAt).toBeGreaterThan(0);
    expect(cogAt).toBeGreaterThan(cutAt); // guard precedes the cog
  });
});
