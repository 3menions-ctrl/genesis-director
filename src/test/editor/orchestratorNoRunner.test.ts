/**
 * Regression: generation orchestrator must not WEDGE when no engine runner is
 * installed.
 *
 * Before the fix, drainQueue claimed the project's serial slot BEFORE checking
 * for a runner, then returned — leaving the job stuck in "running" forever and
 * blocking every later shot for that project. Now, with no runner installed, the
 * job fails honestly (releasing the slot and draining the next), so the queue
 * never wedges and the UI shows an error instead of an eternal spinner.
 *
 * No runner is installed in the test environment (installJobRunner has no
 * callers in the app either), so enqueueShot here exercises exactly that path.
 */
import { describe, it, expect } from "vitest";
import { enqueueShot, getJob, getOrchestratorState } from "@/lib/editor/generation/orchestrator";
import type { EngineInput } from "@/lib/editor/generation/types";

const inputs = {} as EngineInput; // no-runner path never inspects inputs

function enqueue(projectId: string, shotId: string) {
  return enqueueShot({
    projectId,
    shotId,
    inputs,
    engine: "seedance-1-pro",
    tier: "draft",
  });
}

describe("orchestrator — no runner installed", () => {
  it("fails the job instead of leaving it stuck running", async () => {
    const jobId = enqueue("proj-nowedge-1", "shot-1");
    await Promise.resolve();
    expect(getJob(jobId)?.stage).toBe("failed");
    // The serial slot was released, not held.
    expect(getOrchestratorState().running.has("proj-nowedge-1")).toBe(false);
  });

  it("does not wedge later shots behind a stuck job", async () => {
    const a = enqueue("proj-nowedge-2", "shot-a");
    await Promise.resolve();
    const b = enqueue("proj-nowedge-2", "shot-b");
    await Promise.resolve();
    // Both processed (both failed honestly) — the second was NOT blocked by the
    // first holding the running slot forever.
    expect(getJob(a)?.stage).toBe("failed");
    expect(getJob(b)?.stage).toBe("failed");
    expect(getOrchestratorState().running.has("proj-nowedge-2")).toBe(false);
  });
});
