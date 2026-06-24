/**
 * continuity/identity-bible — the spine of cross-film consistency.
 *
 * Every clip scores against the BIBLE (the original, approved
 * reference), never against its drifted neighbour. That single rule is
 * what turns an integrating error process ("copy of a copy") into a
 * bounded one. The bible is built once in Phase A, validated in Phase
 * C, versioned, and carried forward to every clip.
 *
 * Pure. No IO.
 */

export type CharacterRole =
  | "protagonist"
  | "antagonist"
  | "supporting"
  | "narrator"
  | "ensemble";

/** One character's locked identity. */
export interface BibleCharacter {
  characterId: string;
  name: string;
  role: CharacterRole;
  /** The ONE approved reference still every clip is matched against. */
  canonicalStillUrl?: string;
  /** Face embedding for cosine scoring (filled by Phase A analysis). */
  faceEmbedding?: number[];
  /** Distilled identity prompt woven into every prompt featuring them. */
  identityDNA: string;
  wardrobeDNA?: string;
  hairDNA?: string;
  /** Negative directives that fight morphing ("face changing", etc.). */
  antiMorphPrompts: string[];
}

/** The film's locked visual style. */
export interface StyleAnchor {
  palette: string;
  grade: string;
  lens: string;
  /** Master colour histogram every clip's exposure is matched against. */
  masterHistogram?: number[];
}

export interface IdentityBible {
  characters: BibleCharacter[];
  style: StyleAnchor;
  /** Bumped on any re-lock. Each clip records which version it matched
   *  so a mid-film bible change can invalidate just the affected clips. */
  version: number;
}

/** A locked still at a shot boundary — the storyboard skeleton. */
export interface Anchor {
  shotId: string;
  position: "start" | "end";
  stillUrl: string;
  bibleVersion: number;
  /** Identity/colour score at lock time (Phase C). */
  skeletonScore: number;
  locked: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construction
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_PRIORITY: Record<CharacterRole, number> = {
  protagonist: 0,
  antagonist: 1,
  supporting: 2,
  narrator: 3,
  ensemble: 4,
};

const DEFAULT_ANTI_MORPH = [
  "character morphing",
  "face changing between frames",
  "shifting facial features",
  "inconsistent wardrobe",
  "changing hair",
];

/** Minimal character facts the bible builder needs — decoupled from
 *  the full ScriptDocument Character so this stays pure + testable. */
export interface BibleCharacterInput {
  characterId: string;
  name: string;
  role?: CharacterRole;
  description?: string;
  physicalDescription?: string;
  wardrobe?: string;
  identityDNA?: string;
  referenceImageUrl?: string;
  faceEmbedding?: number[];
}

/** Distil an identityDNA string from a character when none is stored. */
export function distillIdentityDNA(c: BibleCharacterInput): string {
  const parts: string[] = [];
  if (c.physicalDescription) parts.push(c.physicalDescription);
  if (c.wardrobe) parts.push(`wearing ${c.wardrobe}`);
  if (c.description) parts.push(c.description);
  if (parts.length === 0) parts.push(c.name);
  return parts.join(", ");
}

/**
 * Build the identity bible from the cast. Characters are ordered by
 * role priority (protagonists first) because most engines weight
 * earlier references more heavily.
 */
export function buildIdentityBible(
  cast: BibleCharacterInput[],
  style: StyleAnchor,
  version = 1,
): IdentityBible {
  const characters: BibleCharacter[] = cast
    .map((c) => ({
      characterId: c.characterId,
      name: c.name,
      role: c.role ?? "supporting",
      canonicalStillUrl: c.referenceImageUrl,
      faceEmbedding: c.faceEmbedding,
      identityDNA: c.identityDNA?.trim() || distillIdentityDNA(c),
      wardrobeDNA: c.wardrobe,
      antiMorphPrompts: [...DEFAULT_ANTI_MORPH],
    }))
    .sort((a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role]);

  return { characters, style, version };
}

/** Resolve the bible entries for a set of character ids, in role
 *  priority order. Used to weave the identity lock for a single shot. */
export function bibleEntriesFor(
  bible: IdentityBible,
  characterIds: string[],
): BibleCharacter[] {
  const want = new Set(characterIds);
  return bible.characters.filter((c) => want.has(c.characterId));
}

/**
 * Validate + repair a bible (mirrors anchor-failsafes.validateIdentityBible
 * on the edge side, but client-pure). Guarantees every character has an
 * identityDNA + anti-morph prompts so a downstream prompt is never empty.
 */
export function validateBible(bible: IdentityBible): {
  valid: boolean;
  errors: string[];
  fixed: IdentityBible;
} {
  const errors: string[] = [];
  const characters = bible.characters.map((c) => {
    const fixed = { ...c };
    if (!fixed.identityDNA || fixed.identityDNA.trim().length < 3) {
      errors.push(`character ${c.name}: empty identityDNA`);
      fixed.identityDNA = c.name;
    }
    if (!fixed.antiMorphPrompts || fixed.antiMorphPrompts.length === 0) {
      errors.push(`character ${c.name}: missing anti-morph prompts`);
      fixed.antiMorphPrompts = [...DEFAULT_ANTI_MORPH];
    }
    if (!fixed.canonicalStillUrl && !fixed.faceEmbedding) {
      // Not fatal — text-only identity still works — but flag it so
      // the UI can prompt the creator to add a reference.
      errors.push(`character ${c.name}: no visual anchor (still or embedding)`);
    }
    return fixed;
  });
  return {
    valid: errors.length === 0,
    errors,
    fixed: { ...bible, characters },
  };
}
