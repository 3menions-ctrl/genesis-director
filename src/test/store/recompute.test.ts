/**
 * Timeline ripple — recompute(project).
 *
 * Walks scenes, lays out video clips contiguously starting at 0,
 * preserves the independent positions of title clips, and recomputes
 * scene.durationSec + project.durationSec.
 *
 * Lives in store.ts as an exported helper so the harness can call it
 * directly without driving mutations through the singleton.
 */

import { describe, it, expect } from "vitest";
import { recompute } from "@/lib/editor/store";
import { makeProject, flatClips } from "./fixtures";
import type { EditorProject } from "@/lib/editor/types";

describe("recompute", () => {
  it("lays out video clips contiguously starting at 0", () => {
    const p = makeProject([
      { id: "c1", durationSec: 3 },
      { id: "c2", durationSec: 4 },
      { id: "c3", durationSec: 5 },
    ]);
    // Force timeline positions to garbage so recompute has to fix them.
    const dirty: EditorProject = {
      ...p,
      scenes: p.scenes.map((s) => ({
        ...s,
        clips: s.clips.map((c) => ({ ...c, timelineStartSec: 99 })),
      })),
    };
    const result = recompute(dirty);
    const clips = flatClips(result);
    expect(clips[0].timelineStartSec).toBe(0);
    expect(clips[1].timelineStartSec).toBe(3);
    expect(clips[2].timelineStartSec).toBe(7);
  });

  it("sums scene.durationSec from video clips only", () => {
    const p = makeProject([
      { id: "c1", durationSec: 3 },
      { id: "c2", durationSec: 4 },
      { id: "t1", durationSec: 2, kind: "title" },
    ]);
    const result = recompute(p);
    expect(result.scenes[0].durationSec).toBe(7);
  });

  it("preserves title clips' independent timelineStartSec", () => {
    const p = makeProject([
      { id: "c1", durationSec: 3 },
      { id: "t1", durationSec: 2, kind: "title" },
      { id: "c2", durationSec: 4 },
    ]);
    // Manually set the title to start at 5s — it should NOT shift
    // when recompute lays out the video clips.
    const dirty: EditorProject = {
      ...p,
      scenes: p.scenes.map((s) => ({
        ...s,
        clips: s.clips.map((c) =>
          c.id === "t1" ? { ...c, timelineStartSec: 5 } : c,
        ),
      })),
    };
    const result = recompute(dirty);
    const title = flatClips(result).find((c) => c.id === "t1")!;
    expect(title.timelineStartSec).toBe(5);
  });

  it("video clips skip over titles when computing positions", () => {
    const p = makeProject([
      { id: "c1", durationSec: 3 },
      { id: "t1", durationSec: 2, kind: "title" },
      { id: "c2", durationSec: 4 },
    ]);
    const result = recompute(p);
    const clips = flatClips(result);
    const c2 = clips.find((c) => c.id === "c2")!;
    // c2 should land at cursor after c1 (3s), NOT after the title.
    expect(c2.timelineStartSec).toBe(3);
  });

  it("project.durationSec is max(video cursor, last title end)", () => {
    const p = makeProject([
      { id: "c1", durationSec: 3 },
      { id: "c2", durationSec: 2 }, // video cursor ends at 5
    ]);
    // Place a long title from 0..10 — the title outlasts the video.
    const dirty: EditorProject = {
      ...p,
      scenes: p.scenes.map((s) => ({
        ...s,
        clips: [
          ...s.clips,
          {
            id: "t1",
            kind: "title",
            index: 99,
            timelineStartSec: 0,
            durationSec: 10,
            videoUrl: null,
            thumbnailUrl: null,
            prompt: "",
            takes: [],
          },
        ],
      })),
    };
    const result = recompute(dirty);
    expect(result.durationSec).toBe(10);
  });

  it("returns a new project reference (immutable)", () => {
    const p = makeProject([{ id: "c1", durationSec: 3 }]);
    const result = recompute(p);
    expect(result).not.toBe(p);
    expect(result.scenes[0]).not.toBe(p.scenes[0]);
  });

  it("handles an empty project gracefully", () => {
    const p = makeProject([]);
    const result = recompute(p);
    expect(result.scenes[0].clips).toEqual([]);
    expect(result.durationSec).toBe(0);
  });
});
