/**
 * screenplay — parser + clip mapping for the Script lens.
 *
 * Turns a screenplay's raw text into a typed block stream that the
 * Script view renders block-by-block. Every block is keyed by its
 * sceneIdx (0-based ordinal of the slug-line that opens its scene)
 * and, when possible, the V1 clip that owns its timeline range so
 * the screenplay can act like sheet music: click a block to seek,
 * watch playback walk through the blocks in order.
 *
 * Industry conventions the parser respects:
 *   SLUG          — "INT. KITCHEN - NIGHT" / "EXT. ROOFTOP - DAY"
 *                   Also: I/E, INT./EXT., EST., FADE IN:, FADE OUT.
 *   ACTION        — Default body paragraph.
 *   CHARACTER     — A name in ALL CAPS on its own line, optionally
 *                   followed by a parenthetical extension like
 *                   "(V.O.)" / "(O.S.)" / "(CONT'D)".
 *   PARENTHETICAL — A line wrapped in parens, sitting between a
 *                   CHARACTER block and its DIALOGUE.
 *   DIALOGUE      — The text that follows a CHARACTER until the
 *                   next blank line / structural break.
 *   TRANSITION    — All-caps ending with "TO:" — CUT TO:, DISSOLVE
 *                   TO:, SMASH CUT TO:, MATCH CUT TO:.
 *
 * The parser doesn't enforce strict formatting. It applies a series
 * of cheap heuristics that work whether the script was hand-typed,
 * AI-generated, or imported from Fountain / Final Draft text.
 *
 * Clip mapping strategy (v1):
 *   Distribute clips uniformly across scenes by ordinal — scene N
 *   contains clipsPerScene = ceil(total / sceneCount) clips, with
 *   the remainder folded into the last scene. Inside a scene, each
 *   non-empty content block (action / dialogue) advances to the
 *   next clip in that scene's slice. When clips run out, blocks
 *   inherit the last clip so the live cursor still has a target.
 *
 *   This is approximate — a future pass will read explicit
 *   scene_id / clip_id annotations the AI can embed in the script
 *   text (`<!-- clip: abc -->`) and use those when present.
 */
import type { EditorClip } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Block types
// ─────────────────────────────────────────────────────────────────────────────
export type ScreenplayBlockKind =
  | "slug"
  | "action"
  | "character"
  | "paren"
  | "dialogue"
  | "transition"
  | "title";

export interface ScreenplayBlock {
  id: string;
  kind: ScreenplayBlockKind;
  /** The visible text — already trimmed. */
  text: string;
  /** 0-based scene ordinal (slug-line count). The opening
   *  slug-line itself shares its sceneIdx with the action /
   *  dialogue blocks that follow until the next slug. */
  sceneIdx: number;
  /** For CHARACTER blocks — the speaker name (uppercase). For
   *  DIALOGUE blocks — the speaker name they inherit from the
   *  most recent CHARACTER block above. */
  speaker?: string;
  /** For CHARACTER extension — "(V.O.)", "(O.S.)" etc. */
  speakerExtension?: string;
  /** Index of the clip that owns this block's runtime position.
   *  -1 when no clip mapping was possible (empty project, etc). */
  clipIdx: number;
  /** The clip itself when clipIdx >= 0. Convenience pointer so the
   *  view doesn't have to thread the clips array through every
   *  child. */
  clip: EditorClip | null;
}

interface ParseInput {
  raw: string;
  clips: EditorClip[];
}

interface ParseOutput {
  blocks: ScreenplayBlock[];
  /** Number of slug-lines detected. */
  sceneCount: number;
  /** Number of dialogue + action blocks (the "content" surface). */
  contentCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-shots → screenplay prose
//
// The generation pipelines persist `generated_script` as a JSON shot list
// ({ shots: [{ title, description, dialogue }] }), but the editor renders
// screenplay TEXT. Feeding raw JSON to parseScreenplay produces garbage, so we
// render the shots into proper screenplay prose first.
// ─────────────────────────────────────────────────────────────────────────────

/** Render a JSON shots/clips payload as screenplay prose. Returns null if `raw`
 *  isn't a recognisable shot list. */
export function shotsJsonToScreenplay(raw: string): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const p = parsed as Record<string, unknown>;
  const shots = Array.isArray((p as { shots?: unknown }).shots) ? (p as { shots: unknown[] }).shots
    : Array.isArray((p as { clips?: unknown }).clips) ? (p as { clips: unknown[] }).clips
    : Array.isArray(parsed) ? (parsed as unknown[]) : null;
  if (!shots || shots.length === 0) return null;

  const out: string[] = [];
  shots.forEach((raw, i) => {
    const sh = (raw ?? {}) as Record<string, unknown>;
    const title = String(sh.title ?? sh.name ?? `Shot ${i + 1}`).toUpperCase().slice(0, 60);
    out.push(`SCENE ${i + 1} — ${title}`, "");
    const desc = String(sh.description ?? sh.prompt ?? sh.action ?? "").trim();
    if (desc) out.push(desc, "");
    const line = String(sh.dialogue ?? sh.line ?? sh.voiceover ?? "").trim();
    if (line) {
      const speaker = String(sh.speaker ?? sh.character ?? "").trim();
      if (speaker && /^[a-z0-9 .'#-]{1,28}$/i.test(speaker)) out.push(speaker.toUpperCase(), line, "");
      else out.push(`"${line.replace(/^["']|["']$/g, "")}"`, "");
    }
  });
  return out.join("\n").trim();
}

/** If `raw` is a JSON shot list, render it as screenplay prose; otherwise return
 *  it unchanged. Safe to call on any script string (prose passes through). */
export function coerceScreenplay(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s || (s[0] !== "{" && s[0] !== "[")) return s;
  return shotsJsonToScreenplay(s) ?? s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex bank — kept narrow so the heuristics stay debuggable
// ─────────────────────────────────────────────────────────────────────────────

/** Lines that mark a new scene's start. */
const SLUG_RE =
  /^(?:(?:INT|EXT|EST|I\/E|INT\.\/EXT)\.?[\s.]|FADE\s+(?:IN|OUT)\b|(?:SCENE|SHOT)\s+\d+)/i;

/** "CUT TO:", "SMASH CUT TO:", "DISSOLVE TO:", "FADE TO BLACK." etc. */
const TRANSITION_RE = /^[A-Z][A-Z0-9\s'’-]+(?:TO:|TO BLACK[.:]?|OUT[.:]?)\s*$/;

/** Parenthetical line — fully wrapped in matched parens. */
const PAREN_RE = /^\(.+\)$/;

/**
 * Detect a character cue. Rules:
 *   - At least one word, all letters uppercase (digits allowed in
 *     the middle, like "INTERN #2").
 *   - Optional " (EXTENSION)" tail — V.O., O.S., CONT'D, PRELAP.
 *   - Up to ~32 chars (longer is almost certainly action).
 *   - At least one alphabetic character.
 */
const CHARACTER_RE = /^([A-Z][A-Z0-9' .#]{0,30})(\s+\(([A-Z. '’]+)\))?$/;

/** Empty / blank line. */
const BLANK_RE = /^\s*$/;

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse raw screenplay text into typed blocks and resolve each block's
 * owning clip (when possible). Pure — no React, no DOM. Memoize on
 * the caller side keyed by `raw + clips.length` if it shows up hot.
 */
export function parseScreenplay({ raw, clips }: ParseInput): ParseOutput {
  if (!raw.trim()) {
    return { blocks: [], sceneCount: 0, contentCount: 0 };
  }

  const lines = raw.split(/\r?\n/);
  const blocks: ScreenplayBlock[] = [];
  let sceneIdx = -1; // becomes 0 on the first slug
  let lastSpeaker: string | undefined;
  let lastExt: string | undefined;
  let buffer: string[] = [];
  let bufferKind: ScreenplayBlockKind = "action";

  // Reused id factory — stable within a single parse so React keys
  // line up across re-renders for the same input.
  let blockSeq = 0;
  const nextId = () => `b-${++blockSeq}`;

  const flushBuffer = () => {
    const text = buffer.join("\n").trim();
    if (!text) {
      buffer = [];
      return;
    }
    blocks.push({
      id: nextId(),
      kind: bufferKind,
      text,
      sceneIdx: Math.max(0, sceneIdx),
      clipIdx: -1, // resolved below
      clip: null,
      ...(bufferKind === "dialogue"
        ? { speaker: lastSpeaker, speakerExtension: lastExt }
        : {}),
    });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (BLANK_RE.test(t)) {
      flushBuffer();
      bufferKind = "action";
      continue;
    }

    if (SLUG_RE.test(t)) {
      flushBuffer();
      sceneIdx += 1;
      blocks.push({
        id: nextId(),
        kind: "slug",
        text: t,
        sceneIdx,
        clipIdx: -1,
        clip: null,
      });
      bufferKind = "action";
      lastSpeaker = undefined;
      lastExt = undefined;
      continue;
    }

    if (TRANSITION_RE.test(t)) {
      flushBuffer();
      blocks.push({
        id: nextId(),
        kind: "transition",
        text: t,
        sceneIdx: Math.max(0, sceneIdx),
        clipIdx: -1,
        clip: null,
      });
      bufferKind = "action";
      continue;
    }

    // CHARACTER cue. Heuristic: matches the all-caps pattern AND
    // either follows a blank line / sits at the start, OR is
    // immediately followed (after optional paren) by non-empty,
    // non-uppercase dialogue. We approximate by checking that this
    // line is all-caps and the next non-blank line exists.
    if (CHARACTER_RE.test(t)) {
      // Look ahead — if the next non-blank line is also ALL-CAPS
      // and matches CHARACTER_RE, this one is most likely action
      // text (e.g. "JOHN PUNCHES THE DOOR"). Cheaply distinguish.
      let j = i + 1;
      while (j < lines.length && BLANK_RE.test(lines[j].trim())) j++;
      const nextNonBlank = j < lines.length ? lines[j].trim() : "";

      const looksLikeCharacter =
        nextNonBlank !== "" &&
        !SLUG_RE.test(nextNonBlank) &&
        !TRANSITION_RE.test(nextNonBlank) &&
        // Next line isn't itself a fresh character cue —
        // accept short uppercase next lines only if they're
        // parens (extension).
        (!CHARACTER_RE.test(nextNonBlank) || PAREN_RE.test(nextNonBlank));

      if (looksLikeCharacter) {
        flushBuffer();
        const match = t.match(CHARACTER_RE)!;
        const name = match[1].trim();
        const ext = match[3]?.trim();
        lastSpeaker = name;
        lastExt = ext;
        blocks.push({
          id: nextId(),
          kind: "character",
          text: t,
          sceneIdx: Math.max(0, sceneIdx),
          clipIdx: -1,
          clip: null,
          speaker: name,
          speakerExtension: ext,
        });
        bufferKind = "dialogue";
        continue;
      }
      // Fall through to action handling.
    }

    if (PAREN_RE.test(t) && bufferKind === "dialogue") {
      flushBuffer();
      blocks.push({
        id: nextId(),
        kind: "paren",
        text: t,
        sceneIdx: Math.max(0, sceneIdx),
        clipIdx: -1,
        clip: null,
      });
      bufferKind = "dialogue";
      continue;
    }

    // Default — accumulate into the active buffer.
    buffer.push(raw);
  }
  flushBuffer();

  // Resolve clip mapping. If no slug-lines exist we treat the whole
  // text as a single synthetic scene.
  const sceneCount = Math.max(1, sceneIdx + 1);
  resolveClipMapping(blocks, sceneCount, clips);

  const contentCount = blocks.filter(
    (b) => b.kind === "action" || b.kind === "dialogue",
  ).length;

  return { blocks, sceneCount, contentCount };
}

/**
 * Map each block to a clip using uniform distribution within its
 * scene. Pure mutation of the block objects.
 */
function resolveClipMapping(
  blocks: ScreenplayBlock[],
  sceneCount: number,
  clips: EditorClip[],
): void {
  if (clips.length === 0) return;

  // Carve the clips into scene slices. Scenes get ceil(N/sceneCount)
  // by default; any remainder lands in the last scene so we never
  // drop a clip.
  const perScene = Math.max(1, Math.ceil(clips.length / sceneCount));
  const sceneRanges: { start: number; end: number }[] = [];
  for (let s = 0; s < sceneCount; s++) {
    const start = Math.min(clips.length, s * perScene);
    const end =
      s === sceneCount - 1 ? clips.length : Math.min(clips.length, start + perScene);
    sceneRanges.push({ start, end });
  }

  // Walk blocks in order. Track the per-scene cursor that advances
  // for each content block (action / dialogue). slug / transition /
  // character / paren blocks reuse the current cursor without
  // bumping it.
  const sceneCursor: number[] = sceneRanges.map((r) => r.start);

  for (const b of blocks) {
    const range = sceneRanges[b.sceneIdx];
    if (!range) continue;
    const cur = Math.min(range.end - 1, sceneCursor[b.sceneIdx]);
    const cur2 = cur < 0 ? 0 : cur;
    if (clips[cur2]) {
      b.clipIdx = cur2;
      b.clip = clips[cur2];
    }
    if (b.kind === "action" || b.kind === "dialogue") {
      // Advance — but never past the end of this scene's slice. The
      // last clip absorbs any extra content blocks.
      if (sceneCursor[b.sceneIdx] < range.end - 1) sceneCursor[b.sceneIdx] += 1;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find which block is "currently being read" given a timeline
 * playhead. Returns the block whose owning clip contains the
 * playhead; falls back to the closest preceding block when the
 * playhead is between mapped clips.
 */
export function findActiveBlockIdx(
  blocks: ScreenplayBlock[],
  playheadSec: number,
): number {
  let active = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.clip) continue;
    if (playheadSec >= b.clip.timelineStartSec) {
      active = i;
    }
  }
  return active;
}

/** Format seconds → MM:SS. Used for the timecode gutter. */
export function fmtSceneTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
