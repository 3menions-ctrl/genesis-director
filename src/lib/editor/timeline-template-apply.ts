/**
 * Timeline templates — one-click "video + audio" starters for the editor.
 *
 * A template is a complete LOOK + PACING + AUDIO recipe. Applying one is a
 * single click that composes the existing, well-tested store mutators:
 *
 *   • lays down (or styles) the V1 video track,
 *   • sets a cohesive look (CSS filter grade) + fade in/out + speed per clip,
 *   • stitches the clips with a signature transition,
 *   • drops an intro + outro title card,
 *   • lands a royalty-free music bed on the A2 (Music) track.
 *
 * Two modes, chosen automatically:
 *   • EMPTY timeline  → "filled-empty": appends prompt-slot placeholders the
 *     user then generates into, pre-styled and pre-scored.
 *   • HAS video clips → "styled-existing": leaves the clips, applies the
 *     template's look/transitions/score over what's already there.
 *
 * Everything here goes through the public store API, so undo/redo, autosave,
 * and the bake pipeline all see the result exactly as if hand-authored.
 */
import * as store from "./store";
import { getEditorState } from "./store";
import { IDENTITY_GRADE } from "./color-grade";
import type { AspectRatio, EditorClip, TransitionKind } from "./types";

// ── Royalty-free music beds ─────────────────────────────────────────────────
// The same self-hosted, license-clear beds the MusicPicker offers. Reused here
// so a template's score is a REAL file, never a placeholder. (Keep in sync with
// src/pages/Editor/components/MusicPicker.tsx → APP_TRACKS.)
const MUSIC_BASE =
  "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/video-clips/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/music";

export type MusicBedId = "strings" | "mountain" | "swell";

export const MUSIC_BEDS: Record<MusicBedId, { title: string; url: string; durationSec: number }> = {
  strings: { title: "Dramatic Strings", url: `${MUSIC_BASE}/66793761-9fb0-40ce-91a9-7f74d7c184c3.mp3`, durationSec: 56 },
  mountain: { title: "Elegant Mountain", url: `${MUSIC_BASE}/c518f90c-d4e0-4862-9ec5-c464f51d227d.mp3`, durationSec: 142 },
  swell: { title: "Ambient Swell", url: `${MUSIC_BASE}/27eac7fc-de97-45ce-8346-104b81dc0a01.mp3`, durationSec: 178 },
};

// ── Template categories ─────────────────────────────────────────────────────
export type TimelineTemplateCategory =
  | "cinematic"
  | "social"
  | "vlog"
  | "commercial"
  | "trailer"
  | "travel"
  | "music"
  | "corporate"
  | "story"
  | "lifestyle";

export const CATEGORY_LABELS: Record<TimelineTemplateCategory, string> = {
  cinematic: "Cinematic",
  social: "Social / Vertical",
  vlog: "Vlog",
  commercial: "Commercial",
  trailer: "Trailer",
  travel: "Travel",
  music: "Music",
  corporate: "Corporate",
  story: "Story",
  lifestyle: "Lifestyle",
};

// ── The template shape ──────────────────────────────────────────────────────
export interface TimelineTemplateSlot {
  /** Prompt seeded into the placeholder clip (the user generates into it). */
  prompt: string;
  durationSec: number;
}

export interface TimelineTemplate {
  id: string;
  name: string;
  description: string;
  category: TimelineTemplateCategory;
  /** Suggested canvas — the apply switches the project aspect to match. */
  aspectRatio: AspectRatio;
  /** One-word vibe shown on the card chip. */
  vibe: string;
  /** Cohesive look applied to every video clip as a CSS filter string
   *  (the editor's lightweight PREVIEW grade). */
  filter: string;
  /** Bakeable grade — a LUT id from the color-grade LUT library. The CSS
   *  `filter` above is preview-only (the stitcher bakes `properties.colorGrade`,
   *  not CSS), so WITHOUT this a template's look never reached the exported
   *  video. When set, applyLook writes a real colorGrade so preview == export. */
  lutId?: string;
  /** Signature transition stitched between consecutive clips. */
  transition: TransitionKind;
  transitionDurationSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  /** Optional global playback speed (e.g. 0.85 for a dreamy slow-mo). */
  speed?: number;
  /** Structure for an EMPTY timeline — prompt-slot placeholders. */
  slots: TimelineTemplateSlot[];
  introTitle?: string;
  outroTitle?: string;
  /** Which royalty-free bed scores this template. */
  music: MusicBedId;
  /** Two CSS colors for the card's gradient tile. */
  gradient: [string, string];
  /** Surfaced first on phones (9:16 / 4:5 templates). */
  mobileFirst?: boolean;
}

export interface ApplyTimelineTemplateResult {
  ok: boolean;
  mode: "filled-empty" | "styled-existing" | "no-project";
  clipsAdded: number;
  styledExisting: number;
  transitionsAdded: number;
  titlesAdded: number;
  musicAdded: boolean;
}

const AUDIO_TRACKS = new Set(["sys:A1", "sys:A2"]);

/** Video clips on the timeline, in play order. Excludes titles + audio rows. */
function videoClipsInOrder(): EditorClip[] {
  const st = getEditorState();
  if (!st.project) return [];
  return st.project.scenes
    .flatMap((s) => s.clips)
    .filter(
      (c) =>
        c.kind !== "title" &&
        !AUDIO_TRACKS.has(c.properties?.trackId ?? "sys:V1"),
    )
    .slice()
    .sort((a, b) => a.timelineStartSec - b.timelineStartSec || a.index - b.index);
}

let slotSeq = 0;

/**
 * Apply a timeline template to the live editor project.
 *
 * @param t       the template to apply
 * @param opts.replaceExisting  when true, wipes the current clips first and
 *                lays the template's slots (defaults to false → style in place
 *                when clips exist, fill when empty).
 */
export function applyTimelineTemplate(
  t: TimelineTemplate,
  opts: { replaceExisting?: boolean } = {},
): ApplyTimelineTemplateResult {
  const st = getEditorState();
  if (!st.project) {
    return {
      ok: false,
      mode: "no-project",
      clipsAdded: 0,
      styledExisting: 0,
      transitionsAdded: 0,
      titlesAdded: 0,
      musicAdded: false,
    };
  }

  // Match the canvas to the template's intended format.
  try {
    store.setAspectRatio(t.aspectRatio);
  } catch {
    /* non-fatal */
  }

  const hadVideo = videoClipsInOrder().length > 0;
  const fill = opts.replaceExisting || !hadVideo;

  let clipsAdded = 0;
  let styledExisting = 0;

  if (fill) {
    if (opts.replaceExisting) {
      try {
        store.clearAllClips();
      } catch {
        /* non-fatal */
      }
    }
    // Lay down a pre-styled placeholder per slot.
    for (const slot of t.slots) {
      const id = `tpl-${t.id}-${slotSeq++}-${Math.floor(performance.now())}`;
      const made = store.appendPendingClip({
        id,
        prompt: slot.prompt,
        durationSec: slot.durationSec,
        thumbnailUrl: null,
      });
      if (made) {
        applyLook(made, t);
        clipsAdded++;
      }
    }
  } else {
    // Style what's already on the timeline.
    for (const clip of videoClipsInOrder()) {
      applyLook(clip.id, t);
      styledExisting++;
    }
  }

  // Stitch consecutive clips with the signature transition.
  const ordered = videoClipsInOrder();
  let transitionsAdded = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    const id = store.addTransition(
      ordered[i].id,
      ordered[i + 1].id,
      t.transition,
      t.transitionDurationSec,
    );
    if (id) transitionsAdded++;
  }

  // Intro + outro title cards.
  let titlesAdded = 0;
  if (t.introTitle) {
    store.setPlayhead(0);
    if (store.insertTitleAtPlayhead(t.introTitle)) titlesAdded++;
  }
  if (t.outroTitle) {
    const total = getEditorState().project?.durationSec ?? 0;
    store.setPlayhead(Math.max(0, total - 3));
    if (store.insertTitleAtPlayhead(t.outroTitle)) titlesAdded++;
  }

  // Score it — land the bed on A2 (Music).
  const musicAdded = addMusicBed(t);

  store.setPlayhead(0);

  return {
    ok: true,
    mode: fill ? "filled-empty" : "styled-existing",
    clipsAdded,
    styledExisting,
    transitionsAdded,
    titlesAdded,
    musicAdded,
  };
}

/** Apply the template's per-clip look (filter grade, fades, speed). */
function applyLook(clipId: string, t: TimelineTemplate): void {
  store.setClipProperty(clipId, {
    filter: t.filter, // preview grade
    fadeInSec: t.fadeInSec,
    fadeOutSec: t.fadeOutSec,
    ...(t.speed ? { speed: t.speed } : {}),
  });
  // BAKEABLE grade (2026-07-02): the CSS `filter` is preview-only — the
  // stitcher bakes properties.colorGrade. Set a real LUT-backed grade so the
  // template's look actually reaches the exported video (preview == export).
  if (t.lutId) {
    store.setClipColorGrade(clipId, { ...IDENTITY_GRADE, lutId: t.lutId, lutMix: 1 });
  }
}

/** Land the royalty-free bed on A2 via the same primitives ingestMusicUrl uses. */
function addMusicBed(t: TimelineTemplate): boolean {
  const bed = MUSIC_BEDS[t.music];
  if (!bed) return false;
  const id = `tpl-score-${t.id}-${Math.floor(performance.now())}`;
  const made = store.appendPendingClip({
    id,
    prompt: `Score: ${bed.title}`,
    durationSec: bed.durationSec,
    thumbnailUrl: null,
  });
  if (!made) return false;
  store.resolvePendingClip(made, {
    videoUrl: bed.url,
    thumbnailUrl: null,
    durationSec: bed.durationSec,
  });
  store.setClipProperty(made, { trackId: "sys:A2" });
  return true;
}
