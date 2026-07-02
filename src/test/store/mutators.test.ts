/**
 * Editor store — first batch of mutator unit tests.
 *
 * Covers the 8 store actions identified in TEST_PLAN.md Week 1:
 *   trimClip / splitAtPlayhead / moveClip / deleteClip /
 *   rollEdit / slipClip / slideClip / applyEffectToClips.
 *
 * Each test resets the store via setProject(null) so the singleton
 * state doesn't bleed between cases. Assertions cover both the
 * mutator's primary effect AND the lock-honoring path that the editor
 * relies on but every-day clicks rarely hit.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setProject,
  getEditorState,
  trimClip,
  splitAtPlayhead,
  moveClip,
  setClipOrder,
  deleteClip,
  rollEdit,
  slipClip,
  slideClip,
  applyEffectToClips,
  setPlayhead,
  selectClip,
  __resetForTests,
} from "@/lib/editor/store";
import { makeProject, flatClips, type ClipSpec } from "./fixtures";
import { buildDefaultTracks, type EditorTrack } from "@/lib/editor/types";

beforeEach(__resetForTests);

const specs2 = (): ClipSpec[] => [
  { id: "c1", durationSec: 4 },
  { id: "c2", durationSec: 6 },
];

const specs3 = (): ClipSpec[] => [
  { id: "c1", durationSec: 3 },
  { id: "c2", durationSec: 4 },
  { id: "c3", durationSec: 5 },
];

describe("trimClip", () => {
  it("sets the clip's duration to the requested seconds", () => {
    setProject(makeProject(specs2()));
    trimClip("c1", 2.5);
    const next = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(next.durationSec).toBe(2.5);
  });

  it("clamps to a 0.5s floor", () => {
    setProject(makeProject(specs2()));
    trimClip("c1", 0.1);
    const next = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(next.durationSec).toBe(0.5);
  });

  it("rolls later clips' timelineStartSec via recompute", () => {
    setProject(makeProject(specs2()));
    trimClip("c1", 2);
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.timelineStartSec).toBe(2);
  });

  it("does nothing when the clip lives on a locked track", () => {
    const tracks: EditorTrack[] = buildDefaultTracks().map((t) =>
      t.id === "sys:V1" ? { ...t, locked: true } : t,
    );
    setProject(makeProject(specs2(), tracks));
    trimClip("c1", 1);
    const next = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(next.durationSec).toBe(4);
  });
});

describe("splitAtPlayhead", () => {
  it("returns false when the playhead is outside any clip", () => {
    setProject(makeProject(specs2()));
    setPlayhead(100);
    expect(splitAtPlayhead()).toBe(false);
  });

  it("returns false within 0.1s of an edge", () => {
    setProject(makeProject(specs2()));
    setPlayhead(0.05);
    expect(splitAtPlayhead()).toBe(false);
  });

  it("splits a clip into two halves at the playhead", () => {
    setProject(makeProject(specs2()));
    setPlayhead(2.5);
    const ok = splitAtPlayhead();
    expect(ok).toBe(true);
    const clips = flatClips(getEditorState().project);
    // 2 clips → 3 after a split inside clip 1.
    expect(clips.length).toBe(3);
    const left = clips[0];
    const right = clips[1];
    expect(left.id).toBe("c1");
    expect(left.durationSec).toBe(2.5);
    expect(right.durationSec).toBe(1.5);
  });

  it("renumbers indices contiguously after a split", () => {
    setProject(makeProject(specs2()));
    setPlayhead(2);
    splitAtPlayhead();
    const clips = flatClips(getEditorState().project).filter((c) => c.kind !== "title");
    expect(clips.map((c) => c.index)).toEqual([0, 1, 2]);
  });
});

describe("moveClip", () => {
  it("reorders the clip from one index to another", () => {
    setProject(makeProject(specs3()));
    moveClip("c3", 0);
    expect(flatClips(getEditorState().project).map((c) => c.id)).toEqual([
      "c3",
      "c1",
      "c2",
    ]);
  });

  it("recomputes timeline positions after reorder", () => {
    setProject(makeProject(specs3()));
    moveClip("c3", 0);
    const clips = flatClips(getEditorState().project);
    expect(clips[0].timelineStartSec).toBe(0);
    expect(clips[1].timelineStartSec).toBe(5);
    expect(clips[2].timelineStartSec).toBe(8);
  });

  it("does nothing when target track is locked", () => {
    const tracks: EditorTrack[] = buildDefaultTracks().map((t) =>
      t.id === "sys:V1" ? { ...t, locked: true } : t,
    );
    setProject(makeProject(specs3(), tracks));
    moveClip("c3", 0);
    expect(flatClips(getEditorState().project).map((c) => c.id)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });
});

describe("setClipOrder (drag reorder)", () => {
  it("reorders V1 clips to the given order in one commit", () => {
    setProject(makeProject(specs3()));
    setClipOrder(["c3", "c1", "c2"]);
    expect(flatClips(getEditorState().project).map((c) => c.id)).toEqual([
      "c3", "c1", "c2",
    ]);
  });

  it("handles a multi-position move (not just adjacent swaps)", () => {
    setProject(makeProject(specs3()));
    setClipOrder(["c2", "c3", "c1"]); // c1 jumps from front to back
    const ids = flatClips(getEditorState().project).map((c) => c.id);
    expect(ids).toEqual(["c2", "c3", "c1"]);
    // and re-sequences time by the new order
    const clips = flatClips(getEditorState().project);
    expect(clips[0].timelineStartSec).toBe(0);
  });

  it("reorders V1 correctly even with an interleaved TITLE clip (index-space bug)", () => {
    // A title interleaved among the video clips used to shift the target
    // index by the title count, landing the clip in the wrong slot.
    setProject(makeProject([
      { id: "v1", durationSec: 5 },
      { id: "t1", durationSec: 3, kind: "title" },
      { id: "v2", durationSec: 4 },
      { id: "v3", durationSec: 3 },
    ]));
    setClipOrder(["v3", "v1", "v2"]);
    const videoIds = flatClips(getEditorState().project)
      .filter((c) => c.kind !== "title")
      .map((c) => c.id);
    expect(videoIds).toEqual(["v3", "v1", "v2"]);
    // The title clip is preserved.
    expect(flatClips(getEditorState().project).some((c) => c.id === "t1")).toBe(true);
  });

  it("rejects an incomplete/mismatched id list (never drops a clip)", () => {
    setProject(makeProject(specs3()));
    setClipOrder(["c3", "c1"]); // missing c2 → reject wholesale
    expect(flatClips(getEditorState().project).map((c) => c.id)).toEqual([
      "c1", "c2", "c3",
    ]);
  });
});

describe("deleteClip", () => {
  it("removes the clip from its scene", () => {
    setProject(makeProject(specs3()));
    deleteClip("c2");
    expect(flatClips(getEditorState().project).map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("recomputes positions so c3 slides into c2's old slot", () => {
    setProject(makeProject(specs3()));
    deleteClip("c2");
    const c3 = flatClips(getEditorState().project).find((c) => c.id === "c3")!;
    expect(c3.timelineStartSec).toBe(3);
  });

  it("clears selectedClipId when the deleted clip was selected", () => {
    setProject(makeProject(specs3()));
    selectClip("c2");
    deleteClip("c2");
    expect(getEditorState().selectedClipId).toBeNull();
  });

  it("strips transitions referencing the deleted clip", () => {
    const project = makeProject(specs3());
    project.transitions = [
      { id: "t1", fromClipId: "c1", toClipId: "c2", durationSec: 0.4, kind: "fade" },
      { id: "t2", fromClipId: "c2", toClipId: "c3", durationSec: 0.4, kind: "fade" },
    ];
    setProject(project);
    deleteClip("c2");
    const transitions = getEditorState().project!.transitions;
    expect(transitions.length).toBe(0);
  });
});

describe("rollEdit", () => {
  it("shifts the shared boundary, keeping total length constant", () => {
    setProject(makeProject(specs2())); // total = 10
    expect(rollEdit("c1", 1)).toBe(true);
    const clips = flatClips(getEditorState().project);
    expect(clips[0].durationSec).toBe(5);
    expect(clips[1].durationSec).toBe(5);
    expect(getEditorState().project!.durationSec).toBe(10);
  });

  it("returns false when either side would go below the 0.5s floor", () => {
    setProject(makeProject(specs2()));
    expect(rollEdit("c1", 100)).toBe(false);
    expect(rollEdit("c1", -100)).toBe(false);
  });

  it("returns false when this is the last clip", () => {
    setProject(makeProject(specs2()));
    expect(rollEdit("c2", 1)).toBe(false);
  });
});

describe("slipClip", () => {
  it("writes a non-negative sourceInSec into the clip's properties", () => {
    setProject(makeProject(specs2()));
    expect(slipClip("c1", 1.5)).toBe(true);
    const c1 = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(
      (c1.properties as { sourceInSec?: number } | undefined)?.sourceInSec,
    ).toBe(1.5);
  });

  it("clamps sourceInSec at zero — no negative offsets", () => {
    setProject(makeProject(specs2()));
    slipClip("c1", -2);
    const c1 = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(
      (c1.properties as { sourceInSec?: number } | undefined)?.sourceInSec,
    ).toBe(0);
  });
});

describe("slideClip", () => {
  it("returns false when the clip lives on a locked track", () => {
    const tracks: EditorTrack[] = buildDefaultTracks().map((t) =>
      t.id === "sys:V1" ? { ...t, locked: true } : t,
    );
    setProject(makeProject(specs3(), tracks));
    expect(slideClip("c2", 1)).toBe(false);
  });

  it("does not change the clip's own duration", () => {
    setProject(makeProject(specs3()));
    slideClip("c2", 1);
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.durationSec).toBe(4);
  });
});

describe("applyEffectToClips", () => {
  it("writes the filter to every targeted clip's properties", () => {
    setProject(makeProject(specs3()));
    expect(applyEffectToClips("contrast(1.2)", ["c1", "c3"])).toBe(true);
    const clips = flatClips(getEditorState().project);
    expect(clips.find((c) => c.id === "c1")!.properties?.filter).toBe("contrast(1.2)");
    expect(clips.find((c) => c.id === "c3")!.properties?.filter).toBe("contrast(1.2)");
    expect(clips.find((c) => c.id === "c2")!.properties?.filter).toBeUndefined();
  });

  it("applies to ALL video clips when no ids are passed", () => {
    setProject(makeProject(specs3()));
    expect(applyEffectToClips("brightness(1.1)")).toBe(true);
    const clips = flatClips(getEditorState().project);
    for (const c of clips) {
      expect(c.properties?.filter).toBe("brightness(1.1)");
    }
  });

  it("clears colorGrade when the filter is blank — preview/render parity", () => {
    setProject(makeProject(specs2()));
    applyEffectToClips("contrast(1.2)", ["c1"]); // first sets something
    applyEffectToClips("", ["c1"]);              // then clears it
    const c1 = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(c1.properties?.colorGrade).toBeNull();
  });

  it("returns false when the target set has no matches", () => {
    setProject(makeProject(specs2()));
    expect(applyEffectToClips("blur(1px)", ["does-not-exist"])).toBe(false);
  });
});
