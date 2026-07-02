/**
 * Timeline templates — data integrity + one-click apply behavior.
 *
 * Covers the two apply modes (fill empty / style existing), music routing to
 * A2, transition stitching, title cards, and the shape of all 50 templates.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  setProject,
  getEditorState,
  __resetForTests,
} from "@/lib/editor/store";
import {
  applyTimelineTemplate,
  MUSIC_BEDS,
  CATEGORY_LABELS,
  type TimelineTemplate,
} from "@/lib/editor/timeline-template-apply";
import {
  TIMELINE_TEMPLATES,
  getTimelineTemplate,
} from "@/lib/editor/timeline-templates";
import { getLut } from "@/lib/editor/lut-library";
import { makeProject, flatClips } from "@/test/store/fixtures";

const AUDIO = new Set(["sys:A1", "sys:A2"]);
const videoClips = () =>
  flatClips(getEditorState().project).filter(
    (c) => c.kind !== "title" && !AUDIO.has(c.properties?.trackId ?? "sys:V1"),
  );
const titleClips = () =>
  flatClips(getEditorState().project).filter((c) => c.kind === "title");
const a2Clips = () =>
  flatClips(getEditorState().project).filter(
    (c) => c.properties?.trackId === "sys:A2",
  );

const EPIC = getTimelineTemplate("cine-epic") as TimelineTemplate;

describe("TIMELINE_TEMPLATES", () => {
  it("has 62 templates with unique ids", () => {
    expect(TIMELINE_TEMPLATES.length).toBe(62);
    const ids = new Set(TIMELINE_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(TIMELINE_TEMPLATES.length);
  });

  it("covers all 10 categories, at least 5 each", () => {
    const byCat = new Map<string, number>();
    for (const t of TIMELINE_TEMPLATES) byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1);
    expect(byCat.size).toBe(Object.keys(CATEGORY_LABELS).length);
    for (const [, n] of byCat) expect(n).toBeGreaterThanOrEqual(5);
  });

  it("every template has a BAKEABLE grade (lutId resolves to a real LUT)", () => {
    // The CSS filter is preview-only; the export bakes colorGrade.lutId. This
    // locks the fix that made template looks actually reach the render.
    for (const t of TIMELINE_TEMPLATES) {
      expect(t.lutId, `${t.id} missing lutId`).toBeTruthy();
      expect(getLut(t.lutId as string), `${t.id} lutId "${t.lutId}" does not resolve`).toBeDefined();
    }
  });

  it("every template is well-formed and scored by a real bed", () => {
    for (const t of TIMELINE_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.slots.length).toBeGreaterThan(0);
      for (const s of t.slots) {
        expect(s.prompt.trim().length).toBeGreaterThan(0);
        expect(s.durationSec).toBeGreaterThan(0);
      }
      expect(t.filter.length).toBeGreaterThan(0);
      expect(MUSIC_BEDS[t.music]).toBeDefined();
      expect(t.gradient).toHaveLength(2);
    }
  });

  it("every music bed url is a real https mp3", () => {
    for (const bed of Object.values(MUSIC_BEDS)) {
      expect(bed.url).toMatch(/^https:\/\/.+\.mp3$/);
      expect(bed.durationSec).toBeGreaterThan(0);
    }
  });

  it("surfaces mobile-first vertical/portrait templates", () => {
    const mobile = TIMELINE_TEMPLATES.filter((t) => t.mobileFirst);
    expect(mobile.length).toBeGreaterThan(0);
    // mobileFirst should only be set on non-wide canvases.
    for (const t of mobile) expect(["9:16", "4:5"]).toContain(t.aspectRatio);
  });
});

describe("applyTimelineTemplate — fill empty timeline", () => {
  beforeEach(() => {
    __resetForTests();
    setProject(makeProject([])); // empty timeline
  });

  it("lays the template's slots, transitions, titles, and a music bed", () => {
    const res = applyTimelineTemplate(EPIC);
    expect(res.ok).toBe(true);
    expect(res.mode).toBe("filled-empty");

    // One video clip per slot.
    expect(videoClips()).toHaveLength(EPIC.slots.length);
    expect(res.clipsAdded).toBe(EPIC.slots.length);

    // Transitions between consecutive video clips.
    expect(getEditorState().project?.transitions.length).toBe(EPIC.slots.length - 1);

    // Intro + outro titles.
    expect(titleClips().length).toBe(2);

    // Scored on A2.
    expect(a2Clips()).toHaveLength(1);
    expect(a2Clips()[0].videoUrl).toBe(MUSIC_BEDS[EPIC.music].url);
    expect(res.musicAdded).toBe(true);
  });

  it("applies the look (filter + fades) to every laid clip", () => {
    applyTimelineTemplate(EPIC);
    for (const c of videoClips()) {
      expect(c.properties?.filter).toBe(EPIC.filter);
      expect(c.properties?.fadeInSec).toBe(EPIC.fadeInSec);
    }
  });

  it("writes a BAKEABLE colorGrade (lutId) so the look reaches the export", () => {
    applyTimelineTemplate(EPIC);
    for (const c of videoClips()) {
      // Preview CSS filter AND the real grade the stitcher bakes.
      expect(c.properties?.colorGrade?.lutId).toBe(EPIC.lutId);
      expect(c.properties?.colorGrade?.lutMix).toBe(1);
    }
  });

  it("switches the project aspect ratio to match the template", () => {
    const vertical = getTimelineTemplate("social-hook") as TimelineTemplate;
    applyTimelineTemplate(vertical);
    expect(getEditorState().project?.aspectRatio).toBe("9:16");
  });
});

describe("applyTimelineTemplate — style existing clips", () => {
  beforeEach(() => {
    __resetForTests();
    setProject(
      makeProject([
        { id: "a", durationSec: 4 },
        { id: "b", durationSec: 4 },
        { id: "c", durationSec: 4 },
      ]),
    );
  });

  it("styles the existing clips without adding new video slots", () => {
    const res = applyTimelineTemplate(EPIC);
    expect(res.mode).toBe("styled-existing");
    expect(res.styledExisting).toBe(3);
    expect(res.clipsAdded).toBe(0);
    // Still exactly the 3 original video clips.
    expect(videoClips()).toHaveLength(3);
    // The look is applied to them.
    for (const c of videoClips()) expect(c.properties?.filter).toBe(EPIC.filter);
    // Transitions stitched between the 3 → 2 boundaries.
    expect(getEditorState().project?.transitions.length).toBe(2);
    // Still scored.
    expect(a2Clips()).toHaveLength(1);
  });

  it("replaceExisting=true wipes then fills with the template's slots", () => {
    const res = applyTimelineTemplate(EPIC, { replaceExisting: true });
    expect(res.mode).toBe("filled-empty");
    expect(videoClips()).toHaveLength(EPIC.slots.length);
  });
});

describe("applyTimelineTemplate — guards", () => {
  it("returns no-project when there is no open project", () => {
    __resetForTests();
    setProject(null);
    const res = applyTimelineTemplate(EPIC);
    expect(res.ok).toBe(false);
    expect(res.mode).toBe("no-project");
  });
});
