/**
 * VoiceBlueprint — the unified rich voice schema for /training-video.
 *
 * Wraps the MiniMax TTS catalog with persona + use-case metadata so
 * users can pick the right voice for the right scene instead of
 * guessing from a generic "Confident woman" label.
 *
 * Each blueprint declares:
 *   • The frontend id (used in URL params + the edge function payload)
 *   • The MiniMax voice ID (sent to Replicate)
 *   • Persona group (Professional / Conversational / Energetic / Authoritative / Narrative)
 *   • Gender, accent, age range, emotional default
 *   • Use cases ("Corporate training", "Podcast intro", "Audiobook narration")
 *   • A signature sample line that demonstrates the voice's character
 *   • Pairing hints (which scenes / characters this voice loves)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Persona groups — drives the rails on the Voice step
// ─────────────────────────────────────────────────────────────────────────────
export type VoicePersonaGroup =
  | "professional"     // corporate, training, presentation
  | "conversational"   // warm, intimate, vlog
  | "energetic"        // upbeat, sales, social media
  | "authoritative"    // deep, commanding, prestige
  | "narrative";       // storytelling, documentary, audiobook

export const VOICE_PERSONA_LABELS: Record<VoicePersonaGroup, string> = {
  professional:   "Professional & Corporate",
  conversational: "Warm & Conversational",
  energetic:      "Energetic & Upbeat",
  authoritative:  "Authoritative & Commanding",
  narrative:      "Narrative & Storytelling",
};

export const VOICE_PERSONA_SHORT: Record<VoicePersonaGroup, string> = {
  professional:   "Professional",
  conversational: "Conversational",
  energetic:      "Energetic",
  authoritative:  "Authoritative",
  narrative:      "Narrative",
};

// ─────────────────────────────────────────────────────────────────────────────
// Other taxonomies
// ─────────────────────────────────────────────────────────────────────────────
export type VoiceGender = "female" | "male" | "neutral";

export type VoiceAgeRange = "young-adult" | "adult" | "mature" | "senior";

export const VOICE_AGE_LABELS: Record<VoiceAgeRange, string> = {
  "young-adult": "Young adult",
  "adult":       "Adult",
  "mature":      "Mature",
  "senior":      "Senior",
};

export type VoiceAccent =
  | "american-neutral" | "american-warm" | "american-energetic"
  | "british-rp" | "british-modern"
  | "neutral-cinematic";

export const VOICE_ACCENT_LABELS: Record<VoiceAccent, string> = {
  "american-neutral":   "American · neutral",
  "american-warm":      "American · warm",
  "american-energetic": "American · energetic",
  "british-rp":         "British · RP",
  "british-modern":     "British · modern",
  "neutral-cinematic":  "Neutral · cinematic",
};

export type VoicePacing = "slow" | "measured" | "natural" | "punchy" | "rapid";

export const VOICE_PACING_LABELS: Record<VoicePacing, string> = {
  slow:     "Slow & deliberate",
  measured: "Measured",
  natural:  "Natural",
  punchy:   "Punchy",
  rapid:    "Rapid",
};

export type VoiceEmotionalDefault =
  | "calm" | "warm" | "confident" | "playful"
  | "intense" | "mysterious" | "joyful" | "contemplative";

export const VOICE_EMOTION_LABELS: Record<VoiceEmotionalDefault, string> = {
  calm:           "Calm",
  warm:           "Warm",
  confident:      "Confident",
  playful:        "Playful",
  intense:        "Intense",
  mysterious:     "Mysterious",
  joyful:         "Joyful",
  contemplative:  "Contemplative",
};

// Common use cases — surfaced as chips on the voice card + drawer
export type VoiceUseCase =
  | "corporate-training" | "product-demo" | "course-narration" | "presentation"
  | "podcast-intro" | "vlog-vo" | "social-vo"
  | "ad-spot" | "sales-pitch" | "explainer"
  | "audiobook" | "documentary" | "trailer" | "drama";

export const VOICE_USECASE_LABELS: Record<VoiceUseCase, string> = {
  "corporate-training": "Corporate training",
  "product-demo":       "Product demo",
  "course-narration":   "Course narration",
  "presentation":       "Presentation",
  "podcast-intro":      "Podcast intro",
  "vlog-vo":            "Vlog VO",
  "social-vo":          "Social VO",
  "ad-spot":            "Ad spot",
  "sales-pitch":        "Sales pitch",
  "explainer":          "Explainer",
  "audiobook":          "Audiobook",
  "documentary":        "Documentary",
  "trailer":            "Trailer",
  "drama":              "Drama",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE BLUEPRINT
// ─────────────────────────────────────────────────────────────────────────────
export interface VoiceBlueprint {
  // ── Identity ─────────────────────────────────────────────
  id: string;
  /** Display name shown on cards. */
  name: string;
  /** One-line persona description. */
  persona: string;
  /** Longer character bio for the detail drawer. */
  bio: string;

  // ── Backend wiring ───────────────────────────────────────
  /** The MiniMax voice ID — sent to the generate-voice edge function. */
  miniMaxVoiceId: string;

  // ── Categorization ───────────────────────────────────────
  group: VoicePersonaGroup;
  gender: VoiceGender;
  ageRange: VoiceAgeRange;
  accent: VoiceAccent;
  pacing: VoicePacing;
  emotionalDefault: VoiceEmotionalDefault;

  // ── Use cases this voice loves ───────────────────────────
  useCases: VoiceUseCase[];

  // ── Sample lines — what's spoken when previewing ─────────
  /** The default short line for the auto-preview cache (≤ 14 words). */
  sampleShort: string;
  /** A longer signature line for the detail drawer. */
  sampleLong: string;

  // ── Discovery ────────────────────────────────────────────
  isFeatured?: boolean;
  isNew?: boolean;

  // ── Pairing hints (forward-compat for cross-surface recs) ─
  pairsWithSceneWorlds?: string[];
  pairsWithCharacterArchetypes?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function groupVoicesByPersona(voices: VoiceBlueprint[]): Record<VoicePersonaGroup, VoiceBlueprint[]> {
  const groups: Record<VoicePersonaGroup, VoiceBlueprint[]> = {
    professional: [], conversational: [], energetic: [], authoritative: [], narrative: [],
  };
  for (const v of voices) groups[v.group].push(v);
  return groups;
}

/** Estimate speech duration in seconds from a word count using the voice's pacing. */
export function estimateSpeechSec(wordCount: number, pacing: VoicePacing): number {
  // Average WPM by pacing
  const wpm: Record<VoicePacing, number> = {
    slow: 110, measured: 130, natural: 150, punchy: 170, rapid: 195,
  };
  if (wordCount <= 0) return 0;
  return Math.round((wordCount / wpm[pacing]) * 60);
}
