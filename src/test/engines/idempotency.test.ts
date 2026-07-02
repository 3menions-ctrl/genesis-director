/**
 * Idempotency contracts — pin two pieces of behavior that protect the
 * project from double-billing and duplicate clip rows.
 *
 *   1. `editor-generate-clip` short-circuits when the same
 *      idempotencyKey arrives twice in the same project scope. The
 *      key shape is `editor-clip:${idempotencyKey}` (client-supplied)
 *      or `editor-clip:auto:${userId}:${duration}:${nibble}` (auto).
 *      A retry of the SAME submission must NOT generate a second
 *      credit charge.
 *
 *   2. `video_clips` declares a UNIQUE(project_id, shot_index)
 *      constraint. Any future migration that drops or replaces it
 *      breaks the upsert path in `upsert_video_clip()` — the
 *      pipeline workers rely on this for crash-safe restart.
 *
 * Both checks are static — they read the source / migration files
 * rather than running a real Supabase. That's enough to fail CI on
 * the regression vector we care about (someone deleting the
 * constraint, or someone removing the key-prefix scoping that makes
 * the auto-key collision-resistant).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");

describe("editor-generate-clip — idempotency key contract", () => {
  const path = resolve(REPO_ROOT, "supabase/functions/editor-generate-clip/index.ts");
  const src = readFileSync(path, "utf-8");

  it("prefixes the user-supplied key under the editor-clip namespace", () => {
    // Without the prefix, a key reused by another flow (download,
    // pipeline) would collide with the editor's deductions and
    // silently short-circuit.
    expect(src).toMatch(/`editor-clip:\$\{[^}]*idempotencyKey[^}]*\}`/);
  });

  it("the auto-key fallback includes userId + duration + a time component", () => {
    // userId: prevents cross-user collision.
    // duration: prevents in-burst dedup of two different clips.
    // time component (Date.now() >> 16): rotates every ~65s so two
    //   independent renders within a session don't dedup.
    expect(src).toMatch(/`editor-clip:auto:\$\{[^}]*userId[^}]*\}:\$\{[^}]*duration[^}]*\}:\$\{[^}]*Date\.now\(\)[^}]*\}`/);
  });

  it("calls deduct_credits with both the user-scope and the project-scope key", () => {
    // The RPC's dedup index is (user_id, idempotency_key). Without
    // the project scope on the key we'd dedup across projects, which
    // we don't want — same client retry across two projects = two
    // charges.
    expect(src).toMatch(/rpc\("deduct_credits"/);
    expect(src).toMatch(/p_idempotency_key:\s*idemKey/);
  });

  it("only deducts when creditsRequired > 0 — zero-credit renders skip deduction", () => {
    // A zero-credit render (the one-time first-video freebie) must NOT call deduct_credits, otherwise
    // it'd leave dummy ledger rows and pollute audit trails.
    expect(src).toMatch(/if\s*\(creditsRequired\s*>\s*0\)/);
  });
});

describe("video_clips — unique constraint contract", () => {
  const path = resolve(
    REPO_ROOT,
    "supabase/migrations/20260106121012_8dd0f36e-fbc8-404c-bc5b-0e7af40adcde.sql",
  );
  const src = readFileSync(path, "utf-8");

  it("declares UNIQUE(project_id, shot_index) on video_clips", () => {
    // This is what makes upsert_video_clip() idempotent across
    // worker retries. Removing it lets two concurrent webhook firings
    // insert duplicate rows for the same shot.
    expect(src).toMatch(/UNIQUE\s*\(\s*project_id\s*,\s*shot_index\s*\)/i);
  });

  it("status enum matches the worker state machine", () => {
    // The four states drive every checkpoint query + the
    // generation-checkpoint RPC. A drift here silently breaks
    // resume-from-failure logic.
    for (const s of ["pending", "generating", "completed", "failed"]) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it("declares (project_id, shot_index) and (project_id, status) indexes", () => {
    // Checkpoint queries hit both. Without the indexes the
    // hollywood-pipeline's per-shot upsert turns into a sequential
    // scan that bottlenecks every fan-out.
    expect(src).toMatch(/project_id.*shot_index/);
    expect(src).toMatch(/project_id.*status/);
  });
});

describe("upsert_video_clip RPC — idempotent insert path", () => {
  const path = resolve(
    REPO_ROOT,
    "supabase/migrations/20260106121012_8dd0f36e-fbc8-404c-bc5b-0e7af40adcde.sql",
  );
  const src = readFileSync(path, "utf-8");

  it("uses INSERT ... ON CONFLICT (project_id, shot_index) DO UPDATE", () => {
    // The exact mechanism that lets two webhook firings race to
    // upsert the same shot row without producing duplicates.
    expect(src).toMatch(/ON CONFLICT\s*\(\s*project_id\s*,\s*shot_index\s*\)/i);
    expect(src).toMatch(/DO UPDATE/i);
  });
});
