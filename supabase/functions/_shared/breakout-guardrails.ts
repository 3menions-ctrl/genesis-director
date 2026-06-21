/**
 * Breakout-effect guardrails — the SINGLE SOURCE OF TRUTH for how 4th-wall /
 * "break out of the screen" effects must be generated.
 *
 * These rules are EMPIRICAL — earned by running dozens of generations against
 * ByteDance's Seedance 2.0 moderation — and corroborated by ByteDance's public
 * post-Hollywood safeguards (Disney / Netflix / Warner / Paramount / Universal
 * cease-and-desists + MPA demand, Feb 2026). They exist so a breakout never
 * silently fails moderation (the vague "E005 input/output flagged as sensitive")
 * or the prompt-length limit (HTTP 422) again.
 *
 * ── THE RULES ──────────────────────────────────────────────────────────────
 *  1. ENGINE — breakouts run on Seedance 2.0 ONLY. Kling/Veo are never used for
 *     breakouts. (seedance-pipeline already hard-guards this; forceBreakoutEngine()
 *     is the shared constant so callers route correctly.)
 *
 *  2. SCRIPT LENGTH — Seedance rejects any prompt > 4000 chars with HTTP 422.
 *     Every clip prompt is hard-clamped to SEEDANCE_SAFE_PROMPT_CHARS.
 *
 *  3. MODERATION — Seedance blocks (E005) on, in order of how reliably it fires:
 *       a. Real-celebrity / recognizable-real-person LIKENESS (face filter).
 *       b. Trademarked / franchise IP characters — capes, chest emblems, the
 *          "superhero" silhouette (e.g. a flying caped hero reads as Superman).
 *       c. Brand logos / wordmarks in the plate — TikTok is a HARD block (it is
 *          ByteDance's own brand); other platforms are risky. Facebook plates
 *          have passed, but the safe default is an unbranded "media player".
 *       d. PHOTOREAL humans performing dynamic / super-powered action.
 *     PROVEN-SAFE (passes every time): STYLIZED / 3D-ANIMATED rendering (it
 *     bypasses the face filter), and calm, ordinary, unbranded realistic people.
 *
 *  4. CAMERA — the screen / platform plate stays LOCKED (camera_fixed: true);
 *     only the subject moves and breaks out. The frame never pans/tilts/zooms.
 *
 * Keep this file authoritative — wire enforcement THROUGH it; don't re-implement.
 */

/** Breakouts use Seedance 2.0 only. */
export const BREAKOUT_ENGINE = "seedance" as const;

/** ByteDance Seedance hard prompt limit (HTTP 422 above it). */
export const SEEDANCE_MAX_PROMPT_CHARS = 4000;
/** Safety margin we clamp to, below the hard limit. */
export const SEEDANCE_SAFE_PROMPT_CHARS = 3800;

/** Fixed Seedance dispatch params every breakout clip must use. */
export const SEEDANCE_BREAKOUT_PARAMS = {
  cameraFixed: true, // locked-off screen — only the subject breaks out
  resolution: "1080p" as const,
  fps: 24,
  durationSeconds: 5, // per clip
  generateAudio: true,
} as const;

/**
 * Appended to every breakout PLATE-image prompt (the Nano Banana step that
 * composites a character into a platform UI) so generated characters stay safe.
 */
export const BREAKOUT_PLATE_SAFETY_DIRECTIVE =
  "Use ORIGINAL characters only — no real people, no celebrity or public-figure likeness, " +
  "no trademarked or franchise characters, no capes / chest emblems / superhero costumes, and no " +
  "brand logos or wordmarks (use a generic unbranded media player). For any character performing " +
  "dynamic or super-powered action, render in a stylized 3D-animated / illustrated style (not " +
  "photoreal) so it reliably clears moderation.";

/** Brand wordmarks that hard-block Seedance moderation (ByteDance's own first). */
const HARD_BLOCKED_BRANDS: Array<[RegExp, string]> = [
  [/\btik[\s-]?tok\b/gi, "media player"],
  [/\bdouyin\b/gi, "media player"],
  [/\bcapcut\b/gi, "media player"],
];

/** Franchise IP character names that reliably trip the filter → neutralized. */
const BLOCKED_IP_TOKENS: Array<[RegExp, string]> = [
  [/\bsuperman\b/gi, "original flying character"],
  [/\bbatman\b/gi, "original character"],
  [/\bspider[\s-]?man\b/gi, "original character"],
  [/\bwonder[\s-]?woman\b/gi, "original character"],
];

/** Breakouts use Seedance. Call this where engine is selected. */
export function forceBreakoutEngine(): typeof BREAKOUT_ENGINE {
  return BREAKOUT_ENGINE;
}

/** Hard-clamp a script to Seedance's prompt limit, breaking on a sentence/word boundary. */
export function clampScript(prompt: string, max = SEEDANCE_SAFE_PROMPT_CHARS): string {
  if (!prompt) return "";
  if (prompt.length <= max) return prompt;
  const cut = prompt.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  return (stop > max * 0.6 ? cut.slice(0, stop) : cut).trim();
}

/** Replace brand/IP tokens that hard-block Seedance moderation. */
export function stripModerationTriggers(prompt: string): string {
  let p = prompt ?? "";
  for (const [re, repl] of HARD_BLOCKED_BRANDS) p = p.replace(re, repl);
  for (const [re, repl] of BLOCKED_IP_TOKENS) p = p.replace(re, repl);
  return p.replace(/\s{2,}/g, " ").trim();
}

/**
 * Full enforcement for a single breakout clip prompt: strip moderation triggers,
 * then hard-clamp to the Seedance length limit. Use on every clip description.
 */
export function enforceBreakoutScript(prompt: string): string {
  return clampScript(stripModerationTriggers(prompt));
}
