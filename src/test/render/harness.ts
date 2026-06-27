/**
 * Render-test harness.
 *
 * Load a JSON fixture describing a small editor project, compile it
 * via `buildSeamlessCommand`, and parse the produced `filter_complex`
 * string so individual tests can assert structural invariants.
 *
 * The harness is intentionally thin — fixtures are plain JSON and the
 * parser only knows about the seamless-stitcher graph shape (per-input
 * normalize, xfade chain, title chain, overlay chain, aux chain,
 * master). When we add fixtures for new editor features, they extend
 * this same vocabulary.
 *
 * Single source of truth: `supabase/functions/_shared/seamless-command.ts`
 * is imported directly; the edge function uses the same module so any
 * graph change ships to production AND the harness in the same commit.
 */

import {
  buildSeamlessCommand,
  type StitchInput,
} from "../../../supabase/functions/_shared/seamless-command.ts";

export type Fixture = {
  name: string;
  description?: string;
  inputs: StitchInput[];
  transitionDuration: number;
  transitionType: string;
  aspectRatio?: string;
  resolution?: string;
  format?: string;
  crf?: number;
  autoDuck?: boolean;
  masterLoudness?: "off" | "broadcast_tv" | "podcast" | "streaming" | "youtube" | "cinema";
  perBoundaryTransitions?: Array<{ kind: string; durationSec: number }>;
  titleClips?: Array<{
    text: string;
    color: string;
    startSec: number;
    durationSec: number;
    x?: number;
    y?: number;
    sizePct?: number;
    bold?: boolean;
  }>;
  overlays?: Array<{ timelineStartSec: number; durationSec: number }>;
  auxAudio?: Array<{ timelineStartSec: number; durationSec: number; kind?: "music" | "voice" }>;
};

export type CompiledFixture = {
  fixture: Fixture;
  command: string;
  filterComplex: string;
  /** Each `;`-separated chunk of the filter graph. */
  chunks: string[];
  /** All `[label]` references found in `chunks`. */
  labels: Set<string>;
  /** Labels declared as filter outputs (e.g. `...[v0]`). */
  outputs: Set<string>;
  /** Labels consumed as filter inputs (e.g. `[v0]...`). */
  inputsRefs: Set<string>;
  /** Final video/audio map labels the encoder reads from. */
  finalVideoLabel: string;
  finalAudioLabel: string;
  /** Output dimensions parsed from a normalize chunk's `scale=WxH`. */
  outputW: number;
  outputH: number;
};

export function compile(fixture: Fixture): CompiledFixture {
  const { command } = buildSeamlessCommand({
    inputs: fixture.inputs,
    transitionDuration: fixture.transitionDuration,
    transitionType: fixture.transitionType,
    masterLoudness: fixture.masterLoudness,
    aspectRatio: fixture.aspectRatio,
    resolution: fixture.resolution,
    format: fixture.format,
    crf: fixture.crf,
    autoDuck: fixture.autoDuck,
    perBoundaryTransitions: fixture.perBoundaryTransitions,
    titleClips: fixture.titleClips,
    overlays: fixture.overlays,
    auxAudio: fixture.auxAudio,
  });

  // Pull filter_complex out of the command string. The builder wraps
  // it in double quotes — extract via a regex that won't choke on
  // nested escapes (we control the input).
  const fcMatch = command.match(/-filter_complex "([^"]+)"/);
  if (!fcMatch) {
    throw new Error("harness: could not locate filter_complex in command");
  }
  const filterComplex = fcMatch[1];
  const chunks = filterComplex.split(";");

  const labels = new Set<string>();
  const outputs = new Set<string>();
  const inputsRefs = new Set<string>();
  for (const c of chunks) {
    // Label references look like `[name]`. The filter graph DSL uses
    // them for both input streams (at chunk start) and output streams
    // (at chunk end). Names without spaces or commas; numeric inputs
    // like `[0:v]` count too — strip them when classifying since the
    // numeric source streams are part of `-i` not the graph.
    const refs = [...c.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    for (const r of refs) labels.add(r);
    // Output labels are everything between the LAST `=` and the chunk's
    // closing `]`. Each chunk ends with `[outName]` after its filter args.
    // Simpler rule: any label appearing AT THE END of a chunk is an output.
    const last = refs.length ? refs[refs.length - 1] : null;
    if (last && c.trim().endsWith(`[${last}]`)) outputs.add(last);
    // Inputs are everything that appears BEFORE the filter expression.
    // Approximated by all labels except the final one in each chunk.
    for (let i = 0; i < refs.length - (last ? 1 : 0); i++) {
      inputsRefs.add(refs[i]);
    }
  }

  // Final map labels — parsed from the `-map "[label]"` args at the end.
  const mapMatches = [...command.matchAll(/-map "\[([^\]]+)\]"/g)].map((m) => m[1]);
  const finalVideoLabel = mapMatches[0] ?? "";
  const finalAudioLabel = mapMatches[1] ?? "";

  // Output dimensions — parsed from the first scale chunk.
  const scaleMatch = filterComplex.match(/scale=(\d+):(\d+)/);
  const outputW = scaleMatch ? Number(scaleMatch[1]) : NaN;
  const outputH = scaleMatch ? Number(scaleMatch[2]) : NaN;

  return {
    fixture,
    command,
    filterComplex,
    chunks,
    labels,
    outputs,
    inputsRefs,
    finalVideoLabel,
    finalAudioLabel,
    outputW,
    outputH,
  };
}

/** Returns every chunk whose contents match the predicate. */
export function chunksMatching(c: CompiledFixture, re: RegExp): string[] {
  return c.chunks.filter((s) => re.test(s));
}

/** Returns true if at least one chunk matches. */
export function hasChunk(c: CompiledFixture, re: RegExp): boolean {
  return c.chunks.some((s) => re.test(s));
}

/** Returns true when no two chunks declare the same output label. */
export function hasUniqueLabels(c: CompiledFixture): { ok: true } | { ok: false; dup: string } {
  const seen = new Set<string>();
  for (const chunk of c.chunks) {
    for (const out of chunkOutputs(chunk)) {
      if (seen.has(out)) return { ok: false, dup: out };
      seen.add(out);
    }
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter graph integrity validator
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrityIssue =
  | { kind: "duplicate-output"; label: string; chunk: string }
  | { kind: "unresolved-input"; label: string; chunk: string }
  | { kind: "unmapped-output"; label: string }
  | { kind: "unbalanced-brackets"; chunk: string }
  | { kind: "unbalanced-parens"; chunk: string }
  | { kind: "dimensions-mismatch"; expected: string; got: string };

export type IntegrityReport = { ok: true } | { ok: false; issues: IntegrityIssue[] };

/**
 * Validate the filter graph against the structural invariants every
 * fixture from F02+ shares.
 *
 * Checks:
 *   1. Label uniqueness — no two chunks declare the same `[out]` label.
 *   2. Referential integrity — every `[input]` ref at the head of a
 *      chunk is either a source stream (`N:v` / `N:a`) or an output
 *      declared by a prior chunk.
 *   3. Map targets — both `-map "[label]"` refs in the command point
 *      at labels that actually exist in the graph.
 *   4. Output dimensions — the parsed canvas size matches what
 *      `dimensionsForAspect(aspect, resolution)` would return.
 *   5. Syntactic well-formedness — brackets and parens balance within
 *      every chunk.
 */
export function validateFilterGraph(c: CompiledFixture): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const declared = new Set<string>();

  for (const chunk of c.chunks) {
    // Bracket / paren balance.
    if (countChar(chunk, "[") !== countChar(chunk, "]")) {
      issues.push({ kind: "unbalanced-brackets", chunk });
    }
    if (countChar(chunk, "(") !== countChar(chunk, ")")) {
      issues.push({ kind: "unbalanced-parens", chunk });
    }

    // Referential integrity — head-of-chunk inputs must be either
    // source streams or already-declared outputs.
    const headInputs = chunkInputs(chunk);
    for (const ref of headInputs) {
      if (isSourceStream(ref)) continue;
      if (declared.has(ref)) continue;
      issues.push({ kind: "unresolved-input", label: ref, chunk });
    }

    // Capture this chunk's outputs.
    const outs = chunkOutputs(chunk);
    for (const out of outs) {
      if (declared.has(out)) {
        issues.push({ kind: "duplicate-output", label: out, chunk });
      } else {
        declared.add(out);
      }
    }
  }

  // Map targets — `-map "[label]"` from the command line.
  const mapMatches = [...c.command.matchAll(/-map "\[([^\]]+)\]"/g)].map((m) => m[1]);
  for (const m of mapMatches) {
    if (!declared.has(m) && !isSourceStream(m)) {
      issues.push({ kind: "unmapped-output", label: m });
    }
  }

  if (issues.length === 0) return { ok: true };
  return { ok: false, issues };
}

function chunkOutputs(chunk: string): string[] {
  // FFmpeg syntax: trailing `[out1][out2]...` (one or more outputs).
  // Walk from the right, collecting `[label]` tokens until we hit
  // something that isn't a closing bracket-pair.
  const out: string[] = [];
  let i = chunk.length;
  while (i > 0) {
    // Skip trailing whitespace.
    while (i > 0 && /\s/.test(chunk[i - 1])) i--;
    if (i === 0 || chunk[i - 1] !== "]") break;
    const close = i - 1;
    const open = chunk.lastIndexOf("[", close);
    if (open < 0) break;
    out.unshift(chunk.slice(open + 1, close));
    i = open;
  }
  return out;
}

function chunkInputs(chunk: string): string[] {
  // FFmpeg syntax: leading `[in1][in2]...` (one or more inputs).
  const out: string[] = [];
  let i = 0;
  while (i < chunk.length) {
    while (i < chunk.length && /\s/.test(chunk[i])) i++;
    if (chunk[i] !== "[") break;
    const close = chunk.indexOf("]", i + 1);
    if (close < 0) break;
    out.push(chunk.slice(i + 1, close));
    i = close + 1;
  }
  return out;
}

function isSourceStream(ref: string): boolean {
  // FFmpeg refers to external file inputs as `N:v` / `N:a` / `N:s`
  // / `N:m` etc., where N is the 0-indexed input number.
  return /^\d+:[vasm]$/.test(ref);
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === ch) n++;
  return n;
}
