/**
 * CharacterBlueprint — the schema for stock training-video presenters.
 *
 * Used alongside the user-upload + webcam-capture paths in the Character
 * step. Each archetype is a curated stock avatar that pairs well with
 * specific voice persona groups and scene worlds — so the wizard can
 * suggest "for this character, try this voice + this scene."
 */
import type { VoicePersonaGroup, VoiceUseCase } from "@/lib/voices/blueprint";
import type { SceneWorld } from "./scene-blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// Archetypes — drives the rail grouping in the Character step
// ─────────────────────────────────────────────────────────────────────────────
export type CharacterArchetype =
  | "executive"        // c-suite, board, prestige
  | "trainer"          // L&D, corporate trainer, course instructor
  | "creator"          // content creator, vlogger, podcaster
  | "presenter"        // tv/news anchor, host
  | "educator";        // teacher, professor, academic

export const CHARACTER_ARCHETYPE_LABELS: Record<CharacterArchetype, string> = {
  executive:  "Executives & Leaders",
  trainer:    "Trainers & Coaches",
  creator:    "Creators & Hosts",
  presenter:  "Anchors & Presenters",
  educator:   "Educators & Academics",
};

export const CHARACTER_ARCHETYPE_SHORT: Record<CharacterArchetype, string> = {
  executive: "Executive",
  trainer:   "Trainer",
  creator:   "Creator",
  presenter: "Presenter",
  educator:  "Educator",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE BLUEPRINT
// ─────────────────────────────────────────────────────────────────────────────
export interface CharacterBlueprint {
  id: string;
  name: string;
  /** Stock reference image URL (Unsplash CDN, royalty-free). */
  image: string;
  /** One-line persona summary. */
  persona: string;
  /** Long bio shown in the detail drawer. */
  bio: string;

  archetype: CharacterArchetype;

  // ── Visual identity (used by the character compositing pipeline) ──
  /** Hair / wardrobe / vibe hint sent to FLUX Fill as styling guidance. */
  styleNote: string;

  // ── Pairing hints (drive the wizard's recommendations) ──────────
  pairsWithVoiceGroups: VoicePersonaGroup[];
  pairsWithSceneWorlds: SceneWorld[];
  useCases: VoiceUseCase[];

  // ── Discovery ──
  isFeatured?: boolean;
  isNew?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10 STOCK AVATARS — Unsplash CDN (same delivery pattern as
// environment-extensions.ts). Each photo ID hand-matched to the archetype.
// ─────────────────────────────────────────────────────────────────────────────
const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=78&auto=format&fit=crop&crop=faces`;

export const CHARACTER_BLUEPRINTS: CharacterBlueprint[] = [
  // ── EXECUTIVES & LEADERS ──────────────────────────────────────
  {
    id: "elena-chen",
    name: "Elena Chen",
    image: u("1573496359142-b8d87734a5a2"),
    persona: "CEO archetype · poised, decisive, charismatic",
    bio: "Elena reads as the founder who can pitch to a boardroom one hour and a 10,000-person conference the next. Tailored, composed, but always warm enough to disarm. Best for keynote videos, all-hands openers, recruitment films.",
    archetype: "executive",
    styleNote: "Tailored blazer, structured hair, neutral or jewel-tone wardrobe, calm direct gaze.",
    pairsWithVoiceGroups: ["professional", "authoritative"],
    pairsWithSceneWorlds: ["corporate", "studio"],
    useCases: ["presentation", "corporate-training", "ad-spot", "trailer"],
    isFeatured: true,
  },
  {
    id: "marcus-blackwood",
    name: "Marcus Blackwood",
    image: u("1560250097-0b93528c311a"),
    persona: "Executive director · seasoned authority",
    bio: "Marcus is the kind of leader people stand up for in a meeting. Silver hair, dark suit, unhurried delivery. Best for legacy-brand films, prestige documentaries, end-of-year addresses.",
    archetype: "executive",
    styleNote: "Dark tailored suit, silver-touched hair, classical gentleman vibe, unhurried expression.",
    pairsWithVoiceGroups: ["authoritative", "narrative"],
    pairsWithSceneWorlds: ["corporate", "studio"],
    useCases: ["presentation", "documentary", "trailer"],
  },

  // ── TRAINERS & COACHES ──────────────────────────────────────
  {
    id: "priya-rao",
    name: "Priya Rao",
    image: u("1580489944761-15a19d654956"),
    persona: "Corporate trainer · warm, clear, encouraging",
    bio: "Priya is the L&D lead every team wants. Approachable, articulate, brilliant at making dense material feel doable. Best for onboarding flows, compliance modules, soft-skills training.",
    archetype: "trainer",
    styleNote: "Smart-casual blouse, natural hair, friendly direct gaze, hand gestures suggested.",
    pairsWithVoiceGroups: ["professional", "conversational"],
    pairsWithSceneWorlds: ["studio", "education", "corporate"],
    useCases: ["corporate-training", "course-narration", "explainer"],
    isFeatured: true,
  },
  {
    id: "daniel-kane",
    name: "Daniel Kane",
    image: u("1507003211169-0a1dd7228f2d"),
    persona: "Fitness + life coach · energetic and direct",
    bio: "Daniel sounds like the trainer who actually gets you moving. Fit, modern wardrobe, high-energy delivery without losing warmth. Best for wellness content, productivity courses, sales training.",
    archetype: "trainer",
    styleNote: "Modern athleisure or fitted henley, fit physique, energetic posture, confident smile.",
    pairsWithVoiceGroups: ["energetic", "conversational"],
    pairsWithSceneWorlds: ["studio", "lifestyle"],
    useCases: ["course-narration", "vlog-vo", "social-vo"],
  },

  // ── CREATORS & HOSTS ─────────────────────────────────────────
  {
    id: "maya-thompson",
    name: "Maya Thompson",
    image: u("1494790108377-be9c29b29330"),
    persona: "Lifestyle creator · radiant, relatable, fashion-forward",
    bio: "Maya is the influencer everyone wants to collab with. Bright energy, on-trend wardrobe, talks to camera like a friend. Best for product reviews, beauty content, lifestyle vlogs.",
    archetype: "creator",
    styleNote: "On-trend wardrobe, natural makeup, radiant smile, casual but polished hair.",
    pairsWithVoiceGroups: ["energetic", "conversational"],
    pairsWithSceneWorlds: ["lifestyle", "studio"],
    useCases: ["vlog-vo", "social-vo", "ad-spot"],
    isFeatured: true,
  },
  {
    id: "jordan-pierce",
    name: "Jordan Pierce",
    image: u("1492562080023-ab3db95bfbce"),
    persona: "Podcast host · thoughtful and conversational",
    bio: "Jordan reads as the podcast host who actually listens. Warm, considered delivery, the kind of person who can make a deep-cut topic sound like the most interesting thing you'll hear all week.",
    archetype: "creator",
    styleNote: "Crisp button-down or knit, glasses optional, intelligent eyes, slightly tilted head.",
    pairsWithVoiceGroups: ["conversational", "narrative"],
    pairsWithSceneWorlds: ["studio", "lifestyle"],
    useCases: ["podcast-intro", "audiobook", "vlog-vo"],
  },

  // ── ANCHORS & PRESENTERS ────────────────────────────────────
  {
    id: "alex-rivera",
    name: "Alex Rivera",
    image: u("1519085360753-af0119f7cbe7"),
    persona: "News anchor · authoritative and articulate",
    bio: "Alex is built for the broadcast desk. Sharp tailored wardrobe, measured eye contact, the cadence of someone who's delivered a thousand lead stories. Best for news, weekly recaps, executive updates.",
    archetype: "presenter",
    styleNote: "Sharp tailored blazer or suit jacket, news-desk-ready hair, measured authoritative gaze.",
    pairsWithVoiceGroups: ["professional", "authoritative"],
    pairsWithSceneWorlds: ["studio", "corporate"],
    useCases: ["presentation", "corporate-training", "documentary"],
  },
  {
    id: "sara-kim",
    name: "Sara Kim",
    image: u("1438761681033-6461ffad8d80"),
    persona: "TV host · poised and luminous",
    bio: "Sara holds the camera the way only a seasoned host can. Bright but composed, the warmth dialed up to just-this-side-of-formal. Best for awards intros, premium brand films, talk-show segments.",
    archetype: "presenter",
    styleNote: "Elegant blouse or dress, polished hair, luminous warm smile, prestige TV-host energy.",
    pairsWithVoiceGroups: ["professional", "conversational"],
    pairsWithSceneWorlds: ["studio", "corporate", "lifestyle"],
    useCases: ["ad-spot", "presentation", "trailer"],
  },

  // ── EDUCATORS & ACADEMICS ───────────────────────────────────
  {
    id: "dr-patel",
    name: "Dr. Patel",
    image: u("1559548331-f9cb98001426"),
    persona: "University professor · thoughtful, articulate, expert",
    bio: "Dr. Patel is the professor whose office hours actually fill up. Cardigan-level approachable but rigorously thoughtful, the kind of educator who can simplify without dumbing down.",
    archetype: "educator",
    styleNote: "Cardigan or blazer over shirt, glasses, intelligent expression, slight contemplative head tilt.",
    pairsWithVoiceGroups: ["professional", "narrative"],
    pairsWithSceneWorlds: ["education", "studio", "corporate"],
    useCases: ["course-narration", "documentary", "explainer"],
  },
  {
    id: "ms-okafor",
    name: "Ms. Okafor",
    image: u("1573497019940-1c28c88b4f3e"),
    persona: "K-12 teacher · warm, encouraging, deeply patient",
    bio: "Ms. Okafor is every favorite teacher you ever had. Bright wardrobe, generous smile, a delivery that telegraphs she has all day to make sure you understand. Best for educational content, kids' explainers, parent-facing courses.",
    archetype: "educator",
    styleNote: "Bright friendly wardrobe, warm wide smile, gentle direct gaze, approachable energy.",
    pairsWithVoiceGroups: ["conversational", "professional"],
    pairsWithSceneWorlds: ["education"],
    useCases: ["course-narration", "explainer"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export function getAllCharacters(): CharacterBlueprint[] {
  return CHARACTER_BLUEPRINTS;
}

export function getCharacter(id: string): CharacterBlueprint | undefined {
  return CHARACTER_BLUEPRINTS.find(c => c.id === id);
}

export function groupCharactersByArchetype(): Record<CharacterArchetype, CharacterBlueprint[]> {
  const groups: Record<CharacterArchetype, CharacterBlueprint[]> = {
    executive: [], trainer: [], creator: [], presenter: [], educator: [],
  };
  for (const c of CHARACTER_BLUEPRINTS) groups[c.archetype].push(c);
  return groups;
}
