/**
 * generation/chains — frame chain + identity chain + pose chain.
 *
 * These three lock the look + the characters + the motion between
 * adjacent shots. Without chaining, a generated film falls apart at
 * every boundary: the protagonist's face shifts, the lighting
 * doesn't match, the camera angle resets. With chaining, shots
 * inherit visual context from their predecessors and the result
 * reads as one continuous film.
 *
 * Pure functions. The orchestrator calls them when building
 * EngineInput; they don't perform any IO themselves.
 *
 * Frame chain (CONTINUITY)
 *   The previous shot's last frame becomes the next shot's start
 *   image. Engines that support image-to-video lock to this anchor
 *   when generating, so the new shot opens on the exact pixel the
 *   previous shot closed on. No cuts visible; just a continuous
 *   pan / push / shift.
 *
 * Identity chain (CHARACTER LOCK)
 *   Every character in the document carries an identityDNA + an
 *   optional referenceImageUrl. When a shot's beats name a
 *   character, that character's identity pack is woven into the
 *   prompt as a CONTINUITY LOCK directive. Engines vary in how they
 *   consume references — some accept multi-image refs, some only
 *   one. The pipeline submitters handle the engine-specific shape.
 *
 * Pose chain (MOTION CONTINUITY)
 *   The most subtle. When two adjacent shots feature the same
 *   character, the second shot inherits a POSE HINT describing
 *   the character's body position at the end of the previous shot.
 *   Helps engines avoid the "character teleport" effect when the
 *   beat splits across shots.
 */
import type {
  ScriptDocument,
  Shot,
} from "../script-document";
import type {
  ChainContext,
  IdentityRef,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Frame chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the previous shot for the given shot id, walking the
 * document in order. Returns null when this is the first shot.
 *
 * Respects explicit `inheritsFromShotId` overrides — when a shot
 * declares its inheritance, that wins over chronological order.
 * Useful for "back to scene N" callbacks where a shot intentionally
 * picks up from a non-adjacent moment.
 */
export function resolvePreviousShot(
  doc: ScriptDocument,
  shotId: string,
): Shot | null {
  const flat = doc.scenes.flatMap((s) => s.shots);
  const idx = flat.findIndex((s) => s.id === shotId);
  if (idx < 0) return null;

  const me = flat[idx];

  // Explicit inheritance wins.
  if (me.inheritsFromShotId) {
    return flat.find((s) => s.id === me.inheritsFromShotId) ?? null;
  }

  // Otherwise the previous shot in document order.
  return idx > 0 ? flat[idx - 1] : null;
}

/**
 * The frame-chain decision. We use the previous shot's last frame
 * when ALL of:
 *   - it exists (the previous shot has completed + persisted)
 *   - the shot ISN'T explicitly opting out (kept open for a future
 *     `inheritsLastFrame: false` field; not implemented today)
 */
export function frameChainStartImage(
  doc: ScriptDocument,
  shotId: string,
): string | null {
  const prev = resolvePreviousShot(doc, shotId);
  if (!prev) return null;
  return prev.generated?.lastFrameUrl ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk this shot's beats, collect every character mentioned, look
 * them up in the document's cast, return the identity pack the
 * pipeline weaves into the prompt.
 *
 * Order matters: protagonists first, then antagonists, then
 * supporting. Most engines pay more attention to early references
 * in the prompt, so we put the most important characters first.
 */
export function identityRefsForShot(
  doc: ScriptDocument,
  shot: Shot,
): IdentityRef[] {
  // Find every beat this shot covers.
  const beatIds = new Set(shot.beatRefs);
  const beats = doc.scenes.flatMap((s) => s.beats).filter((b) => beatIds.has(b.id));

  // Collect distinct character ids from the beats.
  const characterIds: string[] = [];
  for (const b of beats) {
    if (b.characterId && !characterIds.includes(b.characterId)) {
      characterIds.push(b.characterId);
    }
  }

  // Materialize identity packs in role-priority order.
  const rolePriority: Record<string, number> = {
    protagonist: 0,
    antagonist: 1,
    supporting: 2,
    narrator: 3,
    ensemble: 4,
  };

  const refs: IdentityRef[] = [];
  for (const id of characterIds) {
    const c = doc.cast.find((ch) => ch.id === id);
    if (!c) continue;
    if (!c.identityDNA && !c.referenceImageUrl) continue;
    refs.push({
      characterId: c.id,
      characterName: c.name,
      identityDNA: c.identityDNA ?? buildIdentityDNAFromCharacter(c),
      referenceImageUrl: c.referenceImageUrl,
    });
  }

  return refs.sort(
    (a, b) =>
      (rolePriority[
        doc.cast.find((c) => c.id === a.characterId)?.role ?? "supporting"
      ] ?? 99) -
      (rolePriority[
        doc.cast.find((c) => c.id === b.characterId)?.role ?? "supporting"
      ] ?? 99),
  );
}

/** Distill an identityDNA on the fly when the character doesn't have
 *  one stored. Aggregates physical description + wardrobe into a
 *  single compact string suitable for prompt weaving. */
function buildIdentityDNAFromCharacter(c: {
  name: string;
  description: string;
  physicalDescription?: string;
  wardrobe?: string;
}): string {
  const parts: string[] = [];
  if (c.physicalDescription) parts.push(c.physicalDescription);
  if (c.wardrobe) parts.push(`wearing ${c.wardrobe}`);
  if (c.description) parts.push(c.description);
  if (parts.length === 0) parts.push(c.name);
  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Pose chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a pose hint sentence describing how a character should
 * carry over from the previous shot. Heuristic — we can't infer
 * actual pose without a vision model, so we describe the last
 * frame's framing + camera direction as a hint.
 *
 * Example output:
 *   "Pose continuity: the protagonist's body position picks up
 *   exactly where the medium close-up left off — facing camera-
 *   right with hands resting at her sides."
 */
export function poseLockHint(
  doc: ScriptDocument,
  shot: Shot,
): string | null {
  const prev = resolvePreviousShot(doc, shot.id);
  if (!prev) return null;

  // Only worth a pose hint when an identical character spans both
  // shots — otherwise pose continuity isn't a thing.
  const prevChars = new Set(
    doc.scenes
      .flatMap((s) => s.beats)
      .filter((b) => prev.beatRefs.includes(b.id) && b.characterId)
      .map((b) => b.characterId as string),
  );
  const thisChars = doc.scenes
    .flatMap((s) => s.beats)
    .filter((b) => shot.beatRefs.includes(b.id) && b.characterId)
    .map((b) => b.characterId as string);

  const shared = thisChars.find((id) => prevChars.has(id));
  if (!shared) return null;

  const ch = doc.cast.find((c) => c.id === shared);
  const name = ch?.name ?? "the character";

  return `Pose continuity: ${name}'s body position picks up exactly where the previous ${prev.framing} shot ended. Maintain hand position, gaze direction, and posture.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite — build the full chain context for a shot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bundle every chain lookup for a single shot. Called by the
 * pipeline immediately before `buildEngineInput`.
 */
export function buildChainContext(
  doc: ScriptDocument,
  shotId: string,
): ChainContext {
  const flat = doc.scenes.flatMap((s) => s.shots);
  const me = flat.find((s) => s.id === shotId);
  if (!me) {
    return { previousShot: null, identityRefs: [] };
  }

  const prev = resolvePreviousShot(doc, shotId);

  return {
    previousShot: prev
      ? {
          shotId: prev.id,
          lastFrameUrl: prev.generated?.lastFrameUrl,
          videoUrl: prev.generated?.videoUrl,
        }
      : null,
    identityRefs: identityRefsForShot(doc, me),
  };
}
