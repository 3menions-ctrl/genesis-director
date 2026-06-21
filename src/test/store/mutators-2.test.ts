/**
 * Editor store — second batch of mutator unit tests.
 *
 * Covers the Week 2 remaining set from TEST_PLAN.md:
 *   setClipProperty, addKeyframeAtPlayhead, insertTitleAtPlayhead,
 *   applyProjectTemplate, replaceClip, overwriteAtPlayhead,
 *   setTrackProps, cutSelected, duplicateSelected, selectAllClips.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setProject,
  getEditorState,
  setClipProperty,
  addKeyframeAtPlayhead,
  insertTitleAtPlayhead,
  applyProjectTemplate,
  replaceClip,
  overwriteAtPlayhead,
  setTrackProps,
  cutSelected,
  duplicateSelected,
  selectAllClips,
  selectClip,
  extendClipSelection,
  setPlayhead,
  __resetForTests,
} from "@/lib/editor/store";
import { makeProject, flatClips, type ClipSpec } from "./fixtures";
import { buildDefaultTracks, type EditorTrack } from "@/lib/editor/types";

beforeEach(__resetForTests);

const specs3 = (): ClipSpec[] => [
  { id: "c1", durationSec: 3 },
  { id: "c2", durationSec: 4 },
  { id: "c3", durationSec: 5 },
];

describe("setClipProperty", () => {
  it("writes a property into the clip's properties bag", () => {
    setProject(makeProject(specs3()));
    setClipProperty("c2", { volume: 0.4 });
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.properties?.volume).toBe(0.4);
  });

  it("preserves existing properties on the clip when patching one key", () => {
    setProject(makeProject(specs3()));
    setClipProperty("c1", { volume: 0.5 });
    setClipProperty("c1", { opacity: 0.7 });
    const c1 = flatClips(getEditorState().project).find((c) => c.id === "c1")!;
    expect(c1.properties?.volume).toBe(0.5);
    expect(c1.properties?.opacity).toBe(0.7);
  });

  it("burst-coalesces successive edits to the same clip into one history entry", () => {
    setProject(makeProject(specs3()));
    const initial = getEditorState().history.past.length;
    setClipProperty("c1", { volume: 0.5 });
    const after1 = getEditorState().history.past.length;
    setClipProperty("c1", { volume: 0.4 });
    setClipProperty("c1", { volume: 0.3 });
    const after3 = getEditorState().history.past.length;
    // First edit pushes one entry; subsequent same-key edits to same
    // clip stay coalesced — no growth.
    expect(after1 - initial).toBe(1);
    expect(after3).toBe(after1);
  });
});

describe("addKeyframeAtPlayhead", () => {
  it("returns false when the playhead is outside the clip", () => {
    setProject(makeProject(specs3())); // timeline: 0..3..7..12
    setPlayhead(100);
    expect(addKeyframeAtPlayhead("c1", "opacity", 0.5)).toBe(false);
  });

  it("captures a keyframe at the playhead's relative time", () => {
    setProject(makeProject(specs3()));
    setPlayhead(5); // 2s into c2 (which starts at 3)
    addKeyframeAtPlayhead("c2", "opacity", 0.6);
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.keyframes?.length).toBe(1);
    expect(c2.keyframes![0].property).toBe("opacity");
    expect(c2.keyframes![0].value).toBe(0.6);
    expect(c2.keyframes![0].time).toBe(2);
  });

  it("merges within the 0.05s near-tolerance instead of stacking", () => {
    setProject(makeProject(specs3()));
    setPlayhead(5);
    addKeyframeAtPlayhead("c2", "opacity", 0.6);
    setPlayhead(5.02); // ~20ms later — should update, not add
    addKeyframeAtPlayhead("c2", "opacity", 0.9);
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.keyframes?.length).toBe(1);
    expect(c2.keyframes![0].value).toBe(0.9);
  });

  it("does not merge across the 0.05s tolerance threshold", () => {
    setProject(makeProject(specs3()));
    setPlayhead(5);
    addKeyframeAtPlayhead("c2", "opacity", 0.6);
    setPlayhead(5.5); // 0.5s later — distinct kf
    addKeyframeAtPlayhead("c2", "opacity", 0.9);
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.keyframes?.length).toBe(2);
  });
});

describe("insertTitleAtPlayhead", () => {
  it("inserts a title-kind clip at the playhead with a 3s default duration", () => {
    setProject(makeProject(specs3()));
    setPlayhead(2);
    const id = insertTitleAtPlayhead("HELLO");
    expect(id).not.toBeNull();
    const title = flatClips(getEditorState().project).find((c) => c.id === id);
    expect(title?.kind).toBe("title");
    expect(title?.titleText).toBe("HELLO");
    expect(title?.durationSec).toBe(3);
    expect(title?.timelineStartSec).toBe(2);
  });

  it("returns null when no project is loaded", () => {
    expect(insertTitleAtPlayhead("X")).toBeNull();
  });

  it("does not shift the V1 chain (title timeline is independent)", () => {
    setProject(makeProject(specs3()));
    setPlayhead(1);
    insertTitleAtPlayhead("TITLE");
    const videos = flatClips(getEditorState().project).filter((c) => c.kind !== "title");
    expect(videos.map((c) => c.timelineStartSec)).toEqual([0, 3, 7]);
  });
});

describe("applyProjectTemplate", () => {
  it("writes the filter + fades to every V1 clip and returns counts", () => {
    setProject(makeProject(specs3()));
    const counts = applyProjectTemplate({
      filter: "contrast(1.2)",
      fadeInSec: 0.5,
      fadeOutSec: 0.5,
      transitionKind: "fade",
      transitionDurationSec: 0.4,
      playbackSpeed: 1,
    });
    expect(counts.clipsTouched).toBe(3);
    expect(counts.boundariesTouched).toBe(2);
    for (const c of flatClips(getEditorState().project)) {
      expect(c.properties?.filter).toBe("contrast(1.2)");
      expect(c.properties?.fadeInSec).toBe(0.5);
      expect(c.properties?.fadeOutSec).toBe(0.5);
    }
  });

  it("creates one transition per V1 boundary", () => {
    setProject(makeProject(specs3()));
    applyProjectTemplate({
      fadeInSec: 0,
      fadeOutSec: 0,
      transitionKind: "dissolve",
      transitionDurationSec: 0.5,
      playbackSpeed: 1,
    });
    const transitions = getEditorState().project!.transitions;
    expect(transitions.length).toBe(2);
    for (const t of transitions) {
      expect(t.kind).toBe("dissolve");
    }
  });

  it("clamps transition duration to half the shortest adjacent clip", () => {
    setProject(
      makeProject([
        { id: "tiny", durationSec: 1 }, // half = 0.5
        { id: "long", durationSec: 10 },
      ]),
    );
    applyProjectTemplate({
      fadeInSec: 0,
      fadeOutSec: 0,
      transitionKind: "fade",
      transitionDurationSec: 5, // requested 5s, but clip is only 1s
      playbackSpeed: 1,
    });
    const t = getEditorState().project!.transitions[0];
    expect(t.durationSec).toBeLessThanOrEqual(0.5);
  });
});

describe("replaceClip", () => {
  it("swaps the videoUrl + thumbnailUrl on the clip", () => {
    setProject(makeProject(specs3()));
    const ok = replaceClip("c2", {
      videoUrl: "file://new.mp4",
      thumbnailUrl: "file://new.jpg",
    });
    expect(ok).toBe(true);
    const c2 = flatClips(getEditorState().project).find((c) => c.id === "c2")!;
    expect(c2.videoUrl).toBe("file://new.mp4");
    expect(c2.thumbnailUrl).toBe("file://new.jpg");
  });

  it("optionally updates duration and triggers recompute", () => {
    setProject(makeProject(specs3()));
    replaceClip("c1", {
      videoUrl: "file://new.mp4",
      thumbnailUrl: null,
      durationSec: 10,
    });
    const clips = flatClips(getEditorState().project);
    expect(clips.find((c) => c.id === "c1")!.durationSec).toBe(10);
    expect(clips.find((c) => c.id === "c2")!.timelineStartSec).toBe(10);
  });

  it("returns false when the clip lives on a locked track", () => {
    const tracks: EditorTrack[] = buildDefaultTracks().map((t) =>
      t.id === "sys:V1" ? { ...t, locked: true } : t,
    );
    setProject(makeProject(specs3(), tracks));
    const ok = replaceClip("c1", { videoUrl: "x", thumbnailUrl: null });
    expect(ok).toBe(false);
  });
});

describe("overwriteAtPlayhead", () => {
  it("inserts a new clip at the playhead inside the targeted V1 clip", () => {
    setProject(makeProject(specs3())); // timeline: 0..3, 3..7, 7..12
    setPlayhead(4); // inside c2
    const id = overwriteAtPlayhead({
      videoUrl: "file://ov.mp4",
      thumbnailUrl: null,
      durationSec: 2,
    });
    expect(id).not.toBeNull();
    const clips = flatClips(getEditorState().project);
    const inserted = clips.find((c) => c.id === id);
    expect(inserted).toBeDefined();
    expect(inserted!.durationSec).toBe(2);
  });

  it("returns null when no V1 clip exists at the playhead", () => {
    setProject(makeProject(specs3()));
    setPlayhead(100);
    expect(
      overwriteAtPlayhead({ videoUrl: "x", thumbnailUrl: null, durationSec: 1 }),
    ).toBeNull();
  });
});

describe("setTrackProps", () => {
  it("updates the requested track's flags", () => {
    setProject(makeProject(specs3()));
    setTrackProps("sys:V1", { locked: true });
    const v1 = getEditorState().project!.tracks!.find((t) => t.id === "sys:V1");
    expect(v1?.locked).toBe(true);
  });

  it("does nothing for an unknown track id", () => {
    setProject(makeProject(specs3()));
    const before = getEditorState().project!.tracks;
    setTrackProps("sys:NOPE", { locked: true });
    const after = getEditorState().project!.tracks;
    expect(after).toEqual(before);
  });
});

describe("selectAllClips", () => {
  it("selects every clip across the project", () => {
    setProject(makeProject(specs3()));
    expect(selectAllClips()).toBe(true);
    const s = getEditorState();
    expect(s.selectedClipIds).toEqual(["c1", "c2", "c3"]);
    expect(s.selectedClipId).toBe("c1");
  });

  it("returns false on an empty project", () => {
    setProject(makeProject([]));
    expect(selectAllClips()).toBe(false);
  });
});

describe("duplicateSelected", () => {
  it("clones every selected clip into the timeline immediately after the source", () => {
    setProject(makeProject(specs3()));
    selectClip("c2");
    expect(duplicateSelected()).toBe(true);
    const ids = flatClips(getEditorState().project).map((c) => c.id);
    // c1, c2, <dup>, c3
    expect(ids[0]).toBe("c1");
    expect(ids[1]).toBe("c2");
    expect(ids[2]).toMatch(/^dup-/);
    expect(ids[3]).toBe("c3");
  });

  it("returns false when nothing is selected", () => {
    setProject(makeProject(specs3()));
    expect(duplicateSelected()).toBe(false);
  });

  it("selects the new duplicate after duplicating", () => {
    setProject(makeProject(specs3()));
    selectClip("c1");
    duplicateSelected();
    expect(getEditorState().selectedClipId).toMatch(/^dup-/);
  });
});

describe("cutSelected", () => {
  it("removes the selected clip from the timeline", () => {
    setProject(makeProject(specs3()));
    selectClip("c2");
    expect(cutSelected()).toBe(true);
    const ids = flatClips(getEditorState().project).map((c) => c.id);
    expect(ids).toEqual(["c1", "c3"]);
  });

  it("removes every selected clip when multiple are selected", () => {
    setProject(makeProject(specs3()));
    selectClip("c1");
    extendClipSelection("c3");
    cutSelected();
    const ids = flatClips(getEditorState().project).map((c) => c.id);
    expect(ids).toEqual(["c2"]);
  });
});
