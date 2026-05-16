/**
 * Continuity behavior tests for Independent vs Continuous scenes.
 *
 * Replays every fixture in _fixtures/continuity-scenarios.ts through the
 * reference resolver and asserts:
 *
 *   1. The render/queue decision matches.
 *   2. The startImageUrl source (and the actual URL) matches.
 *   3. Independent scenes NEVER inherit a predecessor tail frame, even
 *      when one exists (regression guard for silent continuity leaks).
 *
 * Also runs parallel-fire simulations:
 *
 *   • A 5-scene fully-Continuous run from a cold start: only shot 0 may
 *     render; shots 1-4 must all queue.
 *   • A 5-scene fully-Independent run: every scene must render in parallel.
 *   • A mixed run (anthology with one Continuous pair) gates only the
 *     chained successor.
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveContinuity,
  SCENARIOS,
  simulateParallelFire,
  type SceneInput,
} from "./_fixtures/continuity-scenarios.ts";

for (const scenario of SCENARIOS) {
  Deno.test(`continuity fixture: ${scenario.name}`, () => {
    const actual = resolveContinuity(scenario.input);
    assertEquals(
      actual,
      scenario.expected,
      `${scenario.name} — ${scenario.description}`,
    );
  });
}

Deno.test("independent scenes NEVER inherit predecessor tail frame", () => {
  const independentScenarios = SCENARIOS.filter(
    (s) => s.input.chainFromPrevious === false,
  );
  // sanity: we actually have independent fixtures with a completed predecessor
  const withTail = independentScenarios.filter(
    (s) => s.input.predecessor?.status === "completed" && !!s.input.predecessor?.last_frame_url,
  );
  assertNotEquals(withTail.length, 0, "fixture set must include independent+ready-predecessor cases");

  for (const s of withTail) {
    const outcome = resolveContinuity(s.input);
    if (outcome.action !== "render") {
      throw new Error(`${s.name}: independent scene must render, got queue`);
    }
    assertNotEquals(
      outcome.source,
      "predecessor_tail",
      `${s.name}: independent scene must NOT use predecessor_tail as image source`,
    );
    assertNotEquals(
      outcome.startImageUrl,
      s.input.predecessor!.last_frame_url,
      `${s.name}: independent startImageUrl must not equal predecessor tail`,
    );
  }
});

Deno.test("parallel fire: fully Continuous run parks every successor from a cold start", () => {
  // 5 chained scenes hit the server simultaneously; none of the predecessors
  // exist yet in video_clips (status='missing').
  const scenes: SceneInput[] = Array.from({ length: 5 }, (_, i) => ({
    shotIndex: i,
    chainFromPrevious: true,
    briefRefImageUrl: "https://cdn.example.com/brief.jpg",
    clientStartImageUrl: "https://cdn.example.com/brief.jpg",
    predecessor:
      i === 0 ? undefined : { status: "missing", last_frame_url: null },
  }));
  const outcomes = simulateParallelFire(scenes);

  // Shot 0 renders (no predecessor possible)
  assertEquals(outcomes[0].action, "render", "shot 0 must render");
  // Shots 1..4 must all be queued
  for (let i = 1; i < 5; i++) {
    assertEquals(
      outcomes[i].action,
      "queue",
      `shot ${i} must be parked while predecessor not ready`,
    );
  }
});

Deno.test("parallel fire: fully Independent run renders every scene in parallel", () => {
  const scenes: SceneInput[] = Array.from({ length: 5 }, (_, i) => ({
    shotIndex: i,
    chainFromPrevious: false,
    refImageUrl: `https://cdn.example.com/scene-${i}.jpg`,
    clientStartImageUrl: `https://cdn.example.com/scene-${i}.jpg`,
    // Predecessor states don't matter for Independent scenes.
    predecessor:
      i === 0 ? undefined : { status: "generating", last_frame_url: null },
  }));
  const outcomes = simulateParallelFire(scenes);

  for (let i = 0; i < 5; i++) {
    assertEquals(outcomes[i].action, "render", `shot ${i} must render`);
    if (outcomes[i].action === "render") {
      assertEquals(
        (outcomes[i] as { source: string }).source,
        "scene_ref",
        `shot ${i} must anchor on its own scene_ref`,
      );
    }
  }
});

Deno.test("parallel fire: mixed run only gates the chained successor", () => {
  // 4 scenes: [Independent, Independent, Continuous-from-#1, Independent]
  // Cold start — predecessor of shot 2 is missing.
  const scenes: SceneInput[] = [
    {
      shotIndex: 0,
      chainFromPrevious: false,
      refImageUrl: "https://cdn.example.com/scene-0.jpg",
    },
    {
      shotIndex: 1,
      chainFromPrevious: false,
      refImageUrl: "https://cdn.example.com/scene-1.jpg",
      predecessor: { status: "generating", last_frame_url: null },
    },
    {
      shotIndex: 2,
      chainFromPrevious: true,
      briefRefImageUrl: "https://cdn.example.com/brief.jpg",
      predecessor: { status: "generating", last_frame_url: null },
    },
    {
      shotIndex: 3,
      chainFromPrevious: false,
      refImageUrl: "https://cdn.example.com/scene-3.jpg",
      predecessor: { status: "missing", last_frame_url: null },
    },
  ];
  const outcomes = simulateParallelFire(scenes);

  assertEquals(outcomes[0].action, "render");
  assertEquals(outcomes[1].action, "render");
  assertEquals(outcomes[2].action, "queue", "chained shot must wait on predecessor");
  assertEquals(outcomes[3].action, "render");
});